'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Layers, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  pickTranslation,
  type Bundle,
  type BundleStatus,
} from '@/components/creator/bundles/types';

interface OverviewResp {
  primary_locale: string;
  secondary_locales: string[];
}

function statusBadgeClass(status: BundleStatus): string {
  return status === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function CreatorBundlesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const tt = useTranslations('creator');
  const tc = useTranslations('common');

  interface ListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [disableTarget, setDisableTarget] = useState<Bundle | null>(null);
  const [disabling, setDisabling] = useState(false);

  const fetchBundles = async (page = 1, query = searchQuery) => {
    if (!token) return;
    setLoading(true);
    try {
      const q = query.trim();
      const url = `/bundles?page=${page}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}`;
      const res = await api<{ data: Bundle[]; meta: ListMeta }>(url, { token });
      setBundles(res?.data ?? []);
      setMeta(res?.meta ?? null);
    } catch (err) {
      console.error('Failed to load bundles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    api<OverviewResp>('/translations/overview', { token })
      .then((res) => setPrimaryLocale(res?.primary_locale || 'en'))
      .catch(() => {});
    fetchBundles(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Debounce search → refetch from server.
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => fetchBundles(1, searchQuery), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const toggleStatus = async (bundle: Bundle) => {
    if (!token) return;
    // Confirm before disabling a bundle that's currently attached to products,
    // since the storefront and active carts will silently drop it.
    if (bundle.status === 'ACTIVE') {
      const attachedCount =
        (bundle.products?.length || 0) + (bundle.custom_products?.length || 0);
      if (attachedCount > 0) {
        setDisableTarget(bundle);
        return;
      }
    }
    await applyStatus(bundle, bundle.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE');
  };

  const applyStatus = async (bundle: Bundle, next: BundleStatus) => {
    if (!token) return;
    try {
      await api(`/bundles/${bundle.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status: next }),
      });
      fetchBundles(meta?.page || 1);
    } catch (err) {
      console.error('Failed to toggle bundle status:', err);
    }
  };

  const confirmDisable = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await applyStatus(disableTarget, 'DISABLED');
      setDisableTarget(null);
    } finally {
      setDisabling(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/bundles/${deleteTarget.id}`, { method: 'DELETE', token });
      setBundles((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const e = err as { message?: string };
      setDeleteError(e?.message || tt('bundles.failedDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDisableInstead = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/bundles/${deleteTarget.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status: 'DISABLED' }),
      });
      setDeleteTarget(null);
      fetchBundles(meta?.page || 1);
    } catch (err) {
      const e = err as { message?: string };
      setDeleteError(e?.message || tt('bundles.failedDisable'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: tc('name'),
      render: (item: Bundle) => (
        <span className="text-sm font-medium">
          {pickTranslation(item.translations, primaryLocale)?.name || tt('bundles.untitled')}
        </span>
      ),
    },
    {
      key: 'offers',
      label: tt('bundles.colOffers'),
      render: (item: Bundle) => (
        <span className="text-sm tabular-nums">{item.offers.length}</span>
      ),
    },
    {
      key: 'products',
      label: tt('bundles.colProducts'),
      render: (item: Bundle) => (
        <span className="text-sm tabular-nums">{item.products.length}</span>
      ),
    },
    {
      key: 'updated_at',
      label: tt('bundles.colUpdated'),
      render: (item: Bundle) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.updated_at)}
        </span>
      ),
    },
    {
      key: 'status',
      label: tc('status'),
      render: (item: Bundle) => (
        <button
          type="button"
          onClick={() => toggleStatus(item)}
          className={`inline-flex h-5 cursor-pointer items-center rounded-full border px-2 text-[10px] font-medium transition hover:opacity-70 ${statusBadgeClass(item.status)}`}
          title={item.status === 'ACTIVE' ? tt('bundles.clickToDisable') : tt('bundles.clickToActivate')}
        >
          {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: Bundle) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => router.push(`/creator/bundles/${item.id}`)}
            title={tc('edit')}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(item)}
            title={tc('delete')}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{tt('bundles.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {tt('bundles.subtitle')}
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/creator/bundles/new')}>
          <Plus className="size-4" /> {tt('bundles.createBundle')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={bundles}
        searchPlaceholder={tt('bundles.searchPlaceholder')}
        onSearch={setSearchQuery}
        emptyMessage=""
        pagination={meta ?? undefined}
        onPageChange={(p) => fetchBundles(p)}
      />

      {!loading && bundles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            <Layers className="size-6" />
          </div>
          <p className="text-sm font-medium">{tt('bundles.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tt('bundles.emptyDesc')}
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => router.push('/creator/bundles/new')}
          >
            <Plus className="size-4" /> {tt('bundles.createBundle')}
          </Button>
        </div>
      )}

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
            <DialogTitle>{tt('bundles.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {tt('bundles.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? pickTranslation(deleteTarget.translations, primaryLocale)?.name ||
                    tt('bundles.thisBundle')
                  : ''}
              </span>
              {tt('bundles.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {tc('cancel')}
            </Button>
            {deleteError && deleteTarget?.status === 'ACTIVE' && (
              <Button
                variant="outline"
                onClick={handleDisableInstead}
                disabled={deleting}
              >
                {deleting ? tt('bundles.disabling') : tt('bundles.disableInstead')}
              </Button>
            )}
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? tt('bundles.deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!disableTarget}
        onOpenChange={(open) => !open && setDisableTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tt('bundles.disableTitle')}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">
                {disableTarget
                  ? pickTranslation(disableTarget.translations, primaryLocale)?.name ||
                    tt('bundles.thisBundle')
                  : ''}
              </span>{' '}
              {tt('bundles.attachedToPrefix')}{' '}
              <span className="font-medium text-foreground">
                {tt('bundles.productCount', {
                  count: disableTarget
                    ? (disableTarget.products?.length || 0) +
                      (disableTarget.custom_products?.length || 0)
                    : 0,
                })}
              </span>
              {tt('bundles.disableWarningSuffix')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDisableTarget(null)}
              disabled={disabling}
            >
              {tt('bundles.keepActive')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={disabling}
            >
              {disabling ? tt('bundles.disabling') : tt('bundles.disableBundle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
