'use client';

import { useTranslations } from 'next-intl';

export type DiscountKind = 'percentage' | 'fixed';

interface DiscountKindToggleProps {
  value: DiscountKind;
  currency: string;
  onChange: (kind: DiscountKind) => void;
}

/** Coupon discount kind: a percentage of the cart or a fixed money amount. */
export function DiscountKindToggle({ value, currency, onChange }: DiscountKindToggleProps) {
  const t = useTranslations('creator');
  const options: { kind: DiscountKind; label: string }[] = [
    { kind: 'percentage', label: t('promotionForm.kindPercentage') },
    { kind: 'fixed', label: t('promotionForm.kindFixed', { currency }) },
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{t('promotionForm.discountKind')}</p>
      <div role="radiogroup" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {options.map((o) => {
          const active = value === o.kind;
          return (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.kind)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-zinc-900 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
