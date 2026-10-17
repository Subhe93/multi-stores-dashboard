// Production app (M4.3) — dashboard contract of `GET|PUT|POST|DELETE
// /production/my/*` (creator JWT; every route answers 403
// STORE_APP_NOT_ENABLED while the app is off) plus the settings helpers used
// by the settings tab (saved through PUT /stores/my/apps/production).

import { api } from '@/lib/api';
import { qs } from '@/lib/http';

export type ProductionState = 'NONE' | 'NOT_STARTED' | 'IN_PROGRESS' | 'READY';
export type ProductionCheckSource = 'FIELD_VALUE' | 'VARIANT_OPTION' | 'DESIGN' | 'CUSTOM';
export type ProductionOnComplete = 'none' | 'suggest' | 'auto';
export type ProductionCompleteTarget = 'QUALITY_CHECK' | 'SHIPPED';

export interface ProductionCheck {
  id: string;
  order_item_id: string;
  source: ProductionCheckSource;
  source_key: string;
  label: string;
  value: string | null;
  group_index: number | null;
  file_url: string | null;
  upload_id: string | null;
  file_removed: boolean;
  sort_order: number;
  /** Line quantity (how many times the value must be produced). */
  quantity: number;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  done_by_name: string | null;
  /** Source disappeared from the order: shown struck through, not counted. */
  stale: boolean;
  custom: boolean;
}

export interface ProductionProgress {
  total: number;
  done: number;
}

export interface ProductionSummary extends ProductionProgress {
  state: ProductionState;
  completed_at?: string | null;
}

export interface ProductionLine {
  order_item_id: string;
  title: string;
  image_url: string | null;
  quantity: number;
  /** From the order snapshot (frozen at order time), not the live variant. */
  variant_label: string | null;
  fulfillment_status: string;
  fulfiller_type: string;
  /** False for provider-fulfilled lines: no checks, read-only. */
  owned: boolean;
  progress: ProductionProgress;
  checks: ProductionCheck[];
}

export interface ProductionAddress {
  full_name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
}

export interface ProductionWorkspace {
  order: {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    notes: string | null;
    customer_name: string | null;
    shipping_address: ProductionAddress | null;
    shipping_method_name: string | null;
    market: { key: string; name: string; currency: string } | null;
    locale: string | null;
  };
  lines: ProductionLine[];
  summary: ProductionSummary;
  suggestion: { next_status: ProductionCompleteTarget } | null;
  settings: {
    on_complete: ProductionOnComplete;
    complete_target: ProductionCompleteTarget;
    use_quality_check: boolean;
    start_on_first_check: boolean;
  };
  /**
   * `url` is the Bearer-protected creator route
   * `/api/designer/my/orders/:orderId/items/:itemId/print`: never render it
   * as a plain link (401); download it with `downloadPrintFile()`.
   */
  print_files: ProductionPrintFile[];
}

export interface ProductionPrintFile {
  order_item_id: string;
  url: string;
  label: string;
}

/** `POST production/my/backfill`: `remaining` > 0 means press again. */
export interface ProductionBackfillResult {
  synced: number;
  failed: number;
  remaining: number;
}

export interface ProductionWriteResult {
  check: ProductionCheck | null;
  summary: ProductionSummary;
  changed: boolean;
  suggestion: { next_status: ProductionCompleteTarget } | null;
  order_status: string | null;
  auto_advanced_to?: string;
}

export interface ProductionEvent {
  id: string;
  order_id: string;
  check_id: string | null;
  action: string;
  /** Null on sync-driven rows (e.g. COMPLETED after a resync): shown as "System". */
  actor_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ProductionSettings {
  include_variant_options: boolean;
  exclude_option_names: string[];
  exclude_field_types: string[];
  exclude_field_names: string[];
  default_custom_items: string[];
  on_complete: ProductionOnComplete;
  complete_target: ProductionCompleteTarget;
  start_on_first_check: boolean;
  use_quality_check: boolean;
}

export interface ProductionSettingsResponse {
  settings: ProductionSettings;
  defaults: ProductionSettings;
  presets: Record<string, Partial<ProductionSettings>>;
}

export type ProductionSummaries = Record<string, ProductionSummary>;

// Mirrors the API limits (production-settings.ts PRODUCTION_LIMITS).
export const PRODUCTION_LIMITS = {
  exclude_option_names: 20,
  exclude_field_names: 50,
  default_custom_items: 10,
  label: 80,
} as const;

/** Statuses in which the checklist is read-only (API answers PRODUCTION_ORDER_CLOSED). */
export const CLOSED_ORDER_STATUSES = ['CANCELLED', 'REFUNDED', 'RETURNED'];

/** Orders-list `?production=` filter values understood by the API. */
export const PRODUCTION_FILTERS = ['in_production', 'ready', 'not_started'] as const;
export type ProductionFilter = (typeof PRODUCTION_FILTERS)[number];

export const DEFAULT_PRODUCTION_SETTINGS: ProductionSettings = {
  include_variant_options: true,
  exclude_option_names: [],
  exclude_field_types: [],
  exclude_field_names: [],
  default_custom_items: [],
  on_complete: 'suggest',
  complete_target: 'QUALITY_CHECK',
  start_on_first_check: false,
  use_quality_check: true,
};

const BASE = '/production/my';

export const productionApi = {
  settings: (token: string) => api<ProductionSettingsResponse>(`${BASE}/settings`, { token }),
  summaries: (token: string, orderIds: string[]) =>
    api<ProductionSummaries>(`${BASE}/summaries?order_ids=${orderIds.map(encodeURIComponent).join(',')}`, { token }),
  backfill: (token: string) => api<ProductionBackfillResult>(`${BASE}/backfill`, { method: 'POST', token }),
  workspace: (token: string, orderId: string) =>
    api<ProductionWorkspace>(`${BASE}/orders/${encodeURIComponent(orderId)}`, { token }),
  /** Newest first; `page` 1-based, `limit` at most 200 (API default 50). */
  events: (token: string, orderId: string, q: { page?: number; limit?: number } = {}) =>
    api<ProductionEvent[]>(`${BASE}/orders/${encodeURIComponent(orderId)}/events${qs(q)}`, { token }),
  setCheck: (token: string, checkId: string, done: boolean) =>
    api<ProductionWriteResult>(`${BASE}/checks/${encodeURIComponent(checkId)}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ done }),
    }),
  bulk: (token: string, orderId: string, done: boolean, orderItemId?: string) =>
    api<ProductionWriteResult>(`${BASE}/orders/${encodeURIComponent(orderId)}/bulk`, {
      method: 'POST',
      token,
      body: JSON.stringify(orderItemId ? { order_item_id: orderItemId, done } : { done }),
    }),
  addCustom: (token: string, orderId: string, itemId: string, label: string) =>
    api<ProductionCheck>(
      `${BASE}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/checks`,
      { method: 'POST', token, body: JSON.stringify({ label }) },
    ),
  /** 204 No Content: `api()` resolves with `undefined` on 204. */
  removeCustom: (token: string, checkId: string): Promise<void> =>
    api<void>(`${BASE}/checks/${encodeURIComponent(checkId)}`, { method: 'DELETE', token }),
};

// ── Settings helpers (lenient parse, like the API's normalizeProductionSettings) ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const s = v.trim().slice(0, PRODUCTION_LIMITS.label);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeProductionSettings(raw: unknown): ProductionSettings {
  const d = DEFAULT_PRODUCTION_SETTINGS;
  const s = isRecord(raw) ? raw : {};
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    include_variant_options: bool(s.include_variant_options, d.include_variant_options),
    exclude_option_names: stringList(s.exclude_option_names, PRODUCTION_LIMITS.exclude_option_names),
    exclude_field_types: stringList(s.exclude_field_types, 20),
    exclude_field_names: stringList(s.exclude_field_names, PRODUCTION_LIMITS.exclude_field_names),
    default_custom_items: stringList(s.default_custom_items, PRODUCTION_LIMITS.default_custom_items),
    on_complete: s.on_complete === 'none' || s.on_complete === 'auto' || s.on_complete === 'suggest' ? s.on_complete : d.on_complete,
    complete_target: s.complete_target === 'SHIPPED' || s.complete_target === 'QUALITY_CHECK' ? s.complete_target : d.complete_target,
    start_on_first_check: bool(s.start_on_first_check, d.start_on_first_check),
    use_quality_check: bool(s.use_quality_check, d.use_quality_check),
  };
}

export function sameProductionSettings(a: ProductionSettings, b: ProductionSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Normalises right before saving. `auto` + `SHIPPED` is rejected by the API
 * (SHIPPED captures payment and mails the customer without tracking), so the
 * form never sends it.
 */
export function prepareProductionSettings(form: ProductionSettings): ProductionSettings {
  const next = normalizeProductionSettings(form);
  if (next.on_complete === 'auto' && next.complete_target === 'SHIPPED') next.on_complete = 'suggest';
  return next;
}

/** Merges a named preset over the current form (keys the preset leaves out are kept). */
export function applyProductionPreset(
  form: ProductionSettings,
  preset: Partial<ProductionSettings> | undefined,
): ProductionSettings {
  if (!preset) return form;
  return normalizeProductionSettings({ ...form, ...preset });
}

/** Tailwind colour of a progress bar: <50 % red, ≥50 % amber, 100 % green (WOPS parity). */
export function progressTone(done: number, total: number): 'red' | 'amber' | 'green' | 'none' {
  if (total <= 0) return 'none';
  if (done >= total) return 'green';
  return done / total >= 0.5 ? 'amber' : 'red';
}

/** Localized short relative age ("3 days ago") of an ISO date. */
export function ageOf(iso: string | null | undefined, locale: string, now = Date.now()): string {
  if (!iso) return '—';
  const min = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.floor(min / 60);
  if (h < 48) return rtf.format(-h, 'hour');
  return rtf.format(-Math.floor(h / 24), 'day');
}
