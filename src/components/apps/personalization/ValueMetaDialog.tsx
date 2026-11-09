'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveMediaUrl } from '@/lib/media';
import {
  DEFAULT_BADGE_COLOR,
  MAX_VALUE_COUNT,
  VALUE_META_TEXT_KEYS,
  isHexColor,
  optionValueCount,
  type ValueMeta,
  type ValueMetaTextKey,
  type ValueMetaTexts,
} from '@/lib/personalization';
import {
  DEFAULT_RIBBON_COLOR,
  MAX_UNITS,
  MIN_UNITS,
  RIBBON_MAX_LENGTH,
  cardUnitsOf,
  parseUnits,
  unitLabelOf,
  type CardLayout,
  type UnitLabelSource,
} from '@/lib/variantCards';
import { LocaleTabs } from './LocaleTabs';
import { VariantCardsPreview, type PreviewCardItem } from './VariantCardsPreview';

/** The option shape this dialog edits (subset of VariantManager's VariantOption). */
export interface ValueMetaOption {
  name: string;
  style: string;
  values: string[];
  valueMeta?: Record<string, ValueMeta>;
  swatchMap?: Record<string, string>;
}

/** Card preview inputs (cards v2); the preview is shown for 'card' options only. */
export interface ValueMetaPreview {
  layout: CardLayout;
  showSavings: boolean;
  /** Per-unit line on/off (card_show_unit_price, default on). */
  showUnitPrice: boolean;
  /** Option-level per-unit wording (card_unit_label / card_unit_label_i18n), resolved per active locale. */
  unitLabels?: UnitLabelSource;
  currency: string;
  /** Card price and compare-at price per value (cheapest variant with it). */
  prices: Record<string, { price: number | null; compareAt: number | null }>;
}

interface ValueMetaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: ValueMetaOption | null;
  /** Receives the new `valueMeta` and `swatchMap` (undefined = remove the key). */
  onSave: (next: { valueMeta?: Record<string, ValueMeta>; swatchMap?: Record<string, string> }) => void;
  onPickImage?: () => Promise<string | null>;
  uploading?: boolean;
  /** Store content locales; with more than one, texts can be edited per locale (`i18n`). */
  locales?: readonly string[];
  /** Locale of the base texts (label, sublabel, badge, ribbon). */
  primaryLocale?: string;
  preview?: ValueMetaPreview;
}

type Texts = Record<ValueMetaTextKey, string>;

interface Row extends Texts {
  badge_color: string;
  ribbon_color: string;
  count: string;
  units: string;
  swatch: string;
  /**
   * The value has stored `i18n[primaryLocale]` texts: the storefront shows
   * those, so the primary tab edits them (and writes them back) instead of the
   * base texts.
   */
  primaryI18n: boolean;
  /** Texts per secondary locale being edited. */
  i18n: Record<string, Texts>;
}

const textsOf = (src: ValueMetaTexts | undefined): Texts => ({
  label: src?.label ?? '',
  sublabel: src?.sublabel ?? '',
  badge: src?.badge ?? '',
  ribbon: src?.ribbon ?? '',
});

const isTextsObject = (v: unknown): v is ValueMetaTexts => !!v && typeof v === 'object' && !Array.isArray(v);

const toRows = (option: ValueMetaOption, primary: string, secondary: readonly string[]): Record<string, Row> => {
  const out: Record<string, Row> = {};
  for (const v of option.values) {
    const m = option.valueMeta?.[v] ?? {};
    const i18n: Record<string, Texts> = {};
    for (const l of secondary) i18n[l] = textsOf(m.i18n?.[l]);
    const primaryTexts = primary ? m.i18n?.[primary] : undefined;
    const primaryI18n = isTextsObject(primaryTexts);
    out[v] = {
      ...textsOf(primaryI18n ? primaryTexts : m),
      primaryI18n,
      badge_color: m.badge_color ?? '',
      ribbon_color: m.ribbon_color ?? '',
      count: typeof m.count === 'number' ? String(m.count) : '',
      units: typeof m.units === 'number' ? String(m.units) : '',
      swatch: option.swatchMap?.[v] ?? '',
      i18n,
    };
  }
  return out;
};

/** Native colour picker + hex input, validated like the badge colour. */
function ColorCell({
  value,
  fallback,
  label,
  onChange,
}: {
  value: string;
  fallback: string;
  label: string;
  onChange: (v: string) => void;
}) {
  const bad = value !== '' && !isHexColor(value);
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        aria-label={label}
        className="h-7 w-8 shrink-0 cursor-pointer rounded border"
        value={isHexColor(value) && value.length === 7 ? value : fallback}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        className="h-7 w-24 font-mono text-xs"
        dir="ltr"
        placeholder={fallback}
        value={value}
        aria-label={label}
        aria-invalid={bad || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * Per-value details of a variant option (M4.1 D9, C38; cards v2): card label,
 * sublabel, badge and colour, ribbon and colour, units, repeat count, and the
 * swatch image (`swatchMap`, never the product photo). The texts can also be
 * edited per store locale (`i18n[locale]`). Keys this dialog does not edit are kept.
 */
export function ValueMetaDialog({
  open,
  onOpenChange,
  option,
  onSave,
  onPickImage,
  uploading,
  locales,
  primaryLocale,
  preview,
}: ValueMetaDialogProps) {
  const t = useTranslations('variant.valueMeta');
  const [rows, setRows] = useState<Record<string, Row>>({});
  // Rows as seeded on open: only fields that differ from it are written back.
  const [seed, setSeed] = useState<Record<string, Row>>({});
  const [pending, setPending] = useState<string | null>(null);
  const primary = primaryLocale ?? locales?.[0] ?? '';
  const secondary = useMemo(() => (locales ?? []).filter((l) => l && l !== primary), [locales, primary]);
  const [activeLocale, setActiveLocale] = useState(primary);
  const isPrimary = activeLocale === primary || !secondary.includes(activeLocale);

  // Seed once per opening so a parent re-render never discards edits in progress.
  useEffect(() => {
    if (open && option) {
      const seeded = toRows(option, primary, secondary);
      setRows(seeded);
      setSeed(seeded);
      setActiveLocale(primary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  if (!option) return null;

  const set = (value: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [value]: { ...prev[value]!, ...patch } }));

  /** Text of the active locale (the base texts for the primary one). */
  const textOf = (r: Row, key: ValueMetaTextKey) => (isPrimary ? r[key] : (r.i18n[activeLocale]?.[key] ?? ''));
  const setText = (value: string, key: ValueMetaTextKey, text: string) =>
    setRows((prev) => {
      const r = prev[value]!;
      if (isPrimary) return { ...prev, [value]: { ...r, [key]: text } };
      const cur = r.i18n[activeLocale] ?? textsOf(undefined);
      return { ...prev, [value]: { ...r, i18n: { ...r.i18n, [activeLocale]: { ...cur, [key]: text } } } };
    });
  /** Placeholder: the base text on secondary locales, else the value / a sample. */
  const placeholderOf = (r: Row, key: ValueMetaTextKey, v: string, sample?: string) => {
    if (!isPrimary) return r[key] || (key === 'label' ? v : '');
    return key === 'label' ? v : (sample ?? '');
  };

  const countOf = (r: Row) => (r.count === '' ? undefined : Number(r.count));
  const rowIssues = (r: Row) => {
    const c = countOf(r);
    return {
      badColor: r.badge_color !== '' && !isHexColor(r.badge_color),
      badRibbonColor: r.ribbon_color !== '' && !isHexColor(r.ribbon_color),
      badCount: c !== undefined && (!Number.isInteger(c) || c < 0 || c > MAX_VALUE_COUNT),
      badUnits: parseUnits(r.units) === null,
    };
  };
  const invalid = Object.values(rows).some((r) => Object.values(rowIssues(r)).some(Boolean));
  const anyBadUnits = Object.values(rows).some((r) => rowIssues(r).badUnits);
  /** Pieces placeholder: the Count when it is 2 or more (the automatic fallback), else none. */
  const unitsPlaceholder = (r: Row) => {
    const c = countOf(r);
    return c !== undefined && Number.isInteger(c) && c >= MIN_UNITS ? String(c) : '—';
  };

  const handleSave = () => {
    const valueMeta: Record<string, ValueMeta> = {};
    const swatchMap: Record<string, string> = { ...(option.swatchMap ?? {}) };
    for (const v of option.values) {
      const r = rows[v];
      if (!r) continue;
      // Start from the stored entry so unknown keys survive.
      const meta: ValueMeta = { ...(option.valueMeta?.[v] ?? {}) };
      const before = seed[v];
      // Writes a text only when the user changed it, so untouched stored
      // strings (of any locale) are kept exactly as they are.
      const write = <K extends string>(target: Partial<Record<K, string>>, key: K, now: string, was: string | undefined) => {
        if (before && now === was) return;
        const s = now.trim();
        if (s) target[key] = s;
        else delete target[key];
      };
      const i18n: Record<string, ValueMetaTexts> = { ...(meta.i18n ?? {}) };
      if (r.primaryI18n) {
        const entry: ValueMetaTexts = { ...(i18n[primary] ?? {}) };
        for (const key of VALUE_META_TEXT_KEYS) write(entry, key, r[key], before?.[key]);
        i18n[primary] = entry;
      } else {
        for (const key of VALUE_META_TEXT_KEYS) write(meta, key, r[key], before?.[key]);
      }
      write(meta, 'badge_color', r.badge_color, before?.badge_color);
      write(meta, 'ribbon_color', r.ribbon_color, before?.ribbon_color);
      const c = countOf(r);
      if (c === undefined) delete meta.count;
      else meta.count = c;
      const units = parseUnits(r.units);
      if (typeof units === 'number') meta.units = units;
      else delete meta.units;

      // Per-locale texts: only the store's secondary locales are edited here;
      // other stored locales and unknown keys are kept as they are.
      const touched = new Set<string>(r.primaryI18n ? [primary] : []);
      for (const l of secondary) {
        const entry: ValueMetaTexts = { ...(i18n[l] ?? {}) };
        for (const key of VALUE_META_TEXT_KEYS) write(entry, key, r.i18n[l]?.[key] ?? '', before?.i18n[l]?.[key]);
        i18n[l] = entry;
        touched.add(l);
      }
      // Only locales this dialog edits may be dropped when they end up empty.
      for (const l of touched) if (i18n[l] && Object.keys(i18n[l]).length === 0) delete i18n[l];
      if (Object.keys(i18n).length > 0) meta.i18n = i18n;
      else delete meta.i18n;

      if (Object.keys(meta).length > 0) valueMeta[v] = meta;
      if (r.swatch) swatchMap[v] = r.swatch;
      else delete swatchMap[v];
    }
    onSave({
      valueMeta: Object.keys(valueMeta).length > 0 ? valueMeta : undefined,
      swatchMap: Object.keys(swatchMap).length > 0 ? swatchMap : undefined,
    });
    onOpenChange(false);
  };

  const isCard = option.style === 'card';
  const previewItems: PreviewCardItem[] = option.values
    .filter((v) => rows[v])
    .map((v) => {
      const r = rows[v]!;
      // Active-locale text, falling back to the base text like the storefront.
      const pick = (key: ValueMetaTextKey) => textOf(r, key).trim() || r[key].trim() || undefined;
      const units = parseUnits(r.units);
      return {
        value: v,
        label: pick('label'),
        sublabel: pick('sublabel'),
        badge: pick('badge'),
        ribbon: pick('ribbon'),
        badgeColor: r.badge_color,
        ribbonColor: r.ribbon_color,
        // Explicit pieces, else the repeat count (same fallback as the storefront).
        units: cardUnitsOf({ units: typeof units === 'number' ? units : undefined, count: countOf(r) }),
        price: preview?.prices[v]?.price ?? null,
        compareAt: preview?.prices[v]?.compareAt ?? null,
      };
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t('title', { option: option.name || '—' })}</DialogTitle>
          <p className="text-xs text-muted-foreground">{isCard ? t('hintCard') : t('hint')}</p>
        </DialogHeader>

        <LocaleTabs
          primary={primary}
          secondary={secondary}
          active={activeLocale}
          onChange={setActiveLocale}
          hint={t('textsLocaleHint')}
        />

        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-start font-medium">{t('value')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('label')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('sublabel')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('badge')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('badgeColor')}</th>
                {isCard && <th className="px-2 py-2 text-start font-medium">{t('ribbon')}</th>}
                {isCard && <th className="px-2 py-2 text-start font-medium">{t('ribbonColor')}</th>}
                <th className="px-2 py-2 text-start font-medium">{t('count')}</th>
                {isCard && (
                  <th className="min-w-32 whitespace-nowrap px-2 py-2 text-start font-medium" title={t('unitsTooltip')}>
                    <span className="block">{t('units')}</span>
                    <span className="block font-normal normal-case tracking-normal text-muted-foreground/80">{t('unitsCaption')}</span>
                  </th>
                )}
                <th className="px-2 py-2 text-start font-medium">{t('swatch')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {option.values.map((v) => {
                const r = rows[v];
                if (!r) return null;
                const { badCount, badUnits } = rowIssues(r);
                return (
                  <tr key={v} className="align-top">
                    <td className="max-w-32 px-2 py-1.5 font-medium" title={v}>
                      <span className="block truncate">{v}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-28 text-xs"
                        dir="auto"
                        aria-label={t('label')}
                        placeholder={placeholderOf(r, 'label', v)}
                        value={textOf(r, 'label')}
                        onChange={(e) => setText(v, 'label', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-28 text-xs"
                        dir="auto"
                        aria-label={t('sublabel')}
                        placeholder={placeholderOf(r, 'sublabel', v)}
                        value={textOf(r, 'sublabel')}
                        onChange={(e) => setText(v, 'sublabel', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-24 text-xs"
                        dir="auto"
                        aria-label={t('badge')}
                        placeholder={placeholderOf(r, 'badge', v, t('badgePlaceholder'))}
                        value={textOf(r, 'badge')}
                        onChange={(e) => setText(v, 'badge', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <ColorCell
                        value={r.badge_color}
                        fallback={DEFAULT_BADGE_COLOR}
                        label={t('badgeColor')}
                        onChange={(c) => set(v, { badge_color: c })}
                      />
                    </td>
                    {isCard && <td className="px-2 py-1.5">
                      <Input
                        className="h-7 min-w-24 text-xs"
                        dir="auto"
                        maxLength={RIBBON_MAX_LENGTH}
                        aria-label={t('ribbon')}
                        placeholder={placeholderOf(r, 'ribbon', v, t('ribbonPlaceholder'))}
                        value={textOf(r, 'ribbon')}
                        onChange={(e) => setText(v, 'ribbon', e.target.value)}
                      />
                    </td>}
                    {isCard && <td className="px-2 py-1.5">
                      <ColorCell
                        value={r.ribbon_color}
                        fallback={DEFAULT_RIBBON_COLOR}
                        label={t('ribbonColor')}
                        onChange={(c) => set(v, { ribbon_color: c })}
                      />
                    </td>}
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={MAX_VALUE_COUNT}
                        className="h-7 w-20 text-xs"
                        aria-label={t('count')}
                        placeholder={String(optionValueCount({ ...option, valueMeta: undefined }, v))}
                        value={r.count}
                        aria-invalid={badCount || undefined}
                        onChange={(e) => set(v, { count: e.target.value })}
                      />
                    </td>
                    {isCard && <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={MIN_UNITS}
                        max={MAX_UNITS}
                        step={1}
                        className={`h-7 w-24 text-xs ${badUnits ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        aria-label={t('units')}
                        title={t('unitsTooltip')}
                        placeholder={unitsPlaceholder(r)}
                        value={r.units}
                        aria-invalid={badUnits || undefined}
                        onChange={(e) => set(v, { units: e.target.value })}
                      />
                    </td>}
                    <td className="px-2 py-1.5">
                      {r.swatch ? (
                        <div className="relative size-9 overflow-hidden rounded border bg-zinc-50">
                          {/* eslint-disable-next-line @next/next/no-img-element -- merchant media URL */}
                          <img src={resolveMediaUrl(r.swatch)} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label={t('removeSwatch')}
                            className="absolute end-0 top-0 rounded-bl bg-white/90 p-0.5 text-zinc-500 hover:text-red-600"
                            onClick={() => set(v, { swatch: '' })}
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-9"
                          disabled={!onPickImage || !!pending}
                          title={t('swatch')}
                          onClick={async () => {
                            if (!onPickImage) return;
                            setPending(v);
                            try {
                              const url = await onPickImage();
                              if (url) set(v, { swatch: url });
                            } finally {
                              setPending(null);
                            }
                          }}
                        >
                          {pending === v && uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          {isCard && anyBadUnits && (
            <p role="alert" className="text-xs font-medium text-red-600">{t('unitsInvalid')}</p>
          )}
          <p>{t('countHint', { max: MAX_VALUE_COUNT })}</p>
          {isCard && <p>{t('unitsHint', { min: MIN_UNITS, max: MAX_UNITS })}</p>}
          {isCard && <p>{t('ribbonHint', { max: RIBBON_MAX_LENGTH })}</p>}
          {isCard && <p>{t('savingsHint')}</p>}
        </div>

        {isCard && preview && (
          <div className="max-h-[40vh] overflow-y-auto rounded-md border bg-zinc-50/60 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">{t('preview')}</p>
            <VariantCardsPreview
              items={previewItems}
              layout={preview.layout}
              showSavings={preview.showSavings}
              showUnitPrice={preview.showUnitPrice}
              unitLabel={unitLabelOf(preview.unitLabels, activeLocale || undefined, primary || undefined)}
              currency={preview.currency}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={invalid}>
            {t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
