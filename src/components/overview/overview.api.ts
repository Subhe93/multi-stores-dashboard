import { api, ApiError } from '@/lib/api';

// Types and fetchers for the creator overview (dashboard home).
// Contract: plans/namez-store-apps/OVERVIEW-ANALYTICS-CONTRACT.md

export const OVERVIEW_RANGES = ['today', '7d', '30d', '90d', '12m'] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];
export const DEFAULT_RANGE: OverviewRange = '30d';

export function parseRange(raw: string | null | undefined): OverviewRange {
  return (OVERVIEW_RANGES as readonly string[]).includes(raw ?? '')
    ? (raw as OverviewRange)
    : DEFAULT_RANGE;
}

export type Granularity = 'hour' | 'day' | 'month';

export interface KpiValue {
  value: number;
  previous: number;
}

export interface SeriesPoint {
  /** Bucket start in the store timezone: YYYY-MM-DD, YYYY-MM or YYYY-MM-DDTHH:00. */
  t: string;
  revenue: number;
  orders: number;
}

export interface OverviewProductRef {
  id: string;
  kind: 'own' | 'custom';
  title: string;
  image?: string | null;
}

export interface TopProduct extends OverviewProductRef {
  quantity: number;
  revenue: number;
}

export interface LowStockProduct extends OverviewProductRef {
  stock: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  customer_name?: string | null;
  total: number;
  currency?: string | null;
  status: string;
  payment_status?: string | null;
  created_at: string;
}

export interface OverviewTodo {
  unfulfilled_orders?: number;
  pending_payment_orders?: number;
  low_stock_products?: number;
  draft_products?: number;
  pending_review_products?: number;
}

export interface OverviewSetup {
  has_products?: boolean;
  has_logo?: boolean;
  has_payment?: boolean;
  has_shipping?: boolean;
  has_domain?: boolean;
  has_published_theme?: boolean;
}

export interface OverviewResponse {
  range: OverviewRange;
  granularity: Granularity;
  from: string;
  to: string;
  timezone: string;
  currency: string;
  store_type: 'INDEPENDENT' | 'MARKETPLACE';
  kpis: {
    revenue: KpiValue;
    orders: KpiValue;
    aov: KpiValue;
    items_sold: KpiValue;
    customers: KpiValue;
    returning_customers: KpiValue;
    earnings: KpiValue | null;
  };
  series: SeriesPoint[];
  previous_series: SeriesPoint[];
  status_breakdown: { status: string; count: number }[];
  sales_by_market: { key: string; label: string; revenue: number; orders: number }[];
  payment_methods: { method: string; revenue: number; orders: number }[];
  top_products: TopProduct[];
  recent_orders: RecentOrder[];
  todo: OverviewTodo;
  low_stock: LowStockProduct[];
  setup: OverviewSetup;
}

/** Legacy data shown while the overview endpoint is not deployed (404). */
export interface OverviewFallback {
  totalOrders: number;
  productCount: number | null;
  earningsThisMonth: number | null;
  recentOrders: RecentOrder[];
}

export type OverviewResult =
  | { kind: 'full'; data: OverviewResponse }
  | { kind: 'fallback'; data: OverviewFallback };

interface LegacyOrder {
  id: string | number;
  order_number: string;
  total: number | string;
  currency?: string | null;
  status: string;
  payment_status?: string | null;
  created_at: string;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce numeric fields that may arrive as decimal strings. */
function normalize(data: OverviewResponse): OverviewResponse {
  const kv = (k: KpiValue | null | undefined): KpiValue => ({
    value: num(k?.value),
    previous: num(k?.previous),
  });
  const k = data.kpis ?? ({} as OverviewResponse['kpis']);
  return {
    ...data,
    kpis: {
      revenue: kv(k.revenue),
      orders: kv(k.orders),
      aov: kv(k.aov),
      items_sold: kv(k.items_sold),
      customers: kv(k.customers),
      returning_customers: kv(k.returning_customers),
      earnings: k.earnings ? kv(k.earnings) : null,
    },
    series: (data.series ?? []).map((p) => ({ ...p, revenue: num(p.revenue), orders: num(p.orders) })),
    previous_series: (data.previous_series ?? []).map((p) => ({
      ...p,
      revenue: num(p.revenue),
      orders: num(p.orders),
    })),
    status_breakdown: data.status_breakdown ?? [],
    sales_by_market: (data.sales_by_market ?? []).map((m) => ({ ...m, revenue: num(m.revenue) })),
    payment_methods: (data.payment_methods ?? []).map((m) => ({ ...m, revenue: num(m.revenue) })),
    top_products: (data.top_products ?? []).map((p) => ({ ...p, revenue: num(p.revenue) })),
    recent_orders: (data.recent_orders ?? []).map((o) => ({ ...o, total: num(o.total) })),
    todo: data.todo ?? {},
    low_stock: data.low_stock ?? [],
    setup: data.setup ?? {},
  };
}

async function fetchFallback(
  token: string,
  independent: boolean,
  signal: AbortSignal,
): Promise<OverviewFallback> {
  const productsPath = independent ? '/products/mine?limit=1' : '/custom-products?limit=1';
  const [comm, orders, products] = await Promise.all([
    independent
      ? Promise.resolve(null)
      : api<{ this_month?: number }>('/commissions/summary', { token, signal }).catch(() => null),
    api<{ data: LegacyOrder[]; meta: { total: number } }>('/orders?limit=6', { token, signal }),
    api<{ meta: { total: number } }>(productsPath, { token, signal }).catch(() => null),
  ]);
  return {
    totalOrders: num(orders?.meta?.total),
    productCount: products ? num(products.meta?.total) : null,
    earningsThisMonth: comm ? num(comm.this_month) : null,
    recentOrders: (orders?.data ?? []).map((o) => ({
      id: String(o.id),
      order_number: o.order_number,
      customer_name: o.customer
        ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(' ') || null
        : null,
      total: num(o.total),
      currency: o.currency ?? null,
      status: o.status,
      payment_status: o.payment_status ?? null,
      created_at: o.created_at,
    })),
  };
}

/**
 * Loads the overview for a range. Falls back to the legacy endpoints when
 * GET /stores/my/overview is not deployed yet (404), so the page still works.
 */
export async function fetchOverview(
  token: string,
  range: OverviewRange,
  opts: { independent: boolean; signal: AbortSignal },
): Promise<OverviewResult> {
  // No `tz` is sent: buckets follow the store timezone (server default) so
  // every staff member sees the same days regardless of their browser zone.
  try {
    const data = await api<OverviewResponse>(`/stores/my/overview?range=${range}`, {
      token,
      signal: opts.signal,
    });
    return { kind: 'full', data: normalize(data) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { kind: 'fallback', data: await fetchFallback(token, opts.independent, opts.signal) };
    }
    throw err;
  }
}
