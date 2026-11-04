'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ACCESS_TOKEN_KEY, AUTH_TOKEN_EVENT, LEGACY_REFRESH_KEY, api } from './api';
import { clearCachedStoreApps } from './useStoreApps';
import { roleHomePath } from './magicLogin';

export interface ProviderProfile {
  id: string;
  company_name?: string | null;
  description?: string | null;
  phone?: string | null;
  country?: string | null;
  verified?: boolean;
  /** GET /providers/me: products stay hidden from stores until verified while true. */
  approval_required?: boolean;
}

/** Sign-up card + survey answers (SPEC §1 `Creator.onboarding_profile`). */
export interface OnboardingProfile {
  account_kind?: 'independent' | 'marketplace';
  sells?: 'own' | 'suppliers' | 'both';
  stage?: 'starting' | 'selling_online' | 'physical_shop' | 'agency';
  country?: string;
  completed_at?: string;
}

export interface CreatorProfile {
  id: string;
  display_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  verified?: boolean;
  onboarding_profile?: OnboardingProfile | null;
}

export interface CustomerProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  addresses?: Array<Record<string, unknown>>;
}

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'PROVIDER' | 'CREATOR' | 'CUSTOMER';
  status: string;
  provider?: ProviderProfile | null;
  creator?: CreatorProfile | null;
  customer?: CustomerProfile | null;
  /** True when the account signs in with an authenticator code (GET /auth/me). */
  two_factor_enabled?: boolean;
  /** When the email was verified; null while the account is still PENDING (GET /auth/me). */
  email_verified_at?: string | null;
  /** End of the unverified grace period (created_at + 7 days) while PENDING, else null. */
  verification_deadline?: string | null;
  created_at?: string;
}

/** Body returned by /auth/login and /auth/magic-login. The refresh token
 *  normally stays in the httpOnly cookie; only an older API returns it here. */
export interface AuthTokens {
  user: User;
  access_token: string;
  refresh_token?: string;
}

/** Keep the access token; a body refresh token only from an older API. */
function storeTokens(data: { access_token: string; refresh_token?: string }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) localStorage.setItem(LEGACY_REFRESH_KEY, data.refresh_token);
  else localStorage.removeItem(LEGACY_REFRESH_KEY);
}

/** Returned by /auth/login and /auth/magic-login instead of tokens when the
 *  account has two-factor authentication: a code is still needed. */
export interface TwoFactorChallenge {
  requires_2fa: true;
  challenge_token: string;
  expires_in: number;
}

export function isTwoFactorChallenge(data: unknown): data is TwoFactorChallenge {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as { requires_2fa?: unknown }).requires_2fa === true &&
    typeof (data as { challenge_token?: unknown }).challenge_token === 'string'
  );
}

/** Outcome of a password login: signed in, or a second step is needed. */
export type LoginResult =
  | { status: 'signed_in' }
  | { status: 'two_factor'; challenge: string };

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithTokens: (data: AuthTokens) => Promise<void>;
  /** Finish a 2FA sign-in with an authenticator or recovery code. */
  verifyTwoFactorLogin: (challenge: string, code: string) => Promise<void>;
  /** Reload /auth/me (e.g. after two-factor authentication was turned on/off). */
  refreshProfile: () => Promise<void>;
  /** Swap in a fresh token pair for the signed-in account (change-password
   *  returns one: the API revokes every token issued before the change). */
  replaceTokens: (data: { access_token: string; refresh_token?: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // A silent refresh (api.ts, after a 401) swapped the access token.
  useEffect(() => {
    const onToken = (e: Event) => setToken((e as CustomEvent<string>).detail);
    window.addEventListener(AUTH_TOKEN_EVENT, onToken);
    return () => window.removeEventListener(AUTH_TOKEN_EVENT, onToken);
  }, []);

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) {
      setToken(stored);
      fetchProfile(stored);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async (accessToken: string) => {
    try {
      const profile = await api<User>('/auth/me', { token: accessToken });
      setUser(profile);
      // A 401 may have been healed by a silent refresh: use the stored token.
      setToken(localStorage.getItem(ACCESS_TOKEN_KEY) ?? accessToken);
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(LEGACY_REFRESH_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Shared by password login and the one-click (magic link) login: store the
  // tokens, load the full profile, then redirect by role.
  const loginWithTokens = useCallback(async (data: AuthTokens) => {
    storeTokens(data);
    setToken(data.access_token);
    // The login response carries only id/email/role/status; pages need the
    // full profile (creator/provider ids), so load it before redirecting.
    let profile: User = data.user;
    try {
      profile = await api<User>('/auth/me', { token: data.access_token });
    } catch {
      // Keep the minimal user; a reload fetches the profile again.
    }
    setUser(profile);

    // Redirect based on role
    router.push(roleHomePath(data.user.role) || '/');
  }, [router]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const data = await api<AuthTokens | TwoFactorChallenge>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (isTwoFactorChallenge(data)) {
      return { status: 'two_factor', challenge: data.challenge_token };
    }
    await loginWithTokens(data);
    return { status: 'signed_in' };
  }, [loginWithTokens]);

  const verifyTwoFactorLogin = useCallback(async (challenge: string, code: string) => {
    const data = await api<AuthTokens>('/auth/2fa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ challenge_token: challenge, code }),
    });
    await loginWithTokens(data);
  }, [loginWithTokens]);

  const refreshProfile = useCallback(async () => {
    const current = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!current) return;
    try {
      const profile = await api<User>('/auth/me', { token: current });
      setUser(profile);
    } catch {
      // Keep the current profile; the next page load fetches it again.
    }
  }, []);

  const replaceTokens = useCallback((data: { access_token: string; refresh_token?: string }) => {
    storeTokens(data);
    setToken(data.access_token);
  }, []);

  const logout = useCallback(() => {
    // Revoke the session on the API (fire and forget: local sign-out never
    // waits on the network). The API revokes the refresh token from the
    // cookie (or a legacy stored one) and clears the cookie.
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(LEGACY_REFRESH_KEY);
    if (accessToken) {
      void api('/auth/logout', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
        keepalive: true,
      }).catch(() => {
        // Already expired or offline: local state is cleared regardless.
      });
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
    // Clear the session-scoped store-type cache (written by useStoreType) so
    // the next login doesn't render the previous account's sidebar layout.
    try {
      sessionStorage.removeItem('ms-creator-store-type');
    } catch {
      // Storage may be unavailable; the cache is best-effort anyway.
    }
    // Same for the store-apps cache (written by useStoreApps).
    clearCachedStoreApps();
    setToken(null);
    setUser(null);
    router.push('/auth/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithTokens, verifyTwoFactorLogin, refreshProfile, replaceTokens, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
