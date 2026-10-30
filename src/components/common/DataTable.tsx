'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { pageWindow } from './pageWindow';
import { RowCheckbox } from './RowCheckbox';
import { isRowClickIgnored } from './rowClick';

interface Column<T> {
  key: string;
  label: string;
  className?: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  emptyMessage?: string;
  actions?: React.ReactNode;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  /** Stable row id; required for selection (falls back to `row.id`). */
  getRowId?: (row: T) => string;
  /** Show row checkboxes + a select-all checkbox (current page). */
  selectable?: boolean;
  /**
   * Actions shown in the bar that replaces the toolbar while rows are selected.
   * `clear` resets the selection (call it after a successful bulk action).
   */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  /**
   * Clicking anywhere on the row opens this URL (Ctrl/Cmd/middle click = new tab).
   * Clicks on links, buttons, inputs and elements with data-row-click-ignore are
   * left alone, so render the primary cell as a real <Link> for keyboard users.
   */
  rowHref?: (row: T) => string | null | undefined;
  /** Row click handler for items that open in a dialog (same ignore rules as rowHref). */
  onRowClick?: (row: T) => void;
}

/** Read a cell by column key. Rows are plain objects; column keys index them by name. */
const cellValue = (row: object, key: string): unknown =>
  (row as Record<string, unknown>)[key];

export function DataTable<T extends object>({
  columns,
  data,
  searchPlaceholder,
  onSearch,
  emptyMessage,
  actions,
  pagination,
  onPageChange,
  onSort,
  getRowId,
  selectable,
  bulkActions,
  rowHref,
  onRowClick,
}: DataTableProps<T>) {
  const router = useRouter();
  const rowId = (row: T): string =>
    getRowId ? getRowId(row) : String(cellValue(row, 'id') ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const t = useTranslations('table');
  const placeholder = searchPlaceholder ?? t('searchPlaceholder');
  const empty = emptyMessage ?? t('noData');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSearch = (value: string) => {
    setSearch(value);
    onSearch?.(value);
  };

  const handleSort = (key: string) => {
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSort?.(key, newDir);
  };

  // Client-side sort when no onSort handler
  let sortedData = data;
  if (sortKey && !onSort) {
    sortedData = [...data].sort((a, b) => {
      const aVal = (cellValue(a, sortKey) ?? '') as string | number;
      const bVal = (cellValue(b, sortKey) ?? '') as string | number;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Selection is scoped to the rows on screen; ids that left the data
  // (deleted, filtered out, other page) are dropped automatically.
  const selectedRows = selectable ? sortedData.filter((row) => selected.has(rowId(row))) : [];
  const allSelected = sortedData.length > 0 && selectedRows.length === sortedData.length;
  const someSelected = selectedRows.length > 0 && !allSelected;
  const clearSelection = () => setSelected(new Set());
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sortedData.map(rowId)));
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const goToPage = (p: number) => {
    clearSelection();
    onPageChange?.(p);
  };
  const colCount = columns.length + (selectable ? 1 : 0);

  const openRow = (e: React.MouseEvent<HTMLTableRowElement>, href: string) => {
    if (isRowClickIgnored(e)) return;
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    router.push(href);
  };

  return (
    <Card className="shadow-none">
      {/* Bulk bar replaces the toolbar while rows are selected */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-zinc-50">
          <span className="text-sm font-medium tabular-nums">
            {t('selectedCount', { count: selectedRows.length })}
          </span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearSelection}>
            <X className="w-3.5 h-3.5" />
            {t('clearSelection')}
          </Button>
          {bulkActions && (
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {bulkActions(selectedRows, clearSelection)}
            </div>
          )}
        </div>
      )}
      {/* Toolbar */}
      {selectedRows.length === 0 && (onSearch || actions) && (
        <div className="flex items-center justify-between p-4 border-b">
          {onSearch && (
            <Input
              type="search"
              placeholder={placeholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead className="w-10 h-10">
                <RowCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={sortedData.length === 0}
                  onChange={toggleAll}
                  aria-label={t('selectAll')}
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10 ${col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''} ${col.className || ''}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    sortKey === col.key
                      ? sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      : <ArrowUpDown className="w-3 h-3 opacity-30" />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-32 text-center text-muted-foreground text-sm">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((item, idx) => {
              const id = rowId(item);
              const isSelected = selectable && selected.has(id);
              const href = rowHref?.(item) || null;
              return (
              <TableRow
                key={id || idx}
                data-state={isSelected ? 'selected' : undefined}
                className={href || onRowClick ? 'cursor-pointer' : undefined}
                onClick={
                  href
                    ? (e) => openRow(e, href)
                    : onRowClick
                      ? (e) => { if (!isRowClickIgnored(e)) onRowClick(item); }
                      : undefined
                }
                onAuxClick={href ? (e) => { if (e.button === 1) openRow(e, href); } : undefined}
              >
                {selectable && (
                  <TableCell className="w-10 py-3" data-row-click-ignore>
                    <RowCheckbox
                      checked={!!isSelected}
                      onChange={() => toggleRow(id)}
                      aria-label={t('selectRow')}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-sm py-3">
                    {col.render ? col.render(item) : (cellValue(item, col.key) as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            {t('showingRange', {
              from: ((pagination.page - 1) * pagination.limit) + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            </Button>
            {pageWindow(pagination.page, pagination.totalPages).map((pageNum, i) =>
              pageNum === null ? (
                <span key={'gap-' + i} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={pageNum}
                  variant={pagination.page === pageNum ? 'default' : 'outline'}
                  size="icon"
                  className="h-7 min-w-7 w-auto px-1.5 text-xs tabular-nums"
                  aria-current={pagination.page === pageNum ? 'page' : undefined}
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
