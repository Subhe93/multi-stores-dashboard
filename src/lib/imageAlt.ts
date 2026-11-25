// M170 A: alt text of a product image per language (product editor).
//
// `alt_text` is the default alt (the store primary language); the other
// languages live in `alt_translations` (`{ "de": "..." }`). The API mirror
// is multi-stores-api/src/common/catalog/image-alt-translations.ts: it drops
// the primary-language key and refuses a text over IMAGE_ALT_MAX.

/** Same limit as the API (`IMAGE_ALT_MAX`). */
export const IMAGE_ALT_MAX = 300;

export interface ImageWithAlt {
  alt_text?: string | null;
  alt_translations?: Record<string, string> | null;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The stored map as a plain record of strings (anything else is dropped). */
export function readAltTranslations(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isPlainObject(raw)) return out;
  for (const [locale, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[locale] = value;
  }
  return out;
}

/** The text the alt input of `locale` shows for this image. */
export function altValueFor(image: ImageWithAlt, locale: string, primaryLocale: string): string {
  if (locale === primaryLocale) return image.alt_text || '';
  return readAltTranslations(image.alt_translations)[locale] ?? '';
}

/**
 * The image with the alt of `locale` set to `value` (kept as typed; trimmed
 * when saved). The primary language edits `alt_text`, any other language its
 * key of `alt_translations`; an emptied field removes the key.
 */
export function withImageAlt<I extends ImageWithAlt>(image: I, locale: string, primaryLocale: string, value: string): I {
  if (locale === primaryLocale) return { ...image, alt_text: value };
  const map = readAltTranslations(image.alt_translations);
  if (value === '') delete map[locale];
  else map[locale] = value;
  return { ...image, alt_translations: Object.keys(map).length > 0 ? map : null };
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * `alt_translations` as the save payload sends it: texts trimmed with inner
 * whitespace collapsed, empty ones and the primary-language key dropped,
 * `null` when nothing is left. Always explicit (an object or null), so a
 * cleared text is really cleared; only older clients rely on the API
 * carrying the stored map over.
 */
export function altTranslationsPayload(image: ImageWithAlt, primaryLocale?: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [locale, value] of Object.entries(readAltTranslations(image.alt_translations))) {
    const text = clean(value);
    if (text && locale !== primaryLocale) out[locale] = text;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Stable form of the map for the unsaved-changes snapshot (keys sorted). */
export function altTranslationsSnapshot(image: ImageWithAlt, primaryLocale?: string): Record<string, string> {
  const payload = altTranslationsPayload(image, primaryLocale) ?? {};
  return Object.fromEntries(Object.entries(payload).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Languages (of `locales`) in which at least one image has an alt text. */
export function altFilledLocales(
  images: readonly ImageWithAlt[],
  locales: readonly string[],
  primaryLocale: string,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const locale of locales) {
    out[locale] = images.some((img) => clean(altValueFor(img, locale, primaryLocale)) !== '');
  }
  return out;
}
