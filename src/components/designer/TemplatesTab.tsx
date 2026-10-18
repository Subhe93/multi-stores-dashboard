'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Circle, Copy, FileImage, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  createTemplate,
  deleteTemplate,
  designerFileUrl,
  errorParams,
  getTemplate,
  listAssets,
  listFonts,
  listTemplates,
  type DesignTemplateStatus,
  type TemplateListItem,
} from '@/lib/designer/designer.api';
import { useDateTimeFormat } from '@/components/importer/ImporterBits';
import { FieldError, TemplateStatusBadge } from '@/components/designer/DesignerBits';

const ALL = '__all__';
const ASSETS_HREF = '/creator/designer?tab=assets';
const PRODUCTS_HREF = '/creator/products/own';

/** Library counts behind the onboarding checklist (null until loaded). */
interface LibraryState {
  fonts: number;
  backgrounds: number;
}

/**
 * "Templates" tab: grid of the store's templates with search and status
 * filter, create a blank one, duplicate ("Copy of …", client-side: the
 * API has no duplicate endpoint, so the latest spec is posted as a new
 * template) and delete (409 DESIGNER_TEMPLATE_IN_USE guard). A checklist
 * card walks a new store through fonts → backgrounds → publish → link.
 */
export function TemplatesTab({ token }: { token: string }) {
  const t = useTranslations('creator.designer.templates');
  const te = useTranslations('creator.designer.editor');
  const ts = useTranslations('creator.designer.status');
  const tc = useTranslations('creator.designer.common');
  const router = useRouter();
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const [status, setStatus] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TemplateListItem[] | null>(null);
  const [library, setLibrary] = useState<LibraryState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TemplateListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    listTemplates(token, { status: status === ALL ? undefined : (status as DesignTemplateStatus), limit: 200 })
      .then((res) => setItems(res.items))
      .catch((err) => {
        setItems([]);
        setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Checklist inputs: one font face and one web background are enough.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listFonts(token).catch(() => []), listAssets(token, { kind: 'TEMPLATE_BG_WEB', limit: 1 }).catch(() => ({ total: 0, items: [] }))]).then(
      ([fonts, bgs]) => {
        if (cancelled) return;
        setLibrary({ fonts: Array.isArray(fonts) ? fonts.length : 0, backgrounds: bgs.total ?? bgs.items.length });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const visible = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return q ? items.filter((tpl) => tpl.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const openCreate = () => {
    setNewName('');
    setNameError(null);
    setCreating(true);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      setNameError(t('nameRequired'));
      document.getElementById('dz-new-template-name')?.focus();
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      const d = await createTemplate(token, { name });
      router.push(`/creator/designer/templates/${d.id}`);
    } catch (err) {
      setNameError(describeError(err));
      setSaving(false);
    }
  };

  const duplicate = async (tpl: TemplateListItem) => {
    if (duplicating) return;
    setDuplicating(tpl.id);
    setError(null);
    try {
      const d = await getTemplate(token, tpl.id);
      const spec = d.latest_version?.spec ?? d.current_spec ?? undefined;
      const copy = await createTemplate(token, { name: t('copyOf', { name: tpl.name }).slice(0, 160), spec });
      router.push(`/creator/designer/templates/${copy.id}`);
    } catch (err) {
      setError(describeError(err));
      setDuplicating(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteTemplate(token, deleting.id);
      setItems((prev) => (prev ? prev.filter((x) => x.id !== deleting.id) : prev));
      setDeleting(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DESIGNER_TEMPLATE_IN_USE') {
        const p = errorParams(err);
        setError(te('deleteInUse', { products: Number(p.products ?? 0), designs: Number(p.designs ?? 0), orders: Number(p.orders ?? 0) }));
      } else {
        setError(describeError(err));
      }
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // ─── Onboarding checklist ────────────────────────────────────────────────

  const checklist = useMemo(() => {
    if (!items || !library) return null;
    const published = items.find((x) => x.status === 'PUBLISHED') ?? null;
    const first = items[0] ?? null;
    const steps = [
      { key: 'fonts', done: library.fonts > 0, href: ASSETS_HREF },
      { key: 'backgrounds', done: library.backgrounds > 0, href: ASSETS_HREF },
      { key: 'publish', done: !!published, href: first ? `/creator/designer/templates/${first.id}` : null },
      { key: 'link', done: items.some((x) => x.product_count > 0), href: PRODUCTS_HREF },
    ] as const;
    return steps.every((s) => s.done) ? null : steps;
  }, [items, library]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              className="h-9 w-56 ps-8"
            />
          </div>
          <div className="w-48">
            <SearchableSelect
              value={status}
              onChange={setStatus}
              options={[
                { value: ALL, label: t('allStatuses') },
                { value: 'DRAFT', label: ts('DRAFT') },
                { value: 'PUBLISHED', label: ts('PUBLISHED') },
                { value: 'ARCHIVED', label: ts('ARCHIVED') },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={load} aria-label={tc('refresh')}>
            <RefreshCw />
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus /> {t('new')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('importHint')}{' '}
        <Link href="/creator/importer" className="font-medium text-foreground underline underline-offset-2">
          {t('importLink')}
        </Link>
      </p>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {checklist && (
        <Card className="border-sky-200 bg-sky-50/50 shadow-none">
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-semibold">{t('checklist.title')}</p>
            <p className="text-xs text-muted-foreground">{t('checklist.intro')}</p>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {checklist.map((step, n) => {
                const label = t(`checklist.${step.key}`);
                const body = (
                  <>
                    {step.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                    <span className={`text-xs ${step.done ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                      {n + 1}. {label}
                    </span>
                  </>
                );
                return (
                  <li key={step.key}>
                    {step.done ? (
                      <span className="flex items-center gap-2 px-1 py-1">{body}</span>
                    ) : step.href ? (
                      <Link href={step.href} className="flex min-h-9 items-center gap-2 rounded-md px-1 py-1 hover:bg-white pointer-coarse:min-h-11">
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={openCreate} className="flex min-h-9 w-full items-center gap-2 rounded-md px-1 py-1 text-start hover:bg-white pointer-coarse:min-h-11">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {!visible ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileImage className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{query.trim() ? t('noMatch') : t('emptyTitle')}</p>
            {!query.trim() && <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((tpl) => {
            const thumb = designerFileUrl(tpl.thumbnail_url);
            const href = `/creator/designer/templates/${tpl.id}`;
            return (
              <div key={tpl.id} className="group relative overflow-hidden rounded-xl border bg-white transition hover:border-zinc-400 hover:shadow-sm focus-within:border-zinc-400">
                <Link href={href} className="block">
                  <div className="flex aspect-[5/7] items-center justify-center bg-zinc-50">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- API-hosted thumbnail
                      <img src={thumb} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <FileImage className="size-8 text-zinc-300" />
                    )}
                  </div>
                  <div className="space-y-1.5 border-t p-3">
                    <p className="truncate text-sm font-medium group-hover:underline">{tpl.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TemplateStatusBadge status={tpl.status} />
                      {tpl.source === 'npp' && <Badge variant="outline">NPP</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t('meta', { products: tpl.product_count, versions: tpl.version_count })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{t('updated', { date: formatDate(tpl.updated_at) })}</p>
                  </div>
                </Link>
                {/* Card actions: visible on hover / focus with a mouse, always on touch. */}
                <div className="absolute inset-e-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 bg-white/95 pointer-coarse:size-11"
                    title={t('duplicate')}
                    aria-label={`${t('duplicate')}: ${tpl.name}`}
                    disabled={!!duplicating}
                    onClick={() => duplicate(tpl)}
                  >
                    {duplicating === tpl.id ? <Loader2 className="animate-spin" /> : <Copy />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 bg-white/95 text-red-600 pointer-coarse:size-11"
                    title={te('delete')}
                    aria-label={`${te('delete')}: ${tpl.name}`}
                    onClick={() => setDeleting(tpl)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newTitle')}</DialogTitle>
            <DialogDescription>{t('newBody')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dz-new-template-name">{t('name')}</Label>
            <Input
              id="dz-new-template-name"
              autoFocus
              maxLength={160}
              value={newName}
              aria-invalid={!!nameError || undefined}
              onChange={(e) => {
                setNewName(e.target.value);
                setNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
              }}
            />
            <FieldError text={nameError} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              {tc('cancel')}
            </Button>
            <Button type="button" disabled={saving} onClick={create}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{te('deleteTitle')}</DialogTitle>
            <DialogDescription>{te('deleteBody', { name: deleting?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {tc('cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={deleteBusy} onClick={remove}>
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />} {te('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
