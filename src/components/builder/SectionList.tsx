'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { findSectionSchema, labelOf } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';
import { AddSectionDialog } from './AddSectionDialog';
import { SectionPreview } from './SectionPreviews';
import type { SectionInstance } from './types';

interface SectionListProps {
  sections: SectionInstance[];
  selectedId: string | null;
  locale: string;
  primaryLocale: string;
  pageType: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER';
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAdd: (sectionKey: string) => Promise<void> | void;
  onToggleHidden: (id: string, hidden: boolean) => void;
}

export function SectionList({
  sections,
  selectedId,
  locale,
  primaryLocale,
  pageType,
  onSelect,
  onReorder,
  onAdd,
  onToggleHidden,
}: SectionListProps) {
  const t = useTranslations();
  const sensors = useSensors(
    // 5px activation threshold so a click on a row still fires `onSelect` —
    // without it dnd-kit would swallow the click as a drag start.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sections, oldIndex, newIndex);
    onReorder(next.map((s) => s.id));
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t('builder.sections')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sections.length === 0 ? (
          <p className="text-[11px] text-zinc-400 text-center px-3 py-8">
            {t('builder.noSections')}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  selected={selectedId === section.id}
                  locale={locale}
                  primaryLocale={primaryLocale}
                  onSelect={() => onSelect(section.id)}
                  onToggleHidden={() => onToggleHidden(section.id, !section.is_hidden)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="p-2 border-t">
        <AddSectionDialog locale={locale} pageType={pageType} onAdd={onAdd} />
      </div>
    </div>
  );
}

function SectionRow({
  section,
  selected,
  locale,
  primaryLocale,
  onSelect,
  onToggleHidden,
}: {
  section: SectionInstance;
  selected: boolean;
  locale: string;
  primaryLocale: string;
  onSelect: () => void;
  onToggleHidden: () => void;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const schema = findSectionSchema(section.section_key);
  const title = schema ? labelOf(schema.label, locale) : section.section_key;

  // Show a short preview from the current locale's content (or primary fallback).
  const content =
    section.translations.find((t) => t.locale === locale)?.content ??
    section.translations.find((t) => t.locale === primaryLocale)?.content ??
    {};
  const previewText = String(content.heading || content.html || '')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 40);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-md border bg-white text-left transition',
        selected ? 'border-zinc-900 ring-1 ring-zinc-900/10 shadow-sm' : 'border-zinc-200 hover:border-zinc-300',
        isDragging && 'opacity-50',
        section.is_hidden && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="px-1 py-2 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={t('builder.reorder')}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div
        className="size-8 rounded border border-zinc-100 bg-zinc-50 overflow-hidden shrink-0"
        aria-hidden
      >
        <SectionPreview sectionKey={section.section_key} className="w-full h-full" />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 py-2 pr-2 text-left"
      >
        <div className="text-xs font-medium truncate">{title}</div>
        {previewText && (
          <div className="text-[10px] text-zinc-400 truncate">{previewText}</div>
        )}
      </button>
      <button
        type="button"
        onClick={onToggleHidden}
        className="p-1.5 text-zinc-300 hover:text-zinc-700 opacity-0 group-hover:opacity-100 transition"
        aria-label={section.is_hidden ? t('builder.show') : t('builder.hide')}
      >
        {section.is_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
