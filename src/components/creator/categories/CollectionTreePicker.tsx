'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, FolderTree, Loader2, Plus, Search, Star, Tags, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useStorefrontUrl } from '@/lib/useStorefrontUrl';
import { canOfferCreate, decideTagEnter, normalizeTagName, type TagOption } from '@/lib/tags';

interface Props {
  /** Ids of the checked collections (any depth). */
  value: string[];
  onChange: (ids: string[]) => void;
  /** The one checked collection that drives the breadcrumb / URL path. */
  primaryId: string | null;
  onPrimaryChange: (id: string | null) => void;
  /** The store's primary content locale: collection names are shown in it first. */
  primaryLocale?: string;
  /**
   * Which part to show: 'public' = storefront collections tree (with primary),
   * 'internal' = tags only (no primary), 'all' = both (default).
   * Two scoped pickers can share one `value`: each only adds/removes its own ids.
   */
  scope?: 'all' | 'public' | 'internal';
}

/** Notice shown under the tags list after an inline create / select. */
interface TagNotice {
  kind: 'created' | 'exists' | 'error';
  text: string;
}

interface CollectionNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  // M6.3: INTERNAL rows (tags) are flat and never a product's primary
  // collection; absent on older payloads = PUBLIC.
  visibility?: 'PUBLIC' | 'INTERNAL';
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
  /** True for a tag (INTERNAL row: listed in its own group, never primary). */
  internal: boolean;
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

/**
 * Flatten the tree into an id-indexed map that keeps parent/child links.
 * Tags (INTERNAL rows) are kept out of the tree (`rootIds`) and listed in
 * `internalIds` for their own group.
 */
function indexTree(
  nodes: CollectionNode[],
  primaryLocale: string,
): { byId: Map<string, IndexedNode>; rootIds: string[]; internalIds: string[] } {
  const byId = new Map<string, IndexedNode>();
  const internalIds: string[] = [];
  const walk = (list: CollectionNode[], depth: number, parentId: string | null, prefix: string): string[] =>
    list.flatMap((n) => {
      const name = getName(n, primaryLocale);
      const internal = n.visibility === 'INTERNAL';
      const path = prefix ? `${prefix} / ${name}` : name;
      const entry: IndexedNode = { id: n.id, name, path, depth, parentId, childIds: [], internal };
      byId.set(n.id, entry);
      if (internal) {
        internalIds.push(n.id);
        return [];
      }
      entry.childIds = n.children?.length ? walk(n.children, depth + 1, n.id, path) : [];
      return [n.id];
    });
  const rootIds = walk(nodes, 0, null, '');
  return { byId, rootIds, internalIds };
}

/**
 * WordPress-style "Product categories" metabox: a searchable, collapsible
 * checkbox tree. Checking a child never checks its parent. Exactly one of the
 * checked collections is the primary one (auto-picked when a single
 * collection is checked); it drives the storefront breadcrumb and URL path.
 *
 * With `scope="internal"` it is the tags picker: typing a name that matches
 * no tag and pressing Enter (or clicking the "Create" row) creates the
 * INTERNAL row through the API, named in the store's primary locale, and
 * checks it at once; the surrounding form keeps its unsaved state.
 */
export function CollectionTreePicker({
  value,
  onChange,
  primaryId,
  onPrimaryChange,
  primaryLocale: primaryLocaleProp,
  scope = 'all',
}: Props) {
  const showPublic = scope !== 'internal';
  const showInternal = scope !== 'public';
  const { token } = useAuth();
  const t = useTranslations('components');
  const tcat = useTranslations('category');
  const terr = useTranslations('errors');
  // Names are shown (and new tags named) in the store's primary content
  // locale: the caller's value when given, else the store summary's.
  const { primaryLocale: storePrimaryLocale } = useStorefrontUrl();
  const primaryLocale = primaryLocaleProp || storePrimaryLocale || 'en';
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
  const searchRef = useRef<HTMLInputElement>(null);
  // Ids whose children are hidden. Everything starts expanded, like WordPress.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Inline tag creation (tags picker): in-flight flag and the last notice.
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<TagNotice | null>(null);

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

  const { byId, rootIds, internalIds } = useMemo(() => indexTree(tree, primaryLocale), [tree, primaryLocale]);

  // An id not in the tree (unknown to this picker) is treated as public.
  const isInternal = useCallback((id: string) => byId.get(id)?.internal === true, [byId]);

  // The primary shown is always one of the checked PUBLIC ids: the stored one
  // when it qualifies, else the first checked public collection, else null
  // (also when only internal labels are checked). Every change made here
  // emits a consistent pair through onChange / onPrimaryChange, and the
  // effect below realigns a prefilled primary once the tree is known.
  const resolvePrimary = useCallback(
    (ids: string[], stored: string | null): string | null => {
      if (stored && ids.includes(stored) && !isInternal(stored)) return stored;
      return ids.find((id) => !isInternal(id)) ?? null;
    },
    [isInternal],
  );
  const effectivePrimary = resolvePrimary(value, primaryId);

  // The forms prefill the primary with the first linked id, which may be an
  // internal label; the API rejects that (PRIMARY_COLLECTION_INTERNAL), so the
  // stored value is corrected as soon as the tree says which ids are internal.
  // Only the picker that shows the public tree owns the primary.
  useEffect(() => {
    if (loading || !showPublic) return;
    if (effectivePrimary !== primaryId) onPrimaryChange(effectivePrimary);
  }, [loading, showPublic, effectivePrimary, primaryId, onPrimaryChange]);

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
    // Move the primary when it was unchecked, or auto-pick the first public
    // one when none is set; a tag is never emitted as primary.
    if (!showPublic) return;
    const nextPrimary = resolvePrimary(next, effectivePrimary);
    if (nextPrimary !== primaryId) onPrimaryChange(nextPrimary);
  };

  // A notice fades after a few seconds; an error stays until the next action.
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  // Tags known to this picker, for the Enter / "Create" decision.
  const tagOptions: TagOption[] = useMemo(
    () => internalIds.map((id) => ({ id, name: byId.get(id)?.name ?? '' })),
    [internalIds, byId],
  );

  /**
   * Creates an INTERNAL row named `name` in the primary locale (slug left
   * to the server's WordPress rules), adds it to the loaded tree and checks
   * it. Only the search box is cleared; the form around keeps its state.
   */
  const createTag = async (name: string) => {
    if (!token || creating) return;
    setCreating(true);
    setNotice(null);
    try {
      const created = await api<CollectionNode>('/creator-categories', {
        method: 'POST',
        token,
        body: JSON.stringify({
          slug: '',
          visibility: 'INTERNAL',
          match_rule: 'MANUAL',
          translations: [{ locale: primaryLocale, name }],
        }),
      });
      if (!created?.id) throw new Error('No id in the create response');
      const node: CollectionNode = {
        id: created.id,
        slug: created.slug ?? '',
        parent_id: null,
        visibility: 'INTERNAL',
        translations: created.translations?.length ? created.translations : [{ locale: primaryLocale, name }],
      };
      // Append to the tree the current request answered, so the new id is
      // known as internal before the form sees it checked.
      setLoaded((prev) => (prev ? { ...prev, tree: [...prev.tree, node] } : prev));
      if (!value.includes(created.id)) onChange([...value, created.id]);
      setSearch('');
      setNotice({ kind: 'created', text: t('tagCreated', { name }) });
      searchRef.current?.focus();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setNotice({
        kind: 'error',
        text: code && terr.has(code) ? terr(code) : t('tagCreateFailed'),
      });
    } finally {
      setCreating(false);
    }
  };

  /** Enter in the tags search box: select the exact match, else create. */
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showInternal || e.key !== 'Enter') return;
    e.preventDefault();
    const decision = decideTagEnter(search, tagOptions, value);
    if (decision.kind === 'select') {
      onChange([...value, decision.id]);
      setSearch('');
      setNotice({ kind: 'exists', text: t('tagExists', { name: decision.name }) });
    } else if (decision.kind === 'create') {
      void createTag(decision.name);
    }
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
    .filter((n): n is IndexedNode => Boolean(n))
    .filter((n) => (n.internal ? showInternal : showPublic));
  const shownRootIds = showPublic ? rootIds : [];
  const shownInternalIds = showInternal ? internalIds : [];

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

  // Empty state: no collections at all. Guide the user to create one. The
  // tags picker never shows it: its search box is where tags get created.
  if (!loading && scope !== 'internal' && shownRootIds.length === 0 && shownInternalIds.length === 0) {
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

  // Tags: checkbox only, no primary button, in their own group.
  const visibleInternalIds = visible ? shownInternalIds.filter((id) => visible.has(id)) : shownInternalIds;
  const renderInternalNode = (id: string): ReactNode => {
    const node = byId.get(id);
    if (!node) return null;
    const checked = value.includes(id);
    const inputId = `ctp-${id}`;
    return (
      <li key={id}>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded px-1 py-1 text-sm',
            checked ? 'bg-zinc-100' : 'hover:bg-zinc-50',
          )}
        >
          <Tags className="size-3.5 shrink-0 text-amber-500" aria-hidden />
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
        </div>
      </li>
    );
  };

  const anyVisible =
    (visible ? shownRootIds.some((id) => visible.has(id)) : shownRootIds.length > 0) || visibleInternalIds.length > 0;
  // "Create "<name>"" row: offered while the query matches no tag by name.
  const offerCreate = showInternal && !loading && canOfferCreate(search, tagOptions);
  const createName = normalizeTagName(search);
  const createRow = offerCreate && (
    <button
      type="button"
      onClick={() => void createTag(createName)}
      disabled={creating}
      className="mt-1 flex w-full items-center gap-1.5 rounded border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5 text-start text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-60"
    >
      {creating ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Plus className="size-3.5 shrink-0" />}
      <span className="truncate">{creating ? t('creatingTag') : t('createTag', { name: createName })}</span>
    </button>
  );
  const noTagsYet = scope === 'internal' && !loading && shownInternalIds.length === 0 && !q;

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
                ) : n.internal ? (
                  <Tags className="size-3 text-amber-500" />
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
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={scope === 'internal' ? t('searchInternalLabels') : t('searchCollections')}
            aria-label={scope === 'internal' ? t('searchInternalLabels') : t('searchCollections')}
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t('loadingCollections')}</p>
          ) : noTagsYet ? (
            <p className="py-6 px-2 text-center text-xs text-muted-foreground">{t('noInternalLabelsYetCreate')}</p>
          ) : !anyVisible ? (
            <>
              {!offerCreate && (
                <p className="py-6 text-center text-xs text-muted-foreground">{t('noCollectionsFound')}</p>
              )}
              {createRow}
            </>
          ) : (
            <>
              {shownRootIds.length > 0 && (
                <ul role="tree" className="space-y-0.5">
                  {shownRootIds.map(renderNode)}
                </ul>
              )}
              {visibleInternalIds.length > 0 && (
                <div className={cn(shownRootIds.length > 0 && 'mt-2 border-t border-dashed border-zinc-200 pt-2')}>
                  {/* A scoped internal picker has its own card title, so no group heading. */}
                  {scope === 'all' && <div className="flex items-baseline gap-1.5 px-1 pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {tcat('internalLabelsGroup')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{tcat('internalLabelsHint')}</span>
                  </div>}
                  <ul className="space-y-0.5" aria-label={tcat('internalLabelsGroup')}>
                    {visibleInternalIds.map(renderInternalNode)}
                  </ul>
                </div>
              )}
              {createRow}
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-zinc-50/70 px-3 py-2">
          {scope === 'internal' ? (
            // Inline action: a new tag is typed into the search box above.
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Plus className="size-3" /> {t('newTag')}
            </button>
          ) : (
            <Link href="/creator/categories/new" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
              <Plus className="size-3" /> {t('newCollection')}
            </Link>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Clear only this picker's part; a scoped picker keeps the other part.
                if (scope === 'all') {
                  onChange([]);
                  onPrimaryChange(null);
                  return;
                }
                const mine = new Set(selected.map((n) => n.id));
                onChange(value.filter((id) => !mine.has(id)));
                if (showPublic) onPrimaryChange(null);
              }}
              className="text-[11px] text-red-500 hover:underline"
            >
              {t('clearAll')}
            </button>
          )}
        </div>
      </div>
      {showPublic && <p className="text-[11px] text-muted-foreground">{t('collectionPrimaryHint')}</p>}
      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn('text-[11px]', notice.kind === 'error' ? 'text-red-600' : 'text-emerald-700')}
        >
          {notice.text}
        </p>
      ) : (
        scope === 'internal' && <p className="text-[11px] text-muted-foreground">{t('tagCreateHint')}</p>
      )}
    </div>
  );
}
