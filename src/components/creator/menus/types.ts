// Shared types + pure tree helpers for the WordPress-style menu editor.
// The editor works on an immutable nested tree (max 3 levels) keyed by a
// client-side `cid`; server ids (`id`) are kept so existing rows survive a
// save. All helpers return new arrays and never mutate the input.

export type MenuItemKind = 'CUSTOM' | 'PAGE' | 'COLLECTION' | 'PRODUCT';

export const MENU_MAX_DEPTH = 3;

// Flat item as returned by the API (includes nesting + ordering metadata).
export interface MenuItem {
  id?: string;
  parent_id?: string | null;
  sort_order?: number;
  label: string;
  label_i18n?: Record<string, string> | null;
  url: string;
  open_in_new_tab?: boolean;
  kind?: MenuItemKind | null;
  resource_id?: string | null;
}

// Editor working node.
export interface TreeItem {
  cid: string;
  id?: string;
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  open_in_new_tab?: boolean;
  kind: MenuItemKind;
  resource_id: string | null;
  children: TreeItem[];
}

export interface Menu {
  id: string;
  key: string;
  name: string;
  items: MenuItem[];
}

// What the source panels hand over when the user clicks "Add to menu".
export interface NewMenuItem {
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  kind: MenuItemKind;
  resource_id: string | null;
}

let seq = 0;
export function nextCid(): string {
  seq += 1;
  return `mi-${Date.now().toString(36)}-${seq}`;
}

export function makeNode(input: NewMenuItem): TreeItem {
  return {
    cid: nextCid(),
    label: input.label,
    label_i18n: input.label_i18n && Object.keys(input.label_i18n).length ? input.label_i18n : undefined,
    url: input.url,
    open_in_new_tab: false,
    kind: input.kind,
    resource_id: input.kind === 'CUSTOM' ? null : input.resource_id,
    children: [],
  };
}

// Rebuild the editor tree from the API's flat, sort_order-ordered item list.
// Parents are linked by `parent_id`; orphans fall back to the top level so
// nothing silently vanishes. Depth beyond MENU_MAX_DEPTH is flattened onto
// the deepest allowed level.
export function buildTree(flat: MenuItem[]): TreeItem[] {
  const toNode = (i: MenuItem): TreeItem => ({
    cid: nextCid(),
    id: i.id,
    label: i.label,
    label_i18n: i.label_i18n || undefined,
    url: i.url,
    open_in_new_tab: !!i.open_in_new_tab,
    kind: i.kind || 'CUSTOM',
    resource_id: i.resource_id ?? null,
    children: [],
  });
  const byId = new Map<string, TreeItem>();
  const nodes = flat.map((i) => {
    const n = toNode(i);
    if (i.id) byId.set(i.id, n);
    return n;
  });
  const tops: TreeItem[] = [];
  flat.forEach((i, idx) => {
    const node = nodes[idx];
    const parent = i.parent_id ? byId.get(i.parent_id) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else tops.push(node);
  });
  // Clamp depth: anything deeper than the limit is hoisted to the last level.
  const clamp = (list: TreeItem[], depth: number): TreeItem[] =>
    list.flatMap((n) => {
      if (depth >= MENU_MAX_DEPTH - 1 && n.children.length) {
        const rest = clamp(n.children, depth);
        return [{ ...n, children: [] }, ...rest];
      }
      return [{ ...n, children: clamp(n.children, depth + 1) }];
    });
  return clamp(tops, 0);
}

// ── Tree queries ──────────────────────────────────────────

export interface FlatRow {
  node: TreeItem;
  depth: number;
  parentCid: string | null;
  index: number; // position among siblings
  siblingCount: number;
}

export function flattenTree(items: TreeItem[], depth = 0, parentCid: string | null = null): FlatRow[] {
  return items.flatMap((node, index) => [
    { node, depth, parentCid, index, siblingCount: items.length },
    ...flattenTree(node.children, depth + 1, node.cid),
  ]);
}

// Height of a subtree in levels (leaf = 1).
export function subtreeHeight(node: TreeItem): number {
  return 1 + node.children.reduce((m, c) => Math.max(m, subtreeHeight(c)), 0);
}

// Path of indices from the root to the node, or null when not found.
export function findPath(items: TreeItem[], cid: string, prefix: number[] = []): number[] | null {
  for (let i = 0; i < items.length; i++) {
    const n = items[i];
    if (n.cid === cid) return [...prefix, i];
    const inner = findPath(n.children, cid, [...prefix, i]);
    if (inner) return inner;
  }
  return null;
}

export function getAtPath(items: TreeItem[], path: number[]): TreeItem | undefined {
  let list = items;
  let node: TreeItem | undefined;
  for (const idx of path) {
    node = list[idx];
    if (!node) return undefined;
    list = node.children;
  }
  return node;
}

export function descendantCids(node: TreeItem): Set<string> {
  const out = new Set<string>();
  const walk = (n: TreeItem) => n.children.forEach((c) => { out.add(c.cid); walk(c); });
  walk(node);
  return out;
}

// ── Tree mutations (immutable) ────────────────────────────

export function updateNode(items: TreeItem[], cid: string, fn: (n: TreeItem) => TreeItem): TreeItem[] {
  return items.map((n) => (n.cid === cid ? fn(n) : n.children.length ? { ...n, children: updateNode(n.children, cid, fn) } : n));
}

export function removeAtPath(items: TreeItem[], path: number[]): { items: TreeItem[]; removed: TreeItem | null } {
  if (path.length === 0) return { items, removed: null };
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const removed = items[head] ?? null;
    return { items: items.filter((_, i) => i !== head), removed };
  }
  const parent = items[head];
  if (!parent) return { items, removed: null };
  const inner = removeAtPath(parent.children, rest);
  return {
    items: items.map((n, i) => (i === head ? { ...n, children: inner.items } : n)),
    removed: inner.removed,
  };
}

export function insertAtPath(items: TreeItem[], path: number[], node: TreeItem): TreeItem[] {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const next = items.slice();
    next.splice(Math.max(0, Math.min(head, next.length)), 0, node);
    return next;
  }
  return items.map((n, i) => (i === head ? { ...n, children: insertAtPath(n.children, rest, node) } : n));
}

export function removeNode(items: TreeItem[], cid: string): TreeItem[] {
  const path = findPath(items, cid);
  return path ? removeAtPath(items, path).items : items;
}

// Indent: become the last child of the previous sibling. Allowed when a
// previous sibling exists and the resulting depth stays within the limit.
export function canIndent(items: TreeItem[], cid: string): boolean {
  const path = findPath(items, cid);
  if (!path || path[path.length - 1] === 0) return false;
  const node = getAtPath(items, path)!;
  const depth = path.length - 1;
  return depth + 1 + subtreeHeight(node) <= MENU_MAX_DEPTH;
}

export function indentNode(items: TreeItem[], cid: string): TreeItem[] {
  if (!canIndent(items, cid)) return items;
  const path = findPath(items, cid)!;
  const { items: without, removed } = removeAtPath(items, path);
  if (!removed) return items;
  const prevPath = [...path.slice(0, -1), path[path.length - 1] - 1];
  const prev = getAtPath(without, prevPath)!;
  return insertAtPath(without, [...prevPath, prev.children.length], removed);
}

// Outdent: move right after the parent, at the parent's level.
export function canOutdent(items: TreeItem[], cid: string): boolean {
  const path = findPath(items, cid);
  return !!path && path.length > 1;
}

export function outdentNode(items: TreeItem[], cid: string): TreeItem[] {
  const path = findPath(items, cid);
  if (!path || path.length < 2) return items;
  const { items: without, removed } = removeAtPath(items, path);
  if (!removed) return items;
  const parentPath = path.slice(0, -1);
  const afterParent = [...parentPath.slice(0, -1), parentPath[parentPath.length - 1] + 1];
  return insertAtPath(without, afterParent, removed);
}

// Drag-and-drop: drop `activeCid` as a sibling of `overCid` (before it when
// moving up, after it when moving down). The target depth is clamped so the
// dragged subtree never exceeds the limit — when it would, the item lands
// next to the nearest ancestor of `over` that keeps it within bounds.
export function moveNode(items: TreeItem[], activeCid: string, overCid: string): TreeItem[] {
  if (activeCid === overCid) return items;
  const activePath = findPath(items, activeCid);
  const overPathBefore = findPath(items, overCid);
  if (!activePath || !overPathBefore) return items;
  const active = getAtPath(items, activePath)!;
  if (descendantCids(active).has(overCid)) return items;

  // Flat order decides the direction of the move.
  const order = flattenTree(items).map((r) => r.node.cid);
  const movingDown = order.indexOf(activeCid) < order.indexOf(overCid);

  const { items: without, removed } = removeAtPath(items, activePath);
  if (!removed) return items;
  let overPath = findPath(without, overCid)!;
  const height = subtreeHeight(removed);
  // Walk up until the subtree fits under the depth limit.
  while (overPath.length - 1 + height > MENU_MAX_DEPTH && overPath.length > 1) {
    overPath = overPath.slice(0, -1);
  }
  const target = movingDown
    ? [...overPath.slice(0, -1), overPath[overPath.length - 1] + 1]
    : overPath;
  return insertAtPath(without, target, removed);
}

// ── Locale helpers ────────────────────────────────────────

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska', es: 'Español',
};

export function localeLabel(code: string): string {
  return LOCALE_LABELS[code] || code.toUpperCase();
}

// Read a node's label for a locale: primary uses `label`, others `label_i18n`.
export function labelFor(node: TreeItem, locale: string, primaryLocale: string): string {
  if (locale === primaryLocale) return node.label || '';
  return node.label_i18n?.[locale] || '';
}

// A cleared translation is kept as '' (not deleted): the API merges
// `label_i18n` per locale and only removes a locale when '' is sent for it.
export function withLabel(node: TreeItem, locale: string, primaryLocale: string, value: string): TreeItem {
  if (locale === primaryLocale) return { ...node, label: value };
  return { ...node, label_i18n: { ...(node.label_i18n || {}), [locale]: value } };
}

// Pick a translated string: requested locale → en → first non-empty.
export function pickTranslation<T extends { locale: string }>(
  translations: T[] | null | undefined,
  locale: string,
  read: (t: T) => string | null | undefined,
): string {
  if (!translations?.length) return '';
  const tryLocale = (l: string) => {
    const row = translations.find((t) => t.locale === l);
    return row ? (read(row) || '').trim() : '';
  };
  return tryLocale(locale) || tryLocale('en') || translations.map((t) => (read(t) || '').trim()).find(Boolean) || '';
}

// Build label_i18n for the store's secondary locales from a translation list.
export function i18nLabels<T extends { locale: string }>(
  translations: T[] | null | undefined,
  locales: string[],
  primaryLocale: string,
  read: (t: T) => string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) {
    if (l === primaryLocale) continue;
    const row = translations?.find((t) => t.locale === l);
    const v = row ? (read(row) || '').trim() : '';
    if (v) out[l] = v;
  }
  return out;
}
