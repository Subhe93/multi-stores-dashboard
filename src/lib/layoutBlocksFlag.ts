// Per-store beta flag for the product layout blocks (store app
// `product_layout`): layout containers (Row / Column / Grid) and the new
// product blocks. Pure (no imports) so the node test runner can load it.
// The API enforces the same rule (pages-v2 section-tree.ts).

/** Page types whose builder may use layout containers (API CONTAINER_PAGE_TYPES). */
export const LAYOUT_CONTAINER_PAGE_TYPES: readonly string[] = ['PRODUCT_TEMPLATE'];

/**
 * Whether the builder offers layout containers and the new product blocks:
 * only on a page type that allows containers AND only when the store's
 * `product_layout` app is in effect. Anything else keeps the builder exactly
 * as before the containers existed.
 */
export function layoutBlocksEnabled(pageType: string | null | undefined, appEnabled: boolean): boolean {
  return appEnabled === true && !!pageType && LAYOUT_CONTAINER_PAGE_TYPES.includes(pageType);
}
