'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BulkResult } from '@/lib/bulk';
import { RowCheckbox } from './RowCheckbox';
import type { TableSelection } from './useTableSelection';

/**
 * Selection bar for hand-built tables; same look as the DataTable bulk bar.
 * Render it as the first child of the table card while `count > 0`.
 */
export function TableSelectionBar({
  selection,
  children,
}: {
  selection: TableSelection;
  children?: ReactNode;
}) {
  const t = useTranslations('table');
  if (selection.count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-zinc-50">
      <span className="text-sm font-medium tabular-nums">{t('selectedCount', { count: selection.count })}</span>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={selection.clear}>
        <X className="w-3.5 h-3.5" />
        {t('clearSelection')}
      </Button>
      {children && <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Header checkbox: selects every visible row (indeterminate when partial). */
export function SelectAllCheckbox({ selection }: { selection: TableSelection }) {
  const t = useTranslations('table');
  return (
    <RowCheckbox
      checked={selection.allSelected}
      indeterminate={selection.someSelected}
      disabled={selection.empty}
      onChange={selection.toggleAll}
      aria-label={t('selectAll')}
    />
  );
}

/** Per-row checkbox. Put it in a cell with `data-row-click-ignore`. */
export function SelectRowCheckbox({ selection, id }: { selection: TableSelection; id: string }) {
  const t = useTranslations('table');
  return (
    <RowCheckbox checked={selection.isSelected(id)} onChange={() => selection.toggle(id)} aria-label={t('selectRow')} />
  );
}

export interface BulkNoticeValue {
  tone: 'success' | 'warning';
  text: string;
}

/** Turns a runBulk result into a short message ("3 done" / "2 succeeded, 1 failed: ..."). */
export function useBulkSummary() {
  const t = useTranslations('bulk');
  return <T,>(result: BulkResult<T>): BulkNoticeValue => {
    if (result.failed.length === 0) return { tone: 'success', text: t('allDone', { count: result.ok.length }) };
    const first = result.failed[0]?.error;
    const text = t('partial', { ok: result.ok.length, failed: result.failed.length });
    return { tone: 'warning', text: first ? `${text} ${t('firstError', { error: first })}` : text };
  };
}

/** Dismissible result line shown above a table after a bulk action. */
export function BulkNotice({
  notice,
  onDismiss,
  className = '',
}: {
  notice: BulkNoticeValue | null;
  onDismiss: () => void;
  className?: string;
}) {
  const tc = useTranslations('common');
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-xs ${className} ${
        notice.tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      <span className="min-w-0 break-words">{notice.text}</span>
      <button type="button" onClick={onDismiss} aria-label={tc('close')} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
