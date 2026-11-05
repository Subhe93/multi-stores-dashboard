'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Package, Plus, ImageIcon, Search, X } from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import {
  collectionFilterSelection,
  splitCollectionFilterOptions,
  type CollectionFilterNode,
  type FilterOption,
} from '@/lib/tags';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { api, API_ORIGIN } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { DataTable } from '@/components/common/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ViewInStoreButton } from '@/components/product/ViewInStoreButton';
import { BulkNotice, useBulkNotice } from '@/components/product/BulkNotice';
import { runBulk } from '@/lib/bulk';
import { pickLocalized, pickProductSlug, useStorefrontUrl } from '@/lib/useStorefrontUrl';
import {
  DeleteRedirectField,
  useDeleteRedirect,
  type RedirectTargetSuggestion,
} from '@/components/redirects/DeleteRedirect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const API_BASE = API_ORIGIN;

function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';

interface Translation {
  locale: string;
  title: string;
  slug?: string;
}

interface OwnProduct {
  id: string;
  base_price: number;
  status: ProductStatus;
  created_at?: string;
  sku?: string | null;
  track_inventory?: boolean;
  stock_quantity?: number | null;
  variants?: { is_active: boolean; stock_quantity: number | null }[];
  translations: Translation[];
  images?: { url: string }[];
}

const SORTS = [
  'newest',
  'oldest',
  'updated',
  'title_asc',
  'title_desc',
  'price_asc',
  'price_desc',
] as const;
type Sort = (typeof SORTS)[number];
const PAGE_SIZES = ['20', '50', '100'] as const;
const STOCK_FILTERS = ['in_stock', 'out_of_stock'] as const;
const LIST_PATH = '/creator/products/own';
const editHref = (item: { id: string }) => `${LIST_PATH}/${item.id}`;

/**
 * Units on hand: the product's own stock, or the sum over active variants
 * (a variant with a null stock is untracked, i.e. unlimited). Mirrors the
 * API's out-of-stock rule.
 */
function stockSummary(
  item: OwnProduct,
): { kind: 'untracked' } | { kind: 'count'; value: number } {
  const active = (item.variants ?? []).filter((v) => v.is_active);
  if (active.length) {
    if (active.some((v) => v.stock_quantity == null)) return { kind: 'untracked' };
    return {
      kind: 'count',
      value: active.reduce((s, v) => s + Math.max(0, v.stock_quantity ?? 0), 0),
    };
  }
  if (!item.track_inventory || item.stock_quantity == null) return { kind: 'untracked' };
  return { kind: 'count', value: Math.max(0, item.stock_quantity) };
}

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Same palette/labels as the custom-products list, so both product tables
// present ProductStatus identically.
const statusColors: Record<string, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

type Translator = ReturnType<typeof useTranslations>;

function statusLabels(t: Translator): Record<string, string> {
  return {
    PUBLISHED: t('myProducts.statusPublished'),
    DRAFT: t('myProducts.statusDraft'),
    PENDING_REVIEW: t('myProducts.statusPendingReview'),
    REJECTED: t('myProducts.statusRejected'),
    ARCHIVED: t('myProducts.statusArchived'),
  };
}

const STATUS_FILTERS: ('ALL' | ProductStatus)[] = [
  'ALL',
  'DRAFT',
  'PENDING_REVIEW',
  'REJECTED',
  'PUBLISHED',
  'ARCHIVED',
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreatorOwnProductsPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const tt = useTranslations('creator');
  const tc = useTranslations('common');
  const statusLabelMap = statusLabels(tt);

  // Filters, sort and page live in the URL (?q=&status=&collection=&stock=
  // &sort=&limit=&page=), so the list survives "edit, then back" and can be
  // linked.
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get('status') ?? '';
  const statusFilter: 'ALL' | ProductStatus = (STATUS_FILTERS as string[]).includes(rawStatus)
    ? (rawStatus as ProductStatus)
    : 'ALL';
  const query = searchParams.get('q') ?? '';
  const collection = searchParams.get('collection') ?? '';
  const rawStock = searchParams.get('stock') ?? '';
  const stock = (STOCK_FILTERS as readonly string[]).includes(rawStock) ? rawStock : '';
  const rawSort = searchParams.get('sort') ?? '';
  const sort: Sort = (SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : 'newest';
  const rawLimit = searchParams.get('limit') ?? '';
  const limit = (PAGE_SIZES as readonly string[]).includes(rawLimit) ? rawLimit : '20';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const filtered = !!(query || collection || stock || statusFilter !== 'ALL');

  const [items, setItems] = useState<OwnProduct[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  // Both filters share `?collection=`: PUBLIC rows in the Collections select,
  // INTERNAL rows (tags) in the Tags select.
  const [collections, setCollections] = useState<FilterOption[]>([]);
  const [tags, setTags] = useState<FilterOption[]>([]);
  const { collection: collectionValue, tag: tagValue } = collectionFilterSelection(collection, tags);
  const [deleteTarget, setDeleteTarget] = useState<OwnProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { productUrl, primaryLocale } = useStorefrontUrl();
  // Bulk actions: busy flag, the pending bulk delete and the result notice.
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDelete, setBulkDelete] = useState<{ rows: OwnProduct[]; clear: () => void } | null>(null);
  const { notice, setNotice } = useBulkNotice();
  // "Redirect the old address?" option of the delete dialogs.
  const tRedirect = useTranslations('creator.redirects.onDelete');
  const redirect = useDeleteRedirect();
  /** Storefront address of a product (`/products/<slug>`), or null without a slug. */
  const publicPath = (item: OwnProduct): string | null => {
    const slug = pickProductSlug(item.translations, primaryLocale);
    return slug ? `/products/${slug}` : null;
  };
  const redirectSuggestions = [
    { path: '/products', label: tRedirect('targets.products') },
    { path: '/', label: tRedirect('targets.home') },
  ];
  /** Published products of the loaded list, offered as redirect targets. */
  const knownTargets = (exclude: readonly OwnProduct[]): RedirectTargetSuggestion[] => {
    const skip = new Set(exclude.map((r) => r.id));
    return items.flatMap((item) => {
      const path = item.status === 'PUBLISHED' && !skip.has(item.id) ? publicPath(item) : null;
      return path ? [{ path, label: pickLocalized(item.translations, primaryLocale)?.title || path }] : [];
    });
  };

  /** Writes params to the URL; any change other than the page resets to page 1. */
  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (!('page' in patch)) params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `${LIST_PATH}?${qs}` : LIST_PATH, { scroll: false });
    },
    [router, searchParams],
  );

  // Last search this page wrote to the URL. When the URL catches up with it,
  // the box is left alone (the user may have typed more meanwhile); any other
  // change (back / forward, a pasted link) is copied into the box.
  const pushedQuery = useRef(query);
  useEffect(() => {
    if (query !== pushedQuery.current) {
      pushedQuery.current = query;
      setSearchInput(query);
    }
  }, [query]);

  const pushSearch = useCallback(
    (value: string) => {
      pushedQuery.current = value;
      updateParams({ q: value });
    },
    [updateParams],
  );

  // Debounced search: the URL (and the request) follow 300 ms after typing.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === pushedQuery.current) return;
    const id = setTimeout(() => pushSearch(value), 300);
    return () => clearTimeout(id);
  }, [searchInput, pushSearch]);

  useEffect(() => {
    if (!token) return;
    api<CollectionFilterNode[]>('/creator-categories', { token })
      .then((res) => {
        const split = splitCollectionFilterOptions(Array.isArray(res) ? res : [], primaryLocale);
        setCollections(split.collections);
        setTags(split.tags);
      })
      .catch(() => {
        setCollections([]);
        setTags([]);
      });
  }, [token, primaryLocale]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit, sort });
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (query) params.set('search', query);
    if (collection) params.set('collection', collection);
    if (stock) params.set('stock', stock);
    return params.toString();
  }, [page, limit, sort, statusFilter, query, collection, stock]);

  // Only the latest request may update the list: a slow broad query must
  // not overwrite the result of a newer, narrower one.
  const requestSeq = useRef(0);
  const fetchItems = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api<{ data: OwnProduct[]; meta: ListMeta }>(
        `/products/mine?${listQuery}`,
        { token },
      );
      if (seq !== requestSeq.current) return;
      setItems(res?.data ?? []);
      setMeta(res?.meta ?? null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('Failed to load own products:', err);
      setItems([]);
      setMeta(null);
      setLoadError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, listQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // A page past the end (after deletes or a narrower filter) snaps back.
  useEffect(() => {
    if (meta && meta.totalPages > 0 && page > meta.totalPages) {
      updateParams({ page: meta.totalPages > 1 ? String(meta.totalPages) : '' });
    }
  }, [meta, page, updateParams]);

  const handleStatusFilter = (status: 'ALL' | ProductStatus) => {
    updateParams({ status: status === 'ALL' ? '' : status });
  };

  const clearFilters = () => {
    pushedQuery.current = '';
    setSearchInput('');
    updateParams({ q: '', status: '', collection: '', stock: '' });
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    const plan = redirect.prepare();
    if (!plan) return;
    setDeleting(true);
    setDeleteError('');
    try {
      // Every public address (per-locale slugs) is read before the delete.
      const sources = await redirect.productSources(plan, [
        { kind: 'product', id: deleteTarget.id, fallback: publicPath(deleteTarget) },
      ]);
      await api(`/products/${deleteTarget.id}`, { method: 'DELETE', token });
      setDeleteTarget(null);
      fetchItems();
      // The product is gone either way; the redirect outcome shows in a notice.
      void redirect.apply(plan, sources);
    } catch (err) {
      const e = err as { message?: string };
      setDeleteError(e?.message || tt('myProducts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  /** Short summary of a bulk run: successes and the first failure reason. */
  const reportBulk = (
    ok: number,
    failed: { error: string }[],
    okKey: 'bulkStatusUpdated' | 'bulkDeleted',
  ) => {
    const parts: string[] = [];
    if (ok) parts.push(tt(`myProducts.${okKey}`, { count: ok }));
    if (failed.length) {
      parts.push(tt('myProducts.bulkFailed', { count: failed.length, error: failed[0]!.error }));
    }
    setNotice({ tone: failed.length ? 'warn' : 'ok', text: parts.join(' · ') });
  };

  // Status changes use the partial PUT /products/:id, which also refreshes
  // the storefront cache (PUT /products/:id/status does not).
  const bulkSetStatus = async (rows: OwnProduct[], status: ProductStatus, clear: () => void) => {
    if (!token) return;
    const targets = rows.filter((r) => r.status !== status);
    if (!targets.length) {
      clear();
      setNotice({ tone: 'ok', text: tt('myProducts.bulkNothingToChange') });
      return;
    }
    setBulkBusy(true);
    const result = await runBulk(targets, (r) =>
      api(`/products/${r.id}`, { method: 'PUT', token, body: JSON.stringify({ status }) }),
    );
    setBulkBusy(false);
    clear();
    reportBulk(result.ok.length, result.failed, 'bulkStatusUpdated');
    fetchItems();
  };

  const confirmBulkDelete = async () => {
    if (!token || !bulkDelete) return;
    const plan = redirect.prepare();
    if (!plan) return;
    setBulkBusy(true);
    // Every public address (per-locale slugs) is read before the delete.
    const sources = await redirect.productSources(
      plan,
      bulkDelete.rows.map((r) => ({ kind: 'product' as const, id: r.id, fallback: publicPath(r) })),
    );
    const sourceOf = new Map(bulkDelete.rows.map((r, i) => [r.id, sources[i]]));
    const result = await runBulk(bulkDelete.rows, (r) =>
      api(`/products/${r.id}`, { method: 'DELETE', token }),
    );
    setBulkBusy(false);
    bulkDelete.clear();
    setBulkDelete(null);
    reportBulk(result.ok.length, result.failed, 'bulkDeleted');
    fetchItems();
    // Redirects for every deleted product to the chosen target.
    void redirect.apply(plan, result.ok.map((r) => sourceOf.get(r.id)));
  };

  const bulkActions = (selected: OwnProduct[], clear: () => void) => (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={bulkBusy}
        onClick={() => bulkSetStatus(selected, 'PUBLISHED', clear)}
      >
        {tt('myProducts.bulkPublish')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={bulkBusy}
        onClick={() => bulkSetStatus(selected, 'DRAFT', clear)}
      >
        {tt('myProducts.bulkDraft')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={bulkBusy}
        onClick={() => bulkSetStatus(selected, 'ARCHIVED', clear)}
      >
        {tt('myProducts.bulkArchive')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
        disabled={bulkBusy}
        onClick={() => setBulkDelete({ rows: selected, clear })}
      >
        {tc('delete')}
      </Button>
    </>
  );

  const columns = [
    {
      key: 'title',
      label: tt('myProducts.colProduct'),
      render: (item: OwnProduct) => {
        const t = pickLocalized(item.translations, primaryLocale);
        const imgUrl = resolveUrl(item.images?.[0]?.url);
        return (
          <Link href={editHref(item)} className="group flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-zinc-50">
              {imgUrl ? (
                <img src={imgUrl} alt={t?.title || ''} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="size-4 text-zinc-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium group-hover:underline">{t?.title ?? '—'}</p>
              {(t?.slug || item.sku) && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {[item.sku, t?.slug].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </Link>
        );
      },
    },
    {
      key: 'price',
      label: tt('myProducts.colPricing'),
      render: (item: OwnProduct) => (
        <span className="text-sm font-medium tabular-nums">{fmt(item.base_price)}</span>
      ),
    },
    {
      key: 'stock',
      label: tt('myProducts.colStock'),
      render: (item: OwnProduct) => {
        const s = stockSummary(item);
        if (s.kind === 'untracked') {
          return (
            <span className="text-xs text-muted-foreground">{tt('myProducts.stockUntracked')}</span>
          );
        }
        return s.value > 0 ? (
          <span className="text-xs tabular-nums">
            {tt('myProducts.stockCount', { count: s.value })}
          </span>
        ) : (
          <span className="text-xs font-medium text-red-600">{tt('myProducts.stockOut')}</span>
        );
      },
    },
    {
      key: 'status',
      label: tc('status'),
      render: (item: OwnProduct) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${statusColors[item.status] ?? ''}`}
        >
          {statusLabelMap[item.status] ?? item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: OwnProduct) => {
        const slug = pickProductSlug(item.translations, primaryLocale);
        const published = item.status === 'PUBLISHED';
        return (
          <div className="flex items-center justify-end gap-1.5">
            <ViewInStoreButton
              appearance="icon"
              href={published ? productUrl(slug) : null}
              disabledHint={
                !published
                  ? tt('myProducts.viewInStoreNotPublished')
                  : !slug
                    ? tt('myProducts.viewInStoreNoSlug')
                    : undefined
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => router.push(editHref(item))}
            >
              {tc('edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteTarget(item)}
            >
              {tc('delete')}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{tt('myProducts.ownListTitle')}</h1>
          <p className="text-sm text-muted-foreground">{tt('myProducts.ownListSubtitle')}</p>
        </div>
        <Button size="sm" onClick={() => router.push('/creator/products/own/new')}>
          <Plus className="me-1.5 size-3.5" />
          {tt('products.addProduct')}
        </Button>
      </div>

      {/* Search, filters and sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') pushSearch(searchInput.trim());
            }}
            placeholder={tt('myProducts.searchPlaceholder')}
            aria-label={tt('myProducts.searchPlaceholder')}
            className="h-8 ps-8 text-sm"
          />
        </div>
        {collections.length > 0 && (
          <div className="w-56">
            <SearchableSelect
              value={collectionValue}
              onChange={(v) => updateParams({ collection: v })}
              placeholder={tt('myProducts.filterCollection')}
              options={[
                { value: '', label: tt('myProducts.allCollections') },
                { value: 'none', label: tt('myProducts.noCollection') },
                ...collections,
              ]}
            />
          </div>
        )}
        {tags.length > 0 && (
          <div className="w-48">
            <SearchableSelect
              value={tagValue}
              onChange={(v) => updateParams({ collection: v })}
              placeholder={tt('myProducts.filterTag')}
              options={[{ value: '', label: tt('myProducts.allTags') }, ...tags]}
            />
          </div>
        )}
        <div className="w-44">
          <SearchableSelect
            value={stock}
            onChange={(v) => updateParams({ stock: v })}
            placeholder={tt('myProducts.filterStock')}
            options={[
              { value: '', label: tt('myProducts.allStock') },
              { value: 'in_stock', label: tt('myProducts.stockIn') },
              { value: 'out_of_stock', label: tt('myProducts.stockOut') },
            ]}
          />
        </div>
        <div className="w-48">
          <SearchableSelect
            value={sort}
            onChange={(v) => updateParams({ sort: v === 'newest' ? '' : v })}
            placeholder={tt('myProducts.sortBy')}
            options={SORTS.map((s) => ({ value: s, label: tt(`myProducts.sort_${s}`) }))}
          />
        </div>
        <div className="w-36">
          <SearchableSelect
            value={limit}
            onChange={(v) => updateParams({ limit: v === '20' ? '' : v })}
            options={PAGE_SIZES.map((n) => ({
              value: n,
              label: tt('myProducts.perPage', { count: Number(n) }),
            }))}
          />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="me-1 size-3.5" />
            {tt('myProducts.clearFilters')}
          </Button>
        )}
      </div>

      {/* Status filter tabs + result count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
        {STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {status === 'ALL' ? tt('myProducts.allStatuses') : statusLabelMap[status]}
            </button>
          );
        })}
        </div>
        {meta && !loading && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {tt('myProducts.totalCount', { count: meta.total })}
          </p>
        )}
      </div>

      <BulkNotice notice={notice} onDismiss={() => setNotice(null)} />
      {redirect.notice}

      {/* Error state */}
      {loadError && !loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-muted-foreground">{tt('myProducts.ownLoadFailed')}</p>
          <Button size="sm" variant="outline" onClick={() => fetchItems()}>
            {tt('myProducts.retry')}
          </Button>
        </div>
      ) : !loading && meta?.total === 0 && !filtered ? (
        /* Empty state (no products at all) */
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Package className="size-6 text-zinc-400" />
          </div>
          <p className="text-sm font-medium">{tt('myProducts.ownEmptyTitle')}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{tt('myProducts.ownEmptyDesc')}</p>
          <Button size="sm" onClick={() => router.push('/creator/products/own/new')}>
            <Plus className="me-1.5 size-3.5" />
            {tt('products.addProduct')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          selectable
          bulkActions={bulkActions}
          rowHref={editHref}
          emptyMessage={
            loading
              ? tc('loading')
              : filtered
                ? tt('myProducts.noMatches')
                : tt('myProducts.ownEmptyTitle')
          }
          pagination={meta ?? undefined}
          onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : '' })}
        />
      )}

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={!!bulkDelete}
        onOpenChange={(open) => {
          if (!open) setBulkDelete(null);
        }}
        destructive
        title={tt('myProducts.bulkDeleteTitle', { count: bulkDelete?.rows.length ?? 0 })}
        description={tt('myProducts.bulkDeleteDesc')}
        busy={bulkBusy}
        busyLabel={tt('myProducts.deleting')}
        onConfirm={confirmBulkDelete}
      >
        {bulkDelete && (
          <DeleteRedirectField
            key={bulkDelete.rows.map((r) => r.id).join(',')}
            choiceRef={redirect.choiceRef}
            paths={bulkDelete.rows.map(publicPath).filter((p): p is string => !!p)}
            defaultEnabled={bulkDelete.rows.some((r) => r.status === 'PUBLISHED' && !!publicPath(r))}
            suggestions={redirectSuggestions}
            knownTargets={knownTargets(bulkDelete.rows)}
            skipped={bulkDelete.rows.filter((r) => !publicPath(r)).length}
            disabled={bulkBusy}
          />
        )}
      </ConfirmDialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tt('myProducts.deleteTitleProduct')}</DialogTitle>
            <DialogDescription>
              {tt('myProducts.deleteConfirmPrefix')}{' '}
              <span className="font-medium">
                {pickLocalized(deleteTarget?.translations, primaryLocale)?.title ?? tt('myProducts.thisProduct')}
              </span>
              {tt('myProducts.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <DeleteRedirectField
              key={deleteTarget.id}
              choiceRef={redirect.choiceRef}
              paths={publicPath(deleteTarget) ? [publicPath(deleteTarget)!] : []}
              defaultEnabled={deleteTarget.status === 'PUBLISHED'}
              suggestions={redirectSuggestions}
              knownTargets={knownTargets([deleteTarget])}
              disabled={deleting}
            />
          )}
          {deleteError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? tt('myProducts.deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
