import { API_URL } from '@/lib/api';

// Uploaded files are served by the API host (`/uploads/...`), not by the
// dashboard, so a relative path must be made absolute before it goes into an
// <img>. Absolute URLs pass through unchanged.
const MEDIA_BASE = API_URL.replace(/\/api\/?$/, '');

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `${MEDIA_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}
