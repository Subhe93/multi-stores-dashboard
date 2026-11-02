'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import type { GoLiveChecklist, StoreStatus, TraderDetails } from '@/lib/storeStatus';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

/** The slice of `GET /stores/my/store` the storefront link helpers read. */
export interface MyStoreSummary {
  id?: string;
  slug: string;
  name: string;
  is_active: boolean;
  store_type?: 'MARKETPLACE' | 'INDEPENDENT';
  /** Lifecycle state (SPEC §3); older API builds omit it (treated as LIVE/PAUSED by is_active). */
  status?: StoreStatus;
  status_reason?: string | null;
  trader_details?: TraderDetails | null;
  golive_requested_at?: string | null;
  went_live_at?: string | null;
  golive_checklist?: GoLiveChecklist | null;
  created_at?: string;
  custom_domain?: string | null;
  /** Canonical public host (default market's primary domain, else custom_domain); null = platform subdomain. */
  public_host?: string | null;
  /** Every host that serves the storefront (market domains, their redirects, custom_domain). */
  storefront_hosts?: string[];
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
}

// One shared request per token for a short window: the header store link,
// list pages and editors all need the store, and mount on the same page.
// The TTL keeps it fresh enough after the creator edits store settings.
const CACHE_TTL_MS = 30_000;
let cached: { token: string; at: number; promise: Promise<MyStoreSummary> } | null = null;

/** `GET /stores/my/store`, deduplicated across components (failures are not cached). */
export function fetchMyStore(token: string): Promise<MyStoreSummary> {
  if (cached && cached.token === token && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.promise;
  }
  const promise = api<MyStoreSummary>('/stores/my/store', { token });
  const entry = { token, at: Date.now(), promise };
  cached = entry;
  promise.catch((err: unknown) => {
    // "No store yet" (404) is a stable answer during onboarding: keep it for
    // the TTL so the layout, header and pages share one request. Other
    // failures are retried on the next call.
    if (err instanceof ApiError && err.status === 404) return;
    if (cached === entry) cached = null;
  });
  return promise;
}

/** Effective lifecycle status; API builds without `status` derive it from `is_active`. */
export function effectiveStoreStatus(store: Pick<MyStoreSummary, 'status' | 'is_active'>): StoreStatus {
  return store.status ?? (store.is_active ? 'LIVE' : 'PAUSED');
}

// Mounted `useMyStore` hooks (creator layout, home, settings) reload when the
// cache is dropped, so creating the store or changing its status is seen by
// every subscriber at once instead of only by the component that did it.
const invalidationListeners = new Set<() => void>();

/** Runs `listener` after every `invalidateMyStore()`; returns the unsubscribe. */
export function subscribeMyStoreInvalidation(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

/** Drops the cached store (call after creating it or changing slug / domain / status). */
export function invalidateMyStore(): void {
  cached = null;
  for (const listener of invalidationListeners) listener();
}

/**
 * Public origin of a store: the API's `public_host` (a market store's default
 * market primary domain; its legacy custom_domain may be a retired host), else
 * its custom domain, else the platform subdomain
 * `<slug>.<NEXT_PUBLIC_WEB_URL host>`. Market stores reached on the platform
 * subdomain are redirected by the storefront to the market's public host, so
 * this origin is always a valid entry point.
 */
export function storefrontBaseUrl(
  store: Pick<MyStoreSummary, 'slug' | 'custom_domain' | 'public_host'>,
): string {
  const host = store.public_host || store.custom_domain;
  if (host) return `https://${host}`;
  const u = new URL(WEB_ORIGIN);
  return `${u.protocol}//${store.slug}.${u.host}`;
}

/**
 * Storefront product URL. The primary content locale is served without a
 * locale prefix and the storefront matches a product by any of its
 * translated slugs, so `/products/<slug>` opens the right page.
 */
export function storefrontProductUrl(baseUrl: string, productSlug: string): string {
  return `${baseUrl}/products/${encodeURIComponent(productSlug)}`;
}

/** Pick the slug to link: the store's primary locale first, then any non-empty one. */
export function pickProductSlug(
  translations: { locale: string; slug?: string | null }[] | undefined,
  primaryLocale?: string,
): string | undefined {
  if (!translations?.length) return undefined;
  const primary = primaryLocale
    ? translations.find((tr) => tr.locale === primaryLocale && tr.slug)?.slug
    : undefined;
  return primary || translations.find((tr) => tr.slug)?.slug || undefined;
}

/**
 * Pick the translation to display: the store's primary content locale first,
 * then English, then the first row. Lists must show what shoppers see, so a
 * Swedish store lists its Swedish names, not the English ones.
 */
export function pickLocalized<T extends { locale: string }>(
  translations: T[] | null | undefined,
  primaryLocale?: string | null,
): T | undefined {
  if (!translations?.length) return undefined;
  return (
    (primaryLocale ? translations.find((tr) => tr.locale === primaryLocale) : undefined) ??
    translations.find((tr) => tr.locale === 'en') ??
    translations[0]
  );
}

/**
 * The signed-in creator's store and its public base URL (null until loaded,
 * or when the user has no store). Shares one request with other callers.
 */
export function useStorefrontUrl(): {
  store: MyStoreSummary | null;
  baseUrl: string | null;
  primaryLocale: string;
  productUrl: (slug: string | null | undefined) => string | null;
} {
  const { token, user } = useAuth();
  // Only creators own a store; other roles would just get an error response.
  const hasStore = user?.role === 'CREATOR';
  const [store, setStore] = useState<MyStoreSummary | null>(null);

  useEffect(() => {
    if (!token || !hasStore) return;
    let alive = true;
    fetchMyStore(token)
      .then((s) => { if (alive) setStore(s?.slug ? s : null); })
      .catch(() => { if (alive) setStore(null); });
    return () => { alive = false; };
  }, [token, hasStore]);

  const baseUrl = hasStore && store?.slug ? storefrontBaseUrl(store) : null;
  return {
    store,
    baseUrl,
    primaryLocale: store?.language_config?.primary_locale || 'en',
    productUrl: (slug) => (baseUrl && slug ? storefrontProductUrl(baseUrl, slug) : null),
  };
}
