// Product-level quantity of the product form when the product has variants.
//
// A sale of a product with variants takes stock from the variant row only,
// so the product-level number is never moved by a sale and must not be
// edited (or sent) for such a product. The form shows the sum of the
// variants instead. Same rule as effectiveProductStock in the API
// (multi-stores-api/src/modules/products/effective-stock.ts):
//   - no active variant: the product's own number (editable, as before);
//   - every active variant has a number: their sum (a negative counts as 0);
//   - an active variant without a number (untracked): no total is known.
// Pure (no imports) so the node test runner can load it.

export interface StockVariantLike {
  stock_quantity?: number | null;
  is_active?: boolean | null;
}

export type VariantStockSummary =
  /** No active variant: the product-level number is the one that counts. */
  | { kind: 'product' }
  /** Every active variant carries a number. */
  | { kind: 'sum'; total: number }
  /** At least one active variant is untracked: stock is per variant, no total. */
  | { kind: 'perVariant' };

export function variantStockSummary(variants: readonly StockVariantLike[] | null | undefined): VariantStockSummary {
  const active = (variants ?? []).filter((v) => v.is_active !== false);
  if (active.length === 0) return { kind: 'product' };
  let total = 0;
  for (const v of active) {
    const n = v.stock_quantity;
    if (n === null || n === undefined || !Number.isFinite(n)) return { kind: 'perVariant' };
    total += Math.max(0, n);
  }
  return { kind: 'sum', total };
}

/** True when the variants own the stock: the product-level number is read-only and not sent. */
export function stockIsPerVariant(variants: readonly StockVariantLike[] | null | undefined): boolean {
  return variantStockSummary(variants).kind !== 'product';
}

/**
 * The `stock_quantity` of the product save body: the typed number, or
 * undefined (key not sent) when the field is empty or the variants own the
 * stock.
 */
export function productStockPayload(
  stockQty: string,
  variants: readonly StockVariantLike[] | null | undefined,
): number | undefined {
  if (stockIsPerVariant(variants)) return undefined;
  return stockQty ? parseInt(stockQty) : undefined;
}
