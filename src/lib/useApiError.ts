'use client';

import { useTranslations } from 'next-intl';

/**
 * Returns a function that turns an API error into a localized message.
 *
 * The API attaches a stable `code` to errors (see `api()` in `./api`). We look
 * up `errors.<code>` in the active locale; if there's no code or no matching
 * translation, we fall back to the server-provided English `message`, and
 * finally to a generic message. This keeps every call site safe — an unmapped
 * code degrades gracefully to the raw message rather than throwing.
 */
export function useApiError() {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    const e = err as { code?: string; message?: string } | null | undefined;
    if (e?.code && t.has(e.code)) return t(e.code);
    return e?.message || t('generic');
  };
}
