// M156: language-country URL paths of a market (/de-de/, /de-at/, /ar/).
// Pure module (no JSX, no '@/' imports) so the node unit tests can load it.
// Mirrors the API rules in modules/markets/locale-paths.ts (design doc
// plans/namez-store-apps/M156-LANG-COUNTRY-URLS-DESIGN.md §3) and the
// activity rule shared with the web (§3.3).

import { CONTENT_LOCALE_CODES } from './contentLocales.ts';
import type {
  MarketLocalePath,
  MarketLocalePathErrorCode,
  MarketLocalePathInactiveReason,
} from './markets.api';

export const LOCALE_PATH_SEGMENT_RE = /^[a-z]{2}(?:-[a-z]{2})?$/;
const LANGUAGE_RE = /^[a-z]{2}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const HREFLANG_RE = /^([a-z]{2})(?:-([A-Z]{2}))?$/;

/**
 * Further ISO 639-1 languages a path may name before the storefront supports
 * them. Such rows are stored but stay inactive (`locale_unsupported`) until
 * the language joins the storefront locales.
 */
export const EXTRA_PATH_LANGUAGES: readonly string[] = ['nl', 'it', 'es', 'pt', 'fi', 'da', 'nb', 'pl', 'cs'];

/** Languages the editor offers: storefront locales first, then the extras. */
export const PATH_LANGUAGES: readonly string[] = [
  ...CONTENT_LOCALE_CODES,
  ...EXTRA_PATH_LANGUAGES.filter((l) => !CONTENT_LOCALE_CODES.includes(l)),
];

/** The URL segment of a row: `de-at` for (de, AT), `ar` for a language-only row. */
export function derivePath(locale: string, country: string | null): string {
  const l = (locale || '').toLowerCase();
  return country ? `${l}-${country.toLowerCase()}` : l;
}

/**
 * hreflang codes of a row. Country row: `de-AT`, plus the plain `de` when
 * `plain` is set (the row answers for every speaker of the language).
 * Language-only row: the plain code alone.
 */
export function defaultHreflang(locale: string, country: string | null, plain: boolean): string[] {
  const l = (locale || '').toLowerCase();
  if (!country) return [l];
  const regional = `${l}-${country.toUpperCase()}`;
  return plain ? [regional, l] : [regional];
}

/** A complete row from the editor's three choices. */
export function buildLocalePath(locale: string, country: string | null, plain: boolean): MarketLocalePath {
  const c = country ? country.toUpperCase() : null;
  return { path: derivePath(locale, c), locale: locale.toLowerCase(), country: c, hreflang: defaultHreflang(locale, c, plain) };
}

/** Whether a row also answers for the plain language code (`de`). */
export function hasPlainCode(row: MarketLocalePath): boolean {
  return row.hreflang.includes(row.locale);
}

export interface LocalePathStatus {
  active: boolean;
  inactive_reason: MarketLocalePathInactiveReason | null;
}

/**
 * The activity rule (identical in api / web / dashboard): active when the
 * language is a storefront locale, is one of the market's (secondary)
 * locales, and the country is null or still in the market. The reason is the
 * first failing rule, in that order.
 */
export function localePathStatus(
  row: Pick<MarketLocalePath, 'locale' | 'country'>,
  market: { locales: readonly string[]; countries: readonly string[] },
  supportedLocales: readonly string[] = CONTENT_LOCALE_CODES,
): LocalePathStatus {
  if (!supportedLocales.includes(row.locale)) return { active: false, inactive_reason: 'locale_unsupported' };
  if (!market.locales.includes(row.locale)) return { active: false, inactive_reason: 'locale_not_enabled' };
  if (row.country !== null && !market.countries.includes(row.country)) {
    return { active: false, inactive_reason: 'country_not_in_market' };
  }
  return { active: true, inactive_reason: null };
}

/** A real ISO 639-1 language: Intl knows its name, or it is in the editor's list. */
export function isKnownLanguage(code: string): boolean {
  if (!LANGUAGE_RE.test(code)) return false;
  if (PATH_LANGUAGES.includes(code)) return true;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' }).of(code);
    return !!name && name.toLowerCase() !== code;
  } catch {
    return false;
  }
}

export interface LocalePathError {
  index: number;
  code: MarketLocalePathErrorCode;
}

/**
 * Client-side mirror of the API rules 1–8 (design §3.2), checked against the
 * values about to be saved. At most one error per row: the first failing
 * rule, in the API's check order. Duplicates are reported on the later row.
 */
export function validateLocalePaths(
  rows: readonly MarketLocalePath[],
  market: { defaultLocale: string; countries: readonly string[] },
): LocalePathError[] {
  const errors: LocalePathError[] = [];
  const paths = new Set<string>();
  const pairs = new Set<string>();
  const codes = new Set<string>();
  rows.forEach((row, index) => {
    const fail = (code: MarketLocalePathErrorCode) => errors.push({ index, code });
    const country = row?.country ?? null;
    // 1. Shape.
    if (
      !row ||
      typeof row.path !== 'string' ||
      !LOCALE_PATH_SEGMENT_RE.test(row.path) ||
      typeof row.locale !== 'string' ||
      !LANGUAGE_RE.test(row.locale) ||
      (country !== null && (typeof country !== 'string' || !COUNTRY_RE.test(country))) ||
      !Array.isArray(row.hreflang) ||
      row.hreflang.length < 1 ||
      row.hreflang.length > 4 ||
      !row.hreflang.every((c) => typeof c === 'string' && HREFLANG_RE.test(c))
    ) {
      return fail('MARKET_LOCALE_PATH_INVALID');
    }
    // 2. A real language (not necessarily a storefront locale yet).
    if (!isKnownLanguage(row.locale)) return fail('MARKET_LOCALE_PATH_LANGUAGE_UNKNOWN');
    // 3. The root serves the default language.
    if (row.locale === market.defaultLocale) return fail('MARKET_LOCALE_PATH_DEFAULT_LOCALE');
    // 4. The path says what it serves.
    if (row.path !== derivePath(row.locale, country)) return fail('MARKET_LOCALE_PATH_MISMATCH');
    // 5. The country belongs to the market.
    if (country !== null && !market.countries.includes(country)) return fail('MARKET_LOCALE_PATH_COUNTRY');
    // 6. Unique path and (language, country).
    const pair = `${row.locale}|${country ?? ''}`;
    if (paths.has(row.path) || pairs.has(pair)) return fail('MARKET_LOCALE_PATH_DUPLICATE');
    paths.add(row.path);
    pairs.add(pair);
    // 7. Each code matches the row; a country row leads with ll-CC.
    const shapeOk = row.hreflang.every((c) => {
      const m = HREFLANG_RE.exec(c);
      return !!m && m[1] === row.locale && (m[2] === undefined || m[2] === country);
    });
    const firstOk = country === null || row.hreflang[0] === `${row.locale}-${country}`;
    if (!shapeOk || !firstOk) return fail('MARKET_LOCALE_PATH_HREFLANG');
    // 8. A code points at one URL only.
    const own = [...new Set(row.hreflang)];
    if (own.some((c) => codes.has(c))) return fail('MARKET_LOCALE_PATH_HREFLANG');
    own.forEach((c) => codes.add(c));
  });
  return errors;
}

/**
 * Primary path of a locale among the ACTIVE rows: the language-only row, else
 * the row whose hreflang has the plain code, else the first in stored order.
 */
export function primaryLocalePath(activeRows: readonly MarketLocalePath[], locale: string): MarketLocalePath | null {
  const own = activeRows.filter((r) => r.locale === locale);
  return own.find((r) => r.country === null) ?? own.find((r) => r.hreflang.includes(locale)) ?? own[0] ?? null;
}

/**
 * Summary of the old bare folders that will redirect: one entry per remapped
 * locale (an active row whose path differs from the locale), in first-seen order.
 */
export function legacyRedirects(activeRows: readonly MarketLocalePath[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (const row of activeRows) {
    if (out.some((r) => r.from === row.locale)) continue;
    const primary = primaryLocalePath(activeRows, row.locale);
    if (primary && primary.path !== row.locale) out.push({ from: row.locale, to: primary.path });
  }
  return out;
}

/** Market countries with no active country row: their visitors use the root or the language-only paths. */
export function countriesWithoutPath(activeRows: readonly MarketLocalePath[], countries: readonly string[]): string[] {
  const covered = new Set(activeRows.map((r) => r.country).filter((c): c is string => !!c));
  return countries.filter((c) => !covered.has(c));
}

/** Rows compared field by field (the form sends locale_paths only when they changed). */
export function sameLocalePaths(a: readonly MarketLocalePath[], b: readonly MarketLocalePath[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => {
    const o = b[i];
    return (
      r.path === o.path &&
      r.locale === o.locale &&
      (r.country ?? null) === (o.country ?? null) &&
      r.hreflang.length === o.hreflang.length &&
      r.hreflang.every((c, j) => c === o.hreflang[j])
    );
  });
}

/** Strip the view-only fields of stored rows. */
export function toLocalePathInput(rows: readonly MarketLocalePath[] | null | undefined): MarketLocalePath[] {
  return (rows ?? []).map((r) => ({ path: r.path, locale: r.locale, country: r.country ?? null, hreflang: [...r.hreflang] }));
}

/** Language name in the UI locale, e.g. 'nl' → 'Nederlands' / 'Dutch'; the code when Intl has none. */
export function languageName(code: string, uiLocale: string): string {
  try {
    const name = new Intl.DisplayNames([uiLocale, 'en'], { type: 'language', fallback: 'code' }).of(code);
    if (name && name.toLowerCase() !== code) return name;
  } catch {
    // Unsupported locale or code; fall through.
  }
  return code.toUpperCase();
}
