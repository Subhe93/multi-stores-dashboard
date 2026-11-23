// Brand name of a store for the storefront's structured data (M166 F):
// `theme_config.seo.brandName`, optional. Empty = automatic, which is the
// storefront rule `storeBrandName()` (multi-stores-web/src/lib/storeBrand.ts):
// the store name cut at the first spaced " – ", " — " or " | ".

export const BRAND_NAME_MAX = 70;

const SEPARATORS = [' – ', ' — ', ' | '];

/** The name the storefront uses when no brand name is set (same rule as web). */
export function automaticBrandName(storeName: string | null | undefined): string {
  const name = (storeName ?? '').trim();
  let first = -1;
  let sepLength = 0;
  for (const sep of SEPARATORS) {
    const i = name.indexOf(sep);
    if (i >= 0 && (first < 0 || i < first)) {
      first = i;
      sepLength = sep.length;
    }
  }
  if (first > 0) {
    const head = name.slice(0, first).trim();
    const tail = name.slice(first + sepLength).trim();
    if (head && tail) return head;
  }
  return name;
}

/** Input value: whitespace collapsed, trimmed, capped (code points). */
export function cleanBrandName(value: string | null | undefined): string {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, BRAND_NAME_MAX).join('').trim();
}

/**
 * `theme_config.seo` to save: every key already stored is kept (a key set
 * elsewhere is no longer wiped), the meta fields and the brand name are
 * written; an empty brand name removes the key (automatic name).
 */
export function buildSeoConfig(
  previous: unknown,
  fields: { metaTitle: string; metaDescription: string; brandName: string },
): Record<string, unknown> {
  const base =
    previous && typeof previous === 'object' && !Array.isArray(previous) ? { ...(previous as Record<string, unknown>) } : {};
  base.metaTitle = fields.metaTitle;
  base.metaDescription = fields.metaDescription;
  const brandName = cleanBrandName(fields.brandName);
  if (brandName) base.brandName = brandName;
  else delete base.brandName;
  return base;
}
