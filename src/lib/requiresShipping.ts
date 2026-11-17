// Products that need no shipping (services / digital products), like
// Shopify's "Physical product" setting. This file is the ONLY place in the
// dashboard that reads `requires_shipping` to make a decision; pages call
// these helpers. Rule: only the literal `false` switches shipping off, so a
// missing, null or true value (old API, old rows, cached payloads) keeps
// today's behaviour.

export interface ShippingFlagSource {
  requires_shipping?: boolean | null;
}

/** Product form: the stored value of a loaded product (missing = physical). */
export function productRequiresShipping(product: ShippingFlagSource | null | undefined): boolean {
  return product?.requires_shipping !== false;
}

/** Order snapshot: true when at least one line required shipping when sold. */
export function orderRequiresShipping(order: ShippingFlagSource | null | undefined): boolean {
  return order?.requires_shipping !== false;
}

/** Order line snapshot (Shopify line_item.requires_shipping). */
export function orderLineRequiresShipping(item: ShippingFlagSource | null | undefined): boolean {
  return item?.requires_shipping !== false;
}

/**
 * Body part of a product save. The key is sent only when it matters, so a
 * product that never used the option saves exactly as before:
 * - switched off: `{ requires_shipping: false }`;
 * - switched back on for a product stored as off: `{ requires_shipping: true }`;
 * - otherwise nothing (the API default and the stored value are both true).
 */
export function requiresShippingPayload(
  value: boolean,
  opts: { mode: 'create' | 'edit'; savedValue: boolean },
): { requires_shipping?: boolean } {
  if (!value) return { requires_shipping: false };
  if (opts.mode === 'edit' && !opts.savedValue) return { requires_shipping: true };
  return {};
}

/**
 * Wording of a status badge. `source` is the order, or an order line for a
 * per-item badge. A stored DELIVERED on something that needs no shipping is
 * shown as "Fulfilled"; everything else keeps its normal label.
 */
export type OrderStatusLabelKind = 'fulfilled' | 'default';

export function orderStatusLabelKind(
  status: string | null | undefined,
  source: ShippingFlagSource | null | undefined,
): OrderStatusLabelKind {
  return status === 'DELIVERED' && source?.requires_shipping === false ? 'fulfilled' : 'default';
}

/** Label of a status with the "Fulfilled" wording applied where it belongs. */
export function orderStatusLabel(
  status: string,
  source: ShippingFlagSource | null | undefined,
  normalLabel: (status: string) => string,
  fulfilledLabel: string,
): string {
  return orderStatusLabelKind(status, source) === 'fulfilled' ? fulfilledLabel : normalLabel(status);
}

/**
 * Status dropdown of an order: an order that needs no shipping has no SHIPPED
 * option, and its DELIVERED option reads "Fulfilled". Other orders get the
 * same array back, untouched.
 */
export function withoutShippedOption<T extends { value: string; label: string }>(
  options: readonly T[],
  order: ShippingFlagSource | null | undefined,
  fulfilledLabel?: string,
): T[] {
  if (orderRequiresShipping(order)) return options as T[];
  return options
    .filter((o) => o.value !== 'SHIPPED')
    .map((o) => (o.value === 'DELIVERED' && fulfilledLabel ? { ...o, label: fulfilledLabel } : o));
}

// Statuses from which "Mark as fulfilled" is no longer offered.
const FULFIL_CLOSED_STATUSES = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'];

/** "Mark as fulfilled" is offered for an open order that needs no shipping. */
export function canMarkFulfilled(
  order: (ShippingFlagSource & { status?: string | null }) | null | undefined,
): boolean {
  if (!order || orderRequiresShipping(order)) return false;
  return !FULFIL_CLOSED_STATUSES.includes(order.status ?? '');
}

/** "No shipping" badge: only on a non-shipping line of an order that ships. */
export function showNoShippingBadge(
  order: ShippingFlagSource | null | undefined,
  item: ShippingFlagSource | null | undefined,
): boolean {
  return orderRequiresShipping(order) && !orderLineRequiresShipping(item);
}

/** True when the list has lines and none of them requires shipping. */
export function noLineRequiresShipping(items: readonly ShippingFlagSource[] | null | undefined): boolean {
  return !!items && items.length > 0 && items.every((it) => !orderLineRequiresShipping(it));
}
