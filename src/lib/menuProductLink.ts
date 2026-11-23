// "Change product" of a PRODUCT menu item (M165). Menus keep their own
// structured reference (kind PRODUCT + resource_id); `url` stays the stored
// fallback (`/products/<primary slug>`), and the storefront resolves the
// per-locale link from `resource_id`. Pure (src/lib/menuProductLink.test.mjs).

import { productRefSlug, productRefTitle, type ProductRefRow } from './productRefsBatch.ts';

export interface MenuProductNode {
  label: string;
  url: string;
  kind: string;
  resource_id: string | null;
}

/**
 * The item after picking `next`: new resource id and fallback url; the label
 * follows the new product only when it still equals the old product's title
 * (an owner-written label is kept).
 */
export function menuItemWithProduct<T extends MenuProductNode>(
  node: T,
  next: ProductRefRow,
  previous: ProductRefRow | null,
  primaryLocale: string,
): T {
  const slug = productRefSlug(next, primaryLocale);
  const oldTitle = previous ? productRefTitle(previous, primaryLocale) : '';
  const newTitle = productRefTitle(next, primaryLocale);
  const followTitle = !!newTitle && (!node.label.trim() || (!!oldTitle && node.label === oldTitle));
  return {
    ...node,
    kind: 'PRODUCT',
    resource_id: next.id,
    url: slug ? `/products/${slug}` : node.url,
    label: followTitle ? newTitle : node.label,
  };
}
