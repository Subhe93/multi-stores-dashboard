'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MailWarning, Send } from 'lucide-react';
import { api, ApiError, API_ERROR_EVENT } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { isUnverifiedCode, needsEmailVerification, verificationDaysLeft } from '@/lib/storeStatus';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

/** The `POST /auth/resend-verification` call with the throttle translated. */
function useResendVerification() {
  const { token } = useAuth();
  const t = useTranslations('auth.unverified');
  const describe = useApiError();
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  const resend = useCallback(async () => {
    if (!token) return;
    setState({ kind: 'sending' });
    try {
      await api('/auth/resend-verification', { method: 'POST', token });
      setState({ kind: 'sent' });
    } catch (err) {
      const message = err instanceof ApiError && err.status === 429 ? t('throttled') : describe(err);
      setState({ kind: 'error', message });
    }
  }, [token, t, describe]);

  return { state, resend };
}

/**
 * Persistent banner for staff whose email is still unverified (SPEC §2):
 * what is locked, the days left of the grace period, and a resend button.
 * Rendered by the creator and provider layouts above the page content.
 */
export function UnverifiedBanner() {
  const { user } = useAuth();
  const t = useTranslations('auth.unverified');
  const { state, resend } = useResendVerification();
  if (!needsEmailVerification(user)) return null;

  const days = verificationDaysLeft(user?.verification_deadline);
  const expired = days === 0;

  return (
    <div
      id="verify-email"
      role="status"
      className={`mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center ${
        expired ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <MailWarning className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {expired
            ? t('expiredTitle')
            : user?.role === 'PROVIDER'
              ? t('titleProvider')
              : t('title')}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          {days != null && !expired && t('daysLeft', { days })}{' '}
          {t('sentTo', { email: user?.email ?? '' })}
        </p>
        {state.kind === 'sent' && <p className="mt-1 text-xs font-medium">{t('resent')}</p>}
        {state.kind === 'error' && <p className="mt-1 text-xs font-medium">{state.message}</p>}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 bg-white"
        onClick={resend}
        disabled={state.kind === 'sending'}
      >
        {state.kind === 'sending' ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        {t('resend')}
      </Button>
    </div>
  );
}

/**
 * Friendly dialog shown whenever any request fails with
 * ACCOUNT_EMAIL_UNVERIFIED / ACCOUNT_EMAIL_UNVERIFIED_EXPIRED (listens to the
 * `api()` error event), pointing at the banner with a resend button.
 */
export function VerifyEmailDialog() {
  const { user } = useAuth();
  const t = useTranslations('auth.unverified');
  const { state, resend } = useResendVerification();
  const [open, setOpen] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const onError = (e: Event) => {
      const err = (e as CustomEvent<ApiError>).detail;
      if (!isUnverifiedCode(err?.code)) return;
      setExpired(err.code === 'ACCOUNT_EMAIL_UNVERIFIED_EXPIRED');
      setOpen(true);
    };
    window.addEventListener(API_ERROR_EVENT, onError);
    return () => window.removeEventListener(API_ERROR_EVENT, onError);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expired ? t('dialogExpiredTitle') : t('dialogTitle')}</DialogTitle>
          <DialogDescription>
            {expired ? t('dialogExpiredBody') : t('dialogBody')} {t('sentTo', { email: user?.email ?? '' })}
          </DialogDescription>
        </DialogHeader>
        {state.kind === 'sent' && <p className="text-xs font-medium text-emerald-700">{t('resent')}</p>}
        {state.kind === 'error' && <p className="text-xs font-medium text-red-700">{state.message}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t('later')}
          </Button>
          <Button size="sm" onClick={resend} disabled={state.kind === 'sending'}>
            {state.kind === 'sending' ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {t('resend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
