// Pure helpers for nested page sections (layout containers).
// No React and no imports, so the node test runner can load this file
// directly (node --experimental-strip-types).
//
// Contract (shared with the API and the storefront):
// - Each section carries `parent_id: string | null`; absent/null = root.
// - `sort_order` is scoped to siblings (same parent_id).
// - Only the container keys below may be parents.
// - Depth is 1-based: a root section has depth 1. Max depth is 3; a leaf may
//   sit at depth 3, containers only at depth 1-2. No cycles.

export const CONTAINER_KEYS = ['layout-row', 'layout-column', 'layout-grid'] as const;
export type ContainerKey = (typeof CONTAINER_KEYS)[number];

/** Deepest level any section may sit at (root = 1). */
export const MAX_SECTION_DEPTH = 3;
/** Deepest level a container may sit at (it needs room for one child level). */
export const MAX_CONTAINER_DEPTH = MAX_SECTION_DEPTH - 1;

/** The minimum shape the tree helpers need from a section. */
export interface TreeSectionLike {
  id: string;
  section_key: string;
  sort_order: number;
  parent_id?: string | null;
}

export interface SectionTreeNode<T extends TreeSectionLike> {
  section: T;
  /** 1-based depth (root = 1). */
  depth: number;
  /** Effective parent id (null for root, including promoted orphans). */
  parentId: string | null;
  children: SectionTreeNode<T>[];
}

export interface FlattenedSection<T extends TreeSectionLike> {
  id: string;
  section: T;
  section_key: string;
  /** Effective parent id (null = root). */
  parentId: string | null;
  /** 1-based depth (root = 1). */
  depth: number;
  /** Position among its siblings (0-based). */
  index: number;
  isContainer: boolean;
  /** Number of direct children (also counted when the node is collapsed). */
  childCount: number;
}

export interface MoveTarget {
  /** New parent id, or null for the page root. */
  parentId: string | null;
  /** Position among the new siblings, not counting the moved section itself. */
  index: number;
}

export type MoveCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'not-found' | 'parent-not-found' | 'parent-not-container' | 'cycle' | 'too-deep';
    };

export function isContainerKey(key: string | null | undefined): key is ContainerKey {
  return typeof key === 'string' && (CONTAINER_KEYS as readonly string[]).includes(key);
}

function rawParent(section: TreeSectionLike): string | null {
  return section.parent_id ?? null;
}

/**
 * Builds the section tree from a flat list.
 * - Siblings are ordered by sort_order, ties keep the list order.
 * - A section whose parent is missing, is not a container, or sits in a
 *   cycle is promoted to the root, so nothing ever disappears from the editor.
 */
export function buildTree<T extends TreeSectionLike>(list: readonly T[]): SectionTreeNode<T>[] {
  const byId = new Map<string, T>();
  for (const s of list) byId.set(s.id, s);
  const position = new Map<string, number>();
  list.forEach((s, i) => position.set(s.id, i));

  const childrenOf = new Map<string | null, T[]>();
  for (const s of list) {
    const pid = rawParent(s);
    const parent = pid != null ? byId.get(pid) : undefined;
    const key = parent && parent.id !== s.id && isContainerKey(parent.section_key) ? pid : null;
    const bucket = childrenOf.get(key);
    if (bucket) bucket.push(s);
    else childrenOf.set(key, [s]);
  }
  const bySortOrder = (a: T, b: T) =>
    a.sort_order - b.sort_order || (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
  for (const bucket of childrenOf.values()) bucket.sort(bySortOrder);

  const visited = new Set<string>();
  const build = (s: T, depth: number, parentId: string | null): SectionTreeNode<T> => {
    visited.add(s.id);
    const node: SectionTreeNode<T> = { section: s, depth, parentId, children: [] };
    for (const child of childrenOf.get(s.id) ?? []) {
      if (visited.has(child.id)) continue;
      node.children.push(build(child, depth + 1, s.id));
    }
    return node;
  };

  const roots: SectionTreeNode<T>[] = [];
  for (const s of childrenOf.get(null) ?? []) roots.push(build(s, 1, null));

  // Cycle members are unreachable from the root: promote them, in list order.
  const unreachable = list.filter((s) => !visited.has(s.id)).sort(bySortOrder);
  for (const s of unreachable) {
    if (!visited.has(s.id)) roots.push(build(s, 1, null));
  }
  return roots;
}

/**
 * Pre-order (depth-first) flat view of the tree, as the tree list renders it.
 * Descendants of ids in `collapsedIds` are left out.
 */
export function flattenTree<T extends TreeSectionLike>(
  list: readonly T[],
  collapsedIds?: ReadonlySet<string> | readonly string[],
): FlattenedSection<T>[] {
  const collapsed = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds ?? []);
  const out: FlattenedSection<T>[] = [];
  const walk = (nodes: SectionTreeNode<T>[]) => {
    nodes.forEach((node, index) => {
      out.push({
        id: node.section.id,
        section: node.section,
        section_key: node.section.section_key,
        parentId: node.parentId,
        depth: node.depth,
        index,
        isContainer: isContainerKey(node.section.section_key),
        childCount: node.children.length,
      });
      if (!collapsed.has(node.section.id)) walk(node.children);
    });
  };
  walk(buildTree(list));
  return out;
}

/** The section and all its descendants (the section first, then pre-order). Cycle-safe. */
export function collectSubtreeIds<T extends TreeSectionLike>(list: readonly T[], id: string): string[] {
  if (!list.some((s) => s.id === id)) return [];
  // Children in sibling order (sort_order, then list order).
  const ordered = list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.sort_order - b.s.sort_order || a.i - b.i)
    .map((x) => x.s);
  const childIds = new Map<string, string[]>();
  for (const s of ordered) {
    const pid = rawParent(s);
    if (pid == null) continue;
    const bucket = childIds.get(pid);
    if (bucket) bucket.push(s.id);
    else childIds.set(pid, [s.id]);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    const kids = childIds.get(cur) ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}

/** Removes a section and all its descendants. Sibling sort_order is left as is. */
export function removeSubtree<T extends TreeSectionLike>(list: readonly T[], id: string): T[] {
  const drop = new Set(collectSubtreeIds(list, id));
  return list.filter((s) => !drop.has(s.id));
}

/**
 * Height of the subtree rooted at `id`: 1 for a leaf or an empty container,
 * 2 for a container with leaves, and so on.
 */
export function subtreeHeight<T extends TreeSectionLike>(list: readonly T[], id: string): number {
  const find = (nodes: SectionTreeNode<T>[]): SectionTreeNode<T> | null => {
    for (const n of nodes) {
      if (n.section.id === id) return n;
      const hit = find(n.children);
      if (hit) return hit;
    }
    return null;
  };
  const height = (n: SectionTreeNode<T>): number =>
    1 + n.children.reduce((m, c) => Math.max(m, height(c)), 0);
  const node = find(buildTree(list));
  return node ? height(node) : 1;
}

/**
 * Whether a section with `sectionKey` may be placed under `target` at `depth`.
 * - `target`: the would-be parent (null = page root).
 * - `depth`: the 1-based depth the section would sit at.
 * - `height`: subtree height of the moved section (1 for a leaf / empty container).
 * Cycle checks need ids, see validateMove / moveSection.
 */
export function canDropInto(
  sectionKey: string,
  target: { section_key: string } | null,
  depth: number,
  height = 1,
): boolean {
  if (!Number.isInteger(depth) || depth < 1) return false;
  if (target == null) {
    if (depth !== 1) return false;
  } else {
    if (!isContainerKey(target.section_key)) return false;
    if (depth < 2) return false;
  }
  if (isContainerKey(sectionKey) && depth > MAX_CONTAINER_DEPTH) return false;
  if (depth + Math.max(1, height) - 1 > MAX_SECTION_DEPTH) return false;
  return true;
}

/** Depth of a section by walking its parent chain (1 = root). Null on a cycle or missing id. */
function depthOf<T extends TreeSectionLike>(byId: Map<string, T>, id: string | null): number | null {
  let depth = 0;
  const seen = new Set<string>();
  let cur = id;
  while (cur != null) {
    if (seen.has(cur)) return null;
    seen.add(cur);
    const s = byId.get(cur);
    if (!s) return null;
    depth++;
    cur = rawParent(s);
  }
  return depth;
}

/** Checks a move against the contract (parent exists and is a container, no cycle, depth). */
export function validateMove<T extends TreeSectionLike>(
  list: readonly T[],
  id: string,
  target: { parentId: string | null },
): MoveCheck {
  const byId = new Map<string, T>();
  for (const s of list) byId.set(s.id, s);
  const moving = byId.get(id);
  if (!moving) return { ok: false, reason: 'not-found' };
  const parentId = target.parentId ?? null;
  let parent: T | null = null;
  let depth = 1;
  if (parentId != null) {
    const p = byId.get(parentId);
    if (!p) return { ok: false, reason: 'parent-not-found' };
    if (!isContainerKey(p.section_key)) return { ok: false, reason: 'parent-not-container' };
    if (collectSubtreeIds(list, id).includes(parentId)) return { ok: false, reason: 'cycle' };
    const parentDepth = depthOf(byId, parentId);
    if (parentDepth == null) return { ok: false, reason: 'cycle' };
    parent = p;
    depth = parentDepth + 1;
  }
  if (!canDropInto(moving.section_key, parent, depth, subtreeHeight(list, id))) {
    return { ok: false, reason: 'too-deep' };
  }
  return { ok: true };
}

/** Re-numbers sort_order 0..n-1 per sibling group, in the tree's current order. */
function renumber<T extends TreeSectionLike>(nodes: SectionTreeNode<T>[], out: T[]) {
  nodes.forEach((node, index) => {
    const s = node.section;
    const parentId = node.parentId;
    const same = s.sort_order === index && (s.parent_id ?? null) === parentId;
    out.push(same ? s : { ...s, sort_order: index, parent_id: parentId });
    renumber(node.children, out);
  });
}

/**
 * Moves a section (with its subtree) under `target.parentId` at sibling
 * position `target.index` (clamped). Returns a new flat list in pre-order with
 * sibling sort_order re-numbered 0..n-1. Sections that did not change keep
 * their identity. An invalid move returns the input list unchanged (same
 * reference), so callers can detect it.
 */
export function moveSection<T extends TreeSectionLike>(
  list: readonly T[],
  id: string,
  target: MoveTarget,
): T[] {
  if (!validateMove(list, id, target).ok) return list as T[];
  const parentId = target.parentId ?? null;
  const roots = buildTree(list);

  // Detach the moved node from wherever it sits.
  const detach = (nodes: SectionTreeNode<T>[]): SectionTreeNode<T> | null => {
    const at = nodes.findIndex((n) => n.section.id === id);
    if (at >= 0) return nodes.splice(at, 1)[0];
    for (const n of nodes) {
      const hit = detach(n.children);
      if (hit) return hit;
    }
    return null;
  };
  const moved = detach(roots);
  if (!moved) return list as T[];

  // Find the new sibling array.
  const findChildren = (nodes: SectionTreeNode<T>[]): SectionTreeNode<T>[] | null => {
    for (const n of nodes) {
      if (n.section.id === parentId) return n.children;
      const hit = findChildren(n.children);
      if (hit) return hit;
    }
    return null;
  };
  const siblings = parentId == null ? roots : findChildren(roots);
  if (!siblings) return list as T[];
  const index = Math.max(0, Math.min(Math.trunc(target.index) || 0, siblings.length));
  moved.parentId = parentId;
  siblings.splice(index, 0, moved);

  const out: T[] = [];
  renumber(roots, out);
  return out;
}

/** Payload of PUT pages-v2/:id/sections/tree: the full list with sibling-scoped order. */
export function toTreeReorderPayload<T extends TreeSectionLike>(
  list: readonly T[],
): { items: { id: string; parent_id: string | null; sort_order: number }[] } {
  return {
    items: flattenTree(list).map((f) => ({ id: f.id, parent_id: f.parentId, sort_order: f.index })),
  };
}

// ── dnd-kit sortable-tree helpers ───────────────────────────────────────

/** Drops the descendants of `ids` from a flattened list (the dragged item's children). */
export function removeChildrenOf<T extends TreeSectionLike>(
  items: readonly FlattenedSection<T>[],
  ids: readonly string[],
): FlattenedSection<T>[] {
  const excluded = new Set(ids);
  return items.filter((item) => {
    if (item.parentId != null && excluded.has(item.parentId)) {
      if (item.isContainer) excluded.add(item.id);
      return false;
    }
    return true;
  });
}

export interface DragProjection {
  /** 1-based depth the dragged section would land at. */
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: string | null;
  /** Position among the new siblings (excluding the dragged section). */
  index: number;
  /** False when no depth satisfies the contract at this position. */
  allowed: boolean;
}

function arrayMove<X>(arr: readonly X[], from: number, to: number): X[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where a dragged section would land, following the dnd-kit sortable-tree
 * pattern. `items` is the flattened list with the active item's descendants
 * removed (see removeChildrenOf). `activeHeight` is the dragged subtree's
 * height (see subtreeHeight); it defaults to 1.
 */
export function getProjection<T extends TreeSectionLike>(
  items: readonly FlattenedSection<T>[],
  activeId: string,
  overId: string,
  dragOffsetX: number,
  indentationWidth: number,
  activeHeight = 1,
): DragProjection | null {
  const overItemIndex = items.findIndex((i) => i.id === overId);
  const activeItemIndex = items.findIndex((i) => i.id === activeId);
  if (overItemIndex < 0 || activeItemIndex < 0) return null;
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const step = indentationWidth > 0 ? indentationWidth : 1;
  const dragDepth = Math.round(dragOffsetX / step);
  const projectedDepth = activeItem.depth + dragDepth;

  // Deepest valid depth: under the previous item when it is a container,
  // beside it otherwise; then capped by the contract.
  let maxDepth = previousItem ? (previousItem.isContainer ? previousItem.depth + 1 : previousItem.depth) : 1;
  maxDepth = Math.min(maxDepth, MAX_SECTION_DEPTH - Math.max(1, activeHeight) + 1);
  if (activeItem.isContainer) maxDepth = Math.min(maxDepth, MAX_CONTAINER_DEPTH);
  // Shallowest valid depth: the next item must keep its parent.
  const minDepth = nextItem ? nextItem.depth : 1;

  let depth = projectedDepth;
  if (depth > maxDepth) depth = maxDepth;
  if (depth < minDepth) depth = minDepth;
  if (depth < 1) depth = 1;
  const allowed = minDepth <= maxDepth && depth <= maxDepth;

  let parentId: string | null = null;
  if (depth > 1 && previousItem) {
    if (depth === previousItem.depth) parentId = previousItem.parentId;
    else if (depth > previousItem.depth) parentId = previousItem.id;
    else {
      const ancestor = newItems
        .slice(0, overItemIndex)
        .reverse()
        .find((i) => i.depth === depth);
      parentId = ancestor ? ancestor.parentId : null;
    }
  }

  let index = 0;
  for (let i = 0; i < overItemIndex; i++) {
    const it = newItems[i];
    if (it.id !== activeId && it.parentId === parentId && it.depth === depth) index++;
  }

  return { depth, maxDepth, minDepth, parentId, index, allowed };
}

// ── Child layout (settings._layout) ─────────────────────────────────────

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface ChildLayout {
  span?: Partial<Record<Breakpoint, number>>;
  order?: Partial<Record<Breakpoint, number>>;
  align_self?: 'start' | 'center' | 'end' | 'stretch';
  sticky?: boolean;
}

/** Reads a CHILD_LAYOUT_FIELDS key (e.g. 'span.desktop') from settings._layout. */
export function getChildLayoutValue(settings: Record<string, unknown> | null | undefined, path: string): unknown {
  const layout = settings?._layout;
  if (!layout || typeof layout !== 'object') return undefined;
  let cur: unknown = layout;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Returns new settings with `path` set inside settings._layout. Empty values
 * ('' / null / undefined / NaN) remove the key, and empty groups are pruned,
 * so an untouched child keeps no _layout at all.
 */
export function setChildLayoutValue(
  settings: Record<string, unknown> | null | undefined,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const base = { ...(settings ?? {}) };
  const layout: Record<string, unknown> =
    base._layout && typeof base._layout === 'object' ? { ...(base._layout as Record<string, unknown>) } : {};
  const empty = value === '' || value == null || (typeof value === 'number' && Number.isNaN(value));
  const parts = path.split('.');
  if (parts.length === 1) {
    if (empty) delete layout[parts[0]];
    else layout[parts[0]] = value;
  } else {
    const [group, leaf] = parts;
    const g: Record<string, unknown> =
      layout[group] && typeof layout[group] === 'object' ? { ...(layout[group] as Record<string, unknown>) } : {};
    if (empty) delete g[leaf];
    else g[leaf] = value;
    if (Object.keys(g).length > 0) layout[group] = g;
    else delete layout[group];
  }
  if (Object.keys(layout).length > 0) base._layout = layout;
  else delete base._layout;
  return base;
}
