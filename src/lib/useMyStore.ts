'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { fetchMyStore, invalidateMyStore, subscribeMyStoreInvalidation, type MyStoreSummary } from '@/lib/useStorefrontUrl';

export interface MyStoreState {
  /** The creator's store, null while loading or when there is none. */
  store: MyStoreSummary | null;
  /** True once the API answered 404: the creator has no store yet (onboarding). */
  missing: boolean;
  loading: boolean;
  error: string | null;
  /** Drops the shared cache and loads the store again (after a status change). */
  refetch: () => void;
}

/**
 * The creator's own store with its lifecycle fields (`GET /stores/my/store`),
 * shared with the storefront-link helpers through one cached request.
 * Non-creators never fetch.
 */
export function useMyStore(): MyStoreState {
  const { token, user } = useAuth();
  const isCreator = user?.role === 'CREATOR';
  const [store, setStore] = useState<MyStoreSummary | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${token ?? ''}|${nonce}`;

  useEffect(() => {
    if (!token || !isCreator) return;
    let alive = true;
    fetchMyStore(token)
      .then((s) => {
        if (!alive) return;
        setStore(s?.slug ? s : null);
        setMissing(!s?.slug);
        setError(null);
        setSettled(key);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setStore(null);
          setMissing(true);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : 'Request failed');
        }
        setSettled(key);
      });
    return () => {
      alive = false;
    };
  }, [token, isCreator, key]);

  // Any invalidation (store created in onboarding, status toggled elsewhere)
  // reloads this instance too; the creator layout's redirect depends on it.
  useEffect(() => subscribeMyStoreInvalidation(() => setNonce((n) => n + 1)), []);

  const refetch = useCallback(() => {
    invalidateMyStore();
  }, []);

  const loading = !!token && isCreator && settled !== key;
  return {
    store,
    // Never report "no store" from a previous load while a reload is pending.
    missing: missing && !loading,
    loading,
    error,
    refetch,
  };
}
