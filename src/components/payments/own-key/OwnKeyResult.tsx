'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, Info, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  STRIPE_PAYMENT_METHODS_URL,
  WALLET_METHODS,
  domainRows,
  type DomainTone,
  type OwnKeyStatus,
} from '@/lib/ownStripeKey';
import { PermissionChecklist } from './PermissionTable';

export function ModeBadge({ livemode }: { livemode: boolean }) {
  const t = useTranslations('ownStripeKey.badge');
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold tracking-wide',
        livemode ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      {livemode ? t('live') : t('test')}
    </span>
  );
}

export function StateBadge({ status }: { status: OwnKeyStatus['status'] }) {
  const t = useTranslations('ownStripeKey.badge');
  const cls =
    status === 'ACTIVE'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'NEEDS_RECONNECT'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-zinc-200 bg-zinc-100 text-zinc-600';
  const label = status === 'ACTIVE' ? t('active') : status === 'NEEDS_RECONNECT' ? t('needsReconnect') : t('disabled');
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10px] font-medium', cls)}>
      {status === 'ACTIVE' && <CheckCircle2 className="size-3" />}
      {label}
    </span>
  );
}

function DomainCell({ tone }: { tone: DomainTone }) {
  const t = useTranslations('ownStripeKey.result.domainStatus');
  const tr = useTranslations('ownStripeKey.result');
  // Raw Stripe states mean little to merchants: explain them in the tooltip.
  const label = tone === 'ok' ? t(tone) : `${t(tone)}. ${tr('domainHelp')}`;
  const icon =
    tone === 'ok' ? (
      <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
    ) : tone === 'error' ? (
      <XCircle className="size-3.5 text-red-600" aria-hidden="true" />
    ) : tone === 'pending' ? (
      <CircleDashed className="size-3.5 text-amber-600" aria-hidden="true" />
    ) : (
      <span className="text-zinc-400" aria-hidden="true">
        —
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center" title={label}>
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {label}
        {help && (
          <span title={help} className="inline-flex cursor-help">
            <Info className="size-3" aria-hidden="true" />
            <span className="sr-only">{help}</span>
          </span>
        )}
      </span>
      <span className="min-w-0 text-end">{children}</span>
    </div>
  );
}

interface OwnKeyResultProps {
  status: OwnKeyStatus;
  rechecking: boolean;
  onRecheck: () => void;
  onRemove: () => void;
  onReplace: () => void;
}

/** Connected-key summary: mode, last4, account, checks, webhook, wallet domains. */
export function OwnKeyResult({ status, rechecking, onRecheck, onRemove, onReplace }: OwnKeyResultProps) {
  const t = useTranslations('ownStripeKey.result');
  const tp = useTranslations('ownStripeKey.permissions');
  const tg = useTranslations('ownStripeKey.guide');
  const locale = useLocale();
  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : t('never');
  const rows = domainRows(status.payment_method_domains);
  const anyInactive = rows.some((r) => !r.error && WALLET_METHODS.some((m) => r.methods[m] !== 'ok'));

  return (
    <div className="space-y-4">
      {!status.livemode && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('testKeyNotice')}</p>
        </div>
      )}
      <div className="divide-y rounded-lg border px-3">
        <Row label={t('key')}>
          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
            <ModeBadge livemode={status.livemode} />
            <StateBadge status={status.status} />
            <code className="font-mono text-xs" dir="ltr">
              {status.livemode ? 'rk_live_' : 'rk_test_'}••••{status.key_last4}
            </code>
          </span>
        </Row>
        {status.account_id && (
          <Row label={t('account')} help={t('accountHelp')}>
            <code className="font-mono text-[11px] text-muted-foreground" dir="ltr">
              {status.account_id}
            </code>
          </Row>
        )}
        <Row label={t('webhook')}>
          {status.webhook_ok ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="size-3.5" /> {t('webhookOk')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-700">
              <XCircle className="size-3.5" /> {t('webhookMissing')}
            </span>
          )}
        </Row>
        <Row label={t('verifiedAt')}>{fmt(status.verified_at)}</Row>
        <Row label={t('lastCheckAt')}>{fmt(status.last_check_at)}</Row>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold">{tp('checklistTitle')}</p>
        <PermissionChecklist permissions={status.permissions} />
        {status.pi_write_check === 'live_hint' && (
          <p className="text-[11px] text-muted-foreground">{t('liveHint')}</p>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold">{t('domains')}</p>
          <p className="text-[11px] text-muted-foreground">{t('domainsHint')}</p>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-center text-[11px] text-muted-foreground">
            {t('domainsEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('host')}</th>
                  {WALLET_METHODS.map((m) => (
                    <th key={m} className="whitespace-nowrap px-2 py-2 text-center font-medium">
                      {t(`methods.${m}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.host}>
                    <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">
                      {r.host}
                    </td>
                    {r.error ? (
                      <td colSpan={WALLET_METHODS.length} className="px-2 py-2 text-[11px] text-red-700">
                        {r.error === 'permission_missing' ? t('domainErrorPermission') : t('domainErrorGeneric')}
                      </td>
                    ) : (
                      WALLET_METHODS.map((m) => (
                        <td key={m} className="px-2 py-2 text-center">
                          <DomainCell tone={r.methods[m]} />
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {anyInactive && <p className="text-[11px] text-muted-foreground">{t('domainHelp')}</p>}
        <p className="text-[11px] text-muted-foreground">
          {t('paymentMethodsHint')}{' '}
          <a
            href={STRIPE_PAYMENT_METHODS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2"
          >
            {tg('openPaymentMethods')}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground">{t('refundsHint')}</p>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onRecheck} disabled={rechecking}>
          {rechecking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {t('recheck')}
        </Button>
        <Button size="sm" variant="outline" onClick={onReplace} disabled={rechecking}>
          {t('replace')}
        </Button>
        {/* A link styled as a button (no <button> nested inside <a>). */}
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
        >
          {t('openStripe')}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <Button
          size="sm"
          variant="outline"
          className="ms-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onRemove}
          disabled={rechecking}
        >
          <Trash2 className="size-3.5" />
          {t('remove')}
        </Button>
      </div>
    </div>
  );
}
