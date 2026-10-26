'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, FolderTree, Plus, Search, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Props {
  /** Ids of the checked collections (any depth). */
  value: string[];
  onChange: (ids: string[]) => void;
  /** The one checked collection that drives the breadcrumb / URL path. */
  primaryId: string | null;
  onPrimaryChange: (id: string | null) => void;
  /** The store's primary content locale: collection names are shown in it first. */
  primaryLocale?: string;
}

interface CollectionNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  translations?: { locale: string; name: string }[];
  children?: CollectionNode[];
}

// Stable empty tree so memoised indexing does not rerun while loading.
const EMPTY_TREE: CollectionNode[] = [];

interface IndexedNode {
  id: string;
  name: string;
  /** Full path label, e.g. "Apparel / Hoodies". */
  path: string;
  depth: number;
  parentId: string | null;
  childIds: string[];
}

/**
 * Pick the best display name for a collection: the store's primary locale
 * first, then English, then the first non-empty translation, then the slug.
 */
function getName(node: CollectionNode, primaryLocale: string): string {
  const pick = (locale: string) => node.translations?.find((tr) => tr.locale === locale)?.name?.trim();
  return (
    pick(primaryLocale) ||
    pick('en') ||
    node.translations?.map((tr) => tr.name?.trim()).find(Boolean) ||
    node.slug
  );
}

/** Flatten the tree into an id-indexed map that keeps parent/child links. */
function indexTree(
  nodes: CollectionNode[],
  primaryLocale: string,
): { byId: Map<string, IndexedNode>; rootIds: string[] } {
  const byId = new Map<string, IndexedNode>();
  const walk = (list: CollectionNode[], depth: number, parentId: string | null, prefix: string): string[] =>
    list.map((n) => {
      const name = getName(n, primaryLocale);
      const path = prefix ? `${prefix} / ${name}` : name;
      const entry: IndexedNode = { id: n.id, name, path, depth, parentId, childIds: [] };
      byId.set(n.id, entry);
      entry.childIds = n.children?.length ? walk(n.children, depth + 1, n.id, path) : [];
      return n.id;
    });
  const rootIds = walk(nodes, 0, null, '');
  return { byId, rootIds };
}

/**
 * WordPress-style "Product categories" metabox: a searchable, collapsible
 * checkbox tree. Checking a child never checks its parent. Exactly one of the
 * checked collections is the primary one (auto-picked when a single
 * collection is checked); it drives the storefront breadcrumb and URL path.
 */
export function CollectionTreePicker({
  value,
  onChange,
  primaryId,
  onPrimaryChange,
  primaryLocale = 'en',
}: Props) {
  const { token } = useAuth();
  const t = useTranslations('components');
  // The fetched tree is tagged with the request it answers (token + retry
  // attempt); a mismatch means a request is in flight. A failed fetch is
  // shown as such (with a retry), never as "no collections".
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${token ?? ''}|${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; tree: CollectionNode[]; error: boolean } | null>(null);
  const current = loaded && loaded.key === requestKey ? loaded : null;
  const tree = current ? current.tree : EMPTY_TREE;
  const loading = current === null;
  const loadError = current ? current.error : false;
  const [search, setSearch] = useState('');
  // Ids whose children are hidden. Everything starts expanded, like WordPress.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const key = requestKey;
    api<CollectionNode[]>('/creator-categories', { token })
      .then((res) => {
        if (!cancelled) setLoaded({ key, tree: Array.isArray(res) ? res : [], error: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, tree: [], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [token, requestKey]);

  const load = useCallback(() => setAttempt((n) => n + 1), []);

  const { byId, rootIds } = useMemo(() => indexTree(tree, primaryLocale), [tree, primaryLocale]);

  // The primary shown is always one of the checked ids (first checked when the
  // stored one is missing or unchecked, null when nothing is checked). Every
  // change made here also emits a consistent pair through onChange /
  // onPrimaryChange, and the forms normalise the stored primary on prefill.
  const effectivePrimary =
    value.length === 0 ? null : primaryId && value.includes(primaryId) ? primaryId : value[0];

  // Search: a node stays visible when it matches or has a matching descendant.
  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return null;
    const set = new Set<string>();
    byId.forEach((n) => {
      if (!n.name.toLowerCase().includes(q)) return;
      let cur: IndexedNode | undefined = n;
      while (cur) {
        set.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    });
    return set;
  }, [q, byId]);

  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(next);
    // Move the primary when it was unchecked, or auto-pick it when none is set.
    if (next.length === 0) onPrimaryChange(null);
    else if (!effectivePrimary || !next.includes(effectivePrimary)) onPrimaryChange(next[0]);
    else if (effectivePrimary !== primaryId) onPrimaryChange(effectivePrimary);
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selected = value
    .map((id) => byId.get(id))
    .filter((n): n is IndexedNode => Boolean(n));

  // Fetch failure: say so and offer a retry instead of the "create one" prompt.
  if (!loading && loadError) {
    return (
      <div className="rounded-md border border-dashed border-red-200 bg-red-50/50 p-4 text-center" role="alert">
        <p className="text-xs text-red-700 mb-2">{t('collectionsLoadFailed')}</p>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-zinc-100"
        >
          {t('collectionsRetry')}
        </button>
      </div>
    );
  }

  // Empty state: no collections at all. Guide the user to create one.
  if (!loading && rootIds.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-zinc-50/60 p-4 text-center">
        <FolderTree className="mx-auto mb-2 size-5 text-zinc-400" />
        <p className="text-xs text-muted-foreground mb-3">
          {t.rich('noCollectionsYetCreate', {
            link: (chunks) => (
              <Link href="/creator/categories" className="text-primary hover:underline font-medium">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <Link
          href="/creator/categories/new"
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-zinc-100"
        >
          <Plus className="size-3" /> {t('newCollection')}
        </Link>
      </div>
    );
  }

  const renderNode = (id: string): ReactNode => {
    const node = byId.get(id);
    if (!node) return null;
    if (visible && !visible.has(id)) return null;
    const checked = value.includes(id);
    const isPrimary = checked && effectivePrimary === id;
    const hasChildren = node.childIds.length > 0;
    // While searching every branch is open so matches are never hidden.
    const open = q ? true : !collapsed.has(id);
    const inputId = `ctp-${id}`;

    return (
      <li key={id} role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={checked}>
        <div
          className={cn(
            'group flex items-center gap-1.5 rounded px-1 py-1 text-sm',
            checked ? 'bg-zinc-100' : 'hover:bg-zinc-50',
          )}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapsed(id)}
              aria-label={open ? t('collectionCollapse') : t('collectionExpand')}
              aria-expanded={open}
              className="flex size-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            >
              <ChevronRight
                className={cn('size-3.5 transition-transform', open ? 'rotate-90' : 'rtl:-scale-x-100')}
              />
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden />
          )}
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={() => toggle(id)}
            className="size-3.5 shrink-0 cursor-pointer accent-zinc-800"
          />
          <label htmlFor={inputId} className="flex-1 cursor-pointer truncate select-none">
            {node.name}
          </label>
          {checked && (
            <button
              type="button"
              role="radio"
              aria-checked={isPrimary}
              aria-label={t('collectionSetPrimary', { name: node.name })}
              title={isPrimary ? t('collectionPrimary') : t('collectionSetPrimaryShort')}
              onClick={() => onPrimaryChange(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition',
                isPrimary
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-transparent text-zinc-400 hover:border-zinc-200 hover:text-zinc-700',
              )}
            >
              <Star className={cn('size-3', isPrimary && 'fill-amber-400 text-amber-500')} />
              {isPrimary ? t('collectionPrimary') : t('collectionSetPrimaryShort')}
            </button>
          )}
        </div>
        {hasChildren && open && (
          // Indent guide: a start-side rule marks each nesting level.
          <ul role="group" className="ms-3.5 border-s border-zinc-200 ps-1.5">
            {node.childIds.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  const anyVisible = visible ? rootIds.some((id) => visible.has(id)) : rootIds.length > 0;

  return (
    <div className="space-y-2">
      {/* Selected summary: chips, primary one highlighted. */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('collectionSelectedCount', { count: selected.length })}>
          {selected.map((n) => {
            const isPrimary = effectivePrimary === n.id;
            return (
              <span
                key={n.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium',
                  isPrimary ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-zinc-200 bg-zinc-100',
                )}
              >
                {isPrimary ? (
                  <Star className="size-3 fill-amber-400 text-amber-500" />
                ) : (
                  <FolderTree className="size-3 text-zinc-400" />
                )}
                <span className="max-w-[220px] truncate">{n.path}</span>
                {isPrimary && (
                  <span className="rounded bg-amber-200/70 px-1 text-[9px] uppercase tracking-wide text-amber-900">
                    {t('collectionPrimary')}
                  </span>
                )}
                <button
                  type="button"
                  className="ms-0.5 text-zinc-400 hover:text-zinc-700"
                  onClick={() => toggle(n.id)}
                  aria-label={t('removeNamed', { name: n.path })}
                >
                  <X className="size-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{t('collectionNoneSelected')}</p>
      )}

      <div className="overflow-hidden rounded-md border border-input bg-background">
        <div className="flex items-center gap-2 border-b px-2">
          <Search className="size-3.5 shrink-0 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchCollections')}
            aria-label={t('searchCollections')}
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t('loadingCollections')}</p>
          ) : !anyVisible ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t('noCollectionsFound')}</p>
          ) : (
            <ul role="tree" className="space-y-0.5">
              {rootIds.map(renderNode)}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-zinc-50/70 px-3 py-2">
          <Link href="/creator/categories/new" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
            <Plus className="size-3" /> {t('newCollection')}
          </Link>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                onPrimaryChange(null);
              }}
              className="text-[11px] text-red-500 hover:underline"
            >
              {t('clearAll')}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{t('collectionPrimaryHint')}</p>
    </div>
  );
}
