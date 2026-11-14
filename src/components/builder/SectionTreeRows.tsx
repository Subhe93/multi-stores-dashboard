'use client';

// Row components of the builder's tree section list (SectionList.tsx).
// - SortableSectionRow: a draggable section (leaf or layout container).
// - SectionRowView: the row's look, shared with the drag overlay.
// - AddHereRow: the "+ add here" slot at the end of an expanded container.

import type { CSSProperties, HTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Plus,
  Rows3,
} from 'lucide-react';
import { findSectionSchema } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';
import { SectionPreview } from './SectionPreviews';
import { useUiLabel } from './useUiLabel';
import type { SectionInstance } from './types';

/** Horizontal indent per tree level, in px (also the drag step to nest). */
export const TREE_INDENT_PX = 16;

function indentStyle(depth: number): CSSProperties | undefined {
  return depth > 1 ? { paddingInlineStart: (depth - 1) * TREE_INDENT_PX } : undefined;
}

/** Layout icon of a container row (shown in the thumbnail slot). */
function ContainerIcon({ sectionKey, className }: { sectionKey: string; className?: string }) {
  if (sectionKey === 'layout-row') return <Columns3 className={className} />;
  if (sectionKey === 'layout-grid') return <LayoutGrid className={className} />;
  return <Rows3 className={className} />;
}

interface RowViewProps {
  section: SectionInstance;
  /** Store-content locale being edited (picks the content preview row). */
  contentLocale: string;
  primaryLocale: string;
  selected?: boolean;
  isContainer?: boolean;
  childCount?: number;
  /** Tree pages reserve room for the collapse chevron so rows line up. */
  treeMode?: boolean;
  collapsed?: boolean;
  /** Drag placeholder (the row's projected landing spot). */
  ghost?: boolean;
  /** The projected landing spot breaks the nesting rules. */
  invalid?: boolean;
  /** Rendered inside the DragOverlay (no actions). */
  overlay?: boolean;
  handleProps?: HTMLAttributes<HTMLButtonElement>;
  onSelect?: () => void;
  onToggleCollapse?: () => void;
  onToggleHidden?: () => void;
  onDuplicate?: () => void;
}

export function SectionRowView({
  section,
  contentLocale,
  primaryLocale,
  selected = false,
  isContainer = false,
  childCount = 0,
  treeMode = false,
  collapsed = false,
  ghost = false,
  invalid = false,
  overlay = false,
  handleProps,
  onSelect,
  onToggleCollapse,
  onToggleHidden,
  onDuplicate,
}: RowViewProps) {
  const t = useTranslations();
  const uiLabel = useUiLabel();
  const schema = findSectionSchema(section.section_key);
  // Section type name is dashboard chrome: UI locale, not the content locale.
  const title = schema ? uiLabel(schema.label) : section.section_key;
  // Localized category name — shown as a muted suffix under the title when
  // the section has no content preview text, so empty rows still get context.
  const categoryKey = schema
    ? (`builder.cat${schema.category.charAt(0).toUpperCase()}${schema.category.slice(1)}` as Parameters<typeof t>[0])
    : null;
  const categoryLabel = categoryKey && t.has(categoryKey) ? t(categoryKey) : '';

  // Show a short preview from the current locale's content (or primary fallback).
  const content =
    section.translations.find((tr) => tr.locale === contentLocale)?.content ??
    section.translations.find((tr) => tr.locale === primaryLocale)?.content ??
    {};
  const previewText = String(content.heading || content.html || '')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 40);
  const subtitle = isContainer
    ? t('builder.sectionChildCount', { count: childCount })
    : previewText || categoryLabel;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md border bg-white text-start transition',
        selected ? 'border-zinc-900 ring-1 ring-zinc-900/10 shadow-sm' : 'border-zinc-200 hover:border-zinc-300',
        ghost && 'opacity-50',
        ghost && treeMode && 'border-dashed border-indigo-400',
        ghost && invalid && 'border-dashed border-red-400 bg-red-50',
        overlay && 'shadow-lg border-zinc-300',
        section.is_hidden && 'opacity-60',
      )}
      title={ghost && invalid ? t('builder.cannotDropHere') : undefined}
    >
      <button
        type="button"
        className="px-1 py-2 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing"
        {...handleProps}
        aria-label={t('builder.reorder')}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {treeMode &&
        (isContainer ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            disabled={!onToggleCollapse}
            className="-mx-1 p-0.5 text-zinc-400 hover:text-zinc-700 rounded"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('builder.expandSection') : t('builder.collapseSection')}
            title={collapsed ? t('builder.expandSection') : t('builder.collapseSection')}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="-mx-1 w-[18px] shrink-0" aria-hidden />
        ))}
      <div
        className={cn(
          'size-8 rounded border overflow-hidden shrink-0',
          isContainer
            ? 'border-indigo-100 bg-indigo-50 text-indigo-600 flex items-center justify-center'
            : 'border-zinc-100 bg-zinc-50',
        )}
        aria-hidden
      >
        {isContainer ? (
          <ContainerIcon sectionKey={section.section_key} className="w-4 h-4" />
        ) : (
          <SectionPreview sectionKey={section.section_key} className="w-full h-full" />
        )}
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 py-2 pe-2 text-start"
        aria-current={selected ? 'true' : undefined}
      >
        <div className="text-xs font-medium truncate">{title}</div>
        {subtitle ? <div className="text-[10px] text-zinc-400 truncate">{subtitle}</div> : null}
      </button>
      {!overlay && (
        <>
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 text-zinc-300 hover:text-zinc-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
            aria-label={t('builder.duplicateSection')}
            title={t('builder.duplicateSection')}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleHidden}
            className="p-1.5 text-zinc-300 hover:text-zinc-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
            aria-label={section.is_hidden ? t('builder.show') : t('builder.hide')}
          >
            {section.is_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </>
      )}
    </div>
  );
}

interface SortableRowProps extends Omit<RowViewProps, 'handleProps' | 'ghost' | 'overlay'> {
  id: string;
  depth: number;
}

export function SortableSectionRow({ id, depth, ...view }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...indentStyle(depth),
  };
  return (
    <div ref={setNodeRef} style={style}>
      <SectionRowView
        {...view}
        ghost={isDragging}
        handleProps={{ ...attributes, ...listeners } as HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  );
}

export function AddHereRow({
  depth,
  containerLabel,
  dimmed = false,
  onClick,
}: {
  depth: number;
  containerLabel: string;
  dimmed?: boolean;
  onClick: () => void;
}) {
  const t = useTranslations();
  return (
    <div style={indentStyle(depth)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-1.5 rounded-md border border-dashed border-zinc-200 px-2 py-1 text-[11px] text-zinc-400 transition hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50',
          dimmed && 'opacity-40',
        )}
        aria-label={t('builder.addHereInto', { name: containerLabel })}
        title={t('builder.addHereInto', { name: containerLabel })}
      >
        <Plus className="w-3 h-3" />
        {t('builder.addHere')}
      </button>
    </div>
  );
}
