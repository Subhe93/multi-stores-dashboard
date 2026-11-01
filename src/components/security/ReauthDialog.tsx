'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2, LockKeyhole, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { errorCode, lockedMinutes, sanitizeTotp, type ReauthCredentials } from '@/lib/twoFactor';

/** The protected action: runs with the credentials, throws on failure. */
export type ReauthAction = (credentials: ReauthCredentials) => Promise<void>;

interface ReauthDialogProps {
  /** Action to confirm; null keeps the dialog closed. */
  action: ReauthAction | null;
  onClose: () => void;
  description?: string;
  /** Where the "set up two-step verification" button leads (REAUTH_2FA_REQUIRED). */
  twoFactorSetupHref?: string;
  /** Called before scrolling to the 2FA card (e.g. to switch to its tab). */
  onSetupTwoFactor?: () => void;
  /** Overrides the REAUTH_2FA_REQUIRED explanation (default: payment keys). */
  setupMessage?: string;
}

/**
 * Asks for the current password (and the authenticator code when the account
 * has two-factor authentication) before a payment-credential change. Errors
 * stay inside the dialog so the user can correct and retry.
 */
export function ReauthDialog({ action, onClose, description, twoFactorSetupHref = '#two-factor', onSetupTwoFactor, setupMessage }: ReauthDialogProps) {
  const t = useTranslations('security.reauth');
  const apiError = useApiError();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  // Shown when the profile says 2FA is on, or once the API asked for a code.
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = action !== null;
  const showCode = !!user?.two_factor_enabled || codeRequested;

  // Fresh form every time the dialog opens.
  useEffect(() => {
    if (open) {
      setPassword('');
      setCode('');
      setError('');
      setNeedsSetup(false);
      setCodeRequested(false);
    }
  }, [open]);

  const submit = async () => {
    if (!action || busy) return;
    if (!password) {
      setError(t('passwordRequired'));
      return;
    }
    if (showCode && code.length !== 6) {
      setError(t('codeRequired'));
      return;
    }
    setBusy(true);
    setError('');
    setNeedsSetup(false);
    try {
      await action({ current_password: password, ...(showCode && code ? { totp_code: code } : {}) });
      onClose();
    } catch (err) {
      const c = errorCode(err);
      const minutes = lockedMinutes(err);
      if (c === 'REAUTH_2FA_REQUIRED') setNeedsSetup(true);
      if (c === 'TWO_FACTOR_CODE_INVALID') {
        setCodeRequested(true);
        setCode('');
      }
      if (c === 'REAUTH_PASSWORD_INVALID') setPassword('');
      setError(minutes !== null ? t('locked', { minutes }) : apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
              <LockKeyhole className="size-4.5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{description || t('description')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="reauth-password" className="text-xs">{t('password')}</Label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          {showCode && (
            <div className="space-y-1.5">
              <Label htmlFor="reauth-code" className="text-xs">{t('code')}</Label>
              <Input
                id="reauth-code"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(sanitizeTotp(e.target.value))}
                placeholder="123456"
                className="h-9 font-mono tracking-[0.3em] placeholder:tracking-normal"
              />
              <p className="text-[11px] text-muted-foreground">{t('codeHint')}</p>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {needsSetup && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <div className="space-y-2">
                <p>{setupMessage || t('setupRequired')}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 bg-white"
                  onClick={() => {
                    onClose();
                    onSetupTwoFactor?.();
                    const id = twoFactorSetupHref.replace(/^#/, '');
                    // Next frame: a tab switch may need to mount the card first.
                    requestAnimationFrame(() =>
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    );
                  }}
                >
                  {t('setupButton')}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * State helper: `request(action, description?)` opens the dialog for that
 * action; render `dialog` once in the page.
 */
export function useReauth(options: { twoFactorSetupHref?: string; onSetupTwoFactor?: () => void } = {}): {
  request: (action: ReauthAction, description?: string) => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{ action: ReauthAction; description?: string } | null>(null);
  const request = useCallback(
    (action: ReauthAction, description?: string) => setPending({ action, description }),
    [],
  );
  const close = useCallback(() => setPending(null), []);
  const dialog = (
    <ReauthDialog
      action={pending?.action ?? null}
      onClose={close}
      description={pending?.description}
      twoFactorSetupHref={options.twoFactorSetupHref}
      onSetupTwoFactor={options.onSetupTwoFactor}
    />
  );
  return { request, dialog };
}
