// Creator earnings that never pass through the platform: a cash-on-delivery
// order of a marketplace store. The customer paid in cash, so the platform
// has nothing to pay out; the creator pages say "Outside the platform"
// instead of "paid" / "awaiting" (the supplier pages already do, as
// "offline"). Independent stores are not concerned: their COD cash is the
// store's own revenue.
// Pure (no imports) so the node test runner can load it.

/**
 * True for a cash-on-delivery order of a marketplace store. `storeType` is
 * the owner's store type; unknown (still loading) reads as false, so the page
 * shows what it showed before.
 */
export function isOfflineEarning(
  order: { payment_method?: string | null } | null | undefined,
  storeType: string | null | undefined,
): boolean {
  return storeType === 'MARKETPLACE' && order?.payment_method === 'COD';
}

/** The fields of GET /commissions/summary this module reads. */
export interface OfflineSummaryFields {
  offline?: number | string | null;
  by_currency?: Array<{ currency: string; offline?: number | string | null }> | null;
}

/** One hint line: an amount, in `currency` or (null) in the dashboard currency. */
export interface OfflineHintRow {
  currency: string | null;
  amount: number;
}

const positive = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * The "settled outside platform payouts" hints of the earnings page. Several
 * currencies: one row per currency that has an offline amount. Otherwise one
 * row with the amount of the summary itself. An API that does not send
 * `offline` yet gives no row.
 */
export function offlineHintRows(summary: OfflineSummaryFields | null | undefined): OfflineHintRow[] {
  if (!summary) return [];
  const rows = Array.isArray(summary.by_currency) ? summary.by_currency : [];
  if (rows.length > 1) {
    return rows
      .filter((row) => positive(row.offline) > 0)
      .map((row) => ({ currency: row.currency, amount: positive(row.offline) }));
  }
  const total = positive(summary.offline);
  if (total > 0) return [{ currency: null, amount: total }];
  const only = rows[0];
  return only && positive(only.offline) > 0 ? [{ currency: only.currency, amount: positive(only.offline) }] : [];
}
