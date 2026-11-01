'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorCode } from '@/lib/twoFactor';
import { ReauthDialog, type ReauthAction } from './ReauthDialog';

/** Thrown by `ensure()` when the admin closes the dialog without confirming. */
export class ReauthCancelled extends Error {
  constructor() {
    super('Re-authentication cancelled');
    this.name = 'ReauthCancelled';
  }
}

interface Grant {
  token: string;
  /** ms epoch; refreshed a little early so a request never races expiry. */
  expiresAt: number;
}

const EARLY_MS = 20_000;

/**
 * "Sudo mode" for admin user management (API: POST /admin/reauth). One
 * confirmation — password + 2FA — gives a grant for 5 minutes, so bulk
 * actions work although each 2FA code is single-use. Kept in memory only.
 *
 *   const grant = useAdminGrant();
 *   await grant.run((reauth_token) => api(..., { body: { ..., reauth_token } }));
 *   {grant.dialog}
 */
export function useAdminGrant(): {
  ensure: () => Promise<string>;
  run: <T>(fn: (reauthToken: string) => Promise<T>) => Promise<T>;
  dialog: ReactNode;
} {
  const t = useTranslations('security.reauth');
  const router = useRouter();
  const { token } = useAuth();
  const grantRef = useRef<Grant | null>(null);
  const pendingRef = useRef<Promise<string> | null>(null);
  const settleRef = useRef<{ resolve: (v: string) => void; reject: (e: unknown) => void } | null>(null);
  const [action, setAction] = useState<ReauthAction | null>(null);

  const ensure = useCallback((): Promise<string> => {
    const g = grantRef.current;
    if (g && g.expiresAt - EARLY_MS > Date.now()) return Promise.resolve(g.token);
    // Parallel callers (bulk actions) share one dialog.
    if (pendingRef.current) return pendingRef.current;
    const pending = new Promise<string>((resolve, reject) => {
      settleRef.current = { resolve, reject };
    });
    pendingRef.current = pending;
    setAction(() => async (credentials: { current_password: string; totp_code?: string }) => {
      const res = await api<{ reauth_token: string; expires_in: number }>('/admin/reauth', {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify(credentials),
      });
      grantRef.current = { token: res.reauth_token, expiresAt: Date.now() + res.expires_in * 1000 };
      settleRef.current?.resolve(res.reauth_token);
      settleRef.current = null;
      pendingRef.current = null;
    });
    return pending;
  }, [token]);

  const close = useCallback(() => {
    setAction(null);
    // Closed without a grant: release every waiting caller.
    if (settleRef.current) {
      settleRef.current.reject(new ReauthCancelled());
      settleRef.current = null;
      pendingRef.current = null;
    }
  }, []);

  const run = useCallback(
    async <T,>(fn: (reauthToken: string) => Promise<T>): Promise<T> => {
      try {
        return await fn(await ensure());
      } catch (err) {
        // The server no longer accepts the grant (expired, signed out
        // elsewhere): ask once more.
        if (errorCode(err) === 'REAUTH_REQUIRED') {
          grantRef.current = null;
          return fn(await ensure());
        }
        throw err;
      }
    },
    [ensure],
  );

  const dialog = (
    <ReauthDialog
      action={action}
      onClose={close}
      description={t('adminDescription')}
      setupMessage={t('setupRequiredAdmin')}
      onSetupTwoFactor={() => router.push('/admin/settings#two-factor')}
    />
  );

  return { ensure, run, dialog };
}
