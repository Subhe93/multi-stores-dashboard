'use client';

import { useEffect, useState } from 'react';
import { listRuns } from '@/lib/importer.api';
import { listRedirects } from '@/lib/redirects.api';

const cacheKey = (userId: string | null | undefined) => `importer-history:${userId ?? ''}`;

/**
 * True when the store has import runs or redirects. Used to keep the importer
 * nav entry (read-only page) while the app is no longer offered, so the
 * history and the live redirects stay reachable. Checked once per session and
 * only when `check` is true (the cheap "available/enabled" test failed).
 */
export function useImporterHistory(token: string | null | undefined, userId: string | null | undefined, check: boolean): boolean {
  // Keyed by user so another account in the same tab never reuses the answer.
  const [state, setState] = useState<{ key: string; has: boolean } | null>(null);
  const key = cacheKey(userId);

  useEffect(() => {
    if (!check || !token || !userId) return;
    let cancelled = false;
    let cached: string | null = null;
    try {
      cached = window.sessionStorage.getItem(key);
    } catch {
      // Storage unavailable: just ask the API.
    }
    if (cached !== null) {
      // Async like the API path, so the effect never sets state synchronously.
      void Promise.resolve().then(() => !cancelled && setState({ key, has: cached === '1' }));
      return () => {
        cancelled = true;
      };
    }
    Promise.all([
      listRuns(token, { page: 1, limit: 1 }).then((r) => r.total > 0).catch(() => false),
      listRedirects(token, { page: 1, limit: 1 }).then((r) => r.total > 0).catch(() => false),
    ]).then(([runs, redirects]) => {
      if (cancelled) return;
      const value = runs || redirects;
      setState({ key, has: value });
      try {
        window.sessionStorage.setItem(key, value ? '1' : '0');
      } catch {
        // Best-effort cache.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, userId, key, check]);

  return check && state?.key === key ? state.has : false;
}
