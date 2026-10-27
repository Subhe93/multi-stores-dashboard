'use client';

// "Add menu items" column of the menu editor (WordPress style). Accordion
// panels list the store's pages, collections and products with checkboxes;
// "Add to menu" appends the checked rows as typed items. A fourth panel adds
// a free custom link. Each panel loads its data lazily when first opened.

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, FileText, FolderTree, Link2, Loader2, Package, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { i18nLabels, pickTranslation, type NewMenuItem } from './types';

type PanelKey = 'pages' | 'collections' | 'products' | 'custom';

interface SourcesProps {
  token: string;
  storeId: string | null;
  primaryLocale: string;
  locales: string[];
  onAdd: (items: NewMenuItem[]) => void;
}

export function MenuItemSources({ token, storeId, primaryLocale, locales, onAdd }: SourcesProps) {
  const t = useTranslations('creator.menus');
  const [open, setOpen] = useState<PanelKey>('pages');

  const panels: { key: PanelKey; title: string; icon: React.ReactNode }[] = [
    { key: 'pages', title: t('sourcePages'), icon: <FileText className="size-3.5" /> },
    { key: 'collections', title: t('sourceCollections'), icon: <FolderTree className="size-3.5" /> },
    { key: 'products', title: t('sourceProducts'), icon: <Package className="size-3.5" /> },
    { key: 'custom', title: t('sourceCustomLink'), icon: <Link2 className="size-3.5" /> },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 px-0.5">{t('addItems')}</h3>
      <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-200 overflow-hidden">
        {panels.map((p) => {
          const isOpen = open === p.key;
          return (
            <div key={p.key}>
              <button
                type="button"
                onClick={() => setOpen(p.key)}
                aria-expanded={isOpen}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-medium text-start transition',
                  isOpen ? 'bg-zinc-50 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50',
                )}
              >
                <span className="text-zinc-400">{p.icon}</span>
                <span className="flex-1">{p.title}</span>
                <ChevronDown className={cn('size-3.5 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 bg-zinc-50/60 border-t border-zinc-100">
                  {p.key === 'pages' && (
                    <PagesPanel token={token} storeId={storeId} primaryLocale={primaryLocale} locales={locales} onAdd={onAdd} />
                  )}
                  {p.key === 'collections' && (
                    <CollectionsPanel token={token} primaryLocale={primaryLocale} locales={locales} onAdd={onAdd} />
                  )}
                  {p.key === 'products' && (
                    <ProductsPanel token={token} primaryLocale={primaryLocale} locales={locales} onAdd={onAdd} />
                  )}
                  {p.key === 'custom' && <CustomLinkPanel onAdd={onAdd} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared pieces ─────────────────────────────────────────

interface Candidate {
  key: string;
  item: NewMenuItem;
  title: string;
  hint?: string; // secondary line (slug / path)
  published?: boolean;
  depth?: number;
}

// Fetch result tagged with the request key it answers; a mismatching key means
// a request is in flight (loading) and nothing stale is shown meanwhile.
interface Loaded {
  key: string;
  rows: Candidate[];
  error: boolean;
}

function useLoaded(key: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = loaded && loaded.key === key ? loaded : null;
  return {
    rows: current ? current.rows : [],
    loading: current === null,
    error: current ? current.error : false,
    setLoaded,
  };
}

function useSelection() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const clear = () => setChecked(new Set());
  return { checked, toggle, clear };
}

function CandidateList({
  rows,
  checked,
  onToggle,
  loading,
  error,
  emptyText,
}: {
  rows: Candidate[];
  checked: Set<string>;
  onToggle: (key: string) => void;
  loading: boolean;
  error: boolean;
  emptyText: string;
}) {
  const t = useTranslations('creator.menus');
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-4 animate-spin text-zinc-400" />
      </div>
    );
  }
  if (error) return <p className="py-4 text-[11.5px] text-red-600 text-center">{t('sourcesLoadFailed')}</p>;
  if (rows.length === 0) return <p className="py-4 text-[11.5px] text-zinc-400 text-center">{emptyText}</p>;
  return (
    <ul className="max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-white divide-y divide-zinc-100">
      {rows.map((r) => (
        <li key={r.key}>
          <label
            className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] cursor-pointer hover:bg-zinc-50"
            style={{ paddingInlineStart: `${10 + (r.depth || 0) * 16}px` }}
          >
            <input
              type="checkbox"
              className="size-3.5 shrink-0"
              checked={checked.has(r.key)}
              onChange={() => onToggle(r.key)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-zinc-800">{r.title}</span>
              {r.hint && <span className="block truncate text-[10.5px] font-mono text-zinc-400">{r.hint}</span>}
            </span>
            {r.published !== undefined && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-medium',
                  r.published ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500',
                )}
              >
                {r.published ? t('published') : t('draft')}
              </span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}

function AddCheckedButton({
  rows,
  checked,
  onAdd,
  clear,
}: {
  rows: Candidate[];
  checked: Set<string>;
  onAdd: (items: NewMenuItem[]) => void;
  clear: () => void;
}) {
  const t = useTranslations('creator.menus');
  const count = rows.filter((r) => checked.has(r.key)).length;
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-400">{t('selectedCount', { count })}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={count === 0}
        onClick={() => {
          onAdd(rows.filter((r) => checked.has(r.key)).map((r) => r.item));
          clear();
        }}
      >
        <Plus className="size-3.5" />
        {t('addToMenu')}
      </Button>
    </div>
  );
}

function matches(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q) return true;
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

// ── Pages ─────────────────────────────────────────────────

interface PageTranslation { locale: string; title?: string | null }
interface V2PageDto {
  id: string;
  slug: string;
  type?: string | null;
  published_version_id?: string | null;
  translations?: PageTranslation[] | null;
}
interface LegacyPageDto {
  id: string;
  slug: string;
  status?: string | null;
  translations?: PageTranslation[] | null;
}

function PagesPanel({
  token, storeId, primaryLocale, locales, onAdd,
}: { token: string; storeId: string | null; primaryLocale: string; locales: string[]; onAdd: (i: NewMenuItem[]) => void }) {
  const t = useTranslations('creator.menus');
  const tc = useTranslations('common');
  const key = `${token}|${storeId ?? ''}|${primaryLocale}|${locales.join(',')}`;
  const { rows, loading, error, setLoaded } = useLoaded(key);
  const [q, setQ] = useState('');
  const { checked, toggle, clear } = useSelection();

  useEffect(() => {
    let cancelled = false;
    // Builder (v2) STATIC pages live under /p/<slug>; legacy static pages
    // are served at /<slug>. Both systems coexist, so list both.
    Promise.all([
      api<V2PageDto[]>('/v2/pages/mine', { token }).catch((): V2PageDto[] => []),
      storeId
        ? api<LegacyPageDto[]>(`/stores/${storeId}/pages`, { token }).catch((): LegacyPageDto[] => [])
        : Promise.resolve([] as LegacyPageDto[]),
    ])
      .then(([v2, legacy]) => {
        if (cancelled) return;
        const read = (tr: PageTranslation) => tr.title;
        const v2Rows: Candidate[] = (Array.isArray(v2) ? v2 : [])
          .filter((p) => p.type === 'STATIC' && p.slug)
          .map((p) => {
            const title = pickTranslation(p.translations, primaryLocale, read) || p.slug;
            return {
              key: `v2:${p.id}`,
              title,
              hint: `/${p.slug}`,
              published: !!p.published_version_id,
              item: {
                label: title,
                label_i18n: i18nLabels(p.translations, locales, primaryLocale, read),
                url: `/${p.slug}`,
                kind: 'PAGE',
                resource_id: p.id,
              },
            };
          });
        const legacyRows: Candidate[] = (Array.isArray(legacy) ? legacy : []).map((p) => {
          const title = pickTranslation(p.translations, primaryLocale, read) || p.slug;
          return {
            key: `legacy:${p.id}`,
            title,
            hint: `/${p.slug}`,
            published: p.status === 'PUBLISHED',
            item: {
              label: title,
              label_i18n: i18nLabels(p.translations, locales, primaryLocale, read),
              url: `/${p.slug}`,
              kind: 'PAGE',
              resource_id: p.id,
            },
          };
        });
        setLoaded({ key, rows: [...v2Rows, ...legacyRows], error: false });
      })
      .catch(() => !cancelled && setLoaded({ key, rows: [], error: true }));
    return () => { cancelled = true; };
  }, [key, token, storeId, primaryLocale, locales, setLoaded]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => matches(needle, r.title, r.hint));
  }, [rows, q]);

  return (
    <div className="space-y-2">
      <Input className="h-8 text-[12px] bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc('searchEllipsis')} />
      <CandidateList rows={visible} checked={checked} onToggle={toggle} loading={loading} error={error} emptyText={t('noPages')} />
      <AddCheckedButton rows={visible} checked={checked} onAdd={onAdd} clear={clear} />
    </div>
  );
}

// ── Collections ───────────────────────────────────────────

interface CategoryTranslation { locale: string; name?: string | null }
interface CategoryNode {
  id: string;
  slug: string;
  // M6.3: INTERNAL labels have no storefront page; absent on older payloads = PUBLIC.
  visibility?: 'PUBLIC' | 'INTERNAL' | null;
  translations?: CategoryTranslation[] | null;
  children?: CategoryNode[] | null;
}

function CollectionsPanel({
  token, primaryLocale, locales, onAdd,
}: { token: string; primaryLocale: string; locales: string[]; onAdd: (i: NewMenuItem[]) => void }) {
  const t = useTranslations('creator.menus');
  const tc = useTranslations('common');
  const key = `${token}|${primaryLocale}|${locales.join(',')}`;
  const { rows, loading, error, setLoaded } = useLoaded(key);
  const [q, setQ] = useState('');
  const { checked, toggle, clear } = useSelection();

  useEffect(() => {
    let cancelled = false;
    api<CategoryNode[]>('/creator-categories', { token })
      .then((tree) => {
        if (cancelled) return;
        const read = (tr: CategoryTranslation) => tr.name;
        const out: Candidate[] = [];
        // The endpoint returns a nested tree of any depth; render it indented.
        const walk = (nodes: CategoryNode[], depth: number) => {
          for (const c of nodes) {
            // Internal labels have no page to link to.
            if (c.visibility === 'INTERNAL') continue;
            const title = pickTranslation(c.translations, primaryLocale, read) || c.slug;
            out.push({
              key: c.id,
              title,
              hint: `/collections/${c.slug}`,
              depth,
              item: {
                label: title,
                label_i18n: i18nLabels(c.translations, locales, primaryLocale, read),
                url: `/collections/${c.slug}`,
                kind: 'COLLECTION',
                resource_id: c.id,
              },
            });
            if (c.children?.length) walk(c.children, depth + 1);
          }
        };
        walk(Array.isArray(tree) ? tree : [], 0);
        setLoaded({ key, rows: out, error: false });
      })
      .catch(() => !cancelled && setLoaded({ key, rows: [], error: true }));
    return () => { cancelled = true; };
  }, [key, token, primaryLocale, locales, setLoaded]);

  // Filtering flattens the indentation (a matching child without its parent
  // would otherwise float at an odd depth), so depth is dropped when searching.
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => matches(needle, r.title, r.hint)).map((r) => ({ ...r, depth: 0 }));
  }, [rows, q]);

  return (
    <div className="space-y-2">
      <Input className="h-8 text-[12px] bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc('searchEllipsis')} />
      <CandidateList rows={visible} checked={checked} onToggle={toggle} loading={loading} error={error} emptyText={t('noCollections')} />
      <AddCheckedButton rows={visible} checked={checked} onAdd={onAdd} clear={clear} />
    </div>
  );
}

// ── Products ──────────────────────────────────────────────

interface ProductTranslation { locale: string; title?: string | null; slug?: string | null }
interface ProductRow {
  id: string;
  slug?: string | null; // top-level slug (added by the API for the picker)
  status?: string | null;
  title?: string | null;
  translations?: ProductTranslation[] | null;
}

function ProductsPanel({
  token, primaryLocale, locales, onAdd,
}: { token: string; primaryLocale: string; locales: string[]; onAdd: (i: NewMenuItem[]) => void }) {
  const t = useTranslations('creator.menus');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const key = `${token}|${debounced}|${primaryLocale}|${locales.join(',')}`;
  const { rows, loading, error, setLoaded } = useLoaded(key);
  const { checked, toggle, clear } = useSelection();

  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '20' });
    if (debounced) params.set('search', debounced);
    api<{ data?: ProductRow[] } | ProductRow[]>(`/products/mine?${params.toString()}`, { token })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.data || [];
        const readTitle = (tr: ProductTranslation) => tr.title;
        const out: Candidate[] = [];
        for (const p of list) {
          // Slug: top-level (API picker contract) → primary translation → any.
          const slug =
            (p.slug || '').trim() ||
            pickTranslation(p.translations, primaryLocale, (tr) => tr.slug);
          if (!slug) continue;
          const title = (p.title || '').trim() || pickTranslation(p.translations, primaryLocale, readTitle) || slug;
          out.push({
            key: p.id,
            title,
            hint: `/products/${slug}`,
            published: p.status ? p.status === 'PUBLISHED' : undefined,
            item: {
              label: title,
              label_i18n: i18nLabels(p.translations, locales, primaryLocale, readTitle),
              url: `/products/${slug}`,
              kind: 'PRODUCT',
              resource_id: p.id,
            },
          });
        }
        setLoaded({ key, rows: out, error: false });
      })
      .catch(() => !cancelled && setLoaded({ key, rows: [], error: true }));
    return () => { cancelled = true; };
  }, [key, token, debounced, primaryLocale, locales, setLoaded]);

  return (
    <div className="space-y-2">
      <Input className="h-8 text-[12px] bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchProducts')} />
      <CandidateList rows={rows} checked={checked} onToggle={toggle} loading={loading} error={error} emptyText={t('noProducts')} />
      <AddCheckedButton rows={rows} checked={checked} onAdd={onAdd} clear={clear} />
    </div>
  );
}

// ── Custom link ───────────────────────────────────────────

function CustomLinkPanel({ onAdd }: { onAdd: (i: NewMenuItem[]) => void }) {
  const t = useTranslations('creator.menus');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const canAdd = url.trim().length > 0 && label.trim().length > 0;

  function add() {
    if (!canAdd) return;
    onAdd([{ label: label.trim(), url: url.trim(), kind: 'CUSTOM', resource_id: null }]);
    setUrl('');
    setLabel('');
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-[10.5px] text-zinc-500">{t('url')}</Label>
        <Input
          className="h-8 text-[12px] font-mono bg-white"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10.5px] text-zinc-500">{t('linkText')}</Label>
        <Input
          className="h-8 text-[12px] bg-white"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('labelPlaceholder')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={add}>
          <Plus className="size-3.5" />
          {t('addToMenu')}
        </Button>
      </div>
    </div>
  );
}
