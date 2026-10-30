'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

/** The slice of `GET /stores/my/store` the storefront link helpers read. */
export interface MyStoreSummary {
  slug: string;
  name: string;
  is_active: boolean;
  custom_domain?: string | null;
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
  promise.catch(() => {
    if (cached === entry) cached = null;
  });
  return promise;
}

/** Drops the cached store (call after changing the slug / custom domain). */
export function invalidateMyStore(): void {
  cached = null;
}

/**
 * Public origin of a store: its custom domain when set, else the platform
 * subdomain `<slug>.<NEXT_PUBLIC_WEB_URL host>`. Market stores reached on the
 * platform subdomain are redirected by the storefront to the market's public
 * host, so this origin is always a valid entry point.
 */
export function storefrontBaseUrl(store: Pick<MyStoreSummary, 'slug' | 'custom_domain'>): string {
  if (store.custom_domain) return `https://${store.custom_domain}`;
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
