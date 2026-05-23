'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, X, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductOption {
  id: string;
  name: string;
  thumbnail?: string | null;
  /** Reference unit price used by the bundle preview. */
  unitPrice?: number;
  /** SINGLE / PER_VARIANT / MARGIN — only meaningful for custom products. */
  pricingType?: 'SINGLE' | 'PER_VARIANT' | 'MARGIN';
}

interface Props {
  options: ProductOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  loading?: boolean;
}

export function ProductMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  loading = false,
}: Props) {
  const t = useTranslations();
  const placeholderText = placeholder ?? t('bundle.searchAndPickProducts');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 360,
    placement: 'bottom' as 'bottom' | 'top',
  });
  const triggerRef = useRef<HTMLDivElement>(null);

  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is ProductOption => Boolean(o));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
    : options;

  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const desired = 360;
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const placeBelow = spaceBelow >= Math.min(desired, 200) || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(180, Math.min(desired, placeBelow ? spaceBelow : spaceAbove));
      const top = placeBelow ? r.bottom + 4 : Math.max(margin, r.top - 4 - maxHeight);
      const width = Math.max(r.width, 360);
      const left = Math.min(
        Math.max(margin, r.left),
        Math.max(margin, window.innerWidth - width - margin),
      );
      setPos({ top, left, width, maxHeight, placement: placeBelow ? 'bottom' : 'top' });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="relative" ref={triggerRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        className={cn(
          'flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          open && 'ring-2 ring-ring ring-offset-1',
        )}
      >
        {selected.length === 0 ? (
          <span className="px-1 text-sm text-muted-foreground">{placeholderText}</span>
        ) : (
          selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium"
            >
              {p.thumbnail ? (
                <img
                  src={p.thumbnail}
                  alt=""
                  className="size-4 rounded object-cover"
                />
              ) : (
                <Package className="size-3 text-zinc-400" />
              )}
              <span className="max-w-[180px] truncate">{p.name}</span>
              <button
                type="button"
                className="ml-0.5 text-zinc-400 hover:text-zinc-700"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(p.id);
                }}
                aria-label={t('bundle.removeNamed', { name: p.name })}
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-40" />
      </div>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[9999] flex flex-col overflow-hidden rounded-lg border bg-popover shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b p-2 shrink-0">
              <input
                autoFocus
                type="text"
                placeholder={t('bundle.searchProducts')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t('common.loading')}
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t('bundle.noProductsFound')}
                </p>
              ) : (
                filtered.map((p) => {
                  const isSel = value.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition',
                        isSel ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                      )}
                    >
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="size-7 rounded object-cover"
                        />
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded bg-zinc-100">
                          <Package className="size-3.5 text-zinc-400" />
                        </div>
                      )}
                      <span className="flex-1 truncate">{p.name}</span>
                      <Check
                        className={cn(
                          'size-3.5 shrink-0',
                          isSel ? 'opacity-100 text-zinc-700' : 'opacity-0',
                        )}
                      />
                    </button>
                  );
                })
              )}
            </div>
            {value.length > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t bg-zinc-50/70 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">
                  {t('bundle.selectedCount', { count: value.length })}
                </span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  {t('bundle.clearAll')}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
