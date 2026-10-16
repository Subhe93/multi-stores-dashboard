// Customer uploads (M4.0 WP-B contract): the private original behind a
// customer's personalization file. The value row keeps the public preview URL;
// the original is only served to readers of the order (admin, owning creator,
// fulfilling provider, buyer) through an authenticated download.

import { API_URL, ApiError } from '@/lib/api';
import { parseContentDispositionFilename } from '@/lib/backups';

/** `GET /uploads/customer/:id/original` (JWT). 404 CUSTOMER_UPLOAD_NOT_FOUND, 410 CUSTOMER_UPLOAD_PURGED. */
export function customerUploadOriginalPath(uploadId: string): string {
  return `/uploads/customer/${encodeURIComponent(uploadId)}/original`;
}

// Authenticated file download: fetch with Bearer → blob → save. Throws
// ApiError (with `code`) so callers translate it like any JSON error.
// Same shape as the private helper in `invoices.api.ts`.
async function downloadAuthed(endpoint: string, token: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new ApiError('Download failed');
    err.status = res.status;
    try {
      const json = await res.json();
      if (json?.message) err.message = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
      if (typeof json?.code === 'string') err.code = json.code;
      if (json && typeof json === 'object') err.payload = json;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    // Status-only fallbacks so the UI can still show a precise message.
    if (!err.code && res.status === 410) err.code = 'CUSTOMER_UPLOAD_PURGED';
    if (!err.code && res.status === 404) err.code = 'CUSTOMER_UPLOAD_NOT_FOUND';
    throw err;
  }
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

/** Downloads the exact bytes the customer uploaded (server sets the file name). */
export function downloadCustomerUploadOriginal(
  token: string,
  uploadId: string,
  fallbackName?: string | null,
): Promise<void> {
  return downloadAuthed(customerUploadOriginalPath(uploadId), token, fallbackName || `upload-${uploadId}`);
}
