'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'PROVIDER' | 'CREATOR' | 'CUSTOMER';
  status: string;
  provider?: any;
  creator?: any;
  customer?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
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
      setToken(accessToken);
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setToken(data.access_token);
    setUser(data.user);

    // Redirect based on role
    const roleRoutes: Record<string, string> = {
      ADMIN: '/admin',
      PROVIDER: '/provider',
      CREATOR: '/creator',
    };
    router.push(roleRoutes[data.user.role] || '/');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    router.push('/auth/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
