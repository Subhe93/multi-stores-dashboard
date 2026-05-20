'use client';

import { useCurrency } from '@/lib/useCurrency';
import { pickTranslation } from './types';
import type { BundleOffer } from './types';

interface Props {
  offers: BundleOffer[];
  primaryLocale: string;
  /** Reference unit price used to compute displayed totals. Comes from the
   * first attached product when available, otherwise a sample value. */
  unitPrice?: number;
  /** Pricing strategy of the reference product. Used to caveat the preview
   * for PER_VARIANT/MARGIN where the price varies per variant. */
  pricingType?: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
}

function computeTotals(offer: BundleOffer, unit: number) {
  const original = unit * offer.quantity;
  let final = original;
  switch (offer.discount_type) {
    case 'ITEM':
      // Customer pays for (quantity) units, gets (discount_value) extra units free.
      // The displayed "original" therefore covers (quantity + discount_value) units.
      final = unit * offer.quantity;
      return {
        original: unit * (offer.quantity + offer.discount_value),
        final,
      };
    case 'PERCENTAGE':
      final = original * (1 - offer.discount_value / 100);
      return { original, final };
    case 'FIXED':
      final = Math.max(0, original - offer.discount_value);
      return { original, final };
  }
}

export function BundlePreview({ offers, primaryLocale, unitPrice = 50, pricingType }: Props) {
  const { fmt } = useCurrency();
  const isVariantPricing = pricingType === 'PER_VARIANT' || pricingType === 'MARGIN';

  const sorted = [...offers].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-1 text-sm font-semibold">Preview</div>
      <p className="mb-4 text-xs text-muted-foreground">
        A standard preview of how this bundle will look on your pages.
      </p>

      {sorted.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
          Add at least one offer to see the preview
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((offer, idx) => {
            const t = pickTranslation(offer.translations, primaryLocale);
            const title = t?.title || `Offer ${idx + 1}`;
            const label = t?.label || '';
            const sticker = t?.sticker_text || '';
            const totals = computeTotals(offer, unitPrice);
            const isFirst = idx === 0;

            return (
              <div
                key={offer.id ?? idx}
                className={`relative rounded-lg border p-3 transition ${
                  isFirst ? 'border-blue-400 ring-1 ring-blue-200' : 'border-zinc-200'
                }`}
              >
                {sticker && (
                  <span className="absolute -top-2 right-3 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {sticker}
                  </span>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{title}</span>
                      {label && (
                        <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                          {label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      {fmt(totals.final.toFixed(2))}
                    </span>
                    {totals.original > totals.final && (
                      <span className="text-xs text-muted-foreground line-through tabular-nums">
                        {fmt(totals.original.toFixed(2))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        {isVariantPricing
          ? `Totals computed against the cheapest variant price of ${fmt(unitPrice.toFixed(2))}. Other variants will yield different totals.`
          : `Totals computed against a unit price of ${fmt(unitPrice.toFixed(2))}.`}
      </p>
    </div>
  );
}
