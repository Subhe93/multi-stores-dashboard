'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { PRICING_MODES, type PPricing, type PricingMode } from '@/lib/personalization';

interface FieldPricingEditorProps {
  value: PPricing | null;
  onChange: (next: PPricing | null) => void;
  /** Values that can carry their own price (options, palette or checkbox values). */
  optionValues: string[];
  /** Store base currency code, shown next to amounts. */
  currency: string;
  /** Per-item pricing only makes sense on a repeater. */
  isRepeater: boolean;
}

const NONE = 'none';

/** True when amounts are set and ≥ 0 (Q6: no negative modifiers). */
export function pricingValid(p: PPricing | null): boolean {
  if (!p) return true;
  if (p.mode === 'per_option') {
    return Object.values(p.option_prices ?? {}).every((v) => Number.isFinite(v) && v >= 0);
  }
  return typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount >= 0;
}

/**
 * "Pricing" tab of the field dialog. The price change is per unit, in the
 * store base currency, and always computed on the server (D4).
 */
export function FieldPricingEditor({ value, onChange, optionValues, currency, isRepeater }: FieldPricingEditorProps) {
  const t = useTranslations('customField.pricing');
  const mode = value?.mode ?? NONE;

  const modes = PRICING_MODES.filter((m) => {
    if (m === 'per_item') return isRepeater;
    if (m === 'per_option') return optionValues.length > 0;
    return true;
  });

  const setMode = (m: string) => {
    if (m === NONE) return onChange(null);
    const next: PPricing = { mode: m as PricingMode };
    if (m === 'per_option') next.option_prices = value?.option_prices ?? {};
    else next.amount = value?.amount ?? 0;
    onChange(next);
  };

  const num = (raw: string): number => (raw === '' ? NaN : Number(raw));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      <div className="max-w-sm space-y-1.5">
        <Label className="text-xs">{t('mode')}</Label>
        <SearchableSelect
          value={mode}
          onChange={setMode}
          options={[
            { value: NONE, label: t('none') },
            ...modes.map((m) => ({ value: m, label: t(`modes.${m}`), description: t(`modes.${m}Hint`) })),
          ]}
        />
      </div>

      {value && value.mode !== 'per_option' && (
        <div className="max-w-48 space-y-1.5">
          <Label className="text-xs">{t('amount', { currency })}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-8 text-sm"
            value={typeof value.amount === 'number' && Number.isFinite(value.amount) ? String(value.amount) : ''}
            onChange={(e) => onChange({ ...value, amount: num(e.target.value) })}
          />
        </div>
      )}

      {value?.mode === 'per_option' && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('optionPrices', { currency })}</Label>
          <div className="divide-y rounded-md border">
            {optionValues.map((opt) => {
              const v = value.option_prices?.[opt];
              return (
                <div key={opt} className="flex items-center gap-2 px-2 py-1">
                  <span className="w-40 shrink-0 truncate text-xs" title={opt}>{opt}</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-7 w-28 text-xs"
                    placeholder="0"
                    value={typeof v === 'number' && Number.isFinite(v) ? String(v) : ''}
                    onChange={(e) => {
                      const prices = { ...(value.option_prices ?? {}) };
                      if (e.target.value === '') delete prices[opt];
                      else prices[opt] = num(e.target.value);
                      onChange({ ...value, option_prices: prices });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!pricingValid(value) && <p className="text-[10px] text-red-600">{t('invalid')}</p>}
    </div>
  );
}
