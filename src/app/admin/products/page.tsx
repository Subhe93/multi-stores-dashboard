'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Package } from 'lucide-react';
import { useCurrency } from '@/lib/useCurrency';

type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface AdminProduct {
  id: string;
  slug: string;
  base_price: number;
  status: ProductStatus;
  created_at: string;
  translations: { locale: string; title: string; slug: string }[];
  provider?: { id: string; company_name: string };
  category?: { id: string; translations: { locale: string; name: string }[] };
  images?: { url: string; sort_order: number }[];
}

const statusColors: Record<ProductStatus, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  DRAFT: 'bg-amber-50 text-amber-700',
  ARCHIVED: 'bg-zinc-100 text-zinc-500',
};

const TABS: { label: string; status?: ProductStatus }[] = [
  { label: 'All' },
  { label: 'Published', status: 'PUBLISHED' },
  { label: 'Draft', status: 'DRAFT' },
  { label: 'Archived', status: 'ARCHIVED' },
];

export default function AdminProducts() {
  const t = useTranslations('admin');
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [toggleTarget, setToggleTarget] = useState<AdminProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const tabStatus = TABS[activeTab]?.status;
      if (tabStatus) params.set('status', tabStatus);
      const res = await api<any>(`/products?${params}`, { token });
      setProducts(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [token, activeTab]);

  const handleToggleStatus = async (target: AdminProduct, newStatus: ProductStatus) => {
    if (!token) return;
    setSaving(true);
    try {
      await api(`/products/${target.id}/status`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status: newStatus }),
      });
      setToggleTarget(null);
      fetchProducts();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getName = (p: AdminProduct | null) =>
    p?.translations?.find(t => t.locale === 'en')?.title || p?.slug || '';

  const getCategoryName = (p: AdminProduct) =>
    p.category?.translations?.find(t => t.locale === 'en')?.name || '—';

  // Next status when toggling
  const getNextStatus = (current: ProductStatus): ProductStatus =>
    current === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';

  const tabLabel = (tab: { label: string; status?: ProductStatus }) => {
    if (!tab.status) return t('tabAll');
    if (tab.status === 'PUBLISHED') return t('statusPublished');
    if (tab.status === 'DRAFT') return t('statusDraft');
    return t('statusArchived');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('allProducts')}</h1>
          <p className="text-sm text-muted-foreground">{t('allProductsSubtitle')}</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((tab, i) => (
          <Button
            key={tab.label}
            variant={activeTab === i ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setActiveTab(i)}
          >
            {tabLabel(tab)}
          </Button>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: 'name', label: t('product'), render: (item: AdminProduct) => (
              <div className="flex items-center gap-2.5">
                {item.images?.[0]?.url ? (
                  <img
                    src={item.images[0].url}
                    alt=""
                    className="w-8 h-8 rounded object-cover bg-zinc-100 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0">
                    <Package className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{getName(item)}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">/{item.slug}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'provider', label: t('provider'), render: (item: AdminProduct) => (
              <span className="text-sm">{item.provider?.company_name || '—'}</span>
            ),
          },
          {
            key: 'category', label: t('category'), render: (item: AdminProduct) => (
              <span className="text-xs text-muted-foreground">{getCategoryName(item)}</span>
            ),
          },
          {
            key: 'base_price', label: t('basePrice'), sortable: true, render: (item: AdminProduct) => (
              <span className="text-sm font-medium">{fmt(item.base_price)}</span>
            ),
          },
          {
            key: 'status', label: t('status'), render: (item: AdminProduct) => (
              <Badge variant="secondary" className={`text-[10px] font-semibold ${statusColors[item.status] || ''}`}>
                {item.status}
              </Badge>
            ),
          },
          {
            key: 'created_at', label: t('added'), sortable: true, render: (item: AdminProduct) => (
              <span className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            ),
          },
          {
            key: 'actions', label: '', render: (item: AdminProduct) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => setToggleTarget(item)}
              >
                {item.status === 'PUBLISHED' ? t('archive') : t('publish')}
              </Button>
            ),
          },
        ]}
        data={products}
        pagination={meta}
        onPageChange={(p) => fetchProducts(p)}
        emptyMessage={loading ? t('loading') : t('noProductsFound')}
      />

      {/* Status toggle confirmation */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.status === 'PUBLISHED' ? t('archiveProduct') : t('publishProduct')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {toggleTarget?.status === 'PUBLISHED'
              ? t('archiveProductConfirm', { name: getName(toggleTarget) })
              : t('publishProductConfirm', { name: getName(toggleTarget) })}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToggleTarget(null)}>{t('cancel')}</Button>
            <Button
              size="sm"
              variant={toggleTarget?.status === 'PUBLISHED' ? 'destructive' : 'default'}
              onClick={() => toggleTarget && handleToggleStatus(toggleTarget, getNextStatus(toggleTarget.status))}
              disabled={saving}
            >
              {saving ? t('saving') : toggleTarget?.status === 'PUBLISHED' ? t('archive') : t('publish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
