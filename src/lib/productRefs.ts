'use client';

// React side of the product reference lookup (M165): one shared batcher per
// token, so an inspector with 30 slider rows makes one `GET /products/mine
// ?ids=` request. Pure batching logic: ./productRefsBatch.ts.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  createProductRefsBatcher,
  PRODUCT_REFS_MAX_IDS,
  type ProductRefResult,
  type ProductRefRow,
  type ProductRefsBatcher,
} from './productRefsBatch';

export type { ProductRefResult, ProductRefRow };

const batchers = new Map<string, ProductRefsBatcher>();

/** Shared batcher of a dashboard session token. */
export function productRefsBatcher(token: string): ProductRefsBatcher {
  let b = batchers.get(token);
  if (!b) {
    b = createProductRefsBatcher({
      fetchIds: async (ids) => {
        const params = new URLSearchParams({ ids: ids.join(','), limit: String(PRODUCT_REFS_MAX_IDS) });
        const res = await api<{ data?: ProductRefRow[] } | ProductRefRow[]>(`/products/mine?${params.toString()}`, { token });
        return Array.isArray(res) ? res : (res?.data ?? []);
      },
    });
    batchers.set(token, b);
  }
  return b;
}

/**
 * Result of one product id (`null` id = nothing to look up). `loading`
 * until the batch returns; `retry` forgets the cached result and asks again.
 */
export function useProductRef(
  id: string | null,
  token: string,
): { result: ProductRefResult | null; loading: boolean; retry: () => void } {
  const batcher = productRefsBatcher(token);
  const [state, setState] = useState<{ id: string | null; result: ProductRefResult | null; nonce: number }>(() => ({
    id,
    result: id ? (batcher.peek(id) ?? null) : null,
    nonce: 0,
  }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    batcher.get(id).then((result) => {
      if (!cancelled) setState({ id, result, nonce });
    });
    return () => {
      cancelled = true;
    };
  }, [id, batcher, nonce]);

  const retry = useCallback(() => {
    if (id) batcher.invalidate(id);
    setNonce((n) => n + 1);
  }, [id, batcher]);

  if (!id) return { result: null, loading: false, retry };
  const current = state.id === id && state.nonce === nonce ? state.result : (batcher.peek(id) ?? null);
  return { result: current, loading: current === null, retry };
}
