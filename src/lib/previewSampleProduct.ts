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

/**
 * A posted currency the preview may adopt: an ISO-4217 code of three
 * letters, upper-cased. Anything else resolves to null.
 */
export function normalizePreviewCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Store-wide settings the preview takes from the owner's read of the store. */
export interface PreviewStoreInfo {
  /** ISO-4217 code, upper-cased. */
  currency: string;
  /** The store's enabled apps (raw `apps` block; the preview normalizes it). */
  apps: Record<string, unknown>;
  /** The store's tax display settings (raw `tax` block), or null when absent. */
  tax: Record<string, unknown> | null;
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * The store's real currency, enabled apps and tax settings, read once with the
 * owner's token. The preview route reads the store anonymously, and a store
 * that is not LIVE answers with its "coming soon" shell: no currency (the
 * preview priced in the EUR fallback), `apps: {}` (the personalization app
 * stayed off, so fields placed before the variants rendered after the picker)
 * and no tax block. The owner's read gets the full store payload (the
 * storefront gate opens it to the owner). Only a full payload counts: it
 * always carries a valid currency, the shell never does. Null when it cannot
 * be read. Never throws.
 */
export async function loadPreviewStoreInfo(
  fetcher: PreviewFetcher,
  storeSlug: string,
): Promise<PreviewStoreInfo | null> {
  if (!storeSlug) return null;
  try {
    const store = plainObject(await fetcher(`/storefront/${encodeURIComponent(storeSlug)}`));
    if (!store) return null;
    const currency = normalizePreviewCurrency(store.currency);
    if (!currency) return null;
    return { currency, apps: plainObject(store.apps) ?? {}, tax: plainObject(store.tax) };
  } catch {
    return null;
  }
}

/** The store's real currency, read with the owner's token (see loadPreviewStoreInfo). */
export async function loadPreviewStoreCurrency(
  fetcher: PreviewFetcher,
  storeSlug: string,
): Promise<string | null> {
  return (await loadPreviewStoreInfo(fetcher, storeSlug))?.currency ?? null;
}

export interface PreviewUpdateInput {
  themeKey: string;
  customizations: Record<string, unknown>;
  sections: unknown[];
  locale: string;
  primaryLocale: string;
  menus?: unknown[];
  product?: PreviewProduct | null;
  /** The store's currency read with the owner's token (see loadPreviewStoreInfo). */
  currency?: string | null;
  /** The store's apps and tax settings from the same owner read. */
  store?: PreviewStoreInfo | null;
}

/**
 * The UPDATE_SECTIONS message the builder posts to the preview iframe. The
 * `product` key is present only when the builder loaded one, so the preview
 * keeps its own server-side sample otherwise (unchanged behaviour). The same
 * holds for `currency` (present only when it is a valid ISO-4217 code) and for
 * `apps` / `tax` (present only after the owner's read of the store).
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
  const currency = normalizePreviewCurrency(input.currency ?? input.store?.currency);
  if (currency) message.currency = currency;
  // Apps and tax only from a full owner read, so a failed read never turns
  // the route's own (LIVE store) apps off.
  if (input.store) {
    message.apps = input.store.apps;
    message.tax = input.store.tax;
  }
  return message;
}
