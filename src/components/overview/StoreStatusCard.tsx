'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink, Eye, Loader2, PauseCircle, PlayCircle, Rocket, Clock, AlertTriangle, Ban } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { effectiveStoreStatus, type MyStoreSummary } from '@/lib/useStorefrontUrl';
import { blockingHref, canRequestGoLive } from '@/lib/storeStatus';
import { PREVIEWED_KEY } from '@/lib/onboardingSurvey';
import { Button, buttonVariants } from '@/components/ui/button';
import { StoreStatusBadge } from '@/components/creator/StoreStatusBadge';
import { cn } from '@/lib/utils';
import { OwnKeyTestModeHint } from '@/components/payments/own-key/OwnKeyTestModeHint';

export interface StoreStatusCardProps {
  store: MyStoreSummary;
  /** Public (or preview) storefront URL. */
  storeUrl: string | null;
  independent: boolean;
  /** Called after a status change so the caller reloads the store. */
  onChanged: () => void;
}

function markPreviewed() {
  try {
    window.localStorage.setItem(PREVIEWED_KEY, '1');
  } catch {
    // Storage unavailable: the checklist step just stays open.
  }
}

/**
 * Lifecycle card at the top of the dashboard home (PLAN §2.4): what the
 * store's status means and the one action that moves it forward
 * (preview + request go-live, resubmit, resume, share).
 */
export function StoreStatusCard({ store, storeUrl, independent, onChanged }: StoreStatusCardProps) {
  const { token } = useAuth();
  const t = useTranslations('creator.storeStatus');
  const locale = useLocale();
  const describe = useApiError();
  const status = effectiveStoreStatus(store);
  const checklist = store.golive_checklist ?? null;
  const [busy, setBusy] = useState<'golive' | 'resume' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, flashCopied] = useTransientFlag(1500);

  const requestGoLive = async () => {
    if (!token || busy) return;
    setBusy('golive');
    setError(null);
    try {
      const res = await api<{ status: string; auto_approved?: boolean }>('/stores/my/golive', { method: 'POST', token });
      setNotice(res.auto_approved ? t('nowLive') : t('submitted'));
      onChanged();
    } catch (err) {
      // STORE_GOLIVE_NOT_READY carries `blocking`; the list below shows it.
      setError(describe(err));
      if (err instanceof ApiError && err.status === 400) onChanged();
    } finally {
      setBusy(null);
    }
  };

  const resume = async () => {
    if (!token || busy) return;
    setBusy('resume');
    setError(null);
    try {
      await api('/stores/my/store', { method: 'PUT', token, body: JSON.stringify({ is_active: true }) });
      onChanged();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  };

  const copyUrl = async () => {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      flashCopied();
    } catch {
      // Clipboard unavailable (insecure context): nothing to do.
    }
  };

  const date = (iso: string | null | undefined) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)) : '';

  const blocking = checklist?.blocking ?? [];
  const ready = checklist ? checklist.ready : false;

  const previewLink = storeUrl && (
    <a
      href={storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={markPreviewed}
      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'bg-card' })}
    >
      <Eye className="size-3.5" aria-hidden="true" />
      {t('preview')}
    </a>
  );

  const tone = {
    DRAFT: 'border-zinc-200',
    PENDING_REVIEW: 'border-sky-200 bg-sky-50/40',
    CHANGES_REQUESTED: 'border-amber-200 bg-amber-50/40',
    LIVE: 'border-emerald-200 bg-emerald-50/30',
    PAUSED: 'border-amber-200 bg-amber-50/40',
    SUSPENDED: 'border-red-200 bg-red-50/40',
  }[status];

  const icon = {
    DRAFT: <Rocket className="size-5" />,
    PENDING_REVIEW: <Clock className="size-5" />,
    CHANGES_REQUESTED: <AlertTriangle className="size-5" />,
    LIVE: <Check className="size-5" />,
    PAUSED: <PauseCircle className="size-5" />,
    SUSPENDED: <Ban className="size-5" />,
  }[status];

  return (
    <section id="store-status" className={cn('rounded-xl border bg-card p-4 sm:p-5', tone)} aria-labelledby="store-status-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-700 ring-1 ring-zinc-200" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="store-status-title" className="text-base font-semibold">
              {t(`title.${status}`)}
            </h2>
            <StoreStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === 'PENDING_REVIEW' && store.golive_requested_at
              ? t('body.PENDING_REVIEW_dated', { date: date(store.golive_requested_at) })
              : status === 'LIVE' && store.went_live_at
                ? t('body.LIVE_dated', { date: date(store.went_live_at) })
                : t(`body.${status}`)}
          </p>

          {(status === 'CHANGES_REQUESTED' || status === 'SUSPENDED') && store.status_reason && (
            <blockquote className="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-800">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('reason')}</span>
              {store.status_reason}
            </blockquote>
          )}

          {canRequestGoLive(status) && !ready && (
            <div className="mt-3 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs">
              <p className="font-medium text-zinc-800">{t('blockingTitle')}</p>
              <ul className="mt-1 space-y-1">
                {blocking.map((item) => {
                  const href = blockingHref(item, independent, storeUrl);
                  // INDEPENDENT stores publish their own Privacy + Terms (not the platform texts).
                  const key = item === 'legal_pages_published' && independent ? 'legal_pages_published_independent' : item;
                  const label = t.has(`blocking.${key}`) ? t(`blocking.${key}`) : item;
                  return (
                    <li key={item} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                      {href ? (
                        <Link href={href} className="underline underline-offset-2 hover:text-foreground">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
                {!checklist && <li className="text-muted-foreground">{t('checklistUnavailable')}</li>}
              </ul>
            </div>
          )}

          {checklist?.payments_hint === 'OWN_KEY_TEST_MODE' && <OwnKeyTestModeHint className="mt-3" />}

          {status === 'LIVE' && storeUrl && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="truncate font-mono text-xs text-zinc-800 underline-offset-2 hover:underline">
                {storeUrl}
              </a>
              <Button type="button" variant="ghost" size="xs" onClick={copyUrl} aria-label={t('copyUrl')}>
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                {copied ? t('copied') : t('copyUrl')}
              </Button>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
          {notice && !error && <p className="mt-3 text-xs font-medium text-emerald-700" role="status">{notice}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          {canRequestGoLive(status) && (
            <>
              {previewLink}
              <Button type="button" size="sm" onClick={requestGoLive} disabled={!ready || busy === 'golive'}>
                {busy === 'golive' ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                {status === 'CHANGES_REQUESTED' ? t('resubmit') : t('requestGoLive')}
              </Button>
            </>
          )}
          {status === 'PENDING_REVIEW' && previewLink}
          {status === 'LIVE' && storeUrl && (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'sm' })}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {t('openStore')}
            </a>
          )}
          {status === 'PAUSED' && (
            <Button type="button" size="sm" onClick={resume} disabled={busy === 'resume'}>
              {busy === 'resume' ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
              {t('resume')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
