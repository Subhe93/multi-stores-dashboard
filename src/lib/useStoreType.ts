'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export type StoreType = 'MARKETPLACE' | 'INDEPENDENT';

interface MyStoreTypeInfo {
  store_type?: StoreType;
}

/**
 * Loads the creator's own store and returns its store_type.
 * Returns null while loading or when the creator has no store yet
 * (older stores without the field are treated as MARKETPLACE).
 */
export function useStoreType(): { storeType: StoreType | null; loading: boolean } {
  const { token } = useAuth();
  const [storeType, setStoreType] = useState<StoreType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // `loading` starts as true, so no synchronous setState is needed here.
    api<MyStoreTypeInfo>('/stores/my/store', { token })
      .then((s) => {
        if (cancelled) return;
        setStoreType(s?.store_type === 'INDEPENDENT' ? 'INDEPENDENT' : 'MARKETPLACE');
      })
      .catch(() => {
        if (!cancelled) setStoreType(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { storeType, loading };
}
