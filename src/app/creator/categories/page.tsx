'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Plus,
  FolderTree,
  Trash2,
  Pencil,
  Tag,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  FolderPlus,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { pageWindow } from '@/components/common/pageWindow';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { runBulk } from '@/lib/bulk';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useRowOpen, useTableSelection } from '@/components/common/useTableSelection';
import {
  BulkNotice,
  SelectAllCheckbox,
  SelectRowCheckbox,
  TableSelectionBar,
  useBulkSummary,
  type BulkNoticeValue,
} from '@/components/common/TableSelectionBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace('/api', '');

/** Deepest level a collection may sit on: root = 0, child = 1, grandchild = 2. */
const MAX_CATEGORY_DEPTH = 2;

/** localStorage key prefix for the collapsed-branch set (one entry per store). */
const COLLAPSED_KEY_PREFIX = 'ms-collections-collapsed:';

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchRule = 'MANUAL' | 'TAGS';

// M6.3: INTERNAL labels are flat (no parent, no children) and never shown in the store.
type Visibility = 'PUBLIC' | 'INTERNAL';
type VisibilityFilter = 'all' | 'storefront' | 'internal';
const VISIBILITY_FILTERS: VisibilityFilter[] = ['all', 'storefront', 'internal'];

const LIST_PATH = '/creator/categories';

// Sorting reorders siblings only, so every branch stays under its parent.
const SORTS = [
  'manual',
  'name_asc',
  'name_desc',
  'newest',
  'oldest',
  'updated',
  'products_desc',
  'products_asc',
] as const;
type Sort = (typeof SORTS)[number];
const PAGE_SIZES = ['20', '50', '100'] as const;
const STATUS_TABS = ['', 'active', 'inactive'] as const;
const PRODUCT_FILTERS = ['with', 'empty'] as const;
const IMAGE_FILTERS = ['with', 'without'] as const;
const RULE_FILTERS = ['manual', 'tags'] as const;
const LEVEL_FILTERS = ['top'] as const;

/** Reads a query param, falling back to '' when it is not one of `allowed`. */
function pickParam<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

interface CategoryTranslation {
  locale: string;
  name: string;
}

interface CategoryNode {
  id: string;
  slug: string;
  parent_id?: string | null;
  // Absent on older API payloads = PUBLIC.
  visibility?: Visibility;
  thumbnail_url?: string | null;
  match_rule: MatchRule;
  match_tags: string[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  translations: CategoryTranslation[];
  _count?: { products: number; custom_products?: number; children: number };
  children?: CategoryNode[];
}

interface FlatRow extends CategoryNode {
  /** Display name in the store's primary locale (with fallbacks). */
  name: string;
  /** Ancestor names from the root down, e.g. ["Apparel", "Hoodies"]. */
  ancestors: string[];
  /** Depth in the tree (0 for root). */
  depth: number;
  /** Ids of the direct children. */
  childIds: string[];
  /** Ids of every ancestor, root first. */
  ancestorIds: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Display name: store primary locale, then English, then any translation, then slug. */
function getDisplayName(node: CategoryNode, primaryLocale: string): string {
  const pick = (locale: string) => node.translations?.find((t) => t.locale === locale)?.name?.trim();
  return (
    pick(primaryLocale) ||
    pick('en') ||
    node.translations?.map((tr) => tr.name?.trim()).find(Boolean) ||
    node.slug
  );
}

/**
 * Linked product count, or null for tag-rule collections: their products are
 * resolved live from tags, so the tree payload has no count for them.
 */
function linkedProductCount(node: CategoryNode): number | null {
  if (node.match_rule === 'TAGS') return null;
  return (node._count?.products ?? 0) + (node._count?.custom_products ?? 0);
}

function timeOf(value: string | undefined): number {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Sorts every level of the tree among its siblings. "manual" keeps the API
 * order (sort_order). Ties fall back to the name so the order is stable.
 */
function sortTree(nodes: CategoryNode[], sort: Sort, primaryLocale: string): CategoryNode[] {
  if (sort === 'manual') return nodes;
  const collator = new Intl.Collator(primaryLocale, { sensitivity: 'base', numeric: true });
  const byName = (a: CategoryNode, b: CategoryNode) =>
    collator.compare(getDisplayName(a, primaryLocale), getDisplayName(b, primaryLocale));
  const compare = (a: CategoryNode, b: CategoryNode): number => {
    switch (sort) {
      case 'name_asc':
        return byName(a, b);
      case 'name_desc':
        return byName(b, a);
      case 'newest':
        return timeOf(b.created_at) - timeOf(a.created_at) || byName(a, b);
      case 'oldest':
        return timeOf(a.created_at) - timeOf(b.created_at) || byName(a, b);
      case 'updated':
        return timeOf(b.updated_at) - timeOf(a.updated_at) || byName(a, b);
      case 'products_desc':
      case 'products_asc': {
        // Tag-rule collections have no count and go last either way.
        const ca = linkedProductCount(a);
        const cb = linkedProductCount(b);
        if (ca === null || cb === null) return (ca === null ? 1 : 0) - (cb === null ? 1 : 0) || byName(a, b);
        return (sort === 'products_desc' ? cb - ca : ca - cb) || byName(a, b);
      }
      default:
        return 0;
    }
  };
  const walk = (list: CategoryNode[]): CategoryNode[] =>
    [...list]
      .sort(compare)
      .map((n) => (n.children?.length ? { ...n, children: walk(n.children) } : n));
  return walk(nodes);
}

/** Pre-order flatten of the tree: each row knows its depth, ancestors and children. */
function flattenTree(
  nodes: CategoryNode[],
  primaryLocale: string,
  depth = 0,
  ancestors: string[] = [],
  ancestorIds: string[] = [],
): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    const name = getDisplayName(n, primaryLocale);
    const children = n.children ?? [];
    out.push({
      ...n,
      name,
      ancestors,
      ancestorIds,
      depth,
      childIds: children.map((c) => c.id),
    });
    if (children.length) {
      out.push(
        ...flattenTree(children, primaryLocale, depth + 1, [...ancestors, name], [...ancestorIds, n.id]),
      );
    }
  }
  return out;
}

function resolveUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function readCollapsed(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeCollapsed(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Storage may be unavailable (private mode, quota); the state still works in memory.
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreatorCategoriesPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  const tcat = useTranslations('category');
  const tb = useTranslations('bulk');
  const bulkSummary = useBulkSummary();
  const { linkRow } = useRowOpen();

  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FlatRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Search, filters, sort and page live in the URL (?q=&status=&products=
  // &image=&rule=&level=&show=&sort=&limit=&page=) so the list survives
  // "edit, then back" and can be linked, same as the products list.
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const statusFilter = pickParam(searchParams.get('status'), STATUS_TABS);
  const productsFilter = pickParam(searchParams.get('products'), PRODUCT_FILTERS);
  const imageFilter = pickParam(searchParams.get('image'), IMAGE_FILTERS);
  const ruleFilter = pickParam(searchParams.get('rule'), RULE_FILTERS);
  const levelFilter = pickParam(searchParams.get('level'), LEVEL_FILTERS);
  const visibilityFilter: VisibilityFilter =
    pickParam(searchParams.get('show'), VISIBILITY_FILTERS) || 'all';
  const sort: Sort = pickParam(searchParams.get('sort'), SORTS) || 'manual';
  const limit = Number(pickParam(searchParams.get('limit'), PAGE_SIZES) || '20');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const [searchInput, setSearchInput] = useState(query);
  // Store content locale: names are shown in it first (then en, any, slug).
  const [primaryLocale, setPrimaryLocale] = useState('en');
  // Ids whose children are hidden; persisted per store so the layout survives reloads.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const storageKey = `${COLLAPSED_KEY_PREFIX}${user?.creator?.id ?? 'anon'}`;
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    setCollapsed(readCollapsed(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!token) return;
    api<{ primary_locale?: string }>('/translations/overview', { token })
      .then((res) => setPrimaryLocale(res?.primary_locale || 'en'))
      .catch(() => {});
  }, [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<CategoryNode[]>('/creator-categories', { token });
      setTree(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const sortedTree = useMemo(() => sortTree(tree, sort, primaryLocale), [tree, sort, primaryLocale]);
  const rows = useMemo(() => flattenTree(sortedTree, primaryLocale), [sortedTree, primaryLocale]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const parentIds = useMemo(() => rows.filter((r) => r.childIds.length > 0).map((r) => r.id), [rows]);

  // The visibility switch alone keeps the normal tree (internal labels are
  // flat roots, so hiding them never breaks a path). Any other filter turns
  // on "filter mode": matches show with their ancestor path for context.
  const q = query.trim().toLowerCase();
  const filterMode = !!(q || statusFilter || productsFilter || imageFilter || ruleFilter || levelFilter);
  const filtered = filterMode || visibilityFilter !== 'all';

  // Hits plus the ancestors shown for context (null outside filter mode).
  // The tree endpoint has no filtering and the lists are small enough to
  // filter in memory.
  const matchInfo = useMemo(() => {
    if (!filterMode) return null;
    const hits = new Set<string>();
    const shown = new Set<string>();
    for (const row of rows) {
      const internal = row.visibility === 'INTERNAL';
      if (visibilityFilter === 'storefront' && internal) continue;
      if (visibilityFilter === 'internal' && !internal) continue;
      if (statusFilter === 'active' && !row.is_active) continue;
      if (statusFilter === 'inactive' && row.is_active) continue;
      if (levelFilter === 'top' && row.depth > 0) continue;
      if (imageFilter === 'with' && !row.thumbnail_url) continue;
      if (imageFilter === 'without' && row.thumbnail_url) continue;
      if (ruleFilter === 'manual' && row.match_rule !== 'MANUAL') continue;
      if (ruleFilter === 'tags' && row.match_rule !== 'TAGS') continue;
      if (productsFilter) {
        // Tag-rule collections have no count, so they match neither option.
        const count = linkedProductCount(row);
        if (count === null) continue;
        if (productsFilter === 'with' && count === 0) continue;
        if (productsFilter === 'empty' && count > 0) continue;
      }
      if (
        q &&
        !(
          row.name.toLowerCase().includes(q) ||
          row.slug.toLowerCase().includes(q) ||
          row.ancestors.some((a) => a.toLowerCase().includes(q))
        )
      ) {
        continue;
      }
      hits.add(row.id);
      shown.add(row.id);
      row.ancestorIds.forEach((id) => shown.add(id));
    }
    return { hits, shown };
  }, [filterMode, rows, q, visibilityFilter, statusFilter, levelFilter, imageFilter, ruleFilter, productsFilter]);

  // Every row that passes the filters, in tree (pre-order) order.
  const listRows = useMemo(() => {
    if (matchInfo) return rows.filter((row) => matchInfo.shown.has(row.id));
    if (visibilityFilter === 'all') return rows;
    return rows.filter((row) => (row.visibility === 'INTERNAL') === (visibilityFilter === 'internal'));
  }, [rows, matchInfo, visibilityFilter]);
  const resultCount = matchInfo ? matchInfo.hits.size : listRows.length;

  // Pages are counted in top-level groups: a root with its (shown) subtree is
  // one unit, so a child never lands on another page than its parent.
  const groupIds = useMemo(() => listRows.filter((r) => r.depth === 0).map((r) => r.id), [listRows]);
  const totalPages = Math.max(1, Math.ceil(groupIds.length / limit));
  const currentPage = Math.min(page, totalPages);
  const pageGroupFrom = (currentPage - 1) * limit;
  const pageGroupTo = Math.min(pageGroupFrom + limit, groupIds.length);

  // While filtering every branch is open so a hit is never hidden under a
  // collapsed parent.
  const visibleRows = useMemo(() => {
    const onPage = new Set(groupIds.slice(pageGroupFrom, pageGroupTo));
    return listRows.filter((row) => {
      if (!onPage.has(row.ancestorIds[0] ?? row.id)) return false;
      if (!matchInfo && row.ancestorIds.some((id) => collapsed.has(id))) return false;
      return true;
    });
  }, [listRows, groupIds, pageGroupFrom, pageGroupTo, matchInfo, collapsed]);

  // Ancestor rows shown only for context are not selectable, so "select
  // all" covers the matches on this page.
  const isContextRow = (id: string) => !!matchInfo && !matchInfo.hits.has(id);
  const selectableRows = useMemo(
    () => (matchInfo ? visibleRows.filter((row) => matchInfo.hits.has(row.id)) : visibleRows),
    [visibleRows, matchInfo],
  );
  const selection = useTableSelection(selectableRows, (r) => r.id);
  const clearSelection = selection.clear;

  /** Writes params to the URL; any change other than the page resets to page 1. */
  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      // Same as DataTable: a page, filter or sort change drops the selection.
      clearSelection();
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (!('page' in patch)) params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `${LIST_PATH}?${qs}` : LIST_PATH, { scroll: false });
    },
    [router, searchParams, clearSelection],
  );

  // Last search this page wrote to the URL. When the URL catches up with it,
  // the box is left alone (the user may have typed more meanwhile); any other
  // change (back / forward, a pasted link) is copied into the box.
  const pushedQuery = useRef(query);
  useEffect(() => {
    if (query !== pushedQuery.current) {
      pushedQuery.current = query;
      setSearchInput(query);
    }
  }, [query]);

  const pushSearch = useCallback(
    (value: string) => {
      pushedQuery.current = value;
      updateParams({ q: value });
    },
    [updateParams],
  );

  // Debounced search: the URL follows 300 ms after typing.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === pushedQuery.current) return;
    const id = setTimeout(() => pushSearch(value), 300);
    return () => clearTimeout(id);
  }, [searchInput, pushSearch]);

  // A page past the end (after deletes or a narrower filter) snaps back.
  useEffect(() => {
    if (!loading && page > totalPages) {
      updateParams({ page: totalPages > 1 ? String(totalPages) : '' });
    }
  }, [loading, page, totalPages, updateParams]);

  const clearFilters = () => {
    pushedQuery.current = '';
    setSearchInput('');
    updateParams({ q: '', status: '', products: '', image: '', rule: '', level: '', show: '' });
  };

  const goToPage = (p: number) => updateParams({ page: p > 1 ? String(p) : '' });

  const sortLabel = (s: Sort): string => {
    switch (s) {
      case 'newest':
      case 'oldest':
      case 'updated':
        return t(`myProducts.sort_${s}`);
      default:
        return t(`collections.list.sort_${s}`);
    }
  };

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<BulkNoticeValue | null>(null);

  // Children go first (deepest rows, one at a time) so a parent selected
  // together with its children never detaches them. Unselected children of a
  // deleted parent become top-level, same as the single delete.
  const handleBulkDelete = async () => {
    if (!token) return;
    setBulkBusy(true);
    const targets = [...selection.selectedRows].sort((a, b) => b.depth - a.depth);
    const result = await runBulk(
      targets,
      (row) => api(`/creator-categories/${row.id}`, { method: 'DELETE', token }),
      1,
    );
    setBulkBusy(false);
    setBulkDeleteOpen(false);
    selection.clear();
    setBulkNotice(bulkSummary(result));
    await fetchCategories();
  };

  const updateCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    writeCollapsed(storageKey, next);
  };

  const toggleCollapsed = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateCollapsed(next);
  };

  const expandAll = () => updateCollapsed(new Set());
  const collapseAll = () => updateCollapsed(new Set(parentIds));
  const allCollapsed = parentIds.length > 0 && parentIds.every((id) => collapsed.has(id));

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    rowRefs.current.get(id)?.focus();
  };

  // Tree-grid keyboard model: up/down walk the visible rows, the "inward"
  // arrow opens a branch and the "outward" one closes it (or, on a leaf,
  // jumps to its parent), Enter edits. In RTL the horizontal arrows swap so
  // the key always points the way the chevron does.
  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: FlatRow, index: number) => {
    const isOpen = matchInfo ? true : !collapsed.has(row.id);
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const key =
      rtl && e.key === 'ArrowRight' ? 'ArrowLeft' : rtl && e.key === 'ArrowLeft' ? 'ArrowRight' : e.key;
    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(visibleRows[index + 1]?.id);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(visibleRows[index - 1]?.id);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (row.childIds.length && !isOpen) toggleCollapsed(row.id);
        else if (row.childIds.length && isOpen) focusRow(visibleRows[index + 1]?.id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (row.childIds.length && isOpen && !matchInfo) toggleCollapsed(row.id);
        else focusRow(row.parent_id ?? undefined);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(visibleRows[0]?.id);
        break;
      case 'End':
        e.preventDefault();
        focusRow(visibleRows[visibleRows.length - 1]?.id);
        break;
      case 'Enter':
        if (e.target === e.currentTarget) {
          e.preventDefault();
          router.push(`/creator/categories/${row.id}`);
        }
        break;
      default:
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/creator-categories/${deleteTarget.id}`, {
        method: 'DELETE',
        token,
      });
      await fetchCategories();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete collection:', err);
      const e = err as { message?: string };
      setDeleteError(e?.message || t('collections.failedDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const goNew = (parentId?: string) =>
    router.push(parentId ? `/creator/categories/new?parent=${encodeURIComponent(parentId)}` : '/creator/categories/new');

  const renderRow = (row: FlatRow, index: number) => {
    const hasChildren = row.childIds.length > 0;
    const open = matchInfo ? true : !collapsed.has(row.id);
    const level = row.depth + 1;
    const isInternal = row.visibility === 'INTERNAL';
    const canAddSub = row.depth < MAX_CATEGORY_DEPTH;
    const productCount = (row._count?.products ?? 0) + (row._count?.custom_products ?? 0);
    const parentRow = row.parent_id ? byId.get(row.parent_id) : undefined;
    const rowOpen = linkRow(`/creator/categories/${row.id}`);
    // Ancestor shown only to give a match its path: dimmed, not selectable.
    const contextRow = isContextRow(row.id);

    return (
      <TableRow
        key={row.id}
        ref={(el) => {
          if (el) rowRefs.current.set(row.id, el);
          else rowRefs.current.delete(row.id);
        }}
        tabIndex={0}
        role="row"
        aria-level={level}
        aria-expanded={hasChildren ? open : undefined}
        onKeyDown={(e) => handleRowKeyDown(e, row, index)}
        data-state={selection.isSelected(row.id) ? 'selected' : undefined}
        {...rowOpen}
        className="group cursor-pointer outline-none focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900/20"
      >
        <TableCell className="w-10 py-2" data-row-click-ignore>
          {!contextRow && <SelectRowCheckbox selection={selection} id={row.id} />}
        </TableCell>
        {/* Name + hierarchy */}
        <TableCell className="py-2">
          <div className="flex items-center">
            {/* One guide line per ancestor level above the parent; the lines
                sit where the ancestors' chevrons are, so a branch reads as
                one block. The parent's own column is drawn by the elbow. */}
            {row.ancestorIds.slice(0, -1).map((id, i) => {
              // Column i is ancestor i's chevron column: its line runs down to
              // that ancestor's children, so it ends once the branch this row
              // sits in (ancestor i + 1) is the ancestor's last child.
              const ancestor = byId.get(id);
              const branchId = row.ancestorIds[i + 1];
              const isLastSibling = ancestor ? ancestor.childIds[ancestor.childIds.length - 1] === branchId : false;
              return (
                <span key={id} aria-hidden className="relative block h-9 w-6 shrink-0">
                  {!isLastSibling && (
                    <span className="absolute inset-y-0 inset-s-2.75 w-px bg-zinc-200" />
                  )}
                </span>
              );
            })}
            {row.depth > 0 && (
              // Elbow connector in the parent's column: from the parent's
              // chevron down to this row, continuing when siblings follow.
              <span aria-hidden className="relative block h-9 w-6 shrink-0">
                <span className="absolute inset-s-2.75 top-0 h-1/2 w-px bg-zinc-200" />
                <span className="absolute inset-s-2.75 top-1/2 h-px w-3 bg-zinc-200" />

                {parentRow && parentRow.childIds[parentRow.childIds.length - 1] !== row.id && (
                  <span className="absolute inset-s-2.75 top-1/2 h-1/2 w-px bg-zinc-200" />
                )}
              </span>
            )}

            {hasChildren ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => toggleCollapsed(row.id)}
                disabled={!!matchInfo}
                aria-label={open ? t('collections.tree.collapse') : t('collections.tree.expand')}
                aria-expanded={open}
                className="me-1 flex size-6 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 disabled:opacity-50"
              >
                <ChevronRight
                  className={cn('size-3.5 transition-transform', open ? 'rotate-90' : 'rtl:-scale-x-100')}
                />
              </button>
            ) : (
              <span className="me-1 size-6 shrink-0" aria-hidden />
            )}

            <div className="me-2.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-zinc-100">
              {row.thumbnail_url ? (
                <img src={resolveUrl(row.thumbnail_url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <FolderTree className="size-4 text-zinc-400" />
              )}
            </div>

            <div
              className={cn('flex min-w-0 flex-col', contextRow && 'opacity-60')}
              title={contextRow ? t('collections.list.contextRow') : undefined}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Link href={`/creator/categories/${row.id}`} tabIndex={-1} className="truncate hover:underline">
                  {row.name}
                </Link>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className={cn(
                          'inline-flex h-4 shrink-0 items-center rounded border px-1 font-mono text-[10px] font-semibold leading-none',
                          level === 1 && 'border-zinc-300 bg-zinc-100 text-zinc-700',
                          level === 2 && 'border-sky-200 bg-sky-50 text-sky-700',
                          level === 3 && 'border-violet-200 bg-violet-50 text-violet-700',
                        )}
                      />
                    }
                  >
                    {t('collections.tree.levelShort', { level })}
                  </TooltipTrigger>
                  <TooltipContent>{t('collections.tree.level', { level })}</TooltipContent>
                </Tooltip>
                {isInternal && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge
                          variant="outline"
                          className="h-4 border-amber-200 bg-amber-50 px-1 text-[10px] font-normal text-amber-700"
                        />
                      }
                    >
                      {tcat('internalBadge')}
                    </TooltipTrigger>
                    <TooltipContent>{tcat('internalLabelsHint')}</TooltipContent>
                  </Tooltip>
                )}
                {hasChildren && (
                  <Badge variant="outline" className="h-4 border-zinc-200 bg-white px-1 text-[10px] font-normal text-zinc-500">
                    {t('collections.tree.childrenCount', { count: row.childIds.length })}
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {row.ancestors.length > 0 ? (
                  <span className="truncate">
                    {[...row.ancestors, row.name].join(' › ')}
                  </span>
                ) : (
                  <span>{t('collections.tree.topLevel')}</span>
                )}
                <span aria-hidden className="text-zinc-300">·</span>
                <span className="font-mono">/{row.slug}</span>
              </span>
            </div>
          </div>
        </TableCell>

        {/* Match rule */}
        <TableCell className="py-2">
          {row.match_rule === 'TAGS' ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Tag className="size-2.5 me-0.5" />
              {t('collections.byTags')}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200">
              <Package className="size-2.5 me-0.5" />
              {t('collections.manual')}
            </Badge>
          )}
        </TableCell>

        {/* Products */}
        <TableCell className="py-2">
          {row.match_rule === 'TAGS' ? (
            <span className="text-sm text-muted-foreground">
              {t('collections.byTagsCount', { count: row.match_tags?.length || 0 })}
            </span>
          ) : (
            <span className="text-sm tabular-nums">{productCount}</span>
          )}
        </TableCell>

        {/* Status */}
        <TableCell className="py-2">
          {row.is_active ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {t('collections.active')}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-200">
              {t('collections.inactive')}
            </Badge>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell className="py-2">
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => router.push(`/creator/categories/${row.id}`)}
                    aria-label={tc('edit')}
                  />
                }
              >
                <Pencil className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{tc('edit')}</TooltipContent>
            </Tooltip>
            {/* An internal label is flat: no "add sub-collection" at all. */}
            {!isInternal && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="inline-flex">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={!canAddSub}
                        onClick={() => goNew(row.id)}
                        aria-label={t('collections.tree.addSub')}
                      >
                        <FolderPlus className="size-3.5" />
                      </Button>
                    </span>
                  }
                />
                <TooltipContent>
                  {canAddSub ? t('collections.tree.addSub') : t('collections.tree.maxLevels')}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(row)}
                    aria-label={tc('delete')}
                  />
                }
              >
                <Trash2 className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{tc('delete')}</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('collections.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('collections.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => goNew()}>
          <Plus className="size-4" />
          {t('collections.newCollection')}
        </Button>
      </div>

      {/* Search, filters and sort (same layout as the products list) */}
      {!loading && rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') pushSearch(searchInput.trim());
                }}
                placeholder={t('collections.searchPlaceholder')}
                aria-label={t('collections.searchPlaceholder')}
                className="h-8 w-full rounded-md border border-input bg-background ps-8 pe-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="w-44" title={t('collections.list.productsFilterHint')}>
              <SearchableSelect
                value={productsFilter}
                onChange={(v) => updateParams({ products: v })}
                placeholder={t('collections.list.filterProducts')}
                options={[
                  { value: '', label: t('collections.list.anyProducts') },
                  { value: 'with', label: t('collections.list.withProducts') },
                  { value: 'empty', label: t('collections.list.emptyProducts') },
                ]}
              />
            </div>
            <div className="w-40">
              <SearchableSelect
                value={levelFilter}
                onChange={(v) => updateParams({ level: v })}
                placeholder={t('collections.list.filterLevel')}
                options={[
                  { value: '', label: t('collections.list.allLevels') },
                  { value: 'top', label: t('collections.list.topLevelOnly') },
                ]}
              />
            </div>
            <div className="w-40">
              <SearchableSelect
                value={imageFilter}
                onChange={(v) => updateParams({ image: v })}
                placeholder={t('collections.list.filterImage')}
                options={[
                  { value: '', label: t('collections.list.anyImage') },
                  { value: 'with', label: t('collections.list.withImage') },
                  { value: 'without', label: t('collections.list.withoutImage') },
                ]}
              />
            </div>
            <div className="w-40">
              <SearchableSelect
                value={ruleFilter}
                onChange={(v) => updateParams({ rule: v })}
                placeholder={t('collections.colMatchRule')}
                options={[
                  { value: '', label: t('collections.list.anyRule') },
                  { value: 'manual', label: t('collections.manual') },
                  { value: 'tags', label: t('collections.byTags') },
                ]}
              />
            </div>
            <div className="w-44">
              <SearchableSelect
                value={sort}
                onChange={(v) => updateParams({ sort: v === 'manual' ? '' : v })}
                placeholder={t('myProducts.sortBy')}
                options={SORTS.map((s) => ({ value: s, label: sortLabel(s) }))}
              />
            </div>
            <div className="w-36">
              <SearchableSelect
                value={String(limit)}
                onChange={(v) => updateParams({ limit: v === '20' ? '' : v })}
                options={PAGE_SIZES.map((n) => ({
                  value: n,
                  label: t('myProducts.perPage', { count: Number(n) }),
                }))}
              />
            </div>
            {filtered && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <X className="me-1 size-3.5" />
                {t('myProducts.clearFilters')}
              </Button>
            )}
          </div>

          {/* Status tabs, visibility switch and result count */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {STATUS_TABS.map((status) => {
                  const isActive = statusFilter === status;
                  return (
                    <button
                      key={status || 'all'}
                      type="button"
                      onClick={() => updateParams({ status })}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        isActive
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100',
                      )}
                    >
                      {status === 'active'
                        ? t('collections.active')
                        : status === 'inactive'
                          ? t('collections.inactive')
                          : t('myProducts.allStatuses')}
                    </button>
                  );
                })}
              </div>
              {/* Visibility filter (M6.3): all / storefront / internal */}
              <div
                role="radiogroup"
                aria-label={tcat('visibilityFilter.label')}
                className="inline-flex h-7 items-center rounded-md border border-input bg-background p-0.5"
              >
                {VISIBILITY_FILTERS.map((f) => {
                  const active = visibilityFilter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => updateParams({ show: f === 'all' ? '' : f })}
                      className={cn(
                        'h-6 rounded px-2.5 text-xs font-medium transition',
                        active ? 'bg-zinc-900 text-white' : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground',
                      )}
                    >
                      {tcat(`visibilityFilter.${f}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {t('collections.list.totalCount', { count: resultCount })}
            </p>
          </div>
        </div>
      )}

      <BulkNotice notice={bulkNotice} onDismiss={() => setBulkNotice(null)} />

      {/* Tree table */}
      {loading ? (
        <Card className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground shadow-none">
          <Loader2 className="size-4 animate-spin" />
          {t('collections.tree.loading')}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="shadow-none">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <FolderTree className="size-6" />
            </div>
            <p className="text-sm font-medium">{t('collections.emptyTitle')}</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">{t('collections.emptyDesc')}</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">{t('collections.tree.hierarchyHint')}</p>
            <Button size="sm" className="mt-4" onClick={() => goNew()}>
              <Plus className="size-4" />
              {t('collections.createFirst')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="shadow-none">
          <TableSelectionBar selection={selection}>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              {tc('delete')}
            </Button>
          </TableSelectionBar>
          {/* Tree toolbar (replaced by the selection bar while rows are selected) */}
          <div className={cn('flex flex-wrap items-center justify-end gap-2 border-b p-3', selection.count > 0 && 'hidden')}>
            <div className="flex items-center gap-1.5">
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {t('collections.tree.hierarchyHint')}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={allCollapsed ? expandAll : collapseAll}
                disabled={parentIds.length === 0 || !!matchInfo}
              >
                {allCollapsed ? (
                  <ChevronsUpDown className="size-3.5" />
                ) : (
                  <ChevronsDownUp className="size-3.5" />
                )}
                {allCollapsed ? t('collections.tree.expandAll') : t('collections.tree.collapseAll')}
              </Button>
            </div>
          </div>

          <Table role="treegrid">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 h-10">
                  <SelectAllCheckbox selection={selection} />
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tc('name')}
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('collections.colMatchRule')}
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('collections.colProducts')}
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tc('status')}
                </TableHead>
                <TableHead className="h-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    {q ? t('collections.noSearchResults') : t('collections.list.noFilterResults')}
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map(renderRow)
              )}
            </TableBody>
          </Table>

          {/* Pagination: counted in top-level groups (a root with its subtree) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t('collections.list.showingGroups', {
                  from: pageGroupFrom + 1,
                  to: pageGroupTo,
                  total: groupIds.length,
                })}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label={t('collections.list.previousPage')}
                >
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Button>
                {pageWindow(currentPage, totalPages).map((pageNum, i) =>
                  pageNum === null ? (
                    <span key={'gap-' + i} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="icon"
                      className="h-7 w-auto min-w-7 px-1.5 text-xs tabular-nums"
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label={t('collections.list.nextPage')}
                >
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        destructive
        title={tb('deleteTitle', { count: selection.count })}
        description={tb('deleteDescription')}
        busy={bulkBusy}
        busyLabel={t('collections.deleting')}
        onConfirm={handleBulkDelete}
      />

      {/* Delete confirm dialog */}
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
            <DialogTitle>{t('collections.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('collections.deleteConfirmPrefix')}{' '}
              <span className="font-medium text-foreground">{deleteTarget?.name ?? ''}</span>
              {t('collections.deleteConfirmSuffix')}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('collections.deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
