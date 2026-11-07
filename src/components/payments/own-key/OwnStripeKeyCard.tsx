'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ReauthAction } from '@/components/security/ReauthDialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { errorCode, isReauthError, type ReauthCredentials } from '@/lib/twoFactor';
import {
  OWN_KEY_ANCHOR,
  OWN_KEY_ENDPOINT,
  missingFromError,
  permissionsFromError,
  validateKeyInputs,
  type OwnKeyCheck,
  type KeyInputIssue,
  type OwnKeyPermission,
  type OwnKeyStatus,
} from '@/lib/ownStripeKey';
import { OwnKeyGuide } from './OwnKeyGuide';
import { ModeBadge, OwnKeyResult, StateBadge } from './OwnKeyResult';
import { PermissionChecklist } from './PermissionTable';

const PROGRESS_STEPS = ['key', 'permissions', 'webhook', 'domains', 'saving'] as const;
const PROGRESS_INTERVAL_MS = 2500;

interface SubmitError {
  message: string;
  code?: string;
  missing: OwnKeyPermission[];
  permissions: Partial<Record<OwnKeyPermission, OwnKeyCheck>>;
}

interface OwnStripeKeyCardProps {
  token: string;
  /** Opens the page's re-auth dialog (useReauth().request). */
  requestReauth: (action: ReauthAction, description?: string) => void;
  /** Reports the loaded status to the page (legacy Connect banner). */
  onStatusChange?: (status: OwnKeyStatus | null) => void;
  /** Opens the two-factor setup (the API refuses own keys without 2FA). */
  onSetupTwoFactor?: () => void;
}

/** A GET with no stored key answers 200 with an empty body (null) or 404. */
function isNoKey(err: unknown): boolean {
  if (!(err instanceof ApiError)) return err instanceof SyntaxError;
  return err.status === 404 || err.code === 'OWN_KEY_NOT_FOUND';
}

function hasStatus(value: unknown): value is OwnKeyStatus {
  return !!value && typeof value === 'object' && typeof (value as OwnKeyStatus).status === 'string';
}

/**
 * "Your Stripe account" card for INDEPENDENT stores: the merchant pastes a
 * restricted key + publishable key of their own Stripe account
 * (plans/stripe-restricted-keys/SPEC.md, Dashboard section).
 */
export function OwnStripeKeyCard({ token, requestReauth, onStatusChange, onSetupTwoFactor }: OwnStripeKeyCardProps) {
  const t = useTranslations('ownStripeKey');
  const apiError = useApiError();
  const { user } = useAuth();
  // Set when the API answered REAUTH_2FA_REQUIRED (the profile flag may be stale).
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const needsTwoFactor = twoFactorRequired || !user?.two_factor_enabled;
  // Turning 2FA on refreshes the profile: clear the sticky API flag then.
  useEffect(() => {
    if (user?.two_factor_enabled) setTwoFactorRequired(false);
  }, [user?.two_factor_enabled]);
  const cardRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<OwnKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);

  const [restricted, setRestricted] = useState('');
  const [publishable, setPublishable] = useState('');
  const [showRestricted, setShowRestricted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [success, setSuccess] = useState('');

  const [rechecking, setRechecking] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const applyStatus = useCallback(
    (next: OwnKeyStatus | null) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const fetchStatus = useCallback(async (): Promise<OwnKeyStatus | null> => {
    try {
      const res = await api<OwnKeyStatus | null>(OWN_KEY_ENDPOINT, { token });
      return hasStatus(res) ? res : null;
    } catch (err) {
      if (isNoKey(err)) return null;
      throw err;
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStatus()
      .then((s) => {
        if (cancelled) return;
        applyStatus(s);
        setLoadError('');
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiError(err) || t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // apiError/t are stable per locale; excluded to avoid refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStatus, applyStatus]);

  // Deep link (/creator/settings?tab=payments#own-stripe-key): scroll once loaded.
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    if (window.location.hash === `#${OWN_KEY_ANCHOR}`) {
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [loading]);

  // Step text while the API verifies (several Stripe calls; no streaming).
  useEffect(() => {
    if (!submitting) return;
    setProgress(0);
    const id = window.setInterval(
      () => setProgress((p) => Math.min(p + 1, PROGRESS_STEPS.length - 1)),
      PROGRESS_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [submitting]);

  // Make a failed submit impossible to miss: bring the error into view and focus it.
  useEffect(() => {
    if (!submitError) return;
    requestAnimationFrame(() => {
      const el = errorRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    });
  }, [submitError]);

  const issues = useMemo(() => validateKeyInputs(restricted, publishable), [restricted, publishable]);
  // Wrong-key mistakes show as soon as they are typed; empty fields after a try.
  const visibleIssue = (issue: KeyInputIssue | null): KeyInputIssue | null => {
    if (!issue) return null;
    if (issue.endsWith('_empty')) return attempted ? issue : null;
    return issue;
  };
  const restrictedIssue = visibleIssue(issues.restricted);
  const publishableIssue = visibleIssue(issues.publishable);
  const pairIssue = issues.pair;
  const inputsValid = !issues.restricted && !issues.publishable && !issues.pair;

  const toSubmitError = (err: unknown): SubmitError => {
    const payload = err instanceof ApiError ? err.payload : undefined;
    const permissions = permissionsFromError(payload);
    // `missing` list wins; otherwise derive it from the checklist in the body.
    const listed = missingFromError(payload);
    const missing = listed.length
      ? listed
      : (Object.keys(permissions) as OwnKeyPermission[]).filter((k) => permissions[k] === 'missing');
    return { message: apiError(err), code: errorCode(err), missing, permissions };
  };

  const connect = async (credentials: ReauthCredentials) => {
    setSubmitting(true);
    setSubmitError(null);
    setSuccess('');
    try {
      const res = await api<OwnKeyStatus | null>(OWN_KEY_ENDPOINT, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          publishable_key: publishable.trim(),
          restricted_key: restricted.trim(),
          ...credentials,
        }),
      });
      const fresh = hasStatus(res) ? res : await fetchStatus();
      applyStatus(fresh);
      setRestricted('');
      setPublishable('');
      setShowRestricted(false);
      setAttempted(false);
      setEditing(false);
      setSuccess(t('connected'));
    } catch (err) {
      if (errorCode(err) === 'REAUTH_2FA_REQUIRED') {
        setTwoFactorRequired(true);
        return;
      }
      if (isReauthError(err)) {
        // Wrong password / code: ask again, with the reason as the description.
        requestReauth(async (again) => {
          void connect(again);
        }, apiError(err));
        return;
      }
      setSubmitError(toSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    setAttempted(true);
    setSubmitError(null);
    if (!inputsValid || submitting || needsTwoFactor) return;
    // The dialog only collects the credentials, so the verification progress
    // is visible on the card instead of behind the modal.
    requestReauth(async (credentials) => {
      void connect(credentials);
    }, t('form.reauthDescription'));
  };

  const recheck = async () => {
    if (rechecking) return;
    setRechecking(true);
    setSubmitError(null);
    setSuccess('');
    try {
      // Always 200 with the status; a failed check shows as NEEDS_RECONNECT + last_error_code.
      const res = await api<OwnKeyStatus | null>(`${OWN_KEY_ENDPOINT}/verify`, { method: 'POST', token, body: '{}' });
      const fresh = hasStatus(res) ? res : await fetchStatus();
      applyStatus(fresh);
      if (fresh?.status === 'ACTIVE') setSuccess(t('result.rechecked'));
    } catch (err) {
      if (isNoKey(err)) {
        applyStatus(null);
        return;
      }
      setSubmitError(toSubmitError(err));
      // The check may have flipped the stored state (e.g. NEEDS_RECONNECT).
      fetchStatus().then(applyStatus).catch(() => undefined);
    } finally {
      setRechecking(false);
    }
  };

  const remove = () => {
    setRemoveOpen(false);
    setSuccess('');
    // Errors stay inside the re-auth dialog, which remains open to retry.
    requestReauth(async (credentials) => {
      await api(OWN_KEY_ENDPOINT, { method: 'DELETE', token, body: JSON.stringify(credentials) });
      applyStatus(null);
      setSubmitError(null);
      setEditing(false);
    }, t('removeDialog.reauthDescription'));
  };

  const showForm = !status || editing || status.status !== 'ACTIVE';

  const errorBox = submitError && (
    <div
      ref={errorRef}
      role="alert"
      tabIndex={-1}
      className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
    >
      <div className="flex items-start gap-2 text-destructive">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <div className="space-y-0.5">
          {submitError.code === 'OWN_KEY_MISSING_PERMISSIONS' && <p className="font-semibold">{t('missing.title')}</p>}
          <p>{submitError.code === 'OWN_KEY_MISSING_PERMISSIONS' ? t('missing.body') : submitError.message}</p>
        </div>
      </div>
      {submitError.code === 'OWN_KEY_MISSING_PERMISSIONS' && (
        <>
          <PermissionChecklist permissions={submitError.permissions} missing={submitError.missing} />
          <p className="text-[11px] leading-relaxed text-zinc-700">{t('missing.fix')}</p>
        </>
      )}
    </div>
  );

  return (
    <Card ref={cardRef} id={OWN_KEY_ANCHOR} className="scroll-mt-20 shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            {t('title')}
          </CardTitle>
          {status && (
            <span className="inline-flex items-center gap-1.5">
              <ModeBadge livemode={status.livemode} />
              <StateBadge status={status.status} />
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-56 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
          </div>
        ) : loadError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : (
          <>
            {/* Intro: where the money goes and who controls the key. */}
            <div className="space-y-2">
              <p className="text-xs text-zinc-700">{t('intro')}</p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t('introPoints.restricted')}
                </li>
                <li className="flex items-start gap-1.5">
                  <Wallet className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t('introPoints.direct')}
                </li>
                <li className="flex items-start gap-1.5">
                  <Undo2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t('introPoints.revoke')}
                </li>
              </ul>
            </div>

            {status?.status === 'NEEDS_RECONNECT' && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="space-y-0.5">
                    <p className="font-semibold">{t('reconnectAlert.title')}</p>
                    <p>
                      {status.last_error_code === 'OWN_KEY_MISSING_PERMISSIONS'
                        ? t('reconnectAlert.missingBody')
                        : t('reconnectAlert.body')}
                    </p>
                  </div>
                  {status.last_error_code === 'OWN_KEY_MISSING_PERMISSIONS' && (
                    <>
                      <PermissionChecklist permissions={status.permissions} />
                      <p className="text-[11px] leading-relaxed text-zinc-700">{t('missing.fix')}</p>
                      <Button size="sm" variant="outline" className="bg-white" onClick={recheck} disabled={rechecking}>
                        {rechecking && <Loader2 className="size-3.5 animate-spin" />}
                        {t('result.recheck')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {status && !status.livemode && status.status !== 'NEEDS_RECONNECT' && showForm && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{t('testBanner')}</p>
              </div>
            )}

            {success && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Re-check errors (no form shown); submit errors render above the submit button. */}
            {!showForm && errorBox}

            {status && !editing && status.status === 'ACTIVE' && (
              <OwnKeyResult
                status={status}
                rechecking={rechecking}
                onRecheck={recheck}
                onRemove={() => setRemoveOpen(true)}
                onReplace={() => {
                  setEditing(true);
                  setSuccess('');
                  setSubmitError(null);
                }}
              />
            )}

            {showForm && (
              <div className="space-y-4">
                {/* 2FA comes first: the API refuses own keys without it. */}
                {needsTwoFactor && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold">{t('twoFactor.title')}</p>
                      <p className="text-[11px]">{t('twoFactor.body')}</p>
                      {onSetupTwoFactor && (
                        <Button size="sm" variant="outline" className="h-7 bg-white" onClick={onSetupTwoFactor}>
                          {t('twoFactor.cta')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <OwnKeyGuide
                  defaultOpen={!needsTwoFactor && (!status || status.status === 'NEEDS_RECONNECT')}
                />

                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  autoComplete="off"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="own-key-restricted" className="text-xs">
                      {t('form.restrictedLabel')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="own-key-restricted"
                        type={showRestricted ? 'text' : 'password'}
                        dir="ltr"
                        // Keep password managers from saving or autofilling the key.
                        autoComplete="new-password"
                        data-1p-ignore
                        data-lpignore="true"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={restricted}
                        onChange={(e) => setRestricted(e.target.value)}
                        placeholder="rk_live_…"
                        aria-invalid={!!restrictedIssue}
                        className="h-9 pe-9 font-mono text-xs"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRestricted((v) => !v)}
                        className="absolute inset-y-0 end-0 inline-flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={showRestricted ? t('form.hide') : t('form.show')}
                      >
                        {showRestricted ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                    {restrictedIssue ? (
                      <p className="text-[11px] text-destructive">{t(`issues.${restrictedIssue}`)}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{t('form.restrictedHint')}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="own-key-publishable" className="text-xs">
                      {t('form.publishableLabel')}
                    </Label>
                    <Input
                      id="own-key-publishable"
                      dir="ltr"
                      autoComplete="off"
                      spellCheck={false}
                      value={publishable}
                      onChange={(e) => setPublishable(e.target.value)}
                      placeholder="pk_live_…"
                      aria-invalid={!!publishableIssue}
                      className="h-9 font-mono text-xs"
                      disabled={submitting}
                    />
                    {publishableIssue ? (
                      <p className="text-[11px] text-destructive">{t(`issues.${publishableIssue}`)}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{t('form.publishableHint')}</p>
                    )}
                  </div>

                  {pairIssue && <p className="text-[11px] text-destructive">{t(`issues.${pairIssue}`)}</p>}

                  {errorBox}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" size="sm" disabled={submitting || needsTwoFactor}>
                      {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                      {t('form.submit')}
                    </Button>
                    {status && editing && !submitting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(false);
                          setRestricted('');
                          setPublishable('');
                          setAttempted(false);
                          setSubmitError(null);
                        }}
                      >
                        {t('form.cancel')}
                      </Button>
                    )}
                    {status && status.status !== 'ACTIVE' && !submitting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ms-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setRemoveOpen(true)}
                      >
                        {t('result.remove')}
                      </Button>
                    )}
                  </div>

                  {submitting && (
                    <p role="status" aria-live="polite" className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      <span>
                        {progress + 1}/{PROGRESS_STEPS.length} · {t(`progress.${PROGRESS_STEPS[progress]}`)}
                      </span>
                    </p>
                  )}
                </form>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('removeDialog.title')}</DialogTitle>
            <DialogDescription>{t('removeDialog.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={remove}
            >
              {t('removeDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
