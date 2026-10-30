'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { isRowClickIgnored } from './rowClick';

/**
 * Row selection for hand-built tables (same rules as DataTable): the
 * selection is scoped to `rows`, so ids that left the list (deleted,
 * filtered out, other page) drop out automatically.
 */
export function useTableSelection<T>(rows: T[], getId: (row: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedRows = rows.filter((row) => selected.has(getId(row)));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const someSelected = selectedRows.length > 0 && !allSelected;

  const clear = useCallback(() => setSelected(new Set()), []);
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(getId)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return {
    selectedRows,
    count: selectedRows.length,
    isSelected: (id: string) => selected.has(id),
    allSelected,
    someSelected,
    empty: rows.length === 0,
    toggle,
    toggleAll,
    clear,
  };
}

export type TableSelection = ReturnType<typeof useTableSelection>;

/**
 * Row-open handlers for hand-built tables. `linkRow(href)` navigates (Ctrl/Cmd
 * or middle click opens a new tab); `actionRow(fn)` runs a callback (e.g. an
 * edit dialog). Clicks on links, buttons, inputs and [data-row-click-ignore]
 * are left alone, as is text selection.
 */
export function useRowOpen() {
  const router = useRouter();

  const open = (e: MouseEvent<HTMLElement>, href: string) => {
    if (isRowClickIgnored(e)) return;
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    router.push(href);
  };

  const linkRow = (href: string | null | undefined) =>
    href
      ? {
          className: 'cursor-pointer',
          onClick: (e: MouseEvent<HTMLElement>) => open(e, href),
          onAuxClick: (e: MouseEvent<HTMLElement>) => {
            if (e.button === 1) open(e, href);
          },
        }
      : {};

  const actionRow = (fn: (() => void) | null | undefined) =>
    fn
      ? {
          className: 'cursor-pointer',
          onClick: (e: MouseEvent<HTMLElement>) => {
            if (!isRowClickIgnored(e)) fn();
          },
        }
      : {};

  return { linkRow, actionRow };
}
