// Item limit of a repeater field (schema `maxItems`). Pure (no imports) so
// the node test runner can load it.

/**
 * True when a repeater holding `count` items must not accept another one.
 * A missing, non-finite or non-positive limit means "unlimited", which is the
 * behaviour of every repeater without `maxItems`.
 */
export function repeaterAtLimit(count: number, maxItems: number | null | undefined): boolean {
  if (typeof maxItems !== 'number' || !Number.isFinite(maxItems) || maxItems <= 0) return false;
  return count >= maxItems;
}
