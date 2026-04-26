'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Layers, Plus, ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

interface CustomProductTranslation {
  locale: string;
  title: string;
  slug: string;
}

interface ProductTranslation {
  locale: string;
  title: string;
}

interface DesignTranslation {
  locale: string;
  title: string;
}

interface CustomProduct {
  id: string;
  product_id: string;
  design_id?: string;
  import_mode: 'AS_IS' | 'CUSTOMIZE';
  pricing_type: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
  final_price: number;
  margin_amount?: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
  rejection_reason?: string;
  translations: CustomProductTranslation[];
  mockup_images?: { url: string }[];
  selected_variants?: { id: string; variant_id: string }[];
  product: {
    translations: ProductTranslation[];
    base_price: number;
    images?: { url: string }[];
    variants?: { id: string }[];
  };
  design?: {
    translations: DesignTranslation[];
  };
}

const statusColors: Record<string, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const statusLabels: Record<string, string> = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  REJECTED: 'Needs changes',
  ARCHIVED: 'Archived',
};

export default function CustomProductsPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CustomProduct[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CustomProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<any>(`/custom-products?page=${page}&limit=20`, { token });
      setItems(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [token]);

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/custom-products/${deleteTarget.id}`, { method: 'DELETE', token });
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Product',
      render: (item: CustomProduct) => {
        const t = item.translations.find((x) => x.locale === 'en') ?? item.translations[0];
        const imgUrl = resolveUrl(item.mockup_images?.[0]?.url || item.product?.images?.[0]?.url);
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
              <p className="text-[10px] font-mono text-muted-foreground">{t?.slug ?? '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'base_product',
      label: 'Base Product',
      render: (item: CustomProduct) => {
        const t = item.product?.translations?.find((x) => x.locale === 'en');
        return <span className="text-sm">{t?.title ?? '—'}</span>;
      },
    },
    {
      key: 'import_mode',
      label: 'Mode',
      render: (item: CustomProduct) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${
            item.import_mode === 'AS_IS'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-purple-50 text-purple-700 border-purple-200'
          }`}
        >
          {item.import_mode === 'AS_IS' ? 'As-is' : 'Custom'}
        </Badge>
      ),
    },
    {
      key: 'variants',
      label: 'Variants',
      render: (item: CustomProduct) => {
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
      key: 'design',
      label: 'Design',
      render: (item: CustomProduct) => {
        const t = item.design?.translations?.find((x) => x.locale === 'en');
        return t ? (
          <span className="text-sm">{t.title}</span>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-zinc-100 text-zinc-600 border-zinc-200">
            No design
          </Badge>
        );
      },
    },
    {
      key: 'pricing',
      label: 'Pricing',
      render: (item: CustomProduct) => {
        if (item.pricing_type === 'SINGLE') {
          return <span className="text-sm font-medium">{fmt(item.final_price)}</span>;
        }
        if (item.pricing_type === 'MARGIN') {
          return (
            <span className="text-sm font-medium">
              +{fmt(item.margin_amount ?? 0)}
              <span className="text-[10px] text-muted-foreground ml-1">margin</span>
            </span>
          );
        }
        return (
          <span className="text-xs text-muted-foreground">Per-variant</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: CustomProduct) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${statusColors[item.status] ?? ''}`}
          title={(item as any).rejection_reason || undefined}
        >
          {statusLabels[item.status] ?? item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: CustomProduct) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push(`/creator/custom-products/${item.id}`)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeleteTarget(item)}
          >
            Delete
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
      <p className="text-sm font-medium">No custom products yet</p>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Combine provider products with your designs and set your own price to start selling.
      </p>
      <Button size="sm" onClick={() => router.push('/creator/custom-products/new')}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Create Custom Product
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Custom Products</h1>
          <p className="text-sm text-muted-foreground">Products you&apos;ve customized with your designs</p>
        </div>
        <Button size="sm" onClick={() => router.push('/creator/custom-products/new')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Custom Product
        </Button>
      </div>

      {!loading && items.length === 0 ? (
        emptyState
      ) : (
        <DataTable
          columns={columns}
          data={items}
          emptyMessage={loading ? 'Loading...' : 'No custom products yet'}
          pagination={meta}
          onPageChange={(p) => fetchItems(p)}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Custom Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium">
                {deleteTarget?.translations.find((x) => x.locale === 'en')?.title ?? 'this product'}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
