'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { OrderDesignItem } from '@/lib/designer/designer.api';
import { pickLabel } from '@/lib/designer/pickLabel';

function money(amount: number, currency: string | null | undefined, locale: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Add-ons the customer chose for a designed order line (M5.5), as frozen at
 * checkout: per unit, in the order currency. Renders nothing for lines
 * without add-ons. Kept apart from the print-file block on purpose.
 */
export function OrderDesignAddons({ item }: { item: OrderDesignItem }) {
  const t = useTranslations('creator.designer.order');
  const locale = useLocale();
  const addons = item.addons ?? [];
  if (addons.length === 0) return null;
  const perUnit = addons.reduce((s, a) => s + a.amount, 0);
  return (
    <div className="space-y-1" data-order-design-addons>
      <p className="font-medium text-muted-foreground">{t('addons')}</p>
      <dl className="divide-y rounded-md border">
        {addons.map((a) => (
          <div key={a.key} className="flex gap-3 px-2.5 py-1.5">
            <dt className="min-w-0 flex-1 break-words" dir="auto">
              {pickLabel(a.label, locale) || a.key}
              {a.type === 'quantity' ? ` × ${a.qty}` : ''}
            </dt>
            <dd className="shrink-0 font-medium tabular-nums">+{money(a.amount, item.addons_currency, locale)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-muted-foreground">
        {t('addonsPerUnit', { amount: money(Math.round(perUnit * 100) / 100, item.addons_currency, locale), quantity: item.quantity })}
      </p>
    </div>
  );
}
