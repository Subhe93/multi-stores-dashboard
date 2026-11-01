'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Check, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  downloadText,
  errorCode,
  isCodeOrRecovery,
  lockedMinutes,
  recoveryCodesText,
  sanitizeCodeOrRecovery,
  sanitizeTotp,
} from '@/lib/twoFactor';

interface TwoFactorStatus {
  enabled: boolean;
  enabled_at: string | null;
  recovery_codes_remaining: number;
}

interface SetupResponse {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

interface EnableResponse {
  recovery_codes: string[];
  access_token: string;
  refresh_token: string;
}

type Flow =
  | { kind: 'none' }
  | { kind: 'enable-password' }
  | { kind: 'enable-scan'; setup: SetupResponse }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'disable' }
  | { kind: 'regenerate' };

/** Few recovery codes left: nudge the user to generate new ones. */
const LOW_RECOVERY_CODES = 3;

/**
 * Two-factor authentication (TOTP) for the signed-in staff account: status,
 * set-up with QR code, recovery codes, regenerate and turn off.
 * Anchor id `two-factor` lets other screens link here.
 */
export function TwoFactorCard() {
  const t = useTranslations('security.twoFactor');
  const locale = useLocale();
  const apiError = useApiError();
  const { token, replaceTokens, refreshProfile } = useAuth();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [flow, setFlow] = useState<Flow>({ kind: 'none' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(false);
    try {
      setStatus(await api<TwoFactorStatus>('/auth/2fa', { token }));
    } catch {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (next: Flow) => {
    setFlow(next);
    setPassword('');
    setCode('');
    setError('');
    setSaved(false);
    setCopied(null);
  };

  const close = () => {
    if (busy) return;
    // Recovery codes are shown once; closing means the user is done with them.
    setFlow({ kind: 'none' });
    setPassword('');
    setCode('');
  };

  const fail = (err: unknown) => {
    const minutes = lockedMinutes(err);
    if (errorCode(err) === 'TWO_FACTOR_CODE_INVALID') setCode('');
    setError(minutes !== null ? t('locked', { minutes }) : apiError(err));
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      if (!password) throw { code: 'REAUTH_REQUIRED' };
      const setup = await api<SetupResponse>('/auth/2fa/setup', {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ current_password: password }),
      });
      setPassword('');
      setFlow({ kind: 'enable-scan', setup });
    });

  const confirmEnable = () =>
    run(async () => {
      const res = await api<EnableResponse>('/auth/2fa/enable', {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ code }),
      });
      // Enabling signs out every other session; keep this one going.
      replaceTokens({ access_token: res.access_token, refresh_token: res.refresh_token });
      setFlow({ kind: 'codes', codes: res.recovery_codes });
      await Promise.all([load(), refreshProfile()]);
    });

  const confirmDisable = () =>
    run(async () => {
      await api('/auth/2fa/disable', {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ current_password: password, code }),
      });
      setFlow({ kind: 'none' });
      await Promise.all([load(), refreshProfile()]);
    });

  const confirmRegenerate = () =>
    run(async () => {
      const res = await api<{ recovery_codes: string[] }>('/auth/2fa/recovery-codes', {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ current_password: password, code }),
      });
      setFlow({ kind: 'codes', codes: res.recovery_codes });
      await load();
    });

  const copy = async (text: string, which: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard may be blocked; the value stays visible to copy by hand.
    }
  };

  const enabled = !!status?.enabled;
  const lowCodes = enabled && (status?.recovery_codes_remaining ?? 0) <= LOW_RECOVERY_CODES;

  const passwordField = (
    <div className="space-y-1.5">
      <Label htmlFor="tfa-password" className="text-xs">{t('currentPassword')}</Label>
      <Input
        id="tfa-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-9"
        autoFocus
      />
    </div>
  );

  // With allowRecovery (turn off / new codes) a recovery code also works, so a
  // user who lost their phone and signed in with one is not stuck.
  const codeField = (autoFocus = false, allowRecovery = false) => (
    <div className="space-y-1.5">
      <Label htmlFor="tfa-code" className="text-xs">{t('code')}</Label>
      <Input
        id="tfa-code"
        dir="ltr"
        inputMode={allowRecovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoCapitalize={allowRecovery ? 'characters' : undefined}
        spellCheck={false}
        maxLength={allowRecovery ? 11 : 6}
        value={code}
        onChange={(e) =>
          setCode(allowRecovery ? sanitizeCodeOrRecovery(e.target.value) : sanitizeTotp(e.target.value))
        }
        placeholder={allowRecovery ? '123456 / XXXXX-XXXXX' : '123456'}
        className="h-9 font-mono tracking-[0.3em] placeholder:tracking-normal"
        autoFocus={autoFocus}
      />
    </div>
  );

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <span>{error}</span>
    </div>
  );

  return (
    <Card id="two-factor" className="shadow-none scroll-mt-20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
          {status && (
            <Badge
              variant="outline"
              className={`text-[10px] ${
                enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-600'
              }`}
            >
              {enabled ? t('statusOn') : t('statusOff')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('description')}</p>

        {loadError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
            <span>{t('loadFailed')}</span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => void load()}>
              {t('retry')}
            </Button>
          </div>
        ) : !status ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : enabled ? (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <div className="space-y-0.5">
                <p>
                  {status.enabled_at
                    ? t('enabledSince', { date: new Date(status.enabled_at).toLocaleDateString(locale) })
                    : t('enabledShort')}
                </p>
                <p>{t('recoveryRemaining', { count: status.recovery_codes_remaining })}</p>
              </div>
            </div>
            {lowCodes && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                {t('recoveryLow')}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => open({ kind: 'regenerate' })}>
                <KeyRound className="size-3.5" />
                {t('regenerate')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => open({ kind: 'disable' })}
              >
                <ShieldOff className="size-3.5" />
                {t('disable')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => open({ kind: 'enable-password' })}>
              <ShieldCheck className="size-3.5" />
              {t('enable')}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={flow.kind !== 'none'} onOpenChange={(next) => !next && flow.kind !== 'codes' && close()}>
        <DialogContent className="sm:max-w-xl" showCloseButton={flow.kind !== 'codes'}>
          {flow.kind === 'enable-password' && (
            <form onSubmit={(e) => { e.preventDefault(); void startSetup(); }} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('enableTitle')}</DialogTitle>
                <DialogDescription>{t('enablePasswordHint')}</DialogDescription>
              </DialogHeader>
              {passwordField}
              {errorBox}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={busy}>{t('cancel')}</Button>
                <Button type="submit" disabled={busy || !password}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  {t('continue')}
                </Button>
              </DialogFooter>
            </form>
          )}

          {flow.kind === 'enable-scan' && (
            <form onSubmit={(e) => { e.preventDefault(); void confirmEnable(); }} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('scanTitle')}</DialogTitle>
                <DialogDescription>{t('scanHint')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {/* QR rendered by the API as a PNG data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flow.setup.qr_data_url}
                  alt={t('qrAlt')}
                  width={176}
                  height={176}
                  className="size-44 shrink-0 rounded-lg border bg-white p-2"
                />
                <div className="w-full min-w-0 space-y-2">
                  <p className="text-xs text-muted-foreground">{t('manualHint')}</p>
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-xs">
                      {flow.setup.secret.replace(/(.{4})/g, '$1 ').trim()}
                    </code>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => void copy(flow.setup.secret, 'secret')}
                      aria-label={t('copySecret')}
                      title={t('copySecret')}
                    >
                      {copied === 'secret' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              {codeField(true)}
              {errorBox}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={busy}>{t('cancel')}</Button>
                <Button type="submit" disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  {t('activate')}
                </Button>
              </DialogFooter>
            </form>
          )}

          {flow.kind === 'codes' && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('codesTitle')}</DialogTitle>
                <DialogDescription>{t('codesHint')}</DialogDescription>
              </DialogHeader>
              <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 font-mono text-sm">
                {flow.codes.map((c) => (
                  <li key={c} className="text-center">{c}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void copy(flow.codes.join('\n'), 'codes')}>
                  {copied === 'codes' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === 'codes' ? t('copied') : t('copyCodes')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadText('recovery-codes.txt', recoveryCodesText(flow.codes, t('codesFileHeading')))}
                >
                  <Download className="size-3.5" />
                  {t('downloadCodes')}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4" />
                {t('codesSavedConfirm')}
              </label>
              <DialogFooter>
                <Button type="button" disabled={!saved} onClick={() => setFlow({ kind: 'none' })}>
                  {t('done')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {(flow.kind === 'disable' || flow.kind === 'regenerate') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void (flow.kind === 'disable' ? confirmDisable() : confirmRegenerate());
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>{flow.kind === 'disable' ? t('disableTitle') : t('regenerateTitle')}</DialogTitle>
                <DialogDescription>{flow.kind === 'disable' ? t('disableHint') : t('regenerateHint')}</DialogDescription>
              </DialogHeader>
              {passwordField}
              {codeField(false, true)}
              {errorBox}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={busy}>{t('cancel')}</Button>
                <Button
                  type="submit"
                  variant={flow.kind === 'disable' ? 'destructive' : 'default'}
                  disabled={busy || !password || !isCodeOrRecovery(code)}
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  {flow.kind === 'disable' ? t('disableConfirm') : t('regenerateConfirm')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
