'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchOverview, type OverviewRange, type OverviewResult } from './overview.api';

interface OverviewLoad {
  result: OverviewResult | null;
  error: string | null;
  loading: boolean;
  updatedAt: Date | null;
  refetch: () => void;
}

interface Settled {
  /** Request key the settled state belongs to. */
  key: string;
  error: string | null;
}

/**
 * Loads the overview for `range`, aborting the previous request when the range
 * changes. Older data stays on screen during a refetch (the view dims it).
 * `loading` is derived (settled key ≠ current key), so the effect only sets
 * state from the request callbacks.
 */
export function useOverview(
  token: string | null,
  range: OverviewRange,
  opts: { independent: boolean; enabled: boolean },
): OverviewLoad {
  const [result, setResult] = useState<OverviewResult | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);
  const { independent, enabled } = opts;
  const key = `${range}|${independent ? 1 : 0}|${nonce}`;

  useEffect(() => {
    if (!token || !enabled) return;
    const ac = new AbortController();
    fetchOverview(token, range, { independent, signal: ac.signal })
      .then((r) => {
        if (ac.signal.aborted) return;
        setResult(r);
        setUpdatedAt(new Date());
        setSettled({ key, error: null });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setSettled({ key, error: err instanceof Error ? err.message : 'Request failed' });
      });
    return () => ac.abort();
  }, [token, range, independent, enabled, key]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const current = settled?.key === key;
  return {
    result,
    error: current ? settled.error : null,
    loading: !current,
    updatedAt,
    refetch,
  };
}
