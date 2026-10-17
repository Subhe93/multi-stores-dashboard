// Customer uploads (M4.0 WP-B contract): the private original behind a
// customer's personalization file. The value row keeps the public preview URL;
// the original is only served to readers of the order (admin, owning creator,
// fulfilling provider, buyer) through an authenticated download.

import { downloadAuthed } from '@/lib/http';

/** `GET /uploads/customer/:id/original` (JWT). 404 CUSTOMER_UPLOAD_NOT_FOUND, 410 CUSTOMER_UPLOAD_PURGED. */
export function customerUploadOriginalPath(uploadId: string): string {
  return `/uploads/customer/${encodeURIComponent(uploadId)}/original`;
}

/**
 * Downloads the exact bytes the customer uploaded (server sets the file name).
 * Throws ApiError (with `code`) so callers translate it like any JSON error;
 * status-only fallbacks keep the message precise when the body has no code.
 */
export function downloadCustomerUploadOriginal(
  token: string,
  uploadId: string,
  fallbackName?: string | null,
): Promise<void> {
  return downloadAuthed(customerUploadOriginalPath(uploadId), token, fallbackName || `upload-${uploadId}`, {
    statusCodes: { 410: 'CUSTOMER_UPLOAD_PURGED', 404: 'CUSTOMER_UPLOAD_NOT_FOUND' },
  });
}
