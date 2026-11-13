// Pure helpers for the builder's tree section list (SectionList.tsx).
// Type-only imports, so the node test runner can load this file directly
// (node --experimental-strip-types erases them).
import type { DragProjection, FlattenedSection, MoveTarget, TreeSectionLike } from './sectionTree';

/** One visual row of the section list: a section, or a "+ add here" slot inside a container. */
export type SectionListRow<T extends TreeSectionLike> =
  | { kind: 'section'; item: FlattenedSection<T> }
  | {
      kind: 'add';
      /** The container the new section goes into. */
      parentId: string;
      /** Sibling index the new section gets (= the container's child count, i.e. append). */
      index: number;
      /** 1-based depth of the slot (container depth + 1), used for indentation. */
      depth: number;
    };

/**
 * Pages without any nesting keep the order of the array the builder holds,
 * exactly as the flat list always rendered it. Returns the input unchanged
 * when any section has a parent (the tree then follows sort_order).
 */
export function normalizeFlatOrder<T extends TreeSectionLike>(sections: readonly T[]): readonly T[] {
  if (sections.some((s) => s.parent_id != null)) return sections;
  if (sections.every((s, i) => s.sort_order === i)) return sections;
  return sections.map((s, i) => (s.sort_order === i ? s : { ...s, sort_order: i }));
}

/**
 * Interleaves "+ add here" slots into a flattened (pre-order) list: one slot
 * after the last visible descendant of every expanded container. Collapsed
 * containers and the container being dragged get no slot.
 */
export function buildListRows<T extends TreeSectionLike>(
  items: readonly FlattenedSection<T>[],
  options: { collapsed?: ReadonlySet<string>; activeId?: string | null } = {},
): SectionListRow<T>[] {
  const collapsed = options.collapsed ?? new Set<string>();
  const activeId = options.activeId ?? null;
  const rows: SectionListRow<T>[] = [];
  const open: FlattenedSection<T>[] = [];
  const close = (container: FlattenedSection<T>) =>
    rows.push({ kind: 'add', parentId: container.id, index: container.childCount, depth: container.depth + 1 });

  for (const item of items) {
    while (open.length > 0 && open[open.length - 1].depth >= item.depth) close(open.pop() as FlattenedSection<T>);
    rows.push({ kind: 'section', item });
    if (item.isContainer && !collapsed.has(item.id) && item.id !== activeId) open.push(item);
  }
  while (open.length > 0) close(open.pop() as FlattenedSection<T>);
  return rows;
}

/** Ids of every ancestor container of `id`, nearest first. Cycle-safe. */
export function ancestorIds<T extends TreeSectionLike>(sections: readonly T[], id: string | null): string[] {
  if (!id) return [];
  const byId = new Map<string, T>();
  for (const s of sections) byId.set(s.id, s);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parent_id ?? null;
  while (cur != null && !seen.has(cur)) {
    const parent = byId.get(cur);
    if (!parent) break;
    seen.add(cur);
    out.push(cur);
    cur = parent.parent_id ?? null;
  }
  return out;
}

/**
 * Turns a drag projection into a move target. Null when the drop is not
 * allowed or would leave the section where it already is.
 */
export function resolveDropTarget<T extends TreeSectionLike>(
  active: Pick<FlattenedSection<T>, 'parentId' | 'index'> | null | undefined,
  projection: DragProjection | null | undefined,
): MoveTarget | null {
  if (!active || !projection || !projection.allowed) return null;
  if (projection.parentId === active.parentId && projection.index === active.index) return null;
  return { parentId: projection.parentId, index: projection.index };
}

