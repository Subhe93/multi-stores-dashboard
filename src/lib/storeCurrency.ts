// The currency an owner's dashboard formats amounts in.
// Pure (no imports) so the node test runner can load it.

/** The fields of GET /stores/my/store this module reads. */
export interface OwnerStoreCurrencyFields {
  /** Resolved by the API: the currency the store's orders are charged in. */
  effective_currency?: string | null;
  /** The raw store row value; only an independent store sells in it. */
  currency?: string | null;
  store_type?: string | null;
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * The store's display currency, or '' when it is the platform default (the
 * caller then asks the platform config).
 *
 * The API's `effective_currency` wins. Without it (an API that does not send
 * the field yet) only an independent store uses its own row currency: a
 * marketplace row can hold a stale value while its orders are charged in the
 * platform currency.
 */
export function ownStoreCurrency(store: OwnerStoreCurrencyFields | null | undefined): string {
  if (!store) return '';
  const effective = clean(store.effective_currency);
  if (effective) return effective;
  return store.store_type === 'INDEPENDENT' ? clean(store.currency) : '';
}
