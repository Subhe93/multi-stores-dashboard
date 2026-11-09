'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Truck } from 'lucide-react';
import { DEFAULT_BADGE_COLOR, isHexColor } from '@/lib/personalization';
import {
  DEFAULT_RIBBON_COLOR,
  cardSavings,
  perUnitPrice,
  readableTextOn,
  type CardLayout,
} from '@/lib/variantCards';

export interface PreviewCardItem {
  value: string;
  label?: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  ribbon?: string;
  ribbonColor?: string;
  /** Pieces in the value (explicit units or the count fallback, see cardUnitsOf). */
  units?: number;
  price?: number | null;
  compareAt?: number | null;
  /** Free-shipping line / pill (only when the caller knows the threshold). */
  freeShipping?: boolean;
}

interface VariantCardsPreviewProps {
  items: readonly PreviewCardItem[];
  layout: CardLayout;
  showSavings: boolean;
  /** Per-unit line on/off (card_show_unit_price, default on). */
  showUnitPrice?: boolean;
  /** Custom per-unit wording for the previewed locale; empty = automatic "{price} each". */
  unitLabel?: string;
  currency: string;
  /** Number of cards shown (the first values). */
  max?: number;
}

// Class strings and rules mirror the storefront component
// multi-stores-web/src/components/product/personalization/VariantCards.tsx
// (cards v2). Keep both in sync: the store text colour is approximated with
// zinc-900, the store primary is not used here.
const TEXT = '#111827';
const CLS = {
  gridWrap: 'grid grid-cols-1 sm:grid-cols-2',
  gridCard: 'relative flex min-w-0 items-start justify-between gap-3 rounded-xl border-2 bg-white p-3 text-start',
  gridCardIdle: 'border-gray-200',
  listWrap: 'flex flex-col',
  listRow: 'relative flex w-full min-w-0 items-center gap-3 rounded-xl border-2 px-3 py-3 text-start',
  listRowIdle: 'border-transparent',
  ribbon: 'absolute truncate rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm',
  badgeTop: 'absolute -top-2.5 end-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm',
  badgePill: 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold text-gray-900',
  saveChip: 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
  freePill: 'inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700',
  freeLine: 'mt-1 flex items-center gap-1 text-xs font-medium text-green-700',
} as const;
// Neutral savings chip: the text colour on ~10% of itself.
const SAVE_STYLE: CSSProperties = {
  color: TEXT,
  backgroundColor: `color-mix(in srgb, ${TEXT} 10%, #fff)`,
};
// Soft muted background of an unselected list row.
const MUTED_ROW_BG = `color-mix(in srgb, ${TEXT} 5%, #fff)`;

/**
 * Small static preview of the storefront variation cards (cards v2). It only
 * shows where label, ribbon, badge, savings and per-unit price end up, in
 * dashboard colours. The first card is drawn as the selected one.
 */
export function VariantCardsPreview({
  items,
  layout,
  showSavings,
  showUnitPrice = true,
  unitLabel,
  currency,
  max,
}: VariantCardsPreviewProps) {
  const t = useTranslations('variant.cards');
  const locale = useLocale();
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };
  // Every value is shown unless a caller caps the list; the grid wraps, the list scrolls.
  const shown = max === undefined ? items : items.slice(0, max);
  if (shown.length === 0) return <p className="text-xs text-muted-foreground">{t('previewEmpty')}</p>;

  const list = layout === 'list';
  const hasRibbon = shown.some((c) => c.ribbon);

  const dot = (selected: boolean) => (
    <span
      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? 'border-transparent bg-zinc-900' : 'border-gray-300'
      }`}
    >
      {selected && <Check className="size-3 text-white" strokeWidth={3} />}
    </span>
  );

  return (
    <div
      aria-hidden="true"
      className={`mt-2 ${list ? CLS.listWrap : CLS.gridWrap} ${hasRibbon ? 'gap-x-2 gap-y-4 pt-2' : 'gap-2'}`}
    >
      {shown.map((item, i) => {
        const selected = i === 0;
        // Same rule as the storefront: compare-at + chip only with savings on and > 0.5%.
        const savings = showSavings ? cardSavings(item.price, item.compareAt) : null;
        const saveText = savings
          ? savings.percent >= 1
            ? t('save', { percent: savings.percent, amount: money(savings.amount) })
            : t('saveAmount', { amount: money(savings.amount) })
          : null;
        const each = showUnitPrice ? perUnitPrice(item.price, item.units) : null;
        // Same as the storefront: a stored wording is plain text after the price.
        const eachText = each === null ? null : unitLabel ? `${money(each)} ${unitLabel}` : t('each', { price: money(each) });
        const badgeBg = item.badgeColor && isHexColor(item.badgeColor) ? item.badgeColor : DEFAULT_BADGE_COLOR;
        const ribbonBg = item.ribbonColor && isHexColor(item.ribbonColor) ? item.ribbonColor : DEFAULT_RIBBON_COLOR;
        const title = item.label || item.value;

        const ribbon = (pos: string) =>
          item.ribbon ? (
            <span className={`${CLS.ribbon} ${pos}`} style={{ backgroundColor: ribbonBg, color: readableTextOn(ribbonBg) }}>
              {item.ribbon}
            </span>
          ) : null;
        const chip = saveText ? (
          <span className={CLS.saveChip} style={SAVE_STYLE}>
            {saveText}
          </span>
        ) : null;
        const priceBlock = typeof item.price === 'number' ? (
          <span className="flex shrink-0 flex-col items-end text-end">
            <span className={`font-semibold tabular-nums text-gray-900 ${list ? 'text-base font-bold' : 'text-sm'}`}>
              {money(item.price)}
            </span>
            {savings && typeof item.compareAt === 'number' && (
              <s className="text-xs tabular-nums text-gray-400">{money(item.compareAt)}</s>
            )}
            {eachText !== null && <span className="text-xs tabular-nums text-gray-500" dir="auto">{eachText}</span>}
          </span>
        ) : null;
        const texts = (
          <>
            <span className="block break-words text-sm font-semibold text-gray-900" dir="auto">{title}</span>
            {item.sublabel && <span className="block break-words text-xs text-gray-500" dir="auto">{item.sublabel}</span>}
          </>
        );

        if (list) {
          return (
            <div
              key={item.value}
              className={`${CLS.listRow} ${selected ? 'bg-white shadow-sm' : CLS.listRowIdle}`}
              style={selected ? { borderColor: TEXT, boxShadow: `0 0 0 1px ${TEXT}` } : { backgroundColor: MUTED_ROW_BG }}
            >
              {ribbon('-top-2.5 end-4 max-w-[calc(100%-2rem)]')}
              {dot(selected)}
              <span className="min-w-0 flex-1">
                {texts}
                {(item.badge || item.freeShipping || chip) && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.badge && (
                      <span className={CLS.badgePill} style={{ backgroundColor: badgeBg }}>
                        {item.badge}
                      </span>
                    )}
                    {item.freeShipping && (
                      <span className={CLS.freePill}>
                        <Truck className="size-3" /> {t('freeShipping')}
                      </span>
                    )}
                    {chip}
                  </span>
                )}
              </span>
              {priceBlock}
            </div>
          );
        }
        return (
          <div
            key={item.value}
            className={`${CLS.gridCard} ${selected ? 'shadow-sm' : CLS.gridCardIdle}`}
            style={selected ? { borderColor: TEXT } : undefined}
          >
            {item.badge && (
              <span className={CLS.badgeTop} style={{ backgroundColor: badgeBg }}>
                {item.badge}
              </span>
            )}
            {ribbon(item.badge ? '-top-2.5 start-3 max-w-[calc(50%-1rem)]' : '-top-2.5 start-3 max-w-[calc(100%-1.5rem)]')}
            <span className="flex min-w-0 items-start gap-2.5">
              {dot(selected)}
              <span className="min-w-0">
                {texts}
                {item.freeShipping && (
                  <span className={CLS.freeLine}>
                    <Truck className="size-3" /> {t('freeShipping')}
                  </span>
                )}
                {chip && <span className="mt-1 flex flex-wrap gap-1">{chip}</span>}
              </span>
            </span>
            {priceBlock}
          </div>
        );
      })}
    </div>
  );
}
