'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, Trash2, Pencil, Store, Wand2, Loader2, Package, LayoutPanelTop, Columns } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StorePage {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  type: string;
  translations: { locale: string; title: string }[];
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Translator = ReturnType<typeof useTranslations>;

function getEnTitle(translations: { locale: string; title: string }[], t: Translator): string {
  return translations.find((tr) => tr.locale === 'en')?.title || translations[0]?.title || t('storePages.untitled');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorPagesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeError, setStoreError] = useState(false);
  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<StorePage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openingHomeBuilder, setOpeningHomeBuilder] = useState(false);
  const [openingTemplateBuilder, setOpeningTemplateBuilder] = useState(false);
  const [openingHeaderBuilder, setOpeningHeaderBuilder] = useState(false);
  const [openingFooterBuilder, setOpeningFooterBuilder] = useState(false);

  const openHomeBuilder = async () => {
    if (!token || openingHomeBuilder) return;
    setOpeningHomeBuilder(true);
    try {
      const home = await api<{ id: string }>('/v2/pages/mine/home/ensure', {
        method: 'POST',
        token,
      });
      router.push(`/builder/${home.id}`);
    } catch (err) {
      console.error('Failed to open home builder:', err);
      setOpeningHomeBuilder(false);
    }
  };

  const openProductTemplateBuilder = async () => {
    if (!token || openingTemplateBuilder) return;
    setOpeningTemplateBuilder(true);
    try {
      const template = await api<{ id: string }>('/v2/pages/mine/product-template/ensure', {
        method: 'POST',
        token,
      });
      router.push(`/builder/${template.id}`);
    } catch (err) {
      console.error('Failed to open product template builder:', err);
      setOpeningTemplateBuilder(false);
    }
  };

  // Same pattern as openHomeBuilder — provision the singleton on demand then
  // navigate the builder to it. Idempotent on the API side.
  const openHeaderBuilder = async () => {
    if (!token || openingHeaderBuilder) return;
    setOpeningHeaderBuilder(true);
    try {
      const header = await api<{ id: string }>('/v2/pages/mine/header/ensure', {
        method: 'POST',
        token,
      });
      router.push(`/builder/${header.id}`);
    } catch (err) {
      console.error('Failed to open header builder:', err);
      setOpeningHeaderBuilder(false);
    }
  };

  const openFooterBuilder = async () => {
    if (!token || openingFooterBuilder) return;
    setOpeningFooterBuilder(true);
    try {
      const footer = await api<{ id: string }>('/v2/pages/mine/footer/ensure', {
        method: 'POST',
        token,
      });
      router.push(`/builder/${footer.id}`);
    } catch (err) {
      console.error('Failed to open footer builder:', err);
      setOpeningFooterBuilder(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchStoreAndPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchStoreAndPages = async () => {
    setLoading(true);
    try {
      // Step 1: get store id
      const store = await api<{ id: string }>('/stores/my/store', { token: token! });
      setStoreId(store.id);

      // Step 2: get pages
      const pagesData = await api<StorePage[]>(`/stores/${store.id}/pages`, { token: token! });
      setPages(Array.isArray(pagesData) ? pagesData : []);
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 403) {
        setStoreError(true);
      } else {
        console.error('Failed to load pages:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      await api(`/pages/${deleteTarget.id}`, { method: 'DELETE', token });
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete page:', err);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: t('storePages.colTitle'),
      render: (item: StorePage) => (
        <span className="text-sm font-medium">{getEnTitle(item.translations, t)}</span>
      ),
    },
    {
      key: 'slug',
      label: t('storePages.colSlug'),
      render: (item: StorePage) => (
        <span className="font-mono text-[10px] text-muted-foreground">/{item.slug}</span>
      ),
    },
    {
      key: 'status',
      label: tc('status'),
      render: (item: StorePage) =>
        item.status === 'PUBLISHED' ? (
          <span className="inline-flex h-5 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
            {t('storePages.published')}
          </span>
        ) : (
          <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 text-[10px] font-medium text-zinc-600">
            {t('storePages.draft')}
          </span>
        ),
    },
    {
      key: 'type',
      label: t('storePages.colType'),
      render: (item: StorePage) => (
        <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-medium text-zinc-600">
          {item.type?.toLowerCase().replace(/_/g, ' ') || t('storePages.typeCustom')}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: t('storePages.colDate'),
      render: (item: StorePage) => (
        <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: StorePage) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => router.push(`/builder/${item.id}`)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(item)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Store not set up
  if (!loading && storeError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{t('storePages.title')}</h1>
        </div>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <Store className="size-6" />
            </div>
            <p className="text-sm font-medium">{t('storePages.storeNotSetUp')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('storePages.storeNotSetUpDesc')}
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => router.push('/creator/store')}
            >
              {t('storePages.setUpStore')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('storePages.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('storePages.subtitle')}
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/creator/pages/new')}>
          <Plus className="size-4" />
          {t('storePages.newPage')}
        </Button>
      </div>

      {/* Builder callouts — Home, Product template, Header, Footer.
          Each provisions its singleton page on demand and opens the builder. */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="shadow-none border-dashed">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <Wand2 className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('storePages.homeBuilder')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('storePages.homeBuilderDesc')}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={openHomeBuilder} disabled={openingHomeBuilder} className="shrink-0">
              {openingHomeBuilder ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('storePages.opening')}
                </>
              ) : (
                t('storePages.openBuilder')
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <Package className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('storePages.productTemplate')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('storePages.productTemplateDesc')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openProductTemplateBuilder}
              disabled={openingTemplateBuilder}
              className="shrink-0"
            >
              {openingTemplateBuilder ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('storePages.opening')}
                </>
              ) : (
                t('storePages.editTemplate')
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <LayoutPanelTop className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('storePages.header')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('storePages.headerDesc')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openHeaderBuilder}
              disabled={openingHeaderBuilder}
              className="shrink-0"
            >
              {openingHeaderBuilder ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('storePages.opening')}
                </>
              ) : (
                t('storePages.editHeader')
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <Columns className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('storePages.footer')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('storePages.footerDesc')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openFooterBuilder}
              disabled={openingFooterBuilder}
              className="shrink-0"
            >
              {openingFooterBuilder ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('storePages.opening')}
                </>
              ) : (
                t('storePages.editFooter')
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={pages}
        searchPlaceholder={t('storePages.searchPlaceholder')}
        emptyMessage=""
      />

      {/* Empty state */}
      {!loading && pages.length === 0 && !storeError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            <FileText className="size-6" />
          </div>
          <p className="text-sm font-medium">{t('storePages.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('storePages.emptyDesc')}
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => router.push('/creator/pages/new')}
          >
            <Plus className="size-4" />
            {t('storePages.createFirstPage')}
          </Button>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('storePages.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('storePages.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">
                {deleteTarget ? getEnTitle(deleteTarget.translations, t) : ''}
              </span>
              {t('storePages.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('storePages.deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
