'use client';

// "Menu structure" column: the nested item tree rendered as one flat sortable
// list (dnd-kit) with depth-based indentation. Dragging reorders; while an
// item is dragged its descendants are hidden so the subtree moves as a unit
// and cannot be dropped into itself. Indent/outdent buttons on each card are
// the keyboard/touch-friendly way to nest (up to MENU_MAX_DEPTH levels).

import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { MenuItemCard } from './MenuItemCard';
import {
  canIndent,
  canOutdent,
  descendantCids,
  flattenTree,
  indentNode,
  moveNode,
  outdentNode,
  removeNode,
  updateNode,
  withLabel,
  type TreeItem,
} from './types';

interface StructureProps {
  items: TreeItem[];
  onChange: (next: TreeItem[]) => void;
  activeLocale: string;
  primaryLocale: string;
  locales: string[];
  // Newly added items start expanded so the user sees what landed.
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
}

export function MenuStructure({
  items,
  onChange,
  activeLocale,
  primaryLocale,
  locales,
  expanded,
  onExpandedChange,
}: StructureProps) {
  const t = useTranslations('creator.menus');
  const [activeCid, setActiveCid] = useState<string | null>(null);

  const sensors = useSensors(
    // Activation distance so clicks on the header still toggle the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rows = useMemo(() => flattenTree(items), [items]);

  // Hide the dragged item's subtree during a drag.
  const visibleRows = useMemo(() => {
    if (!activeCid) return rows;
    const active = rows.find((r) => r.node.cid === activeCid);
    if (!active) return rows;
    const hidden = descendantCids(active.node);
    return rows.filter((r) => !hidden.has(r.node.cid));
  }, [rows, activeCid]);

  function toggle(cid: string) {
    const next = new Set(expanded);
    if (next.has(cid)) next.delete(cid);
    else next.add(cid);
    onExpandedChange(next);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveCid(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCid(null);
    if (!over || active.id === over.id) return;
    const next = moveNode(items, String(active.id), String(over.id));
    if (next !== items) onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('structure')}</h3>
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-zinc-500 px-0.5">
        <Info className="size-3.5 mt-px shrink-0 text-zinc-400" />
        {t('structureHint')}
      </p>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-10 text-center">
          <p className="text-xs text-zinc-500">{t('noItemsYet')}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCid(null)}
        >
          <SortableContext items={visibleRows.map((r) => r.node.cid)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {visibleRows.map((r) => {
                const cid = r.node.cid;
                return (
                  <MenuItemCard
                    key={cid}
                    node={r.node}
                    depth={r.depth}
                    expanded={expanded.has(cid)}
                    activeLocale={activeLocale}
                    primaryLocale={primaryLocale}
                    locales={locales}
                    canIndent={canIndent(items, cid)}
                    canOutdent={canOutdent(items, cid)}
                    dragging={activeCid !== null}
                    onToggle={() => toggle(cid)}
                    onIndent={() => onChange(indentNode(items, cid))}
                    onOutdent={() => onChange(outdentNode(items, cid))}
                    onLabel={(locale, v) => onChange(updateNode(items, cid, (n) => withLabel(n, locale, primaryLocale, v)))}
                    onUrl={(v) => onChange(updateNode(items, cid, (n) => ({ ...n, url: v })))}
                    onNewTab={(checked) => onChange(updateNode(items, cid, (n) => ({ ...n, open_in_new_tab: checked })))}
                    onConvertToCustom={() =>
                      onChange(updateNode(items, cid, (n) => ({ ...n, kind: 'CUSTOM', resource_id: null })))
                    }
                    onRemove={() => onChange(removeNode(items, cid))}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
