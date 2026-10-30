'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ViewInStoreButton } from '@/components/product/ViewInStoreButton';
import { BulkNotice, useBulkNotice } from '@/components/product/BulkNotice';
import { runBulk } from '@/lib/bulk';
import { pickProductSlug, useStorefrontUrl } from '@/lib/useStorefrontUrl';
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
import { Layers, Plus, ImageIcon, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { useStoreType } from '@/lib/useStoreType';
import { IndependentStoreNotice } from '@/components/creator/IndependentStoreNotice';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

interface Translation {
  locale: string;
  title: string;
  slug?: string;
}

interface CustomProduct {
  id: string;
  product_id: string;
  import_mode: 'AS_IS' | 'CUSTOMIZE';
  pricing_type: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
  final_price: number;
  margin_amount?: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
  rejection_reason?: string;
  created_at?: string;
  translations: Translation[];
  mockup_images?: { url: string }[];
  selected_variants?: { id: string; variant_id: string }[];
  product: {
    translations: Translation[];
    base_price: number;
    images?: { url: string }[];
    variants?: { id: string }[];
  };
}

interface OwnProduct {
  id: string;
  base_price: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
  created_at?: string;
  translations: Translation[];
  images?: { url: string }[];
  variants?: { id: string }[];
}

type Row =
  | ({ kind: 'custom' } & CustomProduct)
  | ({ kind: 'own' } & OwnProduct);

type ProductStatus = Row['status'];

/** Editor URL of a row (custom and own products live under different routes). */
const editHref = (row: Row) =>
  row.kind === 'custom' ? `/creator/custom-products/${row.id}` : `/creator/products/own/${row.id}`;

/** Own and custom ids come from different tables, so the kind is part of the key. */
const rowKey = (row: Row) => `${row.kind}:${row.id}`;

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

function pickTitle(translations?: Translation[]): Translation | undefined {
  if (!translations?.length) return undefined;
  return translations.find((t) => t.locale === 'en') ?? translations[0];
}

export default function CustomProductsPage() {
  const { fmt } = useCurrency();
  const { token, user } = useAuth();
  const router = useRouter();
  const tt = useTranslations('creator');
  const tc = useTranslations('common');
  const statusLabelMap = statusLabels(tt);
  const [customItems, setCustomItems] = useState<CustomProduct[]>([]);
  const [ownItems, setOwnItems] = useState<OwnProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { storeType } = useStoreType();
  const { productUrl, primaryLocale } = useStorefrontUrl();
  // Bulk actions: busy flag, the pending bulk delete and the result notice.
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDelete, setBulkDelete] = useState<{ rows: Row[]; clear: () => void } | null>(null);
  const { notice, setNotice } = useBulkNotice();

  const creatorId = user?.creator?.id;

  const fetchItems = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const customReq = api<{ data: CustomProduct[] }>(
        '/custom-products?limit=100',
        { token },
      ).catch(() => ({ data: [] as CustomProduct[] }));

      const ownReq = creatorId
        ? api<{ data: OwnProduct[] }>(
            `/products?creator_id=${creatorId}&limit=100`,
            { token },
          ).catch(() => ({ data: [] as OwnProduct[] }))
        : Promise.resolve({ data: [] as OwnProduct[] });

      const [customRes, ownRes] = await Promise.all([customReq, ownReq]);
      setCustomItems(customRes?.data || []);
      setOwnItems(ownRes?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [token, creatorId]);

  const rows = useMemo<Row[]>(() => {
    const merged: Row[] = [
      ...customItems.map((c) => ({ kind: 'custom' as const, ...c })),
      ...ownItems.map((o) => ({ kind: 'own' as const, ...o })),
    ];
    merged.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
    return merged;
  }, [customItems, ownItems]);

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const path =
        deleteTarget.kind === 'custom'
          ? `/custom-products/${deleteTarget.id}`
          : `/products/${deleteTarget.id}`;
      await api(path, { method: 'DELETE', token });
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      const e = err as { message?: string };
      setDeleteError(e?.message || tt('myProducts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (row: Row) => {
    if (!token || duplicatingId) return;
    setDuplicatingId(row.id);
    try {
      const path =
        row.kind === 'custom'
          ? `/custom-products/${row.id}/duplicate`
          : `/products/${row.id}/duplicate`;
      const created = await api<{ id: string }>(path, { method: 'POST', token });
      if (created?.id) {
        const dest =
          row.kind === 'custom'
            ? `/creator/custom-products/${created.id}`
            : `/creator/products/own/${created.id}`;
        router.push(dest);
      }
    } catch (err) {
      console.error('Duplicate failed:', err);
      alert(tt('myProducts.duplicateFailed'));
    } finally {
      setDuplicatingId(null);
    }
  };

  const goEdit = (row: Row) => router.push(editHref(row));

  /** Short summary of a bulk run: successes, provider reviews and the first failure. */
  const reportBulk = (
    ok: number,
    failed: { error: string }[],
    okKey: 'bulkStatusUpdated' | 'bulkDeleted',
    sentForReview = 0,
  ) => {
    const parts: string[] = [];
    if (ok - sentForReview > 0) parts.push(tt(`myProducts.${okKey}`, { count: ok - sentForReview }));
    if (sentForReview > 0) parts.push(tt('myProducts.bulkSentForReview', { count: sentForReview }));
    if (failed.length) {
      parts.push(tt('myProducts.bulkFailed', { count: failed.length, error: failed[0]!.error }));
    }
    setNotice({ tone: failed.length ? 'warn' : 'ok', text: parts.join(' · ') });
  };

  /**
   * Set one row's status. Own products use the partial PUT /products/:id.
   * Custom products are published through the review flow (POST .../submit):
   * the API publishes directly when there is no provider and otherwise moves
   * the product to PENDING_REVIEW. Returns the resulting status.
   */
  const applyStatus = async (row: Row, status: ProductStatus): Promise<ProductStatus> => {
    if (!token) throw new Error('Not signed in');
    if (row.kind === 'own') {
      await api(`/products/${row.id}`, { method: 'PUT', token, body: JSON.stringify({ status }) });
      return status;
    }
    if (status !== 'PUBLISHED') {
      await api(`/custom-products/${row.id}`, { method: 'PUT', token, body: JSON.stringify({ status }) });
      return status;
    }
    // Submit accepts DRAFT / REJECTED only: an archived product goes back to draft first.
    if (row.status === 'ARCHIVED') {
      await api(`/custom-products/${row.id}`, { method: 'PUT', token, body: JSON.stringify({ status: 'DRAFT' }) });
    }
    const res = await api<{ status?: ProductStatus }>(`/custom-products/${row.id}/submit`, { method: 'POST', token });
    return res?.status ?? 'PUBLISHED';
  };

  const bulkSetStatus = async (rows: Row[], status: ProductStatus, clear: () => void) => {
    if (!token) return;
    // Publishing skips rows already live or waiting for the provider's review.
    const targets = rows.filter((r) =>
      status === 'PUBLISHED'
        ? r.status !== 'PUBLISHED' && r.status !== 'PENDING_REVIEW'
        : r.status !== status,
    );
    if (!targets.length) {
      clear();
      setNotice({ tone: 'ok', text: tt('myProducts.bulkNothingToChange') });
      return;
    }
    setBulkBusy(true);
    let sentForReview = 0;
    const result = await runBulk(targets, async (r) => {
      const next = await applyStatus(r, status);
      if (status === 'PUBLISHED' && next === 'PENDING_REVIEW') sentForReview += 1;
    });
    setBulkBusy(false);
    clear();
    reportBulk(result.ok.length, result.failed, 'bulkStatusUpdated', sentForReview);
    fetchItems();
  };

  const confirmBulkDelete = async () => {
    if (!token || !bulkDelete) return;
    setBulkBusy(true);
    const result = await runBulk(bulkDelete.rows, (r) =>
      api(r.kind === 'custom' ? `/custom-products/${r.id}` : `/products/${r.id}`, {
        method: 'DELETE',
        token,
      }),
    );
    setBulkBusy(false);
    bulkDelete.clear();
    setBulkDelete(null);
    reportBulk(result.ok.length, result.failed, 'bulkDeleted');
    fetchItems();
  };

  const bulkActions = (selected: Row[], clear: () => void) => (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={bulkBusy}
        title={tt('myProducts.bulkPublishHint')}
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
      render: (item: Row) => {
        let t: Translation | undefined;
        let imgUrl: string | undefined;
        if (item.kind === 'custom') {
          t = pickTitle(item.translations);
          imgUrl = resolveUrl(item.mockup_images?.[0]?.url || item.product?.images?.[0]?.url);
        } else {
          t = pickTitle(item.translations);
          imgUrl = resolveUrl(item.images?.[0]?.url);
        }
        return (
          <Link href={editHref(item)} className="group flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border bg-zinc-50 overflow-hidden shrink-0 flex items-center justify-center">
              {imgUrl ? (
                <img src={imgUrl} alt={t?.title || ''} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-4 h-4 text-zinc-300" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm group-hover:underline">{t?.title ?? '—'}</p>
              {t?.slug && (
                <p className="text-[10px] font-mono text-muted-foreground">{t.slug}</p>
              )}
            </div>
          </Link>
        );
      },
    },
    {
      key: 'source',
      label: tt('myProducts.colSource'),
      render: (item: Row) => {
        if (item.kind === 'own') {
          return <span className="text-sm text-muted-foreground">{tt('myProducts.yourOwnProduct')}</span>;
        }
        const t = pickTitle(item.product?.translations);
        return <span className="text-sm">{t?.title ?? '—'}</span>;
      },
    },
    {
      key: 'mode',
      label: tt('myProducts.colMode'),
      render: (item: Row) => {
        if (item.kind === 'own') {
          return (
            <Badge
              variant="outline"
              className="text-[10px] font-semibold bg-purple-50 text-purple-700 border-purple-200"
            >
              {tt('myProducts.modeOwn')}
            </Badge>
          );
        }
        return (
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold ${
              item.import_mode === 'AS_IS'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {item.import_mode === 'AS_IS' ? tt('myProducts.modeAsIs') : tt('myProducts.modeCustom')}
          </Badge>
        );
      },
    },
    {
      key: 'variants',
      label: tt('myProducts.colVariants'),
      render: (item: Row) => {
        if (item.kind === 'own') {
          const total = item.variants?.length ?? 0;
          return <span className="text-xs text-muted-foreground">{total}</span>;
        }
        const selected = item.selected_variants?.length ?? 0;
        const total = item.product?.variants?.length ?? 0;
        return (
          <span className="text-xs text-muted-foreground">
            {selected}/{total}
          </span>
        );
      },
    },
    {
      key: 'pricing',
      label: tt('myProducts.colPricing'),
      render: (item: Row) => {
        if (item.kind === 'own') {
          return <span className="text-sm font-medium">{fmt(item.base_price)}</span>;
        }
        if (item.pricing_type === 'SINGLE') {
          return <span className="text-sm font-medium">{fmt(item.final_price)}</span>;
        }
        if (item.pricing_type === 'MARGIN') {
          return (
            <span className="text-sm font-medium">
              +{fmt(item.margin_amount ?? 0)}
              <span className="text-[10px] text-muted-foreground ms-1">{tt('myProducts.margin')}</span>
            </span>
          );
        }
        return <span className="text-xs text-muted-foreground">{tt('myProducts.perVariant')}</span>;
      },
    },
    {
      key: 'status',
      label: tc('status'),
      render: (item: Row) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${statusColors[item.status] ?? ''}`}
          title={item.kind === 'custom' ? item.rejection_reason || undefined : undefined}
        >
          {statusLabelMap[item.status] ?? item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: Row) => {
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
            onClick={() => goEdit(item)}
          >
            {tc('edit')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={tt('myProducts.duplicate')}
            disabled={duplicatingId === item.id}
            onClick={() => handleDuplicate(item)}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeleteTarget(item)}
          >
            {tc('delete')}
          </Button>
        </div>
        );
      },
    },
  ];

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
        <Layers className="w-6 h-6 text-zinc-400" />
      </div>
      <p className="text-sm font-medium">{tt('myProducts.emptyTitle')}</p>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {tt('myProducts.emptyDesc')}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => router.push('/creator/custom-products/new')}>
          <Plus className="w-3.5 h-3.5 me-1.5" />
          {tt('myProducts.customizeProviderProduct')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/creator/products/own/new')}
        >
          <Plus className="w-3.5 h-3.5 me-1.5" />
          {tt('myProducts.addOwnProduct')}
        </Button>
      </div>
    </div>
  );

  // Independent stores manage products from "Add Product" only — provider
  // product imports do not apply, so direct navigation gets a friendly notice.
  if (storeType === 'INDEPENDENT') {
    return <IndependentStoreNotice description={tt('independent.customNotAvailable')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{tt('myProducts.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {tt('myProducts.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/creator/products/own/new')}
          >
            <Plus className="w-3.5 h-3.5 me-1.5" />
            {tt('myProducts.ownProduct')}
          </Button>
          <Button size="sm" onClick={() => router.push('/creator/custom-products/new')}>
            <Plus className="w-3.5 h-3.5 me-1.5" />
            {tt('myProducts.customProduct')}
          </Button>
        </div>
      </div>

      <BulkNotice notice={notice} onDismiss={() => setNotice(null)} />

      {!loading && rows.length === 0 ? (
        emptyState
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={rowKey}
          selectable
          bulkActions={bulkActions}
          rowHref={editHref}
          emptyMessage={loading ? tc('loading') : tt('myProducts.emptyTitle')}
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
      />

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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === 'own'
                ? tt('myProducts.deleteTitleProduct')
                : tt('myProducts.deleteTitleCustom')}
            </DialogTitle>
            <DialogDescription>
              {tt('myProducts.deleteConfirmPrefix')}{' '}
              <span className="font-medium">
                {pickTitle(deleteTarget?.translations)?.title ?? tt('myProducts.thisProduct')}
              </span>
              {tt('myProducts.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
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
