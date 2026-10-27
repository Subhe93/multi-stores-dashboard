'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, CornerDownRight, FolderTree, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Deepest level a collection may sit on: root = 0, child = 1, grandchild = 2. */
export const MAX_CATEGORY_DEPTH = 2;

export interface ParentPickerNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  // M6.3: INTERNAL labels can never be a parent; absent on older payloads = PUBLIC.
  visibility?: 'PUBLIC' | 'INTERNAL';
  translations?: { locale: string; name: string }[];
  children?: ParentPickerNode[];
}

interface Props {
  /** The full collection tree (GET /creator-categories). */
  tree: ParentPickerNode[];
  loading?: boolean;
  /** Selected parent id, null for a top-level collection. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** The collection being edited: it and its subtree can never be the parent. */
  excludeId?: string;
  /**
   * Deepest depth a parent may have (0 = root only). Shrinks when the edited
   * collection already has sub-collections, so its subtree still fits.
   */
  maxParentDepth: number;
  /** The store's primary content locale: names are shown in it first. */
  primaryLocale?: string;
  /** Name of the collection being created/edited, for the live path preview. */
  previewName: string;
}

interface IndexedNode {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  childIds: string[];
  /** Ancestor names, root first. */
  ancestors: string[];
  /** True for the edited collection and every node below it. */
  isSelfOrDescendant: boolean;
}

function getName(node: ParentPickerNode, primaryLocale: string): string {
  const pick = (locale: string) => node.translations?.find((tr) => tr.locale === locale)?.name?.trim();
  return (
    pick(primaryLocale) ||
    pick('en') ||
    node.translations?.map((tr) => tr.name?.trim()).find(Boolean) ||
    node.slug
  );
}

function indexTree(
  nodes: ParentPickerNode[],
  primaryLocale: string,
  excludeId: string | undefined,
): { byId: Map<string, IndexedNode>; rootIds: string[] } {
  const byId = new Map<string, IndexedNode>();
  const walk = (
    list: ParentPickerNode[],
    depth: number,
    parentId: string | null,
    ancestors: string[],
    underSelf: boolean,
  ): string[] =>
    // Internal labels are not offered at all (they are flat, so no subtree is lost).
    list.filter((n) => n.visibility !== 'INTERNAL').map((n) => {
      const name = getName(n, primaryLocale);
      const isSelfOrDescendant = underSelf || n.id === excludeId;
      const entry: IndexedNode = {
        id: n.id,
        name,
        depth,
        parentId,
        childIds: [],
        ancestors,
        isSelfOrDescendant,
      };
      byId.set(n.id, entry);
      entry.childIds = n.children?.length
        ? walk(n.children, depth + 1, n.id, [...ancestors, name], isSelfOrDescendant)
        : [];
      return n.id;
    });
  const rootIds = walk(nodes, 0, null, [], false);
  return { byId, rootIds };
}

/**
 * Single-select tree for the parent of a collection. Same visual language as
 * the product CollectionTreePicker, but with radio semantics: "No parent"
 * first, then the tree, with rows the depth rule forbids shown disabled and
 * explained. A live line underneath previews where the collection will sit.
 */
export function ParentCollectionPicker({
  tree,
  loading = false,
  value,
  onChange,
  excludeId,
  maxParentDepth,
  primaryLocale = 'en',
  previewName,
}: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  // Ids whose children are hidden. Everything starts expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { byId, rootIds } = useMemo(
    () => indexTree(tree, primaryLocale, excludeId),
    [tree, primaryLocale, excludeId],
  );

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

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Why a row cannot be chosen (undefined when it can).
  const disabledReason = (node: IndexedNode): string | undefined => {
    if (node.isSelfOrDescendant) return t('category.parentPicker.selfOrChild');
    if (node.depth > maxParentDepth) return t('category.parentPicker.wouldExceed');
    return undefined;
  };

  const selected = value ? byId.get(value) : undefined;
  // A stored parent that is no longer allowed (e.g. depth rule after a reorder)
  // is still shown as selected so the user sees what to fix.
  const selectedReason = selected ? disabledReason(selected) : undefined;

  const previewPath = [
    ...(selected ? [...selected.ancestors, selected.name] : []),
    previewName.trim() || t('category.parentPicker.unnamed'),
  ];
  const previewLevel = (selected ? selected.depth + 1 : 0) + 1;

  const renderNode = (id: string): ReactNode => {
    const node = byId.get(id);
    if (!node) return null;
    if (visible && !visible.has(id)) return null;
    const hasChildren = node.childIds.length > 0;
    const open = q ? true : !collapsed.has(id);
    const reason = disabledReason(node);
    const disabled = !!reason;
    const checked = value === id;
    const inputId = `pcp-${id}`;
    const level = node.depth + 1;

    return (
      <li key={id} role="none">
        <div
          className={cn(
            'group flex items-center gap-1.5 rounded px-1 py-1 text-sm',
            checked ? 'bg-zinc-100' : disabled ? '' : 'hover:bg-zinc-50',
          )}
          title={reason}
        >
          {hasChildren ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => toggleCollapsed(id)}
              aria-label={open ? t('components.collectionCollapse') : t('components.collectionExpand')}
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
            type="radio"
            name="parent-collection"
            value={id}
            checked={checked}
            disabled={disabled}
            onChange={() => onChange(id)}
            className="size-3.5 shrink-0 cursor-pointer accent-zinc-800 disabled:cursor-not-allowed"
          />
          <label
            htmlFor={inputId}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 select-none',
              disabled ? 'cursor-not-allowed text-zinc-400' : 'cursor-pointer',
            )}
          >
            <span className="truncate">{node.name}</span>
            <span
              className={cn(
                'inline-flex h-4 shrink-0 items-center rounded border px-1 font-mono text-[10px] font-semibold leading-none',
                disabled
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-400'
                  : level === 1
                    ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
                    : level === 2
                      ? 'border-sky-200 bg-sky-50 text-sky-700'
                      : 'border-violet-200 bg-violet-50 text-violet-700',
              )}
              title={t('category.parentPicker.levelTitle', { level })}
            >
              {t('category.parentPicker.levelShort', { level })}
            </span>
            {reason && (
              <span className="hidden truncate text-[11px] text-zinc-400 sm:inline">— {reason}</span>
            )}
          </label>
        </div>
        {hasChildren && open && (
          // Indent guide: a start-side rule marks each nesting level.
          <ul role="none" className="ms-3.5 border-s border-zinc-200 ps-1.5">
            {node.childIds.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  const anyVisible = visible ? rootIds.some((id) => visible.has(id)) : rootIds.length > 0;
  const noneChecked = value === null || (value !== null && !selected);

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-md border border-input bg-background"
        role="radiogroup"
        aria-label={t('category.parentCollection')}
      >
        {/* "No parent" is always first, so a top-level collection is one click. */}
        <label
          className={cn(
            'flex cursor-pointer items-center gap-2 border-b px-2.5 py-2 text-sm',
            noneChecked ? 'bg-zinc-100' : 'hover:bg-zinc-50',
          )}
        >
          <input
            type="radio"
            name="parent-collection"
            value=""
            checked={noneChecked}
            onChange={() => onChange(null)}
            className="size-3.5 shrink-0 cursor-pointer accent-zinc-800"
          />
          <FolderTree className="size-3.5 shrink-0 text-zinc-500" />
          <span className="font-medium">{t('category.noneTopLevel')}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {t('category.parentPicker.noParentHint')}
          </span>
        </label>

        {!loading && rootIds.length > 0 && (
          <div className="flex items-center gap-2 border-b px-2">
            <Search className="size-3.5 shrink-0 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('category.searchCollections')}
              aria-label={t('category.searchCollections')}
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('category.clear')}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto p-1.5">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('components.loadingCollections')}
            </p>
          ) : rootIds.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('category.parentPicker.noOthers')}
            </p>
          ) : !anyVisible ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('components.noCollectionsFound')}
            </p>
          ) : (
            <ul role="none" className="space-y-0.5">
              {rootIds.map(renderNode)}
            </ul>
          )}
        </div>
      </div>

      {/* Live preview: where the collection will sit, and on which level. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-xs',
          selectedReason ? 'border-amber-200 bg-amber-50/60' : 'border-zinc-200 bg-zinc-50/60',
        )}
        aria-live="polite"
      >
        <CornerDownRight className="size-3.5 shrink-0 text-zinc-400" />
        <span className="text-muted-foreground">{t('category.parentPicker.previewLabel')}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-1 font-medium">
          {previewPath.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className="text-zinc-400">›</span>}
              <span className={cn('truncate', i === previewPath.length - 1 && 'text-zinc-900')}>{part}</span>
            </span>
          ))}
        </span>
        <span
          className={cn(
            'ms-auto inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] font-semibold',
            previewLevel === 1 && 'border-zinc-300 bg-zinc-100 text-zinc-700',
            previewLevel === 2 && 'border-sky-200 bg-sky-50 text-sky-700',
            previewLevel >= 3 && 'border-violet-200 bg-violet-50 text-violet-700',
          )}
        >
          {t('category.parentPicker.previewLevel', { level: previewLevel })}
        </span>
        {selectedReason && (
          <span className="basis-full text-[11px] text-amber-700">{selectedReason}</span>
        )}
      </div>
    </div>
  );
}
