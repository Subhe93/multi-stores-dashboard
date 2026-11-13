// Which sections the builder's "Add section" palette offers for a page type.
// Pure (no imports) so the node test runner can load it.

export type BuilderPageType =
  | 'HOME'
  | 'STATIC'
  | 'LANDING'
  | 'PRODUCT_TEMPLATE'
  | 'CATALOG_TEMPLATE'
  | 'COLLECTION_TEMPLATE'
  | 'HEADER'
  | 'FOOTER';

/** The availability-related part of a section schema. */
export interface SectionAvailability {
  pageTypes?: readonly BuilderPageType[];
  chrome?: boolean;
  /** Feature gate: hidden unless the caller enables it (see AvailabilityOptions). */
  gate?: 'layout-containers';
}

export interface AvailabilityOptions {
  /**
   * Offer the nested layout containers (layout-row / -column / -grid). Off by
   * default so the palette stays as before until the tree builder and the
   * per-store flag are wired in.
   */
  layoutContainers?: boolean;
}

function isChromePageType(pageType: BuilderPageType): boolean {
  return pageType === 'HEADER' || pageType === 'FOOTER';
}

/**
 * - `pageTypes` set: the section shows only on those page types.
 * - `pageTypes` omitted: every page type EXCEPT HEADER/FOOTER, so page-content
 *   sections don't pollute the chrome builders. Chrome-only sections set
 *   pageTypes: ['HEADER'] or ['FOOTER'].
 * - `chrome: true`: additionally allowed in HEADER and FOOTER, whatever the
 *   rule above says (embed-code: content pages plus the store chrome).
 * - `gate` set: hidden unless the matching option is enabled.
 */
export function isAvailableForPageType(
  schema: SectionAvailability,
  pageType: BuilderPageType,
  options: AvailabilityOptions = {},
): boolean {
  if (schema.gate === 'layout-containers' && !options.layoutContainers) return false;
  if (schema.chrome && isChromePageType(pageType)) return true;
  if (schema.pageTypes && schema.pageTypes.length > 0) {
    return schema.pageTypes.includes(pageType);
  }
  return !isChromePageType(pageType);
}
