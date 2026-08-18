'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, Trash2, Pencil, Store, Wand2, Loader2, Package, LayoutPanelTop, Columns, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface PageTranslation {
  locale: string;
  title?: string | null;
  content?: string | null;
}

// One row in the unified table. Pages live in two backends: the legacy
// StaticPage table and the builder's v2 Page table. The builder publishes to
// v2 only, so the published state must be read from whichever system the row
// belongs to — that is what `isPublished` carries.
interface PageRow {
  id: string;
  system: 'legacy' | 'v2';
  slug: string;
  type: string;
  isPublished: boolean;
  isRequired: boolean;
  translations: PageTranslation[];
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

// Store-content-locale-aware title: primary locale → en → first row with a
// title → translated "Untitled". The old version looked up hardcoded 'en'
// first, so German stores listed every page under its English name.
function pageTitle(
  translations: PageTranslation[],
  primaryLocale: string,
  t: Translator,
): string {
  return (
    translations.find((tr) => tr.locale === primaryLocale)?.title ||
    translations.find((tr) => tr.locale === 'en')?.title ||
    translations.find((tr) => !!tr.title)?.title ||
    t('storePages.untitled')
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatorPagesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeError, setStoreError] = useState(false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<PageRow[]>([]);
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PageRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<PageRow | null>(null);
  const [renameTitles, setRenameTitles] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');
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
      // Step 1: store id + content locales (page titles follow the STORE's
      // languages, not the dashboard UI language).
      const store = await api<{
        id: string;
        language_config?: { primary_locale?: string; secondary_locales?: string[] };
      }>('/stores/my/store', { token: token! });
      setStoreId(store.id);
      const primary = store.language_config?.primary_locale || 'en';
      const secondary = store.language_config?.secondary_locales || [];
      setPrimaryLocale(primary);
      setAllLocales([primary, ...secondary.filter((l) => l && l !== primary)]);

      // Step 2: both page systems. The table shows legacy static pages plus
      // builder (v2) STATIC pages; the builder publishes to v2 only, so the
      // v2 published flag comes from published_version_id (what the
      // storefront actually serves), not the status column.
      const [legacy, v2] = await Promise.all([
        api<any[]>(`/stores/${store.id}/pages`, { token: token! }),
        api<any[]>('/v2/pages/mine', { token: token! }).catch(() => []),
      ]);

      const v2Rows: PageRow[] = (Array.isArray(v2) ? v2 : [])
        .filter((p) => p.type === 'STATIC' && p.slug)
        .map((p) => ({
          id: p.id,
          system: 'v2' as const,
          slug: p.slug,
          type: p.static_kind || 'CUSTOM',
          isPublished: !!p.published_version_id,
          isRequired: !!p.is_required,
          translations: p.translations || [],
          created_at: p.created_at,
        }));
      const v2Slugs = new Set(v2Rows.map((p) => p.slug));

      const legacyRows: PageRow[] = (Array.isArray(legacy) ? legacy : [])
        // A slug that exists in v2 means the page was migrated to the builder
        // (or rebuilt there) — the v2 row is the one the storefront serves.
        .filter((p) => !v2Slugs.has(p.slug))
        .map((p) => ({
          id: p.id,
          system: 'legacy' as const,
          slug: p.slug,
          type: p.type || 'CUSTOM',
          isPublished: p.status === 'PUBLISHED',
          isRequired: !!p.is_required,
          translations: p.translations || [],
          created_at: p.created_at,
        }));

      setPages([...v2Rows, ...legacyRows]);
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
      const path =
        deleteTarget.system === 'v2' ? `/v2/pages/${deleteTarget.id}` : `/pages/${deleteTarget.id}`;
      await api(path, { method: 'DELETE', token });
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete page:', err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Rename ────────────────────────────────────────────────
  const openRename = (row: PageRow) => {
    const titles: Record<string, string> = {};
    for (const locale of allLocales) {
      titles[locale] = row.translations.find((tr) => tr.locale === locale)?.title || '';
    }
    setRenameTitles(titles);
    setRenameError('');
    setRenameTarget(row);
  };

  const handleRename = async () => {
    if (!renameTarget || !token || renaming) return;
    const entries = allLocales
      .map((locale) => ({ locale, title: (renameTitles[locale] || '').trim() }))
      .filter((e) => e.title);
    if (entries.length === 0) {
      setRenameError(t('storePages.renameEmpty'));
      return;
    }
    setRenaming(true);
    setRenameError('');
    try {
      if (renameTarget.system === 'v2') {
        // v2 upserts per locale — only titled locales are sent, nothing is deleted.
        await api(`/v2/pages/${renameTarget.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ translations: entries }),
        });
      } else {
        // Legacy update REPLACES all translation rows, so resend every
        // existing row with its content preserved and only the title changed.
        const byLocale = new Map(renameTarget.translations.map((tr) => [tr.locale, tr]));
        const locales = Array.from(new Set([...allLocales, ...renameTarget.translations.map((tr) => tr.locale)]));
        const translations = locales
          .map((locale) => {
            const existing = byLocale.get(locale);
            const title = (renameTitles[locale] ?? existing?.title ?? '').trim();
            if (!title) return null;
            return { locale, title, content: existing?.content ?? '' };
          })
          .filter((tr): tr is { locale: string; title: string; content: string } => !!tr);
        await api(`/pages/${renameTarget.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify({ translations }),
        });
      }
      // Reflect the new titles in the table without a refetch.
      setPages((prev) =>
        prev.map((p) => {
          if (p.id !== renameTarget.id) return p;
          const others = p.translations.filter((tr) => !entries.some((e) => e.locale === tr.locale));
          const updated = entries.map((e) => ({
            ...(p.translations.find((tr) => tr.locale === e.locale) || {}),
            locale: e.locale,
            title: e.title,
          }));
          return { ...p, translations: [...updated, ...others] };
        }),
      );
      setRenameTarget(null);
    } catch (err: any) {
      setRenameError(err?.message || t('storePages.renameFailed'));
    } finally {
      setRenaming(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: t('storePages.colTitle'),
      render: (item: PageRow) => (
        <span className="text-sm font-medium">{pageTitle(item.translations, primaryLocale, t)}</span>
      ),
    },
    {
      key: 'slug',
      label: t('storePages.colSlug'),
      render: (item: PageRow) => (
        <span className="font-mono text-[10px] text-muted-foreground">/{item.slug}</span>
      ),
    },
    {
      key: 'status',
      label: tc('status'),
      render: (item: PageRow) =>
        item.isPublished ? (
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
      render: (item: PageRow) => (
        <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-medium text-zinc-600">
          {item.type && item.type !== 'CUSTOM'
            ? item.type.toLowerCase().replace(/_/g, ' ')
            : t('storePages.typeCustom')}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: t('storePages.colDate'),
      render: (item: PageRow) => (
        <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: PageRow) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            title={t('storePages.rename')}
            onClick={() => openRename(item)}
          >
            <Type className="size-3.5" />
          </Button>
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

      {/* Table — simple client-side filter by title or slug */}
      <DataTable
        columns={columns}
        data={pages.filter((p) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          return (
            pageTitle(p.translations, primaryLocale, t).toLowerCase().includes(q) ||
            p.translations.some((tr) => (tr.title || '').toLowerCase().includes(q)) ||
            (p.slug || '').toLowerCase().includes(q)
          );
        })}
        searchPlaceholder={t('storePages.searchPlaceholder')}
        onSearch={setSearch}
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

      {/* Rename dialog — page title per store content locale. Writes through
          the system the page belongs to (v2 upsert / legacy full replace). */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('storePages.renameTitle')}</DialogTitle>
            <DialogDescription>{t('storePages.renameDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {allLocales.map((locale) => (
              <div key={locale} className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {locale}
                  {locale === primaryLocale && <span className="ms-1 text-[9px]">({t('storePages.primaryLocale')})</span>}
                </Label>
                <Input
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  value={renameTitles[locale] || ''}
                  onChange={(e) =>
                    setRenameTitles((prev) => ({ ...prev, [locale]: e.target.value }))
                  }
                />
              </div>
            ))}
            {renameError && <p className="text-xs text-red-600">{renameError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)} disabled={renaming}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleRename} disabled={renaming}>
              {renaming ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('storePages.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('storePages.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">
                {deleteTarget ? pageTitle(deleteTarget.translations, primaryLocale, t) : ''}
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
