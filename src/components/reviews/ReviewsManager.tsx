'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeCheck, Check, Eye, MessageSquare, Star, X } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { ListEmptyState } from '@/components/common/ListEmptyState';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Button } from '@/components/ui/button';
import { useDateFormatter } from '@/components/customers/shared';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media';
import { useStoreType } from '@/lib/useStoreType';
import { notifyReviewsChanged } from '@/lib/useReviewsPendingCount';
import {
  REVIEW_RATINGS,
  REVIEW_TABS,
  isReviewListFiltered,
  normalizeReviewCounts,
  parseReviewListState,
  patchReviewListParams,
  reviewListQuery,
  reviewProductOptions,
  reviewSourceKey,
  tabCount,
  type OwnerReview,
  type ReviewCounts,
  type ReviewListMeta,
  type ReviewProductOption,
  type ReviewTab,
  isReviewChanged,
  refreshedReview,
} from '@/lib/reviews';
import { deleteReview, listReviews, removeReviewReply, saveReviewReply, setReviewStatus } from '@/lib/reviews.api';
import { ReviewDialog, type ReviewActions } from './ReviewDialog';
import { ReviewStars } from './ReviewStars';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { useReviewError } from './useReviewError';

const LIST_PATH = '/creator/reviews';

interface Notice {
  tone: 'success' | 'error';
  text: string;
}

/**
 * Moderation list of the store's product reviews: status tabs with counts,
 * rating and product filters (all in the URL), and a dialog per review with
 * approve / reject / reply / delete. The owner can never create a review or
 * change its rating or text.
 */
export function ReviewsManager({ token }: { token: string }) {
  const t = useTranslations('creator.reviews');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fmtDate = useDateFormatter();
  const describeError = useReviewError();
  const { storeType } = useStoreType();

  const state = useMemo(() => parseReviewListState(searchParams), [searchParams]);
  const listQuery = reviewListQuery(state);

  const [rows, setRows] = useState<OwnerReview[]>([]);
  const [meta, setMeta] = useState<ReviewListMeta | null>(null);
  const [counts, setCounts] = useState<ReviewCounts>(() => normalizeReviewCounts(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selected, setSelected] = useState<OwnerReview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Review whose open dialog must show the fresh row after the next load
  // (the API answered REVIEW_CHANGED: the customer edited it meanwhile).
  const refreshId = useRef<string | null>(null);

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const qs = patchReviewListParams(searchParams.toString(), patch);
      router.replace(qs ? `${LIST_PATH}?${qs}` : LIST_PATH, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listReviews(token, listQuery)
      .then((page) => {
        if (cancelled) return;
        setRows(page.items);
        setMeta(page.meta);
        setCounts(page.counts);
        const changedId = refreshId.current;
        if (changedId) {
          refreshId.current = null;
          setSelected((prev) => (prev && prev.id === changedId ? refreshedReview(page.items, changedId) : prev));
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // describeError is rebuilt every render; the query string is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, listQuery, reloadKey]);

  // A page past the end (after moderating the last row of a page) snaps back.
  useEffect(() => {
    if (!loading && meta && state.page > 1 && state.page > Math.max(meta.totalPages, 1)) {
      updateParams({ page: meta.totalPages > 1 ? String(meta.totalPages) : '' });
    }
  }, [loading, meta, state.page, updateParams]);

  const reload = () => setReloadKey((k) => k + 1);

  // ── Moderation actions (shared by the row buttons and the dialog) ─────────
  const afterChange = (text: string, updated: OwnerReview | null, removedId?: string) => {
    if (updated) {
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
    } else if (removedId) {
      setRows((prev) => prev.filter((r) => r.id !== removedId));
      setSelected((prev) => (prev && prev.id === removedId ? null : prev));
    }
    setNotice({ tone: 'success', text });
    // Counts and tab membership come from the server; the badge follows.
    reload();
    notifyReviewsChanged();
  };

  const guarded = async (review: OwnerReview, fn: () => Promise<void>): Promise<string | null> => {
    setBusyId(review.id);
    try {
      await fn();
      return null;
    } catch (err) {
      const text = describeError(err);
      if (isReviewChanged(err)) {
        // Nothing was applied. Load the current text, so the owner decides
        // on what the customer wrote now; the page notice stays readable
        // when the dialog has to close.
        refreshId.current = review.id;
        setNotice({ tone: 'error', text });
        reload();
        notifyReviewsChanged();
      }
      return text;
    } finally {
      setBusyId(null);
    }
  };

  const actions: ReviewActions = {
    setStatus: (review, status) =>
      guarded(review, async () => {
        const updated = await setReviewStatus(token, review.id, status, review.updated_at);
        afterChange(status === 'APPROVED' ? t('toasts.approved') : t('toasts.rejected'), updated);
      }),
    saveReply: (review, body) =>
      guarded(review, async () => {
        const updated = await saveReviewReply(token, review.id, body, review.updated_at);
        afterChange(t('toasts.replySaved'), updated);
      }),
    removeReply: (review) =>
      guarded(review, async () => {
        const updated = await removeReviewReply(token, review.id);
        afterChange(t('toasts.replyRemoved'), updated);
      }),
    remove: (review) =>
      guarded(review, async () => {
        await deleteReview(token, review.id);
        afterChange(t('toasts.deleted'), null, review.id);
      }),
  };

  const quickStatus = async (review: OwnerReview, status: 'APPROVED' | 'REJECTED') => {
    if (busyId) return;
    setNotice(null);
    const failure = await actions.setStatus(review, status);
    if (failure) setNotice({ tone: 'error', text: failure });
  };

  // ── Product filter: the owner's products, searched on the server ──────────
  const [productQuery, setProductQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const includeCustom = storeType === 'MARKETPLACE';
  const searchKey = `${debouncedQuery}|${includeCustom ? 1 : 0}|${locale}`;
  const [productSearch, setProductSearch] = useState<{ key: string; options: ReviewProductOption[] }>({ key: '', options: [] });
  // Label of the picked product, kept so the trigger still names it when the
  // current search results no longer hold it.
  const [pickedProduct, setPickedProduct] = useState<ReviewProductOption | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(productQuery.trim()), 300);
    return () => clearTimeout(h);
  }, [productQuery]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '20' });
    if (debouncedQuery) params.set('search', debouncedQuery);
    const qs = params.toString();
    Promise.all([
      api<unknown>(`/products/mine?${qs}`, { token }).catch(() => null),
      includeCustom ? api<unknown>(`/custom-products?${qs}`, { token }).catch(() => null) : Promise.resolve(null),
    ]).then(([products, custom]) => {
      if (!cancelled) setProductSearch({ key: searchKey, options: reviewProductOptions(products, custom, locale) });
    });
    return () => {
      cancelled = true;
    };
  }, [token, debouncedQuery, includeCustom, locale, searchKey]);

  const productOptions = useMemo(() => {
    const options = productSearch.options.map((o) => ({ value: o.value, label: o.label, imageUrl: resolveMediaUrl(o.image) ?? '' }));
    const head = [{ value: '', label: t('filters.allProducts'), imageUrl: '' }];
    if (state.product && !options.some((o) => o.value === state.product)) {
      // Every listed row is of the filtered product, so a row can name it.
      const fromRow = rows.find((r) => r.product?.id === state.product)?.product;
      const label =
        (pickedProduct?.value === state.product ? pickedProduct.label : '') || fromRow?.title || t('filters.selectedProduct');
      head.push({ value: state.product, label, imageUrl: '' });
    }
    return [...head, ...options];
  }, [productSearch.options, state.product, rows, pickedProduct, t]);

  const columns = [
    {
      key: 'rating',
      label: t('columns.rating'),
      render: (r: OwnerReview) => <ReviewStars rating={r.rating} />,
    },
    {
      key: 'product',
      label: t('columns.product'),
      render: (r: OwnerReview) => {
        const image = resolveMediaUrl(r.product?.image_url);
        return (
          <div className="flex min-w-0 max-w-52 items-center gap-2">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote API-host thumbnail
              <img src={image} alt="" className="size-8 shrink-0 rounded border object-cover" loading="lazy" />
            ) : (
              <span className="size-8 shrink-0 rounded border bg-zinc-100" aria-hidden />
            )}
            <span className="truncate text-xs font-medium">{r.product?.title || r.product?.slug || '—'}</span>
          </div>
        );
      },
    },
    {
      key: 'review',
      label: t('columns.review'),
      render: (r: OwnerReview) => (
        <div dir="auto" lang={r.locale || undefined} className="min-w-40 max-w-sm">
          {r.title && <span className="block truncate text-sm font-medium">{r.title}</span>}
          <span className="line-clamp-2 break-words text-xs text-muted-foreground">{r.body}</span>
          {r.reply && (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-700">
              <MessageSquare aria-hidden className="size-3" />
              {t('replied')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      label: t('columns.customer'),
      render: (r: OwnerReview) => (
        <div className="min-w-0 max-w-40">
          <span dir="auto" className="block truncate text-xs">{r.display_name || '—'}</span>
          {r.verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <BadgeCheck aria-hidden className="size-3" />
              {t('verified')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      label: t('columns.source'),
      render: (r: OwnerReview) => {
        const key = reviewSourceKey(r.source);
        return <span className="text-xs text-muted-foreground">{key ? t(`source.${key}`) : r.source || '—'}</span>;
      },
    },
    {
      key: 'locale',
      label: t('columns.language'),
      render: (r: OwnerReview) => <span dir="ltr" className="text-xs uppercase text-muted-foreground">{r.locale || '—'}</span>,
    },
    {
      key: 'created_at',
      label: t('columns.date'),
      render: (r: OwnerReview) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>,
    },
    {
      key: 'status',
      label: t('columns.status'),
      render: (r: OwnerReview) => <ReviewStatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      label: tc('actions'),
      render: (r: OwnerReview) => (
        <div className="flex items-center justify-end gap-1">
          {r.status !== 'APPROVED' && (
            <Button
              variant="outline"
              size="icon"
              className="size-7 text-emerald-700"
              disabled={busyId !== null}
              title={t('actions.approve')}
              aria-label={t('actions.approve')}
              onClick={() => void quickStatus(r, 'APPROVED')}
            >
              <Check className="size-3.5" />
            </Button>
          )}
          {r.status !== 'REJECTED' && (
            <Button
              variant="outline"
              size="icon"
              className="size-7 text-red-600"
              disabled={busyId !== null}
              title={t('actions.reject')}
              aria-label={t('actions.reject')}
              onClick={() => void quickStatus(r, 'REJECTED')}
            >
              <X className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title={t('actions.view')}
            aria-label={t('actions.view')}
            onClick={() => setSelected(r)}
          >
            <Eye className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const filtered = isReviewListFiltered(state);
  const showEmptyState = !loading && !loadError && rows.length === 0 && !filtered;

  return (
    <div className="space-y-4">
      {/* Status tabs with counts; the tab lives in the URL. */}
      <div role="tablist" aria-label={t('columns.status')} className="flex flex-wrap items-center gap-1 border-b">
        {REVIEW_TABS.map((tab: ReviewTab) => {
          const active = state.tab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => updateParams({ tab: tab === 'pending' ? '' : tab })}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                active ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`tabs.${tab}`)}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                {tabCount(counts, tab)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <SearchableSelect
            value={state.rating}
            onChange={(v) => updateParams({ rating: v })}
            placeholder={t('filters.rating')}
            options={[
              { value: '', label: t('filters.allRatings') },
              ...REVIEW_RATINGS.map((n) => ({ value: n, label: t('filters.stars', { count: Number(n) }) })),
            ]}
          />
        </div>
        <div className="w-64">
          <SearchableSelect
            value={state.product}
            onChange={(v) => {
              const option = productSearch.options.find((o) => o.value === v);
              if (option) setPickedProduct(option);
              updateParams({ product: v });
            }}
            placeholder={t('filters.product')}
            options={productOptions}
            onSearchChange={setProductQuery}
            loading={productSearch.key !== searchKey}
          />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => updateParams({ rating: '', product: '' })}>
            <X className="me-1 size-3.5" />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
            notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label={tc('close')}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            {tc('retry')}
          </Button>
        </div>
      ) : showEmptyState ? (
        <ListEmptyState icon={<Star />} title={t(`empty.${state.tab}`)} hint={t('empty.hint')} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r: OwnerReview) => r.id}
          onRowClick={(r: OwnerReview) => setSelected(r)}
          emptyMessage={loading ? tc('loading') : t('empty.filtered')}
          pagination={meta ?? undefined}
          onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : '' })}
        />
      )}

      <ReviewDialog review={selected} actions={actions} onClose={() => setSelected(null)} />
    </div>
  );
}
