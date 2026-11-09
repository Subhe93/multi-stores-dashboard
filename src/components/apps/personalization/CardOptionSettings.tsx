'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import type { ValueMeta } from '@/lib/personalization';
import {
  UNIT_LABEL_MAX_LENGTH,
  autoUnitWording,
  cardLayoutOf,
  cardShowSavingsOf,
  cardShowUnitPriceOf,
  cardUnitsOf,
  cheapestVariantFor,
  unitLabelOf,
  type CardLayout,
} from '@/lib/variantCards';
import { LocaleTabs } from './LocaleTabs';
import { VariantCardsPreview, type PreviewCardItem } from './VariantCardsPreview';

/** The option-level card settings (cards v2) as stored in variant_option_config[i]. */
export interface CardOptionLike {
  name: string;
  values: string[];
  valueMeta?: Record<string, ValueMeta>;
  card_layout?: CardLayout;
  card_show_savings?: boolean;
  /** Per-unit line; absent = true. */
  card_show_unit_price?: boolean;
  /** Custom per-unit wording (base) and per store locale. */
  card_unit_label?: string;
  card_unit_label_i18n?: Record<string, string>;
}

/** The option keys this component edits; `undefined` = key removed. */
export type CardOptionPatch = Pick<
  CardOptionLike,
  'card_layout' | 'card_show_savings' | 'card_show_unit_price' | 'card_unit_label' | 'card_unit_label_i18n'
>;

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
      units: cardUnitsOf(m),
      price: v?.price ?? null,
      compareAt: v?.compare_at_price ?? null,
    };
  });
}

interface CardOptionSettingsProps {
  option: CardOptionLike;
  variants: readonly VariantPriceLike[];
  currency: string;
  /** Store content locales (primary first) for the per-locale wording. */
  locales?: readonly string[];
  primaryLocale?: string;
  /**
   * Receives every edited key: defaults are sent as undefined (key removed):
   * grid layout, savings off, unit price on, empty wording.
   */
  onChange: (patch: CardOptionPatch) => void;
}

/**
 * Option-level settings of a 'card' style option (cards v2): layout (grid or
 * full-width list rows), the savings toggle, the per-unit price toggle and
 * wording (per store locale) and a small preview.
 */
export function CardOptionSettings({ option, variants, currency, locales, primaryLocale, onChange }: CardOptionSettingsProps) {
  const t = useTranslations('variant.cards');
  const layout = cardLayoutOf(option);
  const showSavings = cardShowSavingsOf(option);
  const showUnitPrice = cardShowUnitPriceOf(option);

  const primary = primaryLocale ?? locales?.[0] ?? '';
  const secondary = useMemo(() => (locales ?? []).filter((l) => l && l !== primary), [locales, primary]);
  const [activeLocale, setActiveLocale] = useState(primary);
  // Store locales may arrive after mount: select the primary tab once they do.
  useEffect(() => {
    if (!activeLocale && primary) setActiveLocale(primary);
  }, [activeLocale, primary]);
  const isPrimary = activeLocale === primary || !secondary.includes(activeLocale);

  const patchOf = (): CardOptionPatch => ({
    card_layout: layout === 'grid' ? undefined : layout,
    // Opt-in (existing cards stay unchanged): on = true, off = key removed.
    card_show_savings: showSavings ? true : undefined,
    // Opt-out: on (default) = key removed, off = false.
    card_show_unit_price: showUnitPrice ? undefined : false,
    card_unit_label: option.card_unit_label?.trim() ? option.card_unit_label : undefined,
    card_unit_label_i18n: option.card_unit_label_i18n,
  });
  const emit = (partial: Partial<CardOptionPatch>) => onChange({ ...patchOf(), ...partial });

  /** Wording of the active locale: the base label for the primary one. */
  const unitLabelValue = isPrimary ? (option.card_unit_label ?? '') : (option.card_unit_label_i18n?.[activeLocale] ?? '');
  const setUnitLabel = (raw: string) => {
    const text = raw.slice(0, UNIT_LABEL_MAX_LENGTH);
    if (isPrimary) {
      emit({ card_unit_label: text.trim() ? text : undefined });
      return;
    }
    const i18n: Record<string, string> = { ...(option.card_unit_label_i18n ?? {}) };
    if (text.trim()) i18n[activeLocale] = text;
    else delete i18n[activeLocale];
    emit({ card_unit_label_i18n: Object.keys(i18n).length > 0 ? i18n : undefined });
  };
  // Placeholder = what the storefront shows for this locale without an entry:
  // the base wording on secondary locales, else the automatic wording.
  const unitLabelPlaceholder =
    (isPrimary ? undefined : option.card_unit_label?.trim() || undefined) ?? autoUnitWording(activeLocale || primary);
  const previewUnitLabel = unitLabelOf(option, activeLocale || undefined, primary || undefined);

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
                onClick={() => emit({ card_layout: value === 'grid' ? undefined : value })}
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
            <ToggleSwitch
              checked={showSavings}
              onChange={(next) => emit({ card_show_savings: next ? true : undefined })}
              label={t('showSavings')}
            />
            <span className="text-xs font-medium">{t('showSavings')}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('savingsSource')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t pt-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <ToggleSwitch
              checked={showUnitPrice}
              onChange={(next) => emit({ card_show_unit_price: next ? undefined : false })}
              label={t('showUnitPrice')}
            />
            <span className="text-xs font-medium">{t('showUnitPrice')}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('unitPriceHint')}</p>
        </div>
        {showUnitPrice && (
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor={`unit-label-${option.name}`}>
              {t('unitLabel')}
            </label>
            <LocaleTabs primary={primary} secondary={secondary} active={activeLocale} onChange={setActiveLocale} />
            <Input
              id={`unit-label-${option.name}`}
              className="h-8 max-w-56 text-xs"
              dir="auto"
              maxLength={UNIT_LABEL_MAX_LENGTH}
              placeholder={unitLabelPlaceholder}
              value={unitLabelValue}
              onChange={(e) => setUnitLabel(e.target.value)}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed !== e.target.value) setUnitLabel(trimmed);
              }}
            />
            <p className="text-xs text-muted-foreground">{t('unitLabelHint', { max: UNIT_LABEL_MAX_LENGTH })}</p>
          </div>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        <p className="text-xs font-medium text-muted-foreground">{t('preview')}</p>
        <VariantCardsPreview
          items={previewItemsOf(option, variants)}
          layout={layout}
          showSavings={showSavings}
          showUnitPrice={showUnitPrice}
          unitLabel={previewUnitLabel}
          currency={currency}
        />
      </div>
    </div>
  );
}
