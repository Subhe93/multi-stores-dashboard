// Small HTTP helpers shared by the typed API clients (M5 E16): query-string
// building, the paged list shape and an authenticated file download. The
// importer, designer and customer-upload clients used to carry a copy each.

import { API_URL, ApiError } from '@/lib/api';
import { parseContentDispositionFilename } from '@/lib/backups';

/** Paged list response of the creator APIs (`{items, total, page, limit}`). */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** `?a=1&b=x` from a record; `undefined`, `null` and `''` are left out. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * ApiError (with `code`, `status`, `errors`, `payload`) built from a non-2xx
 * response of a non-JSON request, so callers translate it like any `api()`
 * error. `statusCodes` maps a bare HTTP status to a code when the body has
 * none (e.g. `{410: 'CUSTOMER_UPLOAD_PURGED'}`).
 */
export async function toApiError(res: Response, fallback: string, statusCodes?: Record<number, string>): Promise<ApiError> {
  const err = new ApiError(fallback);
  err.status = res.status;
  try {
    const json = await res.json();
    if (json?.message) err.message = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
    if (Array.isArray(json?.message)) err.errors = json.message;
    if (typeof json?.code === 'string') err.code = json.code;
    if (json && typeof json === 'object') err.payload = json;
  } catch {
    // Non-JSON body; keep the fallback message.
  }
  if (!err.code && statusCodes?.[res.status]) err.code = statusCodes[res.status];
  return err;
}

/**
 * Authenticated GET saved as a file: fetch with Bearer → blob → temporary
 * link. The file name comes from Content-Disposition, else `fallbackName`.
 * Throws ApiError on failure (see `toApiError`).
 */
export async function downloadAuthed(
  endpoint: string,
  token: string,
  fallbackName: string,
  options: { statusCodes?: Record<number, string> } = {},
): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await toApiError(res, 'Download failed', options.statusCodes);
  const filename = parseContentDispositionFilename(res.headers.get('content-disposition')) || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
