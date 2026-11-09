// Pure helpers of the variation cards v2 (plans/variant-cards-v2/SPEC.md):
// option-level layout / savings flags, value-level ribbon + units, and the
// savings math the storefront uses. Unit-tested in variantCards.test.mjs.

export const CARD_LAYOUTS = ['grid', 'list'] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];
export const DEFAULT_CARD_LAYOUT: CardLayout = 'grid';

export const DEFAULT_RIBBON_COLOR = '#111827';
export const RIBBON_MAX_LENGTH = 40;
export const MIN_UNITS = 2;
export const MAX_UNITS = 99;
/** Max length of the per-unit wording (card_unit_label and each i18n entry). */
export const UNIT_LABEL_MAX_LENGTH = 30;

/**
 * Automatic per-unit wording per store locale: the word the storefront puts
 * next to the per-piece price when no custom wording is stored (mirrors the
 * web's personalization.each messages). Only used as the input placeholder.
 */
export const AUTO_UNIT_WORDING: Record<string, string> = {
  en: 'each',
  ar: 'للقطعة',
  tr: 'tanesi',
  de: 'pro Stück',
  fr: 'l’unité',
  sv: '/st',
};

export function autoUnitWording(locale: string | undefined): string {
  const code = (locale ?? '').toLowerCase().split('-')[0] ?? '';
  return AUTO_UNIT_WORDING[code] ?? AUTO_UNIT_WORDING.en!;
}

/** Savings below this share of the compare-at price are not shown. */
const MIN_SAVINGS_SHARE = 0.005;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isCardLayout(v: unknown): v is CardLayout {
  return typeof v === 'string' && (CARD_LAYOUTS as readonly string[]).includes(v);
}

/** Stored layout or the default ('grid', today's look). */
export function cardLayoutOf(option: { card_layout?: unknown } | null | undefined): CardLayout {
  return isCardLayout(option?.card_layout) ? option.card_layout : DEFAULT_CARD_LAYOUT;
}

/** Savings are opt-in: only an explicit `card_show_savings: true` turns them on. */
export function cardShowSavingsOf(option: { card_show_savings?: unknown } | null | undefined): boolean {
  return option?.card_show_savings === true;
}

/** The per-unit line is on by default; only an explicit `false` hides it. */
export function cardShowUnitPriceOf(option: { card_show_unit_price?: unknown } | null | undefined): boolean {
  return option?.card_show_unit_price !== false;
}

/**
 * Pieces of a value: explicit `units` (2..99) always wins; without it the
 * repeat `count` is used when it is an integer >= 2. Undefined otherwise.
 */
export function cardUnitsOf(meta: { units?: unknown; count?: unknown } | null | undefined): number | undefined {
  const u = meta?.units;
  if (typeof u === 'number' && Number.isInteger(u) && u >= MIN_UNITS && u <= MAX_UNITS) return u;
  const c = meta?.count;
  if (typeof c === 'number' && Number.isInteger(c) && c >= MIN_UNITS && c <= MAX_UNITS) return c;
  return undefined;
}

export interface UnitLabelSource {
  card_unit_label?: unknown;
  card_unit_label_i18n?: unknown;
}

/**
 * Custom per-unit wording for a locale: i18n[locale] → i18n[primary] → base
 * label → undefined (the caller then uses the automatic wording).
 */
export function unitLabelOf(
  option: UnitLabelSource | null | undefined,
  locale?: string,
  primaryLocale?: string,
): string | undefined {
  if (!option) return undefined;
  const i18n = option.card_unit_label_i18n;
  const map = i18n && typeof i18n === 'object' && !Array.isArray(i18n) ? (i18n as Record<string, unknown>) : {};
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return (
    (locale ? pick(map[locale]) : undefined) ??
    (primaryLocale ? pick(map[primaryLocale]) : undefined) ??
    pick(option.card_unit_label)
  );
}

/**
 * Parses the units input: '' = not set (undefined), an integer 2..99 = that
 * number, anything else = null (invalid).
 */
export function parseUnits(raw: string): number | undefined | null {
  const s = raw.trim();
  if (s === '') return undefined;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= MIN_UNITS && n <= MAX_UNITS ? n : null;
}

export interface CardSavings {
  /** Whole percent, rounded down. */
  percent: number;
  /** compare_at − price, two decimals. */
  amount: number;
}

/** Savings of a card, or null when the compare-at price is not meaningfully higher. */
export function cardSavings(price: number | null | undefined, compareAt: number | null | undefined): CardSavings | null {
  if (typeof price !== 'number' || typeof compareAt !== 'number') return null;
  if (!Number.isFinite(price) || !Number.isFinite(compareAt) || price < 0 || compareAt <= 0) return null;
  const diff = compareAt - price;
  if (diff <= 0 || diff / compareAt <= MIN_SAVINGS_SHARE) return null;
  return {
    percent: Math.floor((diff / compareAt) * 100 + 1e-9),
    amount: Math.round(diff * 100) / 100,
  };
}

/** Per-unit price (price / units), two decimals; null without valid units. */
export function perUnitPrice(price: number | null | undefined, units: number | null | undefined): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  if (typeof units !== 'number' || !Number.isInteger(units) || units < MIN_UNITS || units > MAX_UNITS) return null;
  return Math.round((price / units) * 100) / 100;
}

/** Black-ish or white text, whichever reads better on `hex` (WCAG relative luminance). */
export function readableTextOn(hex: string): '#ffffff' | '#111827' {
  if (!HEX_RE.test(hex)) return '#ffffff';
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  // Contrast with white vs with #111827 (luminance ~0.0116).
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.0616) ? '#ffffff' : '#111827';
}

interface VariantLike {
  options: Record<string, string>;
  price: number;
  compare_at_price?: number | null;
  is_active?: boolean;
}

/**
 * Card price of one option value in 'from' mode: the cheapest active variant
 * with that value, with ITS compare-at price (spec: same variant as the price).
 */
export function cheapestVariantFor<T extends VariantLike>(variants: readonly T[], optionName: string, value: string): T | null {
  let best: T | null = null;
  for (const v of variants) {
    if (v.is_active === false || v.options[optionName] !== value) continue;
    if (!best || v.price < best.price) best = v;
  }
  return best;
}
