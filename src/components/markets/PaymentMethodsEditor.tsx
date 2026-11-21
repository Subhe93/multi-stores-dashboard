'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OWN_KEY_SETTINGS_HREF } from '@/components/payments/own-key/OwnKeyTestModeHint';
import {
  customModeBlocked,
  isCodOnly,
  paymentMethodRows,
  storeAvailableMethods,
  togglePaymentMethod,
  type MarketPaymentMethod,
} from '@/lib/marketPaymentMethods';
import type { StorePaymentMethodsView } from '@/lib/markets.api';

/** DOM id of the card, so the form can scroll to it on a validation error. */
export const PAYMENT_METHODS_CARD_ID = 'market-payment-methods';

/** Where the owner turns each method on for the whole store. */
const SETTINGS_HREF: Record<MarketPaymentMethod, string> = {
  card: OWN_KEY_SETTINGS_HREF,
  kustom: '/creator/settings?tab=payments',
  cod: '/creator/settings?tab=store',
};

interface PaymentMethodsEditorProps {
  /** null = use the store's methods; otherwise the market's subset. */
  value: MarketPaymentMethod[] | null;
  onChange: (value: MarketPaymentMethod[] | null) => void;
  /** GET /markets/payment-methods; null while loading or after a failure. */
  store: StorePaymentMethodsView | null;
  loading: boolean;
  /** Translated load failure; the stored value stays untouched. */
  error: string | null;
  onRetry: () => void;
  /** The API predates M157 (the store read answered 404): store mode only. */
  unsupported: boolean;
  /** Client validation result (restricted mode with nothing checked). */
  invalid: 'empty' | null;
  isDefaultMarket: boolean;
}

/**
 * M157 "Payment methods" card of the market form: use every method the store
 * offers (default) or restrict this market to a subset. The setting only
 * narrows: a method the store does not offer cannot be chosen, and a stored
 * value for a method the store has since lost is shown so it can be removed.
 */
export function PaymentMethodsEditor({
  value,
  onChange,
  store,
  loading,
  error,
  onRetry,
  unsupported,
  invalid,
  isDefaultMarket,
}: PaymentMethodsEditorProps) {
  const t = useTranslations('creator.markets.form.paymentMethods');
  const restricted = value !== null;
  const available = storeAvailableMethods(store);
  const rows = paymentMethodRows(store, value);
  const label = (m: MarketPaymentMethod) => t(m);
  const errorId = `${PAYMENT_METHODS_CARD_ID}-error`;

  // Custom mode can be entered only from a loaded store read with at least
  // one available method (an old API without the endpoint offers nothing
  // else: the field would not be saved anyway). A stored value stays shown.
  const customDisabled = customModeBlocked({ restricted, unsupported, store });

  // Custom mode starts from what the store offers today (the owner unchecks).
  const chooseCustom = () => {
    if (!restricted && !customDisabled) onChange(available);
  };

  return (
    <Card id={PAYMENT_METHODS_CARD_ID} className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('hint')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {unsupported && <p className="text-[11px] text-muted-foreground">{t('unsupported')}</p>}

        {error && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-red-600" role="alert">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" className="h-7" disabled={loading} onClick={onRetry}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t('retry')}
            </Button>
          </div>
        )}

        <label
          className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 transition ${
            !restricted ? 'border-zinc-900 bg-zinc-50/60' : 'border-zinc-200 hover:bg-zinc-50/40'
          }`}
        >
          <input type="radio" name="market-payment-mode" className="mt-0.5" checked={!restricted} onChange={() => onChange(null)} />
          <div className="space-y-0.5">
            <span className="block text-xs font-medium">{t('modeStore')}</span>
            <p className="text-[10px] text-muted-foreground">
              {loading && !store
                ? t('loading')
                : store
                  ? available.length
                    ? t('modeStoreHint', { methods: available.map(label).join(', ') })
                    : t('storeNone')
                  : t('modeStoreHintUnknown')}
            </p>
          </div>
        </label>

        <div
          className={`space-y-3 rounded-md border p-3 transition ${
            restricted ? 'border-zinc-900 bg-zinc-50/60' : 'border-zinc-200'
          } ${customDisabled ? 'opacity-60' : ''}`}
        >
          <label className={`flex items-start gap-2 ${customDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="radio"
              name="market-payment-mode"
              className="mt-0.5"
              checked={restricted}
              disabled={customDisabled}
              onChange={chooseCustom}
            />
            <div className="space-y-0.5">
              <span className="block text-xs font-medium">{t('modeCustom')}</span>
              <p className="text-[10px] text-muted-foreground">{t('modeCustomHint')}</p>
            </div>
          </label>

          {restricted && (
            <div className="space-y-2 ps-6">
              <ul className="space-y-2" aria-describedby={invalid ? errorId : undefined}>
                {rows.map((row) => (
                  <li key={row.method} className="space-y-1">
                    <label
                      className={`flex items-start gap-2 text-xs ${row.disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={row.checked}
                        disabled={row.disabled}
                        // A stale row can only be unchecked; an unavailable one never checked.
                        onChange={(e) => {
                          if (e.target.checked && !row.available) return;
                          onChange(togglePaymentMethod(value ?? [], row.method, e.target.checked));
                        }}
                      />
                      <span className="space-y-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 font-medium">
                          {label(row.method)}
                          {store && !row.available && !row.stale && (
                            <Badge variant="outline" className="h-auto px-1 py-0 text-[9px] text-muted-foreground">
                              {t('unavailable')}
                            </Badge>
                          )}
                        </span>
                        {store && !row.available && row.reason && (
                          <span className="block text-[10px] text-muted-foreground">
                            {t(`reasons.${row.reason}`)}{' '}
                            {row.reason !== 'not_independent' && (
                              <Link href={SETTINGS_HREF[row.method]} className="font-medium underline underline-offset-2">
                                {t(`links.${row.method}`)}
                              </Link>
                            )}
                          </span>
                        )}
                      </span>
                    </label>
                    {row.stale && (
                      <p className="flex items-start gap-1.5 ps-5 text-[10px] text-amber-800">
                        <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                        <span>{t('stale')}</span>
                      </p>
                    )}
                    {row.testMode && row.checked && (
                      <p className="flex items-start gap-1.5 ps-5 text-[10px] text-amber-800">
                        <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                        <span>{t('testMode')}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {invalid === 'empty' && (
                <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[11px] text-red-600">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span>{t('errors.empty')}</span>
                </p>
              )}
              {isCodOnly(value) && (
                <p className="flex items-start gap-1.5 text-[10px] text-amber-800">
                  <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                  <span>{t('codOnly')}</span>
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">{t('appliesToNew')}</p>
            </div>
          )}
        </div>

        {isDefaultMarket && <p className="text-[10px] text-muted-foreground">{t('defaultMarketHint')}</p>}
      </CardContent>
    </Card>
  );
}
