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
 */
export function isAvailableForPageType(
  schema: SectionAvailability,
  pageType: BuilderPageType,
): boolean {
  if (schema.chrome && isChromePageType(pageType)) return true;
  if (schema.pageTypes && schema.pageTypes.length > 0) {
    return schema.pageTypes.includes(pageType);
  }
  return !isChromePageType(pageType);
}
