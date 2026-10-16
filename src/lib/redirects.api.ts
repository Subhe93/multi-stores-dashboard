// Typed client for the store redirects endpoints (M4.4 §6.3, `redirects/my`).
// Mirrors multi-stores-api/src/modules/redirects/redirects-creator.controller.ts
// and `RedirectView` in redirects.service.ts. Listing and deleting stay open
// with the importer app off; create, edit and test require it.

import { api } from '@/lib/api';

export type RedirectSource = 'IMPORT' | 'MANUAL';
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

/** "Test a URL": what the storefront would do with this path right now. */
export function testRedirect(token: string, path: string): Promise<RedirectTestResult> {
  return api<RedirectTestResult>('/redirects/my/test', { method: 'POST', token, body: JSON.stringify({ path }) });
}
