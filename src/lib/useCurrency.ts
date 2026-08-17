'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { useAuth } from './auth';

let cachedCurrency: string | null = null;

/** Clear the cached currency so the next useCurrency() call re-fetches from the API. */
export function clearCurrencyCache() {
  cachedCurrency = null;
}

function readToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
}

/**
 * Resolve the currency this dashboard should format amounts in.
 *
 * A creator running an independent store prices in that store's own currency
 * (it charges on their own connected account), so their orders, earnings and
 * product forms have to follow it rather than the platform default. Everyone
 * else — admins, providers, and marketplace creators — sees the platform
 * currency, which is what those orders are actually charged in.
 */
async function fetchCurrency(token: string, isCreator: boolean): Promise<string> {
  if (isCreator) {
    try {
      const store = await api<{ currency?: string | null }>('/stores/my/store', { token });
      if (store?.currency) return store.currency;
    } catch {
      // No store yet, or the request failed — fall through to the platform value.
    }
  }
  const config = await api<{ default_currency?: string }>('/admin/platform-config', { token });
  return config?.default_currency || 'USD';
}

export function useCurrency() {
  const [currency, setCurrency] = useState(cachedCurrency || 'USD');
  const { user } = useAuth();
  const isCreator = user?.role === 'CREATOR';

  useEffect(() => {
    if (cachedCurrency) {
      setCurrency(cachedCurrency);
      return;
    }
    const token = readToken();
    // Wait for the profile before deciding whose currency to ask for.
    if (!token || !user) return;
    let cancelled = false;
    fetchCurrency(token, isCreator)
      .then((cur) => {
        cachedCurrency = cur;
        if (!cancelled) setCurrency(cur);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, isCreator]);

  /** Force re-fetch the currency from the API (e.g. after settings change). */
  const refresh = useCallback(() => {
    clearCurrencyCache();
    const token = readToken();
    if (!token) return;
    fetchCurrency(token, isCreator)
      .then((cur) => {
        cachedCurrency = cur;
        setCurrency(cur);
      })
      .catch(() => {});
  }, [isCreator]);

  const fmt = useCallback(
    (amount: number | string | null | undefined) => {
      const num = Number(amount ?? 0);
      return new Intl.NumberFormat('en', { style: 'currency', currency }).format(num);
    },
    [currency],
  );

  return { currency, fmt, refresh };
}
