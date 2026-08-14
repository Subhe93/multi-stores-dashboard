'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export type StoreType = 'MARKETPLACE' | 'INDEPENDENT';

interface MyStoreTypeInfo {
  store_type?: StoreType;
}

// Session-scoped cache so nav/pages render with the last-known type on mount
// instead of flashing the marketplace layout while the request is in flight.
const CACHE_KEY = 'ms-creator-store-type';

// Custom event fired when the cached store type changes so every mounted
// useStoreType() instance (e.g. the sidebar layout) updates immediately.
const CHANGE_EVENT = 'ms-store-type-changed';

function readCache(): StoreType | null {
  if (typeof window === 'undefined') return null;
  const v = window.sessionStorage.getItem(CACHE_KEY);
  return v === 'INDEPENDENT' || v === 'MARKETPLACE' ? v : null;
}

/**
 * Writes the store type to the session cache and notifies all mounted
 * useStoreType() hooks. Call this right after an action that changes the
 * creator's store (e.g. creating a store) so the sidebar doesn't stay stale.
 */
export function setCachedStoreType(type: StoreType) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, type);
  } catch {
    // Storage may be unavailable (private mode); the event still updates
    // currently mounted hooks.
  }
  window.dispatchEvent(new CustomEvent<StoreType>(CHANGE_EVENT, { detail: type }));
}

/**
 * Loads the creator's own store and returns its store_type.
 * Returns null while loading (unless cached) or when the creator has no store
 * yet (older stores without the field are treated as MARKETPLACE).
 */
export function useStoreType(): { storeType: StoreType | null; loading: boolean } {
  const { token } = useAuth();
  const [storeType, setStoreType] = useState<StoreType | null>(readCache);
  const [loading, setLoading] = useState(true);

  // Stay in sync with cache updates pushed from elsewhere in the app
  // (e.g. right after the creator creates their store).
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<StoreType>).detail;
      if (detail === 'INDEPENDENT' || detail === 'MARKETPLACE') setStoreType(detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // `loading` starts as true, so no synchronous setState is needed here.
    api<MyStoreTypeInfo>('/stores/my/store', { token })
      .then((s) => {
        if (cancelled) return;
        const type: StoreType = s?.store_type === 'INDEPENDENT' ? 'INDEPENDENT' : 'MARKETPLACE';
        setStoreType(type);
        try {
          window.sessionStorage.setItem(CACHE_KEY, type);
        } catch {
          // Storage may be unavailable (private mode); the fetch still works.
        }
      })
      .catch(() => {
        if (cancelled) return;
        // On a transient fetch failure keep the last-known cached value so the
        // sidebar doesn't flip layouts; only report null when nothing is cached.
        if (!readCache()) setStoreType(null);
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
