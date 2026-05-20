'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Package, Pencil, Trash2, ImageIcon, CheckSquare2, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      'bg-zinc-100 text-zinc-600',
  PUBLISHED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  ARCHIVED:   'bg-amber-50 text-amber-700 border-amber-200',
};

const TABS = ['All', 'Draft', 'Published', 'Archived'];

export default function ProviderProducts() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'delete' | 'publish' | 'archive' | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const fetchProducts = async (page = 1, status?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api<any>(`/products?${params}`, { token });
      setProducts(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [token]);

  const handleTab = (tab: string) => {
    setActiveTab(tab);
    setSelected(new Set());
    fetchProducts(1, tab === 'All' ? undefined : tab.toUpperCase());
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    await api(`/products/${deleteTarget.id}`, { method: 'DELETE', token });
    setDeleteTarget(null);
    setSelected(new Set());
    fetchProducts();
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
      alert('Failed to duplicate product. Please try again.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkConfirm = async () => {
    if (!token || !bulkAction || selected.size === 0) return;
    setBulkWorking(true);
    try {
      const ids = Array.from(selected);
      if (bulkAction === 'delete') {
        await Promise.all(ids.map(id => api(`/products/${id}`, { method: 'DELETE', token })));
      } else {
        const status = bulkAction === 'publish' ? 'PUBLISHED' : 'ARCHIVED';
        await Promise.all(ids.map(id =>
          api(`/products/${id}`, { method: 'PUT', token, body: JSON.stringify({ status }) })
        ));
      }
      setSelected(new Set());
      setBulkAction(null);
      fetchProducts(1, activeTab === 'All' ? undefined : activeTab.toUpperCase());
    } catch (err) { console.error(err); }
    finally { setBulkWorking(false); }
  };

  const getFeaturedImage = (item: any) =>
    item.images?.find((img: any) => img.is_featured)?.url || item.images?.[0]?.url || null;

  const allSelected = products.length > 0 && selected.size === products.length;
  const someSelected = selected.size > 0 && selected.size < products.length;

  if (!loading && products.length === 0 && activeTab === 'All') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground">Manage your product catalog</p>
          </div>
          <Link href="/provider/products/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add Product
          </Link>
        </div>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No products yet</p>
            <p className="text-xs text-muted-foreground mb-4">Get started by adding your first product</p>
            <Link href="/provider/products/new" className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              Add your first product
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
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog</p>
        </div>
        <Link href="/provider/products/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Status tabs */}
        <div className="flex gap-1.5">
          {TABS.map(tab => (
            <Button key={tab} variant={activeTab === tab ? 'default' : 'ghost'} size="sm" className="h-8 text-xs"
              onClick={() => handleTab(tab)}>{tab}</Button>
          ))}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-zinc-900 text-white rounded-lg px-3 py-1.5">
            <CheckSquare2 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{selected.size} selected</span>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-white hover:bg-white/10 px-2"
              onClick={() => setBulkAction('publish')}>Publish</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-white hover:bg-white/10 px-2"
              onClick={() => setBulkAction('archive')}>Archive</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-300 hover:bg-white/10 px-2"
              onClick={() => setBulkAction('delete')}>Delete</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-white/50 hover:bg-white/10 px-2"
              onClick={() => setSelected(new Set())}>✕</Button>
          </div>
        )}
      </div>

      {/* Custom table with checkboxes */}
      <Card className="shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50/50">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Price</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Variants</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Created</th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No products found</td></tr>
              ) : (
                products.map(item => {
                  const imgUrl = getFeaturedImage(item);
                  const isSelected = selected.has(item.id);
                  return (
                    <tr key={item.id} className={`hover:bg-zinc-50 transition ${isSelected ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" className="rounded" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => router.push(`/provider/products/${item.id}`)} className="flex items-center gap-3 text-left hover:opacity-80 transition">
                          <div className="h-9 w-9 rounded-md bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                            {imgUrl ? <img src={imgUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.translations?.[0]?.title || 'Untitled'}</p>
                            <p className="text-[10px] text-muted-foreground">{item.category?.translations?.[0]?.name || '—'}</p>
                          </div>
                        </button>
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
                            title="Edit"
                            onClick={() => router.push(`/provider/products/${item.id}`)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Duplicate"
                            disabled={duplicatingId === item.id}
                            onClick={() => handleDuplicate(item.id)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            title="Delete"
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
            <span className="text-xs text-muted-foreground">{meta.total} products</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={meta.page <= 1} onClick={() => fetchProducts(meta.page - 1)}>Prev</Button>
              <span className="text-xs px-2 py-1">{meta.page} / {meta.totalPages}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={meta.page >= meta.totalPages} onClick={() => fetchProducts(meta.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Single Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Product</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>"{deleteTarget?.translations?.[0]?.title || 'this product'}"</strong>?
            This will permanently remove all variants, images, and custom fields.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={!!bulkAction} onOpenChange={v => { if (!v && !bulkWorking) setBulkAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'delete' ? 'Delete Products' : bulkAction === 'publish' ? 'Publish Products' : 'Archive Products'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {bulkAction === 'delete'
              ? `Permanently delete ${selected.size} selected product${selected.size > 1 ? 's' : ''}? This cannot be undone.`
              : `${bulkAction === 'publish' ? 'Publish' : 'Archive'} ${selected.size} selected product${selected.size > 1 ? 's' : ''}?`}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkAction(null)} disabled={bulkWorking}>Cancel</Button>
            <Button
              variant={bulkAction === 'delete' ? 'destructive' : 'default'}
              size="sm"
              onClick={handleBulkConfirm}
              disabled={bulkWorking}
            >
              {bulkWorking ? 'Working...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
