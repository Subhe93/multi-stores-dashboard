'use client';

import { useState } from 'react';
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
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  onSearch,
  emptyMessage = 'No data found',
  actions,
  pagination,
  onPageChange,
  onSort,
}: DataTableProps<T>) {
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
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return (
    <Card className="shadow-none">
      {/* Toolbar */}
      {(onSearch || actions) && (
        <div className="flex items-center justify-between p-4 border-b">
          {onSearch && (
            <Input
              type="search"
              placeholder={searchPlaceholder}
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
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground text-sm">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((item, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-sm py-3">
                    {col.render ? col.render(item) : item[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={pagination.page === pageNum ? 'default' : 'outline'}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => onPageChange?.(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            {pagination.totalPages > 5 && <span className="text-xs text-muted-foreground px-1">...</span>}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
