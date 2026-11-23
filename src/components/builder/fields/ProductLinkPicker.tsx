'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media';
import { productRefsBatcher } from '@/lib/productRefs';
import { productRefSlug, productRefTitle, type ProductRefRow } from '@/lib/productRefsBatch';

/**
 * Searchable product picker of the link fields (M165): the store's own
 * products (title in the content locale + thumbnail), searched on the server
 * with a 300 ms debounce through `GET /products/mine` (same source as the
 * menu editor's Products panel). Drafts are listed with a status word;
 * archived products come last. The picked row is seeded into the shared
 * product-ref cache so its chip renders without another request.
 */
export function ProductLinkPicker({
  token,
  contentLocale,
  onPick,
  id,
}: {
  token: string;
  contentLocale: string;
  onPick: (product: ProductRefRow) => void;
  id?: string;
}) {
  const t = useTranslations('builder.linkField');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [nonce, setNonce] = useState(0);
  // Rows of the last finished request; `loading` while the current key differs.
  const key = `${token}|${debounced}|${nonce}`;
  const [loaded, setLoaded] = useState<{ key: string; rows: ProductRefRow[]; failed: boolean }>({ key: '', rows: [], failed: false });
  const loading = loaded.key !== key;
  const rows = loaded.rows;
  const failed = !loading && loaded.failed;

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '20' });
    if (debounced) params.set('search', debounced);
    api<{ data?: ProductRefRow[] } | ProductRefRow[]>(`/products/mine?${params.toString()}`, { token })
      .then((res) => {
        if (!cancelled) setLoaded({ key, rows: Array.isArray(res) ? res : (res?.data ?? []), failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, rows: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key, debounced, token]);

  const options = useMemo(() => {
    const sorted = [...rows].sort((a, b) => Number(a.status === 'ARCHIVED') - Number(b.status === 'ARCHIVED'));
    return sorted.map((p) => {
      const slug = productRefSlug(p, contentLocale);
      const status = p.status === 'DRAFT' ? t('statusDraft') : p.status === 'ARCHIVED' ? t('statusArchived') : '';
      return {
        value: p.id,
        label: productRefTitle(p, contentLocale) || slug || p.id,
        description: [slug ? `/products/${slug}` : '', status].filter(Boolean).join(' · '),
        imageUrl: resolveMediaUrl(p.images?.[0]?.url) ?? '',
      };
    });
  }, [rows, contentLocale, t]);

  return (
    <div className="space-y-1">
      <SearchableSelect
        id={id}
        options={options}
        value=""
        onChange={(value) => {
          const row = rows.find((r) => r.id === value);
          if (!row) return;
          productRefsBatcher(token).seed(row);
          onPick(row);
        }}
        placeholder={t('searchProducts')}
        searchPlaceholder={t('searchProducts')}
        onSearchChange={setQuery}
        loading={loading}
        emptyText={failed ? t('loadFailed') : t('noProductsFound')}
      />
      {failed && (
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="text-[10.5px] font-medium text-indigo-600 hover:underline"
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
}
