'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Package, Plus, ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { DataTable } from '@/components/common/DataTable';
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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

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
  translations: Translation[];
  images?: { url: string }[];
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

function pickTitle(translations?: Translation[]): Translation | undefined {
  if (!translations?.length) return undefined;
  return translations.find((t) => t.locale === 'en') ?? translations[0];
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

  const [items, setItems] = useState<OwnProduct[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductStatus>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<OwnProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchItems = useCallback(
    async (page = 1, status: 'ALL' | ProductStatus = statusFilter) => {
      if (!token) return;
      setLoading(true);
      setLoadError(false);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (status !== 'ALL') params.set('status', status);
        const res = await api<{ data: OwnProduct[]; meta: ListMeta }>(
          `/products/mine?${params.toString()}`,
          { token },
        );
        setItems(res?.data ?? []);
        setMeta(res?.meta ?? null);
      } catch (err) {
        console.error('Failed to load own products:', err);
        setItems([]);
        setMeta(null);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [token, statusFilter],
  );

  useEffect(() => {
    fetchItems(1);
  }, [fetchItems]);

  const handleStatusFilter = (status: 'ALL' | ProductStatus) => {
    setStatusFilter(status);
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/products/${deleteTarget.id}`, { method: 'DELETE', token });
      setDeleteTarget(null);
      fetchItems(meta?.page || 1);
    } catch (err) {
      const e = err as { message?: string };
      setDeleteError(e?.message || tt('myProducts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: tt('myProducts.colProduct'),
      render: (item: OwnProduct) => {
        const t = pickTitle(item.translations);
        const imgUrl = resolveUrl(item.images?.[0]?.url);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-zinc-50">
              {imgUrl ? (
                <img src={imgUrl} alt={t?.title || ''} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="size-4 text-zinc-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{t?.title ?? '—'}</p>
              {t?.slug && (
                <p className="font-mono text-[10px] text-muted-foreground">{t.slug}</p>
              )}
            </div>
          </div>
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
      render: (item: OwnProduct) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push(`/creator/products/own/${item.id}`)}
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
      ),
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

      {/* Status filter tabs */}
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

      {/* Error state */}
      {loadError && !loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-muted-foreground">{tt('myProducts.ownLoadFailed')}</p>
          <Button size="sm" variant="outline" onClick={() => fetchItems(meta?.page || 1)}>
            {tt('myProducts.retry')}
          </Button>
        </div>
      ) : !loading && items.length === 0 && statusFilter === 'ALL' ? (
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
          emptyMessage={loading ? tc('loading') : tt('myProducts.ownEmptyTitle')}
          pagination={meta ?? undefined}
          onPageChange={(p) => fetchItems(p)}
        />
      )}

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
            <DialogTitle>{tt('myProducts.deleteTitleProduct')}</DialogTitle>
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
