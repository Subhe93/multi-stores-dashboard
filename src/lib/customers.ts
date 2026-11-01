// Pure helpers of the Customers pages (creator `/creator/customers` and admin
// `/admin/customers`): URL state, API query strings and response shaping.
// Kept free of React, `@/` imports and browser globals so node:test can load it.

export type CustomerStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BANNED';
export type CustomerType = 'PERSON' | 'COMPANY';

/** One row of `GET /stores/my/customers` (and `/admin/customers`, which adds `store`). */
export interface CustomerRow {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: CustomerStatus | string;
  customer_type: CustomerType | null;
  company_name: string | null;
  orders_count: number;
  total_spent: number | string;
  currency: string | null;
  last_order_at: string | null;
  created_at: string;
  store?: { id: string; name: string; slug: string } | null;
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerList {
  data: CustomerRow[];
  meta: ListMeta;
}

export interface CustomerAddress {
  id: string;
  label?: string | null;
  full_name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country_code: string;
  phone?: string | null;
  company_name?: string | null;
  org_number?: string | null;
  is_default?: boolean;
}

export interface CustomerOrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  currency: string | null;
  created_at: string;
}

export interface CustomerTaxExemptionStatus {
  id: string;
  kind: string;
  vat_number: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface CustomerStats {
  /** Counted orders (the overview rules: paid, not cancelled/refunded). */
  orders_count: number;
  /** Every order of the customer in the store, whatever its status. */
  all_orders_count: number;
  total_spent: number;
  average_order: number;
  last_order_at: string | null;
  currency: string | null;
}

/** Detail of one customer, normalised from the API payload (see `normalizeCustomerDetail`). */
export interface CustomerDetail {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  customer_type: CustomerType | null;
  company_name: string | null;
  org_number: string | null;
  vat_number: string | null;
  created_at: string | null;
  store: { id: string; name: string; slug: string } | null;
  stats: CustomerStats;
  addresses: CustomerAddress[];
  orders: CustomerOrderRow[];
  tax_exemption: CustomerTaxExemptionStatus | null;
}

// ─── List URL state ─────────────────────────────────────────────────────────

export const CUSTOMER_SORT_KEYS = [
  'name',
  'email',
  'orders_count',
  'total_spent',
  'last_order_at',
  'created_at',
] as const;
export type CustomerSortKey = (typeof CUSTOMER_SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

export const HAS_ORDERS_FILTERS = ['yes', 'no'] as const;
export const TYPE_FILTERS = ['company', 'person'] as const;
export const PAGE_SIZE = 20;

export interface CustomerListState {
  q: string;
  hasOrders: '' | (typeof HAS_ORDERS_FILTERS)[number];
  type: '' | (typeof TYPE_FILTERS)[number];
  /** Created-on range, `YYYY-MM-DD` (inclusive). */
  from: string;
  to: string;
  sort: CustomerSortKey | '';
  dir: SortDir;
  page: number;
  /** Admin only: store id filter. */
  store: string;
}

/** Minimal read-only view of URLSearchParams (Next's ReadonlyURLSearchParams fits). */
interface ParamsLike {
  get(name: string): string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Store ids are UUIDs; anything else is dropped rather than sent to the API.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

function validDate(value: string | null): string {
  if (!value || !DATE_RE.test(value)) return '';
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? '' : value;
}

/** Reads the list state from the page URL; unknown or malformed values fall back to defaults. */
export function parseCustomerListState(params: ParamsLike): CustomerListState {
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  const sort = pick(params.get('sort'), CUSTOMER_SORT_KEYS);
  const store = params.get('store') ?? '';
  return {
    q: (params.get('q') ?? '').trim().slice(0, 200),
    hasOrders: pick(params.get('has_orders'), HAS_ORDERS_FILTERS),
    type: pick(params.get('type'), TYPE_FILTERS),
    from: validDate(params.get('from')),
    to: validDate(params.get('to')),
    sort,
    // Without a sort key the direction means nothing; default newest first.
    dir: sort && params.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Number.isFinite(page) && page > 1 ? page : 1,
    store: ID_RE.test(store) ? store : '',
  };
}

/** URL query of a list state (defaults left out), without the leading `?`. */
export function serializeCustomerListState(state: Partial<CustomerListState>): string {
  const sp = new URLSearchParams();
  if (state.q) sp.set('q', state.q);
  if (state.hasOrders) sp.set('has_orders', state.hasOrders);
  if (state.type) sp.set('type', state.type);
  if (state.from) sp.set('from', state.from);
  if (state.to) sp.set('to', state.to);
  if (state.store) sp.set('store', state.store);
  if (state.sort) {
    sp.set('sort', state.sort);
    if (state.dir === 'asc') sp.set('dir', 'asc');
  }
  if (state.page && state.page > 1) sp.set('page', String(state.page));
  return sp.toString();
}

/**
 * Applies a patch to the current URL params. Any change other than the page
 * resets to page 1 (same rule as the collections list). Empty values are removed.
 */
export function patchListParams(current: string, patch: Record<string, string>): string {
  const sp = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value) sp.set(key, value);
    else sp.delete(key);
  }
  if (!('page' in patch)) sp.delete('page');
  return sp.toString();
}

/** True when any filter (not sort or page) narrows the list. */
export function isCustomerListFiltered(state: CustomerListState): boolean {
  return !!(state.q || state.hasOrders || state.type || state.from || state.to || state.store);
}

/**
 * API query string (with the leading `?`) of a list state. `paged: false`
 * leaves page and limit out (the CSV export takes the same filters).
 */
export function customerListQuery(
  state: CustomerListState,
  options: { paged?: boolean; limit?: number; withStore?: boolean } = {},
): string {
  const { paged = true, limit = PAGE_SIZE, withStore = false } = options;
  const sp = new URLSearchParams();
  if (paged) {
    sp.set('page', String(state.page));
    sp.set('limit', String(limit));
  }
  if (state.q) sp.set('search', state.q);
  if (state.hasOrders) sp.set('has_orders', state.hasOrders === 'yes' ? 'true' : 'false');
  if (state.type) sp.set('customer_type', state.type === 'company' ? 'COMPANY' : 'PERSON');
  if (state.from) sp.set('from', state.from);
  if (state.to) sp.set('to', state.to);
  if (state.sort) {
    sp.set('sort', state.sort);
    sp.set('dir', state.dir);
  }
  if (withStore && state.store) sp.set('store_id', state.store);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ─── Display helpers ────────────────────────────────────────────────────────

/** "First Last", else the email. */
export function customerName(c: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
  return name || c.email || '';
}

/** Blocked = any status that stops the customer from signing in. */
export function isBlockedStatus(status: string | null | undefined): boolean {
  return status === 'SUSPENDED' || status === 'BANNED';
}

/**
 * BANNED is set by the platform admin. A store owner can neither lift nor
 * change it (the API answers 403 CUSTOMER_BANNED_BY_ADMIN); the admin can.
 */
export function isBannedStatus(status: string | null | undefined): boolean {
  return status === 'BANNED';
}

/** Whether a store owner may block / unblock a customer with this status. */
export function ownerCanChangeStatus(status: string | null | undefined): boolean {
  return !isBannedStatus(status);
}

/** Skipped rows of a bulk response by reason (`daily_limit`, `banned`, …). */
export function bulkSkipReasons(res: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const skipped = res && typeof res === 'object' ? (res as Record<string, unknown>).skipped : null;
  if (!Array.isArray(skipped)) return out;
  for (const row of skipped) {
    const reason = row && typeof row === 'object' ? (row as { reason?: unknown }).reason : null;
    const key = typeof reason === 'string' && reason ? reason : 'other';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * Largest whole unit between `date` and `now` for Intl.RelativeTimeFormat
 * (negative = in the past). Under a minute returns `{ value: 0, unit: 'minute' }`.
 * Null for missing or invalid dates.
 */
export function relativeTimeParts(
  date: string | null | undefined,
  now: number = Date.now(),
): { value: number; unit: Intl.RelativeTimeFormatUnit } | null {
  if (!date) return null;
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) return null;
  const diffSec = (ms - now) / 1000;
  const abs = Math.abs(diffSec);
  for (const [unit, size] of RELATIVE_UNITS) {
    if (abs >= size) return { value: Math.trunc(diffSec / size), unit };
  }
  return { value: 0, unit: 'minute' };
}

/**
 * Number of rows a bulk response reports as done, else `fallback`. The API
 * answers `{ requested, succeeded: id[], skipped: {id, reason}[] }`.
 */
export function bulkDoneCount(res: unknown, fallback: number): number {
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    for (const key of ['ok', 'updated', 'processed', 'count', 'sent', 'succeeded']) {
      const v = r[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (Array.isArray(v)) return v.length;
    }
  }
  return fallback;
}

/** Number of failed or skipped rows a bulk response reports (0 when it says nothing). */
export function bulkFailedCount(res: unknown): number {
  if (res && typeof res === 'object') {
    let total = 0;
    for (const key of ['failed', 'skipped']) {
      const v = (res as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v)) total += v;
      else if (Array.isArray(v)) total += v.length;
    }
    return total;
  }
  return 0;
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Normalises the detail payload. Stats may come nested (`stats`) or flat on
 * the customer, the orders list as `orders` or `recent_orders`, and the user
 * fields flat or under `user`; the average is derived when absent.
 */
export function normalizeCustomerDetail(raw: unknown): CustomerDetail {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const user = (r.user && typeof r.user === 'object' ? r.user : {}) as Record<string, unknown>;
  const statsRaw = (r.stats && typeof r.stats === 'object' ? r.stats : r) as Record<string, unknown>;
  const ordersCount = num(statsRaw.orders_count);
  const totalSpent = num(statsRaw.total_spent);
  const average =
    statsRaw.average_order !== undefined && statsRaw.average_order !== null
      ? num(statsRaw.average_order)
      : ordersCount > 0
        ? totalSpent / ordersCount
        : 0;
  const ordersRaw = Array.isArray(r.orders) ? r.orders : Array.isArray(r.recent_orders) ? r.recent_orders : [];
  const ct = r.customer_type === 'COMPANY' || r.customer_type === 'PERSON' ? r.customer_type : null;
  const store = r.store && typeof r.store === 'object' ? (r.store as CustomerDetail['store']) : null;
  const exemption =
    r.tax_exemption && typeof r.tax_exemption === 'object'
      ? (r.tax_exemption as CustomerTaxExemptionStatus)
      : null;
  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? user.id ?? ''),
    first_name: str(r.first_name) ?? '',
    last_name: str(r.last_name) ?? '',
    email: str(r.email) ?? str(user.email) ?? '',
    phone: str(r.phone),
    status: str(r.status) ?? str(user.status) ?? 'ACTIVE',
    customer_type: ct,
    company_name: str(r.company_name),
    org_number: str(r.org_number),
    vat_number: str(r.vat_number),
    created_at: str(r.created_at) ?? str(user.created_at),
    store,
    stats: {
      orders_count: ordersCount,
      all_orders_count: Math.max(num(statsRaw.all_orders_count), ordersCount),
      total_spent: totalSpent,
      average_order: average,
      last_order_at: str(statsRaw.last_order_at),
      currency: str(statsRaw.currency) ?? str(r.currency),
    },
    addresses: Array.isArray(r.addresses) ? (r.addresses as CustomerAddress[]) : [],
    orders: ordersRaw as CustomerOrderRow[],
    tax_exemption: exemption && !exemption.revoked_at ? exemption : null,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Light client-side email check before the API validates it. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
