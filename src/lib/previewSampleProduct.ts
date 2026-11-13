// Sample product for the builder preview of a PRODUCT_TEMPLATE.
//
// The storefront's /builder-preview route asks the API for a sample product
// anonymously, which the storefront gate refuses for a store that is not LIVE
// (DRAFT / PENDING_REVIEW / ...): the product blocks then only show their
// placeholders. The builder holds the owner's session token, so it reads the
// same public endpoints as the owner (the API's optional viewer resolves the
// Bearer token and lets the owner preview the closed store) and posts the
// product to the preview iframe.
//
// Pure (no imports) so the node test runner can load it.

/** Reads one API endpoint and resolves with its `data` (the dashboard `api()`). */
export type PreviewFetcher = (endpoint: string) => Promise<unknown>;

/** Minimal shape the preview needs to adopt a product. */
export interface PreviewProduct {
  id: string;
  slug?: string;
  [key: string]: unknown;
}

/** Whether a value can stand in as the preview's product (an object with an id). */
export function isPreviewProduct(value: unknown): value is PreviewProduct {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { id: string }).id.length > 0
  );
}

/**
 * The product the preview renders: the store's sample product (most recently
 * updated PUBLISHED own product), upgraded to the full product payload of the
 * live product route when it can be read (custom fields, bundles, promotions,
 * shipping, designer...), so every product block renders with data. Falls
 * back to the thin sample when the full read fails, and to null when the
 * store has no product or the sample read fails. Never throws.
 */
export async function loadPreviewSampleProduct(
  fetcher: PreviewFetcher,
  storeSlug: string,
): Promise<PreviewProduct | null> {
  if (!storeSlug) return null;
  const store = encodeURIComponent(storeSlug);
  let sample: unknown;
  try {
    sample = await fetcher(`/storefront/${store}/v2/sample-product`);
  } catch {
    return null;
  }
  if (!isPreviewProduct(sample)) return null;
  const productSlug = typeof sample.slug === 'string' && sample.slug ? sample.slug : '';
  if (!productSlug) return sample;
  try {
    const full = await fetcher(`/storefront/${store}/products/${encodeURIComponent(productSlug)}`);
    // Only the same product may replace the sample (never another row).
    if (isPreviewProduct(full) && full.id === sample.id) {
      return { ...full, slug: productSlug };
    }
  } catch {
    /* keep the thin sample */
  }
  return sample;
}

export interface PreviewUpdateInput {
  themeKey: string;
  customizations: Record<string, unknown>;
  sections: unknown[];
  locale: string;
  primaryLocale: string;
  menus?: unknown[];
  product?: PreviewProduct | null;
}

/**
 * The UPDATE_SECTIONS message the builder posts to the preview iframe. The
 * `product` key is present only when the builder loaded one, so the preview
 * keeps its own server-side sample otherwise (unchanged behaviour).
 */
export function buildPreviewUpdateMessage(input: PreviewUpdateInput): Record<string, unknown> {
  const message: Record<string, unknown> = {
    type: 'UPDATE_SECTIONS',
    themeKey: input.themeKey,
    customizations: input.customizations,
    sections: input.sections,
    locale: input.locale,
    primaryLocale: input.primaryLocale,
    menus: input.menus,
  };
  if (isPreviewProduct(input.product)) message.product = input.product;
  return message;
}
