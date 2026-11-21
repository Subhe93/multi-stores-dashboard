// M157: payment methods per market (dashboard side).
// Pure module (no JSX, no '@/' imports) so the node unit tests can load it.
// Mirrors the API rules in modules/markets/payment-methods.ts (design doc
// plans/namez-store-apps/M157-MARKET-PAYMENT-METHODS-DESIGN.md §2.3, §3.1, §8).

import type {
  PaymentCheck,
  StorePaymentMethodStatus,
  StorePaymentMethodUnavailableReason,
  StorePaymentMethodsView,
} from './markets.api';

/** Payment methods a market can restrict to. Stored and sent in this order. */
export const MARKET_PAYMENT_METHODS = ['card', 'kustom', 'cod'] as const;
export type MarketPaymentMethod = (typeof MARKET_PAYMENT_METHODS)[number];

export const isMarketPaymentMethod = (v: unknown): v is MarketPaymentMethod =>
  typeof v === 'string' && (MARKET_PAYMENT_METHODS as readonly string[]).includes(v);

/** Known values only, unique, in MARKET_PAYMENT_METHODS order. */
export function sortPaymentMethods(values: readonly unknown[]): MarketPaymentMethod[] {
  return MARKET_PAYMENT_METHODS.filter((m) => values.includes(m));
}

/**
 * Reader of `MarketView.payment_methods`. A missing field (API deployed before
 * M157) or null = the store's methods. A non-array value is read fail-closed
 * as [] (nothing allowed), like the API's parsePaymentMethods.
 */
export function readPaymentMethods(raw: unknown): MarketPaymentMethod[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return [];
  return sortPaymentMethods(raw);
}

/** Order-insensitive equality; null (store mode) only equals null. */
export function samePaymentMethods(a: readonly MarketPaymentMethod[] | null, b: readonly MarketPaymentMethod[] | null): boolean {
  if (a === null || b === null) return a === b;
  const sa = sortPaymentMethods(a);
  const sb = sortPaymentMethods(b);
  return sa.length === sb.length && sa.every((m, i) => m === sb[i]);
}

/** Check or uncheck one method; the result is sorted. */
export function togglePaymentMethod(
  value: readonly MarketPaymentMethod[],
  method: MarketPaymentMethod,
  on: boolean,
): MarketPaymentMethod[] {
  const rest = value.filter((m) => m !== method);
  return sortPaymentMethods(on ? [...rest, method] : rest);
}

/** Client mirror of the API value rules (unknown / duplicate cannot come from the editor). */
export function validatePaymentMethods(value: readonly MarketPaymentMethod[] | null): 'empty' | null {
  return value !== null && value.length === 0 ? 'empty' : null;
}

/**
 * The `payment_methods` field of a PUT/POST body: undefined (omit the field)
 * when unchanged, null when switched back to the store's methods, otherwise
 * the sorted subset.
 */
export function paymentMethodsPayload(
  current: readonly MarketPaymentMethod[] | null,
  initial: readonly MarketPaymentMethod[] | null,
): MarketPaymentMethod[] | null | undefined {
  if (samePaymentMethods(current, initial)) return undefined;
  return current === null ? null : sortPaymentMethods(current);
}

/** Methods the store offers (store read loaded), in canonical order. */
export function storeAvailableMethods(store: StorePaymentMethodsView | null): MarketPaymentMethod[] {
  if (!store) return [];
  return sortPaymentMethods(store.methods.filter((s) => s.available).map((s) => s.method));
}

/**
 * Whether the "choose methods" mode cannot be entered now. Custom mode starts
 * from the store's available methods, so without a loaded store read (still
 * loading, failed) or with no available method it would open on [] with every
 * box disabled and the save blocked. The radio waits instead; the card shows
 * the loading text, the retry banner or "no method yet". A stored restriction
 * (already restricted) always stays visible and editable.
 */
export function customModeBlocked(opts: {
  restricted: boolean;
  unsupported: boolean;
  store: StorePaymentMethodsView | null;
}): boolean {
  if (opts.restricted) return false;
  return opts.unsupported || storeAvailableMethods(opts.store).length === 0;
}

export interface PaymentMethodRow {
  method: MarketPaymentMethod;
  /** The store offers the method (false while the store read is not loaded). */
  available: boolean;
  checked: boolean;
  /** The checkbox cannot be toggled. A stale row can still be unchecked. */
  disabled: boolean;
  /** Why the store cannot offer it; null when available or unknown. */
  reason: StorePaymentMethodUnavailableReason | null;
  /** Checked, but the store no longer offers the method: it has no effect. */
  stale: boolean;
  /** card only: the only card route is an ACTIVE TEST own key. */
  testMode: boolean;
}

/**
 * One row per method for the editor's checkboxes. While the store read is not
 * loaded (null) every box is disabled and nothing is marked stale.
 */
export function paymentMethodRows(
  store: StorePaymentMethodsView | null,
  value: readonly MarketPaymentMethod[] | null,
): PaymentMethodRow[] {
  return MARKET_PAYMENT_METHODS.map((method) => {
    const status: StorePaymentMethodStatus | undefined = store?.methods.find((s) => s.method === method);
    const available = !!status?.available;
    const checked = !!value?.includes(method);
    const stale = !!store && checked && !available;
    return {
      method,
      available,
      checked,
      // A stale value stays uncheckable (so the owner can remove it) but a
      // method the store lacks can never be checked.
      disabled: !store || (!available && !checked),
      reason: available ? null : (status?.reason ?? null),
      stale,
      testMode: available && method === 'card' && status?.test_mode === true,
    };
  });
}

export type PaymentMethodsSummaryKey = 'card' | 'kustom' | 'cod' | 'cardKustom' | 'cardCod' | 'kustomCod' | 'all';

/** Key of `creator.markets.paymentMethods.summary.*`; null when unset or empty. */
export function paymentMethodsSummaryKey(value: readonly MarketPaymentMethod[] | null): PaymentMethodsSummaryKey | null {
  if (value === null) return null;
  const v = sortPaymentMethods(value).join('+');
  const map: Record<string, PaymentMethodsSummaryKey> = {
    card: 'card',
    kustom: 'kustom',
    cod: 'cod',
    'card+kustom': 'cardKustom',
    'card+cod': 'cardCod',
    'kustom+cod': 'kustomCod',
    'card+kustom+cod': 'all',
  };
  return map[v] ?? null;
}

/** Payment-check provider of a method (COD has none: it never satisfies the gate). */
export type PaymentCheckProvider = 'stripe' | 'kustom';

/** The provider is used in a market with this setting (null = every provider). */
export function providerUsedInMarket(provider: PaymentCheckProvider, methods: readonly MarketPaymentMethod[] | null): boolean {
  if (methods === null) return true;
  return methods.includes(provider === 'stripe' ? 'card' : 'kustom');
}

/**
 * Go-live gate, mirror of the API paymentCheckPassesFor: unrestricted = Stripe
 * ok OR Kustom ok (as before M157); restricted = an allowed method whose
 * provider is ok. COD never satisfies the gate.
 */
export function paymentCheckPassesFor(
  check: Pick<PaymentCheck, 'stripe' | 'kustom'> | null | undefined,
  methods: readonly MarketPaymentMethod[] | null,
): boolean {
  if (!check) return false;
  return (
    (providerUsedInMarket('stripe', methods) && check.stripe === 'ok') ||
    (providerUsedInMarket('kustom', methods) && check.kustom === 'ok')
  );
}

/** Only COD is checked: such a market can never go LIVE by itself. */
export const isCodOnly = (value: readonly MarketPaymentMethod[] | null): boolean =>
  value !== null && value.length === 1 && value[0] === 'cod';

const INVALID_REASONS = ['unknown', 'duplicate', 'empty'] as const;

/**
 * errors.* key of a MARKET_PAYMENT_METHODS_INVALID body. The errors map is
 * flat (useApiError looks up errors.<code>), so the reason becomes a suffix:
 * MARKET_PAYMENT_METHODS_INVALID_UNKNOWN / _DUPLICATE / _EMPTY. An unknown or
 * missing reason falls back to the base code.
 */
export function paymentMethodsInvalidKey(reason: unknown): string {
  return (INVALID_REASONS as readonly unknown[]).includes(reason)
    ? `MARKET_PAYMENT_METHODS_INVALID_${String(reason).toUpperCase()}`
    : 'MARKET_PAYMENT_METHODS_INVALID';
}

/** Error codes of the market payment_methods setting (scroll to the card on these). */
export const MARKET_PAYMENT_METHODS_ERROR_CODES = ['MARKET_PAYMENT_METHODS_INVALID', 'MARKET_PAYMENT_METHODS_NOT_READY'] as const;
