'use client';

// The builder's section list. Flat pages render a plain sortable list, as
// always. Pages with layout containers (layout-row / -column / -grid) render a
// tree, following the dnd-kit sortable-tree pattern: the list is flattened in
// pre-order (lib/sectionTree.ts flattenTree), the dragged row's subtree is
// hidden while it moves, and the horizontal drag offset picks the depth
// (getProjection). Drops that break the nesting rules are refused.

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { findSectionSchema } from '@/lib/section-schemas';
import {
  flattenTree,
  getProjection,
  moveSection,
  removeChildrenOf,
  subtreeHeight,
  type MoveTarget,
} from '@/lib/sectionTree';
import { ancestorIds, buildListRows, isDropAllowed, normalizeFlatOrder, resolveDropTarget } from '@/lib/sectionListRows';
import { AddSectionDialog, type SectionInsertTarget } from './AddSectionDialog';
import { AddHereRow, SectionRowView, SortableSectionRow, TREE_INDENT_PX } from './SectionTreeRows';
import type { SectionInstance } from './types';
import { useUiLabel } from './useUiLabel';

interface SectionListProps {
  sections: SectionInstance[];
  selectedId: string | null;
  /** Store-content locale being edited (row content previews only). */
  contentLocale: string;
  primaryLocale: string;
  pageType: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'CATALOG_TEMPLATE' | 'COLLECTION_TEMPLATE' | 'HEADER' | 'FOOTER';
  onSelect: (id: string) => void;
  // Moves a section (with its subtree) under target.parentId (null = root) at
  // sibling position target.index (the moved section not counted). Used on
  // pages with nesting; flat pages prefer onReorder when it is given.
  onMove?: (id: string, target: MoveTarget) => void;
  // Legacy flat reorder (full id list in the new order). Always used on flat
  // pages when given (keeps the array order the list shows); on tree pages
  // only when onMove is absent, and then only for root-to-root moves.
  onReorder?: (orderedIds: string[]) => void;
  // Called when an "add" control is used, with where the new section should
  // go: a container's "+ add here" passes the container and its child count;
  // the bottom "Add section" button passes (null, root count). The chosen
  // section is then reported through onAdd with the same target.
  onAddInto?: (parentId: string | null, index: number) => void;
  onAdd: (sectionKey: string, target?: SectionInsertTarget) => Promise<void> | void;
  onAddPreset?: (presetId: string) => Promise<void> | void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onDuplicate: (id: string) => Promise<void> | void;
  // Layout containers + product blocks (the store's `product_layout` app).
  // Off: the add dialog hides them, containers get no "+ add here" slot and
  // drags cannot move a section into a container; already-saved containers
  // still show. Defaults to the product template.
  layoutContainers?: boolean;
}

// Left/Right change the depth while dragging with the keyboard (one indent
// per press); Up/Down move between rows as in a plain sortable list.
const treeKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    const step = event.code === 'ArrowRight' ? TREE_INDENT_PX : -TREE_INDENT_PX;
    return { ...args.currentCoordinates, x: args.currentCoordinates.x + step };
  }
  return sortableKeyboardCoordinates(event, args);
};

const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

export function SectionList({
  sections,
  selectedId,
  contentLocale,
  primaryLocale,
  pageType,
  onSelect,
  onMove,
  onReorder,
  onAddInto,
  onAdd,
  onAddPreset,
  onToggleHidden,
  onDuplicate,
  layoutContainers,
}: SectionListProps) {
  const t = useTranslations();
  const uiLabel = useUiLabel();
  const listRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [rtl, setRtl] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [insertTarget, setInsertTarget] = useState<SectionInsertTarget | null>(null);

  const sensors = useSensors(
    // 5px activation threshold so a click on a row still fires `onSelect` —
    // without it dnd-kit would swallow the click as a drag start.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: treeKeyboardCoordinates }),
  );

  // Flat pages keep the order of the builder's array, as before.
  const ordered = useMemo(() => normalizeFlatOrder(sections), [sections]);
  const fullFlat = useMemo(() => flattenTree(ordered), [ordered]);
  const treeMode = fullFlat.some((f) => f.isContainer || f.depth > 1);
  const rootCount = fullFlat.filter((f) => f.depth === 1).length;
  const containersOn = layoutContainers ?? pageType === 'PRODUCT_TEMPLATE';

  // A section selected elsewhere (e.g. in the preview) inside a collapsed
  // container expands its ancestors (adjusting state during render).
  const [lastSelectedId, setLastSelectedId] = useState(selectedId);
  if (selectedId !== lastSelectedId) {
    setLastSelectedId(selectedId);
    const hidden = ancestorIds(ordered, selectedId).filter((id) => collapsed.has(id));
    if (hidden.length > 0) {
      const next = new Set(collapsed);
      for (const id of hidden) next.delete(id);
      setCollapsed(next);
    }
  }

  const items = useMemo(() => {
    const flat = flattenTree(ordered, collapsed);
    return activeId ? removeChildrenOf(flat, [activeId]) : flat;
  }, [ordered, collapsed, activeId]);
  const activeItem = activeId ? (items.find((i) => i.id === activeId) ?? null) : null;
  const activeHeight = useMemo(
    () => (activeId ? subtreeHeight(ordered, activeId) : 1),
    [ordered, activeId],
  );
  const projection =
    activeId && overId
      ? getProjection(items, activeId, overId, rtl ? -offsetX : offsetX, TREE_INDENT_PX, activeHeight)
      : null;
  const rows = useMemo(
    () => buildListRows(items, { collapsed, activeId, addSlots: containersOn }),
    [items, collapsed, activeId, containersOn],
  );

  function resetDrag() {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  }

  function handleDragStart({ active }: DragStartEvent) {
    const el = listRef.current;
    setRtl(!!el && getComputedStyle(el).direction === 'rtl');
    setActiveId(String(active.id));
    setOverId(String(active.id));
    setOffsetX(0);
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetX(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over ? String(over.id) : null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const target = e.over ? resolveDropTarget(activeItem, projection, { allowNewParent: containersOn }) : null;
    resetDrag();
    if (!target) return;
    // moveSection validates parent, cycle and depth; an invalid move returns
    // the same list, so nothing is reported.
    const next = moveSection(ordered, id, target);
    if (next === ordered) return;
    // Flat pages keep the legacy reorder path: `next` follows the array order
    // the list shows (not the possibly drifted sort_order), so these ids equal
    // the old arrayMove result and reorderSections renumbers 0..n-1 from them.
    if (!treeMode && onReorder) {
      onReorder(flattenTree(next).map((f) => f.id));
      return;
    }
    if (onMove) {
      onMove(id, target);
      return;
    }
    if (target.parentId !== null || activeItem?.parentId !== null) return;
    onReorder?.(flattenTree(next).map((f) => f.id));
  }

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddInto(parentId: string, index: number) {
    setInsertTarget({ parentId, index });
    onAddInto?.(parentId, index);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    // The bottom trigger opens the dialog for the page root (append).
    if (open && !dialogOpen) {
      setInsertTarget(null);
      onAddInto?.(null, rootCount);
    }
    setDialogOpen(open);
  }

  const labelFor = (sectionKey: string) => {
    const schema = findSectionSchema(sectionKey);
    return schema ? uiLabel(schema.label) : sectionKey;
  };

  const overlaySection = treeMode && activeItem ? activeItem.section : null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t('builder.sections')}
        </h2>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {sections.length === 0 ? (
          <p className="text-[11px] text-zinc-400 text-center px-3 py-8">
            {t('builder.noSections')}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={treeMode ? MEASURING : undefined}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={resetDrag}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {rows.map((row) => {
                if (row.kind === 'add') {
                  return (
                    <AddHereRow
                      key={`add:${row.parentId}`}
                      depth={row.depth}
                      containerLabel={labelFor(
                        items.find((i) => i.id === row.parentId)?.section_key ?? '',
                      )}
                      dimmed={!!activeId}
                      onClick={() => openAddInto(row.parentId, row.index)}
                    />
                  );
                }
                const item = row.item;
                const isActive = item.id === activeId;
                const depth = isActive && projection && treeMode ? projection.depth : item.depth;
                return (
                  <SortableSectionRow
                    key={item.id}
                    id={item.id}
                    depth={depth}
                    section={item.section}
                    contentLocale={contentLocale}
                    primaryLocale={primaryLocale}
                    selected={selectedId === item.id}
                    isContainer={item.isContainer}
                    childCount={item.childCount}
                    treeMode={treeMode}
                    collapsed={collapsed.has(item.id)}
                    invalid={
                      isActive && !!projection && !isDropAllowed(activeItem, projection, { allowNewParent: containersOn })
                    }
                    onSelect={() => onSelect(item.id)}
                    onToggleCollapse={item.isContainer ? () => toggleCollapsed(item.id) : undefined}
                    onToggleHidden={() => onToggleHidden(item.id, !item.section.is_hidden)}
                    onDuplicate={() => onDuplicate(item.id)}
                  />
                );
              })}
            </SortableContext>
            {/* Tree pages drag an overlay so the in-list row can show the
                projected depth; flat pages move the row itself, as before. */}
            {treeMode &&
              typeof document !== 'undefined' &&
              createPortal(
                <DragOverlay>
                  {overlaySection ? (
                    <SectionRowView
                      section={overlaySection}
                      contentLocale={contentLocale}
                      primaryLocale={primaryLocale}
                      isContainer={activeItem?.isContainer}
                      childCount={activeItem?.childCount}
                      treeMode
                      overlay
                    />
                  ) : null}
                </DragOverlay>,
                document.body,
              )}
          </DndContext>
        )}
      </div>

      <div className="p-2 border-t">
        <AddSectionDialog
          pageType={pageType}
          onAdd={onAdd}
          onAddPreset={onAddPreset}
          target={insertTarget}
          sections={sections}
          layoutContainers={containersOn}
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
        />
      </div>
    </div>
  );
}

export default SectionList;
