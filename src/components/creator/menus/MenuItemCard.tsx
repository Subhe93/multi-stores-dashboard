'use client';

// One sortable, collapsible menu item card. The header shows the drag grip,
// label, kind badge and indent/outdent/expand controls; the body edits the
// label (per locale tab), URL, new-tab flag and offers removal. Depth guides
// are drawn as vertical lines in the leading gutter so nesting reads at a
// glance.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Link2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SameAsBaseChip, useTranslationPlaceholder } from '@/components/common/LocaleTabs';
import { labelFor, localeLabel, type MenuItemKind, type TreeItem } from './types';

export const INDENT_PX = 28;

const KIND_STYLES: Record<MenuItemKind, string> = {
  PAGE: 'bg-sky-50 text-sky-700 border-sky-200',
  COLLECTION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PRODUCT: 'bg-amber-50 text-amber-700 border-amber-200',
  CUSTOM: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

interface CardProps {
  node: TreeItem;
  depth: number;
  expanded: boolean;
  activeLocale: string;
  primaryLocale: string;
  locales: string[];
  canIndent: boolean;
  canOutdent: boolean;
  dragging: boolean; // some item is being dragged (collapse bodies for clarity)
  onToggle: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onLabel: (locale: string, value: string) => void;
  onUrl: (value: string) => void;
  onNewTab: (checked: boolean) => void;
  onConvertToCustom: () => void;
  onRemove: () => void;
}

export function MenuItemCard({
  node,
  depth,
  expanded,
  activeLocale,
  primaryLocale,
  locales,
  canIndent,
  canOutdent,
  dragging,
  onToggle,
  onIndent,
  onOutdent,
  onLabel,
  onUrl,
  onNewTab,
  onConvertToCustom,
  onRemove,
}: CardProps) {
  const t = useTranslations('creator.menus');
  const tc = useTranslations('common');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.cid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const kindLabel: Record<MenuItemKind, string> = {
    PAGE: t('kindPage'),
    COLLECTION: t('kindCollection'),
    PRODUCT: t('kindProduct'),
    CUSTOM: t('kindCustom'),
  };

  const translationPlaceholder = useTranslationPlaceholder();
  const isSecondary = activeLocale !== primaryLocale;
  const ownLabel = labelFor(node, activeLocale, primaryLocale);
  // Secondary locale with no translation yet: the header falls back to the
  // base label, flagged with a "Same as base" chip so it is not mistaken for
  // a translation.
  const fallsBackToBase = isSecondary && !ownLabel.trim() && !!node.label;
  const displayLabel = ownLabel || node.label || t('untitledItem');
  const isCustom = node.kind === 'CUSTOM';
  const showBody = expanded && !dragging;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingInlineStart: depth * INDENT_PX }}
      className={cn('relative', isDragging && 'z-10 opacity-70')}
    >
      {/* Depth guides: one vertical line per ancestor level. */}
      {Array.from({ length: depth }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-0 bottom-0 border-s-2 border-zinc-200 pointer-events-none"
          style={{ insetInlineStart: i * INDENT_PX + 12 }}
        />
      ))}
      {depth > 0 && (
        <span
          aria-hidden
          className="absolute top-5 border-t-2 border-zinc-200 pointer-events-none"
          style={{ insetInlineStart: (depth - 1) * INDENT_PX + 12, width: INDENT_PX - 12 }}
        />
      )}

      <div
        className={cn(
          'rounded-lg border bg-white transition-shadow',
          isDragging ? 'border-indigo-300 shadow-lg' : 'border-zinc-200',
          depth > 0 && 'bg-zinc-50/40',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="size-7 inline-flex items-center justify-center rounded text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 cursor-grab active:cursor-grabbing touch-none shrink-0"
            title={t('dragHandle')}
            aria-label={t('dragHandle')}
          >
            <GripVertical className="size-4" />
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="min-w-0 flex-1 flex items-center gap-2 text-start"
            aria-expanded={expanded}
          >
            <span className={cn('truncate text-[13px] font-medium', !node.label && 'text-zinc-400 italic', fallsBackToBase && 'text-zinc-500')}>
              {displayLabel}
            </span>
            {fallsBackToBase && <SameAsBaseChip className="shrink-0" />}
            <span
              className={cn(
                'shrink-0 rounded-full border px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide',
                KIND_STYLES[node.kind],
              )}
            >
              {kindLabel[node.kind]}
            </span>
            {node.children.length > 0 && (
              <span className="shrink-0 text-[10px] text-zinc-400">
                {t('childCount', { count: node.children.length })}
              </span>
            )}
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <IconButton onClick={onOutdent} disabled={!canOutdent} title={t('outdent')}>
              <ChevronLeft className="size-3.5 rtl:-scale-x-100" />
            </IconButton>
            <IconButton onClick={onIndent} disabled={!canIndent} title={t('indent')}>
              <ChevronRight className="size-3.5 rtl:-scale-x-100" />
            </IconButton>
            <IconButton onClick={onToggle} title={expanded ? t('collapse') : t('expand')}>
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
            </IconButton>
          </div>
        </div>

        {/* Body */}
        {showBody && (
          <div className="border-t border-zinc-100 px-3 py-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10.5px] text-zinc-500">
                  {t('label')}
                  {locales.length > 1 && (
                    <span className="ms-1 text-zinc-400">
                      · {localeLabel(activeLocale)}
                      {isSecondary && <span className="ms-1">({tc('locale.translation')})</span>}
                    </span>
                  )}
                  {fallsBackToBase && <SameAsBaseChip className="ms-1.5" />}
                </Label>
                <Input
                  className="h-8 text-[12.5px]"
                  value={ownLabel}
                  onChange={(e) => onLabel(activeLocale, e.target.value)}
                  placeholder={translationPlaceholder({
                    locale: activeLocale,
                    primaryLocale,
                    baseValue: node.label,
                    primaryPlaceholder: t('labelPlaceholder'),
                  })}
                  dir={activeLocale === 'ar' ? 'rtl' : undefined}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px] text-zinc-500">{t('url')}</Label>
                <Input
                  className={cn('h-8 text-[12.5px] font-mono', !isCustom && 'bg-zinc-50 text-zinc-500')}
                  value={node.url}
                  onChange={(e) => onUrl(e.target.value)}
                  readOnly={!isCustom}
                  placeholder="/products"
                />
                {!isCustom && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-[10.5px] text-zinc-400">{t('urlLinkedHint')}</p>
                    <button
                      type="button"
                      onClick={onConvertToCustom}
                      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-indigo-600 hover:text-indigo-700 shrink-0"
                    >
                      <Link2 className="size-3" />
                      {t('convertToCustom')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11.5px] text-zinc-600">
                <input
                  type="checkbox"
                  checked={!!node.open_in_new_tab}
                  onChange={(e) => onNewTab(e.target.checked)}
                  className="size-3.5"
                />
                <ExternalLink className="size-3 text-zinc-400" />
                {t('openInNewTab')}
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[11.5px] text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onRemove}
              >
                <Trash2 className="size-3.5" />
                {tc('remove')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="size-7 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition"
    >
      {children}
    </button>
  );
}
