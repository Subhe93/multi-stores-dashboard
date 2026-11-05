// Typed client for the store redirects endpoints (M4.4 §6.3, `redirects/my`).
// Mirrors multi-stores-api/src/modules/redirects/redirects-creator.controller.ts
// and `RedirectView` in redirects.service.ts. Redirects are a core store
// feature (Online store -> Redirects); the importer app also writes them.

import { api } from '@/lib/api';

/** SLUG_CHANGE: the old-slug 301 written when a product, collection or page URL changes. */
export type RedirectSource = 'IMPORT' | 'MANUAL' | 'SLUG_CHANGE';
export const REDIRECT_STATUS_CODES = [301, 302, 307, 308] as const;
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number];

export interface RedirectView {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  source: RedirectSource;
  import_run_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RedirectListResponse {
  items: RedirectView[];
  total: number;
  page: number;
  limit: number;
}

export interface RedirectListQuery {
  q?: string;
  source?: RedirectSource;
  page?: number;
  /** ≤ 200 (API limit). */
  limit?: number;
}

export interface RedirectInput {
  from_path: string;
  to_path: string;
  status_code?: RedirectStatusCode;
  is_active?: boolean;
}

export interface RedirectTestResult {
  /** The normalized path that was matched. */
  path: string;
  /** Published content at this path. An active redirect from the same path wins over it (the proxy matches redirects first). */
  live?: 'product' | 'collection' | 'page' | null;
  match: Pick<RedirectView, 'id' | 'from_path' | 'to_path' | 'status_code' | 'source'> | null;
}

function listQs(query: RedirectListQuery): string {
  const p = new URLSearchParams();
  if (query.q?.trim()) p.set('q', query.q.trim());
  if (query.source) p.set('source', query.source);
  if (query.page) p.set('page', String(query.page));
  if (query.limit) p.set('limit', String(Math.min(200, query.limit)));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function listRedirects(token: string, query: RedirectListQuery = {}): Promise<RedirectListResponse> {
  return api<RedirectListResponse>(`/redirects/my${listQs(query)}`, { token });
}

export function createRedirect(token: string, input: RedirectInput): Promise<RedirectView> {
  return api<RedirectView>('/redirects/my', { method: 'POST', token, body: JSON.stringify(input) });
}

/** Partial update. Any merchant edit turns the row MANUAL (imports never overwrite it). */
export function updateRedirect(token: string, id: string, input: Partial<RedirectInput>): Promise<RedirectView> {
  return api<RedirectView>(`/redirects/my/${encodeURIComponent(id)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(input),
  });
}

export function deleteRedirect(token: string, id: string): Promise<{ deleted: true }> {
  return api<{ deleted: true }>(`/redirects/my/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

// ─── Bulk CSV import (W1-B `POST redirects/my/bulk`) ─────────────────────────

export interface RedirectBulkRow {
  from_path: string;
  to_path: string;
  status_code?: RedirectStatusCode;
  /** 1-based line of the uploaded file (maps API conflicts back to it). */
  line?: number;
}

export interface RedirectBulkConflict {
  from_path: string;
  to_path?: string;
  reason?: string;
  /** Line of the uploaded file, when known. */
  line?: number;
}

export interface RedirectBulkResult {
  created: number;
  /** Rows the API refused (path already redirected, loop, invalid). */
  conflicts: RedirectBulkConflict[];
}

/** API limit on rows per bulk call. */
export const REDIRECT_BULK_MAX = 5000;

/** Raw answer of `POST redirects/my/bulk` (M5 B17). */
interface RedirectBulkResponse {
  created: number | { id: string }[];
  conflicts?: { from_path: string; to_path?: string; code?: string; reason?: string; line?: number }[];
}

/**
 * Creates many redirects at once. The API takes CSV text
 * (`from_path,to_path[,status]` per line), so the rows parsed client-side are
 * serialised back to that shape, one row per line. Callers must reject cells
 * that contain `,`, `;` or a tab first (the API splits on all three). The
 * API reports conflicts by line of that text; they are mapped back to the
 * row's own `line`.
 */
export async function bulkCreateRedirects(token: string, rows: RedirectBulkRow[]): Promise<RedirectBulkResult> {
  const csv = rows.map((r) => [r.from_path, r.to_path, r.status_code ?? ''].join(',')).join('\n');
  const res = await api<RedirectBulkResponse>('/redirects/my/bulk', {
    method: 'POST',
    token,
    body: JSON.stringify({ csv }),
  });
  return {
    created: Array.isArray(res?.created) ? res.created.length : Number(res?.created ?? 0),
    conflicts: (res?.conflicts ?? []).map((c) => ({
      from_path: c.from_path,
      to_path: c.to_path,
      reason: c.reason ?? c.code,
      line: typeof c.line === 'number' ? (rows[c.line - 1]?.line ?? c.line) : undefined,
    })),
  };
}

// ─── Delete-flow helpers ─────────────────────────────────────────────────────

/** `GET redirects/my/locale-prefixes`: every `/<locale>` prefix the storefront serves (markets included). */
export interface RedirectLocalePrefixes {
  primary_locale: string;
  prefixes: string[];
}

export function getRedirectLocalePrefixes(token: string): Promise<RedirectLocalePrefixes> {
  return api<RedirectLocalePrefixes>('/redirects/my/locale-prefixes', { token });
}

export type ProductPathKind = 'product' | 'custom-product';

export interface ProductPathsItem {
  kind: ProductPathKind;
  id: string;
  /** Every public storefront path of the product (per-locale slugs and prefixes). */
  paths: string[];
}

/** Public paths of one product; call it BEFORE the product is deleted. */
export async function getProductPaths(token: string, kind: ProductPathKind, id: string): Promise<ProductPathsItem> {
  const res = await api<{ items?: ProductPathsItem[] } | ProductPathsItem>(
    `/redirects/my/product-paths/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,
    { token },
  );
  if (res && 'items' in res && Array.isArray(res.items)) {
    return res.items[0] ?? { kind, id, paths: [] };
  }
  return res as ProductPathsItem;
}

/** Public paths of many products in one call; call it BEFORE they are deleted. */
export async function getProductPathsBatch(
  token: string,
  items: { kind: ProductPathKind; id: string }[],
): Promise<ProductPathsItem[]> {
  if (!items.length) return [];
  const res = await api<{ items?: ProductPathsItem[] }>('/redirects/my/product-paths', {
    method: 'POST',
    token,
    body: JSON.stringify({ items }),
  });
  return res?.items ?? [];
}

/** "Test a URL": what the storefront would do with this path right now. */
export function testRedirect(token: string, path: string): Promise<RedirectTestResult> {
  return api<RedirectTestResult>('/redirects/my/test', { method: 'POST', token, body: JSON.stringify({ path }) });
}
