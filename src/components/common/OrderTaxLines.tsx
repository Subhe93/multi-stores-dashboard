'use client';

import { useTranslations } from 'next-intl';
import { formatAmountIn, formatTaxRateLabel, orderTaxLines, type TaxLine, type TaxPricingMode } from '@/lib/taxRate';

interface OrderLike {
  tax_lines?: TaxLine[] | null;
  tax_rate_bp?: number | null;
  tax_amount?: number | string | null;
  total?: number | string | null;
  tax_pricing_mode?: TaxPricingMode | null;
}

interface OrderTaxLinesProps {
  order: OrderLike;
  // Order currency (falls back to the dashboard currency in the caller).
  currency: string;
  // Extra classes for each row (the order pages differ in text size).
  rowClassName?: string;
}

// Itemised tax rows for an order total block. INCLUSIVE orders list the tax
// already contained in the total ("Includes VAT 25 %"); EXCLUSIVE orders list
// the tax added on top of the net lines ("VAT 25 %").
export function OrderTaxLines({ order, currency, rowClassName = '' }: OrderTaxLinesProps) {
  const tp = useTranslations('payments');
  const lines = orderTaxLines(order);
  if (lines.length === 0) return null;
  const exclusive = order.tax_pricing_mode === 'EXCLUSIVE';
  return (
    <>
      {lines.map((line, index) => (
        <div
          key={`${line.label}-${line.rate_bp}-${index}`}
          className={`flex justify-between ${exclusive ? '' : 'text-muted-foreground'} ${rowClassName}`}
        >
          <span>
            {exclusive
              ? tp('taxAddedLine', { label: line.label, rate: formatTaxRateLabel(line.rate_bp) })
              : tp('includesTaxLine', { label: line.label, rate: formatTaxRateLabel(line.rate_bp) })}
          </span>
          <span>{formatAmountIn(line.tax_amount, currency)}</span>
        </div>
      ))}
    </>
  );
}
