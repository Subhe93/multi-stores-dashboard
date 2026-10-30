'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Package, Pencil, Trash2, ImageIcon, Copy, Send, Archive } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media';
import { useCurrency } from '@/lib/useCurrency';
import { useTranslations } from 'next-intl';
import { runBulk } from '@/lib/bulk';
import { useRowOpen, useTableSelection } from '@/components/common/useTableSelection';
import {
  BulkNotice,
  SelectAllCheckbox,
  SelectRowCheckbox,
  TableSelectionBar,
  useBulkSummary,
  type BulkNoticeValue,
} from '@/components/common/TableSelectionBar';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      'bg-zinc-100 text-zinc-600',
  PUBLISHED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  ARCHIVED:   'bg-amber-50 text-amber-700 border-amber-200',
};

/** Product list row (GET /products/mine) — only the fields rendered by the table. */
interface ProductRow {
  id: string;
  status: string;
  product_type: string;
  base_price: number | string;
  created_at: string;
  images?: { url: string; is_featured?: boolean }[] | null;
  translations?: { title?: string | null }[] | null;
  category?: { translations?: { name?: string | null }[] | null } | null;
  variants?: { id: string }[] | null;
}

/** Pagination block returned next to `data` by list endpoints. */
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TABS = ['All', 'Draft', 'Published', 'Archived'];

const TAB_LABEL_KEYS: Record<string, string> = {
  All:       'tabAll',
  Draft:     'tabDraft',
  Published: 'tabPublished',
  Archived:  'tabArchived',
};

export default function ProviderProducts() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [bulkAction, setBulkAction] = useState<'delete' | 'publish' | 'archive' | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [bulkNotice, setBulkNotice] = useState<BulkNoticeValue | null>(null);
  const selection = useTableSelection(products, (p) => p.id);
  const bulkSummary = useBulkSummary();
  const { linkRow } = useRowOpen();
  const currentStatus = () => (activeTab === 'All' ? undefined : activeTab.toUpperCase());

  const fetchProducts = async (page = 1, status?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api<{ data: ProductRow[]; meta?: PaginationMeta | null }>(`/products/mine?${params}`, { token });
      setProducts(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [token]);

  const handleTab = (tab: string) => {
    setActiveTab(tab);
    selection.clear();
    fetchProducts(1, tab === 'All' ? undefined : tab.toUpperCase());
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    await api(`/products/${deleteTarget.id}`, { method: 'DELETE', token });
    setDeleteTarget(null);
    fetchProducts(meta?.page ?? 1, currentStatus());
  };

  const handleDuplicate = async (id: string) => {
    if (!token || duplicatingId) return;
    setDuplicatingId(id);
    try {
      const created = await api<{ id: string }>(`/products/${id}/duplicate`, {
        method: 'POST',
        token,
      });
      // Take the user straight to the duplicate so they can edit it.
      if (created?.id) router.push(`/provider/products/${created.id}`);
    } catch (err) {
      console.error('Duplicate failed:', err);
      alert(t('duplicateFailed'));
    } finally {
      setDuplicatingId(null);
    }
  };

  // Runs the existing single endpoints for every selected product.
  const handleBulkConfirm = async () => {
    if (!token || !bulkAction || selection.count === 0) return;
    setBulkWorking(true);
    const action = bulkAction;
    const result = await runBulk(selection.selectedRows, (p) =>
      action === 'delete'
        ? api(`/products/${p.id}`, { method: 'DELETE', token })
        : api(`/products/${p.id}`, {
            method: 'PUT',
            token,
            body: JSON.stringify({ status: action === 'publish' ? 'PUBLISHED' : 'ARCHIVED' }),
          }),
    );
    setBulkWorking(false);
    setBulkAction(null);
    selection.clear();
    setBulkNotice(bulkSummary(result));
    fetchProducts(1, currentStatus());
  };

  const getFeaturedImage = (item: ProductRow) =>
    resolveMediaUrl(item.images?.find((img) => img.is_featured)?.url || item.images?.[0]?.url) || null;

  if (!loading && products.length === 0 && activeTab === 'All') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t('products')}</h1>
            <p className="text-sm text-muted-foreground">{t('manageCatalog')}</p>
          </div>
          <Link href="/provider/products/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4" /> {t('addProduct')}
          </Link>
        </div>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{t('noProductsYet')}</p>
            <p className="text-xs text-muted-foreground mb-4">{t('getStartedProduct')}</p>
            <Link href="/provider/products/new" className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              {t('addFirstProduct')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('products')}</h1>
          <p className="text-sm text-muted-foreground">{t('manageCatalog')}</p>
        </div>
        <Link href="/provider/products/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" /> {t('addProduct')}
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Status tabs */}
        <div className="flex gap-1.5">
          {TABS.map(tab => (
            <Button key={tab} variant={activeTab === tab ? 'default' : 'ghost'} size="sm" className="h-8 text-xs"
              onClick={() => handleTab(tab)}>{t(TAB_LABEL_KEYS[tab])}</Button>
          ))}
        </div>

      </div>

      <BulkNotice notice={bulkNotice} onDismiss={() => setBulkNotice(null)} />

      {/* Custom table with checkboxes */}
      <Card className="shadow-none overflow-hidden">
        <TableSelectionBar selection={selection}>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkAction('publish')}>
            <Send className="w-3.5 h-3.5" />
            {t('publish')}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkAction('archive')}>
            <Archive className="w-3.5 h-3.5" />
            {t('archive')}
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setBulkAction('delete')}>
            <Trash2 className="w-3.5 h-3.5" />
            {t('delete')}
          </Button>
        </TableSelectionBar>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50/50">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <SelectAllCheckbox selection={selection} />
                </th>
                <th className="text-start px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">{t('colProduct')}</th>
                <th className="text-start px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">{t('colType')}</th>
                <th className="text-start px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">{t('colPrice')}</th>
                <th className="text-start px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">{t('colVariants')}</th>
                <th className="text-start px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">{t('colStatus')}</th>
                <th className="text-start px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">{t('colCreated')}</th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">{tc('loading')}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">{t('noProductsFound')}</td></tr>
              ) : (
                products.map(item => {
                  const imgUrl = getFeaturedImage(item);
                  const isSelected = selection.isSelected(item.id);
                  const href = `/provider/products/${item.id}`;
                  return (
                    <tr key={item.id} {...linkRow(href)} className={`cursor-pointer hover:bg-zinc-50 transition ${isSelected ? 'bg-zinc-50' : ''}`}>
                      <td className="px-3 py-2" data-row-click-ignore>
                        <SelectRowCheckbox selection={selection} id={item.id} />
                      </td>
                      <td className="px-3 py-2">
                        <Link href={href} className="flex items-center gap-3 text-start hover:opacity-80 transition">
                          <div className="h-9 w-9 rounded-md bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                            {imgUrl ? <img src={imgUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.translations?.[0]?.title || 'Untitled'}</p>
                            <p className="text-[10px] text-muted-foreground">{item.category?.translations?.[0]?.name || '—'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-[10px]">{item.product_type}</Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">{fmt(item.base_price)}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{item.variants?.length || 0}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[item.status] || ''}`}>{item.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={tc('edit')}
                            onClick={() => router.push(`/provider/products/${item.id}`)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t('duplicate')}
                            disabled={duplicatingId === item.id}
                            onClick={() => handleDuplicate(item.id)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            title={tc('delete')}
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">{t('countProducts', { count: meta.total })}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={meta.page <= 1} onClick={() => { selection.clear(); fetchProducts(meta.page - 1, currentStatus()); }}>{t('prev')}</Button>
              <span className="text-xs px-2 py-1">{meta.page} / {meta.totalPages}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={meta.page >= meta.totalPages} onClick={() => { selection.clear(); fetchProducts(meta.page + 1, currentStatus()); }}>{tc('next')}</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Single Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('deleteProduct')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{t('deleteProductConfirm', { name: deleteTarget?.translations?.[0]?.title || t('thisProduct') })}</strong>{' '}
            {t('deleteProductWarning')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>{tc('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>{tc('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={!!bulkAction} onOpenChange={v => { if (!v && !bulkWorking) setBulkAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'delete' ? t('bulkDeleteTitle') : bulkAction === 'publish' ? t('bulkPublishTitle') : t('bulkArchiveTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {bulkAction === 'delete'
              ? t('bulkDeleteConfirm', { count: selection.count })
              : bulkAction === 'publish'
                ? t('bulkPublishConfirm', { count: selection.count })
                : t('bulkArchiveConfirm', { count: selection.count })}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkAction(null)} disabled={bulkWorking}>{tc('cancel')}</Button>
            <Button
              variant={bulkAction === 'delete' ? 'destructive' : 'default'}
              size="sm"
              onClick={handleBulkConfirm}
              disabled={bulkWorking}
            >
              {bulkWorking ? t('working') : tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
