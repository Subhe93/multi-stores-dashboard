'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MarketStatus, PaymentCheck, ProviderCheckState } from '@/lib/markets.api';

type Translator = ReturnType<typeof useTranslations>;

const DOT_CLASS: Record<ProviderCheckState, string> = {
  ok: 'bg-emerald-500',
  missing: 'bg-red-500',
  unknown: 'bg-amber-400',
};

export const MARKET_STATUS_CLASS: Record<MarketStatus, string> = {
  LIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-zinc-50 text-zinc-600 border-zinc-200',
};

/** True when at least one provider can take payments in the market currency. */
export function paymentCheckPasses(check: PaymentCheck | null | undefined): boolean {
  return !!check && (check.stripe === 'ok' || check.kustom === 'ok');
}

/**
 * Actionable message for the Stripe line, keyed by the API's `reason_code`
 * (M1-DESIGN §3.6). Unknown codes fall back to the generic state message.
 */
export function stripeCheckMessage(t: Translator, check: PaymentCheck, currency: string): string {
  const d = check.details?.stripe;
  if (check.stripe === 'ok') {
    return d?.settlement_currency_supported === false
      ? t('check.stripe.settlement_conversion_note', { currency })
      : t('check.stripe.ok');
  }
  if (check.stripe === 'missing' && d?.reason_code && t.has(`check.stripe.${d.reason_code}`)) {
    return t(`check.stripe.${d.reason_code}`);
  }
  return t(`check.stripe.${check.stripe}`);
}

/** Same for Kustom: static country table result + creator readiness (L4). */
export function kustomCheckMessage(t: Translator, check: PaymentCheck): string {
  const d = check.details?.kustom;
  if (check.kustom === 'ok') return t('check.kustom.ok');
  const byCountry = d?.by_country ?? {};
  if (check.kustom === 'missing') {
    if (d?.reason_code && t.has(`check.kustom.${d.reason_code}`)) return t(`check.kustom.${d.reason_code}`);
    const mismatch = Object.entries(byCountry).find(([, s]) => s === 'mismatch');
    if (mismatch && d?.expected_currency) {
      return t('check.kustom.currency_mismatch', { country: mismatch[0], expected: d.expected_currency });
    }
    return t('check.kustom.missing');
  }
  const unknown = Object.entries(byCountry).find(([, s]) => s === 'unknown');
  if (unknown) return t('check.kustom.unknown_country', { country: unknown[0] });
  return t('check.kustom.unknown');
}

export function ProviderDot({ state }: { state: ProviderCheckState }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${DOT_CLASS[state]}`} aria-hidden />;
}

interface PaymentCheckCardProps {
  check: PaymentCheck | null;
  status: MarketStatus;
  isDefault: boolean;
  currency: string;
  busy: boolean;
  onRecheck: () => void;
  onSetStatus: (status: MarketStatus) => void;
  /** Translated reason the last status change was refused (e.g. no activated hostname). */
  statusError?: string | null;
}

/**
 * Per-provider readiness for the market currency plus the LIVE/DRAFT switch.
 * "Set live" stays disabled (with a tooltip) until a provider reports ok; the
 * default market is always LIVE and cannot be set to DRAFT.
 */
export function PaymentCheckCard({ check, status, isDefault, currency, busy, onRecheck, onSetStatus, statusError }: PaymentCheckCardProps) {
  const t = useTranslations('creator.markets');
  const locale = useLocale();
  const passes = paymentCheckPasses(check);

  const providers: Array<{ key: 'stripe' | 'kustom'; label: string; state: ProviderCheckState; message: string }> = [
    {
      key: 'stripe',
      label: t('check.stripe.label'),
      state: check?.stripe ?? 'unknown',
      message: check ? stripeCheckMessage(t, check, currency) : t('check.never'),
    },
    {
      key: 'kustom',
      label: t('check.kustom.label'),
      state: check?.kustom ?? 'unknown',
      message: check ? kustomCheckMessage(t, check) : t('check.never'),
    },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-semibold">{t('check.title')}</CardTitle>
        <Badge variant="outline" className={`text-[10px] ${MARKET_STATUS_CLASS[status]}`}>{t(`status.${status}`)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.key} className="flex items-start gap-2.5">
              <span className="mt-1.5"><ProviderDot state={p.state} /></span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">
                  {p.label}{' '}
                  <span className="text-[11px] font-normal text-muted-foreground">({t(`check.state.${p.state}`)})</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{p.message}</p>
              </div>
            </div>
          ))}
        </div>
        {check?.checked_at && (
          <p className="text-[11px] text-muted-foreground">
            {t('check.checkedAt', { date: new Date(check.checked_at).toLocaleString(locale) })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRecheck}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t('check.recheck')}
          </Button>
          {status === 'DRAFT' ? (
            passes ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => onSetStatus('LIVE')}>
                {t('check.setLive')}
              </Button>
            ) : (
              <Tooltip>
                {/* The wrapper keeps the tooltip reachable while the button is disabled. */}
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button type="button" size="sm" disabled>
                    {t('check.setLive')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('check.setLiveBlocked')}</TooltipContent>
              </Tooltip>
            )
          ) : (
            !isDefault && (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onSetStatus('DRAFT')}>
                {t('check.setDraft')}
              </Button>
            )
          )}
        </div>
        {statusError && <p className="text-[11px] text-red-600">{statusError}</p>}
      </CardContent>
    </Card>
  );
}
