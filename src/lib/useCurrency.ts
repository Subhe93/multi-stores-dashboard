'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

let cachedCurrency: string | null = null;

/** Clear the cached currency so the next useCurrency() call re-fetches from the API. */
export function clearCurrencyCache() {
  cachedCurrency = null;
}

export function useCurrency() {
  const [currency, setCurrency] = useState(cachedCurrency || 'USD');

  useEffect(() => {
    if (cachedCurrency) {
      setCurrency(cachedCurrency);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) return;
    api<{ default_currency?: string }>('/admin/platform-config', { token })
      .then((config) => {
        const cur = config?.default_currency || 'USD';
        cachedCurrency = cur;
        setCurrency(cur);
      })
      .catch(() => {});
  }, []);

  /** Force re-fetch the currency from the API (e.g. after admin changes settings). */
  const refresh = useCallback(() => {
    clearCurrencyCache();
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) return;
    api<{ default_currency?: string }>('/admin/platform-config', { token })
      .then((config) => {
        const cur = config?.default_currency || 'USD';
        cachedCurrency = cur;
        setCurrency(cur);
      })
      .catch(() => {});
  }, []);

  const fmt = useCallback(
    (amount: number | string | null | undefined) => {
      const num = Number(amount ?? 0);
      return new Intl.NumberFormat('en', { style: 'currency', currency }).format(num);
    },
    [currency],
  );

  return { currency, fmt, refresh };
}