'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { previewMarketPrice } from '@/lib/marketPricing';
import { fxPreview, type FxPreview, type PriceRule, type PriceRuleEnding } from '@/lib/markets.api';

const ENDINGS: PriceRuleEnding[] = ['none', '.99', '.90', '.95', '9', '0'];
const INCREMENTS = ['', '0.1', '0.5', '1', '5', '10'];
const EXAMPLE_BASE = 299;

interface PriceRuleEditorProps {
  value: PriceRule;
  onChange: (next: PriceRule) => void;
  baseCurrency: string;
  marketCurrency: string;
}

/**
 * Edits `Market.price_rule`: convert (manual or platform rate) vs fixed, with
 * rounding and a live example conversion. The platform rate is previewed via
 * GET /markets/fx-preview whenever the currency pair changes.
 */
export function PriceRuleEditor({ value, onChange, baseCurrency, marketCurrency }: PriceRuleEditorProps) {
  const t = useTranslations('creator.markets.rule');
  const { token } = useAuth();
  const sameCurrency = !marketCurrency || marketCurrency === baseCurrency;
  // Preview keyed by currency pair so a stale result never shows for a new
  // pair while the request is in flight (null = loading).
  const pair = `${baseCurrency}:${marketCurrency}`;
  const [preview, setPreview] = useState<{ pair: string; result: FxPreview } | null>(null);
  const platform = preview?.pair === pair ? preview.result : null;

  useEffect(() => {
    if (!token || sameCurrency) return;
    let cancelled = false;
    fxPreview(token, baseCurrency, marketCurrency)
      .then((res) => { if (!cancelled) setPreview({ pair, result: res }); })
      .catch(() => { if (!cancelled) setPreview({ pair, result: { rate: null, source: 'none' } }); });
    return () => { cancelled = true; };
  }, [token, baseCurrency, marketCurrency, sameCurrency, pair]);

  const set = (patch: Partial<PriceRule>) => onChange({ ...value, ...patch });
  const setRounding = (patch: Partial<NonNullable<PriceRule['rounding']>>) =>
    onChange({ ...value, rounding: { ...(value.rounding ?? {}), ...patch } });

  const source = value.source ?? 'manual';
  // Rate used for the example: 1 for the same currency, the manual rate, or
  // the platform rate when that source is chosen.
  const effectiveRate = sameCurrency
    ? 1
    : source === 'platform'
      ? platform?.rate ?? null
      : value.rate != null && Number.isFinite(Number(value.rate)) && Number(value.rate) > 0
        ? Number(value.rate)
        : null;

  // Same math as the API (mirrored in lib/marketPricing.ts), null without a rate.
  const example = previewMarketPrice(EXAMPLE_BASE, effectiveRate, value.rounding, marketCurrency);

  const fmt = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  if (sameCurrency) {
    return <p className="text-[11px] text-muted-foreground">{t('sameCurrency', { currency: baseCurrency })}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('mode')}</Label>
          <SearchableSelect
            value={value.mode}
            onChange={(v) => set({ mode: v as PriceRule['mode'] })}
            options={[
              { value: 'convert', label: t('modeConvert'), description: t('modeConvertDesc') },
              { value: 'fixed', label: t('modeFixed'), description: t('modeFixedDesc') },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('source')}</Label>
          <SearchableSelect
            value={source}
            onChange={(v) => set({ source: v as PriceRule['source'] })}
            options={[
              { value: 'manual', label: t('sourceManual'), description: t('sourceManualDesc') },
              { value: 'platform', label: t('sourcePlatform'), description: t('sourcePlatformDesc') },
            ]}
          />
        </div>
      </div>

      {value.mode === 'fixed' && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{t('fixedWarning')}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('rate', { from: baseCurrency, to: marketCurrency })}</Label>
          {source === 'platform' ? (
            <Input
              className="h-8 text-sm"
              value={platform === null ? '…' : platform.rate != null ? String(platform.rate) : t('ratePlatformMissing')}
              disabled
              readOnly
            />
          ) : (
            <Input
              className="h-8 text-sm"
              type="number"
              min={0}
              step="0.0001"
              dir="ltr"
              value={value.rate ?? ''}
              onChange={(e) => set({ rate: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder={platform?.rate != null ? String(platform.rate) : '1.0000'}
            />
          )}
          {source === 'manual' && platform?.rate != null && (
            <p className="text-[11px] text-muted-foreground">{t('ratePlatformHint', { rate: platform.rate })}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('increment')}</Label>
          <SearchableSelect
            value={value.rounding?.increment != null ? String(value.rounding.increment) : ''}
            onChange={(v) => setRounding({ increment: v === '' ? null : Number(v) })}
            options={INCREMENTS.map((inc) => ({ value: inc, label: inc === '' ? t('incrementNone') : inc }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('ending')}</Label>
          <SearchableSelect
            value={value.rounding?.ending ?? 'none'}
            onChange={(v) => setRounding({ ending: v as PriceRuleEnding })}
            options={ENDINGS.map((e) => ({ value: e, label: e === 'none' ? t('endingNone') : e }))}
          />
        </div>
      </div>

      <p className="rounded-md border bg-zinc-50 px-3 py-2 text-xs" dir="ltr">
        {example == null
          ? t('exampleNoRate')
          : t('example', { from: fmt(EXAMPLE_BASE, baseCurrency), to: fmt(example, marketCurrency) })}
      </p>
    </div>
  );
}
