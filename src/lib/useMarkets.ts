'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { listMarkets, type MarketView } from '@/lib/markets.api';

/**
 * Loads the creator's markets (GET /markets) and exposes a refresh. Mirrors
 * useStoreApps: no SWR, one request per mount, cancelled on unmount.
 * `errorCode` carries the API error code (e.g. STORE_APP_NOT_ENABLED) so the
 * page can map it through `errors.<code>`. Pass `enabled=false` on pages that
 * only need markets while the app is on, to skip the (403) request.
 */
export function useMarkets(enabled = true): {
  markets: MarketView[] | null;
  loading: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  setMarkets: (next: MarketView[]) => void;
} {
  const { token } = useAuth();
  const [markets, setMarkets] = useState<MarketView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await listMarkets(token);
      setMarkets(Array.isArray(list) ? list : []);
      setErrorCode(null);
      setErrorMessage(null);
    } catch (err) {
      setErrorCode(err instanceof ApiError && err.code ? err.code : null);
      setErrorMessage(err instanceof Error && err.message ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !enabled) return;
    let cancelled = false;
    listMarkets(token)
      .then((list) => {
        if (cancelled) return;
        setMarkets(Array.isArray(list) ? list : []);
        setErrorCode(null);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorCode(err instanceof ApiError && err.code ? err.code : null);
        setErrorMessage(err instanceof Error && err.message ? err.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, enabled]);

  // A disabled hook never loads, so it must not report "loading" forever.
  return { markets, loading: enabled ? loading : false, errorCode, errorMessage, refresh: load, setMarkets };
}
