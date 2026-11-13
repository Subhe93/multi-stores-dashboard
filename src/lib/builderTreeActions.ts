// Pure helpers for the builder's tree actions (move within siblings, undo/redo
// re-creation order, id remapping). No React and no imports, so the node test
// runner can load this file directly (node --experimental-strip-types).
// Tree rules live in sectionTree.ts; these helpers only read parent_id and
// sibling-scoped sort_order.

/** The minimum shape these helpers need from a section. */
export interface TreeRowLike {
  id: string;
  section_key: string;
  sort_order: number;
  parent_id?: string | null;
}

// Mirror of CONTAINER_KEYS in sectionTree.ts (kept local so this file stays
// import-free for the node test runner).
const CONTAINER_SECTION_KEYS = ['layout-row', 'layout-column', 'layout-grid'];

function parentOfRow(row: TreeRowLike): string | null {
  return row.parent_id ?? null;
}

/**
 * True when the list uses nesting (a container or a section with a parent).
 * Pages without nesting keep the legacy flat reorder endpoint.
 */
export function usesSectionTree(list: readonly TreeRowLike[]): boolean {
  return list.some((s) => parentOfRow(s) !== null || CONTAINER_SECTION_KEYS.includes(s.section_key));
}

/** The section's parent id (null for root or an unknown id). */
export function parentIdOf(list: readonly TreeRowLike[], id: string): string | null {
  const row = list.find((s) => s.id === id);
  return row ? parentOfRow(row) : null;
}

/** Siblings of `parentId` in display order (sort_order, then list order). */
export function siblingsOf<T extends TreeRowLike>(list: readonly T[], parentId: string | null): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => parentOfRow(s) === parentId)
    .sort((a, b) => a.s.sort_order - b.s.sort_order || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * Move target for "move up / move down" within the section's own siblings,
 * in the moveSection() index convention (position among the new siblings,
 * not counting the moved section). Null when the section is already first
 * (up) or last (down), or the id is unknown.
 */
export function siblingMoveTarget(
  list: readonly TreeRowLike[],
  id: string,
  delta: -1 | 1,
): { parentId: string | null; index: number } | null {
  const row = list.find((s) => s.id === id);
  if (!row) return null;
  const parentId = parentOfRow(row);
  const siblings = siblingsOf(list, parentId);
  const at = siblings.findIndex((s) => s.id === id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= siblings.length) return null;
  return { parentId, index: to };
}

/**
 * Sections of `target` that are missing from `existingIds`, ordered so a
 * parent always comes before its children (by depth inside `target`, then
 * target order). Undo/redo re-creates them in this order so each POST can
 * reference an already created parent.
 */
export function missingInCreateOrder<T extends TreeRowLike>(
  target: readonly T[],
  existingIds: ReadonlySet<string>,
): T[] {
  const byId = new Map(target.map((s) => [s.id, s]));
  const depthOf = (s: T): number => {
    let depth = 1;
    const seen = new Set<string>([s.id]);
    let cur = parentOfRow(s);
    while (cur !== null) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const p = byId.get(cur);
      if (!p) break;
      depth++;
      cur = parentOfRow(p);
    }
    return depth;
  };
  return target
    .map((s, i) => ({ s, i, d: depthOf(s) }))
    .filter(({ s }) => !existingIds.has(s.id))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ s }) => s);
}

/** Rewrites `oldId` to `newId` in place: the section's own id and every parent_id pointing at it. */
export function remapSectionId(list: TreeRowLike[], oldId: string, newId: string): void {
  for (const row of list) {
    if (row.id === oldId) row.id = newId;
    if (row.parent_id === oldId) row.parent_id = newId;
  }
}

/**
 * Sections of `current` that `target` keeps but that sit (directly or deeper)
 * inside a section `target` drops. Deleting the dropped container on the
 * server would cascade onto them, so they must be moved out first.
 */
export function survivorsInsideDropped(
  current: readonly TreeRowLike[],
  targetIds: ReadonlySet<string>,
): Set<string> {
  const byId = new Map(current.map((s) => [s.id, s]));
  const out = new Set<string>();
  for (const s of current) {
    if (!targetIds.has(s.id)) continue;
    const seen = new Set<string>([s.id]);
    let cur = parentOfRow(s);
    while (cur !== null && !seen.has(cur)) {
      seen.add(cur);
      if (!targetIds.has(cur)) {
        out.add(s.id);
        break;
      }
      cur = byId.get(cur) ? parentOfRow(byId.get(cur) as TreeRowLike) : null;
    }
  }
  return out;
}

/**
 * Dropped sections whose own parent is kept (or root): deleting just these
 * removes every dropped section, since the API cascades to descendants.
 */
export function topMostDropped(current: readonly TreeRowLike[], targetIds: ReadonlySet<string>): string[] {
  const droppedIds = new Set(current.filter((s) => !targetIds.has(s.id)).map((s) => s.id));
  return current
    .filter((s) => droppedIds.has(s.id))
    .filter((s) => {
      const p = parentOfRow(s);
      return p === null || !droppedIds.has(p);
    })
    .map((s) => s.id);
}

/**
 * Ids that appear in `after` but not in `before`; the first one whose parent
 * is not itself new is the root of a duplicated subtree.
 */
export function newSubtreeRootId(before: readonly TreeRowLike[], after: readonly TreeRowLike[]): string | null {
  const known = new Set(before.map((s) => s.id));
  const fresh = after.filter((s) => !known.has(s.id));
  const freshIds = new Set(fresh.map((s) => s.id));
  const root = fresh.find((s) => {
    const p = parentOfRow(s);
    return p === null || !freshIds.has(p);
  });
  return root?.id ?? null;
}

/**
 * The layout row a "Convert to blocks" built for `monolithId`: the new
 * `layout-row` whose settings point back at the monolith (`_converted_from`).
 * The breadcrumb is the first new root in tree order, so the generic
 * newSubtreeRootId would select it instead. Null when there is none.
 */
export function convertedRowId(
  before: readonly TreeRowLike[],
  after: readonly (TreeRowLike & { settings?: unknown })[],
  monolithId: string,
): string | null {
  const known = new Set(before.map((s) => s.id));
  const row = after.find((s) => {
    if (known.has(s.id) || s.section_key !== 'layout-row') return false;
    const settings = s.settings;
    return (
      !!settings &&
      typeof settings === 'object' &&
      (settings as Record<string, unknown>)._converted_from === monolithId
    );
  });
  return row?.id ?? null;
}

/** Error codes of the section-tree API (pages-v2 section-tree.ts and friends). */
export const SECTION_TREE_ERROR_CODES = [
  'PAGE_SECTION_NOT_FOUND',
  'PAGE_SECTION_FORBIDDEN',
  'PAGE_SECTION_IDS_INVALID',
  'PAGE_SECTION_PARENT_INVALID',
  'PAGE_SECTION_PARENT_NOT_CONTAINER',
  'PAGE_SECTION_TREE_CYCLE',
  'PAGE_SECTION_TREE_TOO_DEEP',
  'PAGE_SECTION_CONTAINER_NOT_ALLOWED',
] as const;
