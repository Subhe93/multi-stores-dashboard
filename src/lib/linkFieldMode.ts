// Link field modes (M165): a `type: 'url'` field holds either a typed URL
// (Custom URL) or a product reference `product:<id>` written by the product
// picker. The mode is derived from the stored value; this module is pure so
// `node --test` can cover it (src/lib/linkFieldMode.test.mjs).

import { formatProductRef, parseStoreLinkRef } from '@multi-stores/core/link-ref';

export type LinkFieldMode = 'custom' | 'product';
export type ProductLinkFlag = 'off' | 'prefer' | undefined;

/** Whether the field offers the Product mode at all. */
export function productLinkEnabled(flag: ProductLinkFlag): boolean {
  return flag !== 'off';
}

/** Product id of a stored product reference, or null. */
export function productRefId(value: unknown): string | null {
  return parseStoreLinkRef(value)?.id ?? null;
}

/**
 * Mode of a stored value: a product reference opens in Product mode; any
 * other non-empty value in Custom mode; an empty value in Product mode only
 * when the field prefers it.
 */
export function linkFieldMode(value: unknown, flag: ProductLinkFlag): LinkFieldMode {
  if (!productLinkEnabled(flag)) return 'custom';
  if (productRefId(value)) return 'product';
  const empty = typeof value !== 'string' || value.trim() === '';
  return empty && flag === 'prefer' ? 'product' : 'custom';
}

/** The value written when a product is picked. */
export function pickedProductValue(id: string): string {
  return formatProductRef(id);
}

/**
 * Value of the Custom URL input after switching from Product mode: the
 * picked product's address (`/products/<slug>`) so the owner can edit it,
 * else empty. Switching never erases the stored value silently: the caller
 * writes this only when the owner confirms the switch.
 */
export function customPrefillFromProduct(product: { slug?: string | null } | null | undefined): string {
  const slug = product?.slug?.trim();
  return slug ? `/products/${slug}` : '';
}

/**
 * Switching from Custom to Product mode keeps the typed value stored until a
 * product is picked (returns the value unchanged).
 */
export function valueOnSwitchToProduct(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
