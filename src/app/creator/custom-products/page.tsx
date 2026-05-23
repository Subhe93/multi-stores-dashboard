'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Layers, Plus, ImageIcon, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

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

  const goEdit = (row: Row) => {
    const dest =
      row.kind === 'custom'
        ? `/creator/custom-products/${row.id}`
        : `/creator/products/own/${row.id}`;
    router.push(dest);
  };

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border bg-zinc-50 overflow-hidden shrink-0 flex items-center justify-center">
              {imgUrl ? (
                <img src={imgUrl} alt={t?.title || ''} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-4 h-4 text-zinc-300" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{t?.title ?? '—'}</p>
              {t?.slug && (
                <p className="text-[10px] font-mono text-muted-foreground">{t.slug}</p>
              )}
            </div>
          </div>
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
              <span className="text-[10px] text-muted-foreground ml-1">{tt('myProducts.margin')}</span>
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
      render: (item: Row) => (
        <div className="flex items-center gap-1.5">
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
      ),
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
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {tt('myProducts.customizeProviderProduct')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/creator/products/own/new')}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {tt('myProducts.addOwnProduct')}
        </Button>
      </div>
    </div>
  );

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
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {tt('myProducts.ownProduct')}
          </Button>
          <Button size="sm" onClick={() => router.push('/creator/custom-products/new')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {tt('myProducts.customProduct')}
          </Button>
        </div>
      </div>

      {!loading && rows.length === 0 ? (
        emptyState
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={loading ? tc('loading') : tt('myProducts.emptyTitle')}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
