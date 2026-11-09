'use client';

import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import type { ValueMeta } from '@/lib/personalization';
import {
  cardLayoutOf,
  cardShowSavingsOf,
  cheapestVariantFor,
  type CardLayout,
} from '@/lib/variantCards';
import { VariantCardsPreview, type PreviewCardItem } from './VariantCardsPreview';

/** The option-level card settings (cards v2) as stored in variant_option_config[i]. */
export interface CardOptionLike {
  name: string;
  values: string[];
  valueMeta?: Record<string, ValueMeta>;
  card_layout?: CardLayout;
  card_show_savings?: boolean;
}

interface VariantPriceLike {
  options: Record<string, string>;
  price: number;
  compare_at_price?: number | null;
  is_active?: boolean;
}

/** Preview rows of an option: stored value details + the cheapest variant's prices. */
export function previewItemsOf(option: CardOptionLike, variants: readonly VariantPriceLike[]): PreviewCardItem[] {
  return option.values.map((value) => {
    const m = option.valueMeta?.[value] ?? {};
    const v = cheapestVariantFor(variants, option.name, value);
    return {
      value,
      label: m.label,
      sublabel: m.sublabel,
      badge: m.badge,
      badgeColor: m.badge_color,
      ribbon: m.ribbon,
      ribbonColor: m.ribbon_color,
      units: m.units,
      price: v?.price ?? null,
      compareAt: v?.compare_at_price ?? null,
    };
  });
}

interface CardOptionSettingsProps {
  option: CardOptionLike;
  variants: readonly VariantPriceLike[];
  currency: string;
  /** Receives the next layout / savings flag; defaults (grid, savings off) are sent as undefined (key removed). */
  onChange: (patch: { card_layout?: CardLayout; card_show_savings?: boolean }) => void;
}

/**
 * Option-level settings of a 'card' style option (cards v2): layout (grid or
 * full-width list rows), the savings toggle and a small preview.
 */
export function CardOptionSettings({ option, variants, currency, onChange }: CardOptionSettingsProps) {
  const t = useTranslations('variant.cards');
  const layout = cardLayoutOf(option);
  const showSavings = cardShowSavingsOf(option);
  const emit = (nextLayout: CardLayout, nextSavings: boolean) =>
    onChange({
      card_layout: nextLayout === 'grid' ? undefined : nextLayout,
      // Opt-in (existing cards stay unchanged): on = true, off = key removed.
      card_show_savings: nextSavings ? true : undefined,
    });

  const choices: { value: CardLayout; label: string; Icon: typeof LayoutGrid }[] = [
    { value: 'grid', label: t('layoutGrid'), Icon: LayoutGrid },
    { value: 'list', label: t('layoutList'), Icon: Rows3 },
  ];

  return (
    <div className="space-y-3 rounded-md border bg-zinc-50/60 p-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t('layout')}</p>
          <div role="radiogroup" aria-label={t('layout')} className="inline-flex rounded-md border bg-background p-0.5">
            {choices.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={layout === value}
                onClick={() => emit(value, showSavings)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition ${
                  layout === value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <ToggleSwitch checked={showSavings} onChange={(next) => emit(layout, next)} label={t('showSavings')} />
            <span className="text-xs font-medium">{t('showSavings')}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('savingsSource')}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{t('preview')}</p>
        <VariantCardsPreview
          items={previewItemsOf(option, variants)}
          layout={layout}
          showSavings={showSavings}
          currency={currency}
        />
      </div>
    </div>
  );
}
