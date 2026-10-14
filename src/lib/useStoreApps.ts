'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { isStoreAppKey, type MyStoreAppView, type StoreAppKey } from '@/lib/storeApps.registry';

// Session-scoped cache so nav/pages render with the last-known apps on mount
// instead of flashing the "no apps" layout while the request is in flight.
const CACHE_KEY = 'ms-creator-store-apps';

// Custom event fired when the cached apps change so every mounted
// useStoreApps() instance (e.g. the sidebar layout) updates immediately.
const CHANGE_EVENT = 'ms-store-apps-changed';

/**
 * Keeps only well-formed rows whose key exists in the local registry, so an
 * app key the dashboard doesn't know yet never reaches `t('items.<key>')`.
 * Returns null when the value is not an array at all.
 */
export function sanitizeStoreApps(value: unknown): MyStoreAppView[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((a): a is MyStoreAppView => !!a && typeof a === 'object' && isStoreAppKey((a as MyStoreAppView).key));
}

const sanitize = sanitizeStoreApps;

function readCache(): MyStoreAppView[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(apps: MyStoreAppView[]) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(apps));
  } catch {
    // Storage may be unavailable (private mode); the event still updates
    // currently mounted hooks.
  }
}

/**
 * Writes the creator's apps to the session cache and notifies all mounted
 * useStoreApps() hooks. Call this right after a PUT /stores/my/apps/:key so
 * the sidebar and other pages don't stay stale.
 */
export function setCachedStoreApps(apps: MyStoreAppView[]) {
  writeCache(apps);
  window.dispatchEvent(new CustomEvent<MyStoreAppView[]>(CHANGE_EVENT, { detail: apps }));
}

/**
 * Drops the session cache. Called on logout so the next login doesn't render
 * the previous account's apps.
 */
export function clearCachedStoreApps() {
  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage may be unavailable; the cache is best-effort anyway.
  }
}

/** True when the app is both made available by the admin and enabled by the creator. */
export function isAppEnabled(apps: MyStoreAppView[] | null | undefined, key: StoreAppKey): boolean {
  if (!apps) return false;
  const app = apps.find((a) => a.key === key);
  return !!app && app.available && app.enabled;
}

/**
 * Loads the creator's store apps (every registry key; check `available`).
 * Returns null while loading (unless cached) or when the request fails with
 * nothing cached.
 */
export function useStoreApps(): { apps: MyStoreAppView[] | null; loading: boolean } {
  const { token } = useAuth();
  const [apps, setApps] = useState<MyStoreAppView[] | null>(readCache);
  const [loading, setLoading] = useState(true);

  // Stay in sync with cache updates pushed from elsewhere in the app
  // (e.g. right after the creator toggles an app on the Apps page).
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = sanitize((e as CustomEvent<MyStoreAppView[]>).detail);
      if (detail) setApps(detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // `loading` starts as true, so no synchronous setState is needed here.
    api<MyStoreAppView[]>('/stores/my/apps', { token })
      .then((list) => {
        if (cancelled) return;
        const next = sanitize(list) ?? [];
        setApps(next);
        writeCache(next);
      })
      .catch(() => {
        if (cancelled) return;
        // On a transient fetch failure keep the last-known cached value so the
        // sidebar doesn't flip; only report null when nothing is cached.
        if (!readCache()) setApps(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { apps, loading };
}
