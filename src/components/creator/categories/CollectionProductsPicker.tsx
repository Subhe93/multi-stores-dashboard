'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, LayoutGrid, List, Package, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveMediaUrl } from '@/lib/media';
import { useCurrency } from '@/lib/useCurrency';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollectionProductOption {
  /** Prefixed id: `p:<id>` for own products, `cp:<id>` for custom products. */
  id: string;
  title: string;
  kind: 'own' | 'custom';
  thumbnail?: string | null;
  /** SKU and/or slug, shown as the secondary line. */
  subtitle?: string | null;
  price?: number | null;
  /** ProductStatus (PUBLISHED, DRAFT, ...) when the API returns it. */
  status?: string | null;
}

type ViewMode = 'list' | 'grid';

interface Props {
  options: CollectionProductOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = 'collection-products-view';
/** Items rendered per "Show more" step, so large selections stay light. */
const PAGE_SIZE = 60;

// Same palette as the product lists, so ProductStatus reads identically.
const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const STATUS_KEYS: Record<string, string> = {
  PUBLISHED: 'creator.myProducts.statusPublished',
  DRAFT: 'creator.myProducts.statusDraft',
  PENDING_REVIEW: 'creator.myProducts.statusPendingReview',
  REJECTED: 'creator.myProducts.statusRejected',
  ARCHIVED: 'creator.myProducts.statusArchived',
};

const GRID_CLASSES = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5';
const DIALOG_GRID_CLASSES = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

// ── View-mode persistence ─────────────────────────────────────────────────────

function readStoredView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>('list');
  // Read after mount so the server render and the first client render match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    setView(readStoredView());
  }, []);
  const update = (v: ViewMode) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // Storage unavailable (private mode, blocked site data): keep in memory only.
    }
  };
  return [view, update];
}

// ── Small pieces ──────────────────────────────────────────────────────────────

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const t = useTranslations();
  const items: { mode: ViewMode; label: string; Icon: typeof List }[] = [
    { mode: 'list', label: t('category.viewList'), Icon: List },
    { mode: 'grid', label: t('category.viewGrid'), Icon: LayoutGrid },
  ];
  return (
    <div
      role="group"
      aria-label={t('category.viewMode')}
      className="inline-flex shrink-0 items-center rounded-md border border-zinc-200 bg-white p-0.5"
    >
      {items.map(({ mode, label, Icon }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(mode)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function Thumb({ src, className }: { src?: string | null; className?: string }) {
  const url = resolveMediaUrl(src);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- media is served by the API host
    <img src={url} alt="" loading="lazy" className={cn('object-cover', className)} />
  ) : (
    <div className={cn('flex items-center justify-center bg-zinc-100', className)}>
      <Package className="size-1/3 max-h-6 max-w-6 text-zinc-400" />
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const t = useTranslations();
  if (!status) return null;
  return (
    <span
      className={cn(
        'inline-flex h-4.5 shrink-0 items-center rounded-full border px-1.5 text-[10px] font-medium',
        STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200',
      )}
    >
      {STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}
    </span>
  );
}

function ShowMore({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  const t = useTranslations();
  if (remaining <= 0) return null;
  return (
    <div className="flex justify-center pt-1">
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        {t('category.showMoreProducts', { count: remaining })}
      </Button>
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-md border border-zinc-200 bg-white">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5">
          <Skeleton className="size-11 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GridSkeleton({ count = 10, className }: { count?: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-1.5 p-2">
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Manual product selection for a collection: the selected products in a list
 * or grid view (choice remembered per browser), plus an "Add products" dialog
 * whose results use the same view and toggle inclusion on click.
 */
export function CollectionProductsPicker({ options, value, onChange, loading = false }: Props) {
  const t = useTranslations();
  const { fmt } = useCurrency();
  const [view, setView] = useViewMode();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [pickerOpen, setPickerOpen] = useState(false);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const shown = value.slice(0, visible);
  const priceText = (o: CollectionProductOption) =>
    o.price !== null && o.price !== undefined && Number.isFinite(o.price) ? fmt(o.price) : null;
  const kindLabel = (o: CollectionProductOption) =>
    o.kind === 'own' ? t('bundle.ownSuffix') : t('bundle.customSuffix');

  // ── Selected: list rows ────────────────────────────────────────────────────

  const renderRow = (id: string) => {
    const o = byId.get(id);
    const name = o?.title ?? t('category.productUnavailable');
    const price = o ? priceText(o) : null;
    return (
      <li key={id} className="group flex items-center gap-3 p-2.5">
        <Thumb src={o?.thumbnail} className="size-11 shrink-0 rounded-md border border-zinc-100" />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium', !o && 'text-muted-foreground italic')}>
            {name}
          </p>
          {o && (
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {price && <span className="tabular-nums font-medium text-zinc-700">{price}</span>}
              <span>{kindLabel(o)}</span>
              {o.subtitle && <span className="max-w-[16rem] truncate">{o.subtitle}</span>}
              <StatusBadge status={o.status} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => remove(id)}
          aria-label={t('bundle.removeNamed', { name })}
          title={t('bundle.removeNamed', { name })}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </li>
    );
  };

  // ── Selected: grid cards ───────────────────────────────────────────────────

  const renderCard = (id: string) => {
    const o = byId.get(id);
    const name = o?.title ?? t('category.productUnavailable');
    const price = o ? priceText(o) : null;
    return (
      <li
        key={id}
        className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white transition hover:border-zinc-300 hover:shadow-sm"
      >
        <Thumb src={o?.thumbnail} className="aspect-square w-full" />
        <div className="space-y-1 p-2">
          <p
            className={cn('line-clamp-2 text-xs font-medium leading-snug', !o && 'text-muted-foreground italic')}
            title={name}
          >
            {name}
          </p>
          {o && (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              {price && <span className="tabular-nums font-medium text-zinc-700">{price}</span>}
              <StatusBadge status={o.status} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => remove(id)}
          aria-label={t('bundle.removeNamed', { name })}
          title={t('bundle.removeNamed', { name })}
          className={cn(
            'absolute top-1.5 inset-e-1.5 inline-flex size-7 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition',
            'hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            // Hidden until hover on pointer devices; always visible on touch and keyboard focus.
            'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <X className="size-3.5" />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-700">
          {t('category.selectedProducts')}{' '}
          <span className="font-normal text-muted-foreground">({value.length})</span>
        </p>
        <div className="flex items-center gap-2">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-red-500 hover:underline"
            >
              {t('bundle.clearAll')}
            </button>
          )}
          <ViewModeToggle value={view} onChange={setView} />
          <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus className="size-3.5" />
            {t('category.addProducts')}
          </Button>
        </div>
      </div>

      {/* Selected products */}
      {loading && value.length > 0 ? (
        view === 'grid' ? (
          <GridSkeleton count={Math.min(value.length, 10)} className={GRID_CLASSES} />
        ) : (
          <ListSkeleton rows={Math.min(value.length, 5)} />
        )
      ) : value.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white px-4 py-8 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100">
            <Package className="size-5 text-zinc-400" />
          </div>
          <p className="text-sm font-medium">{t('category.noProductsSelected')}</p>
          <p className="text-[11px] text-muted-foreground">{t('category.noProductsSelectedHint')}</p>
          <Button type="button" size="sm" className="mt-1" onClick={() => setPickerOpen(true)}>
            <Plus className="size-3.5" />
            {t('category.addProducts')}
          </Button>
        </div>
      ) : view === 'grid' ? (
        <ul className={GRID_CLASSES}>{shown.map(renderCard)}</ul>
      ) : (
        <ul className="divide-y rounded-md border border-zinc-200 bg-white">{shown.map(renderRow)}</ul>
      )}

      {!loading && (
        <ShowMore
          remaining={value.length - shown.length}
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        />
      )}

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        options={options}
        value={value}
        onChange={onChange}
        loading={loading}
        view={view}
        onViewChange={setView}
        priceText={priceText}
        kindLabel={kindLabel}
      />
    </div>
  );
}

// ── Picker dialog ─────────────────────────────────────────────────────────────

function ProductPickerDialog({
  open,
  onOpenChange,
  options,
  value,
  onChange,
  loading,
  view,
  onViewChange,
  priceText,
  kindLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: CollectionProductOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  priceText: (o: CollectionProductOption) => string | null;
  kindLabel: (o: CollectionProductOption) => string;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? options.filter(
            (o) => o.title.toLowerCase().includes(q) || (o.subtitle ?? '').toLowerCase().includes(q),
          )
        : options,
    [options, q],
  );
  const shown = filtered.slice(0, visible);

  const toggle = (id: string) =>
    onChange(selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      setVisible(PAGE_SIZE);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[85vh] flex-col gap-3 p-0',
          view === 'grid' ? 'sm:max-w-4xl' : 'sm:max-w-2xl',
        )}
      >
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{t('category.addProductsTitle')}</DialogTitle>
          <DialogDescription>{t('category.addProductsHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 inset-s-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder={t('bundle.searchProducts')}
              aria-label={t('bundle.searchProducts')}
              className="h-9 w-full rounded-md border border-input bg-background ps-8 pe-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ViewModeToggle value={view} onChange={onViewChange} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">
          {loading ? (
            view === 'grid' ? (
              <GridSkeleton count={10} className={DIALOG_GRID_CLASSES} />
            ) : (
              <ListSkeleton rows={6} />
            )
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Package className="size-6 text-zinc-300" />
              <p className="text-xs text-muted-foreground">{t('bundle.noProductsFound')}</p>
            </div>
          ) : view === 'grid' ? (
            <div className={DIALOG_GRID_CLASSES}>
              {shown.map((o) => {
                const isSel = selectedSet.has(o.id);
                const price = priceText(o);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      'group relative overflow-hidden rounded-lg border bg-white text-start transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSel
                        ? 'border-zinc-900 ring-1 ring-zinc-900'
                        : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm',
                    )}
                  >
                    <Thumb src={o.thumbnail} className="aspect-square w-full" />
                    <span
                      className={cn(
                        'absolute top-1.5 inset-e-1.5 flex size-5 items-center justify-center rounded-full border transition',
                        isSel
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-300 bg-white/90 text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="size-3" />
                    </span>
                    <span className="block space-y-1 p-2">
                      <span className="line-clamp-2 text-xs font-medium leading-snug" title={o.title}>
                        {o.title}
                      </span>
                      <span className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        {price && <span className="tabular-nums font-medium text-zinc-700">{price}</span>}
                        <StatusBadge status={o.status} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="divide-y rounded-md border border-zinc-200">
              {shown.map((o) => {
                const isSel = selectedSet.has(o.id);
                const price = priceText(o);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      'flex w-full items-center gap-3 p-2.5 text-start transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      isSel ? 'bg-zinc-50' : 'hover:bg-zinc-50/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border transition',
                        isSel ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="size-3" />
                    </span>
                    <Thumb src={o.thumbnail} className="size-10 shrink-0 rounded-md border border-zinc-100" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.title}</span>
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        {price && <span className="tabular-nums font-medium text-zinc-700">{price}</span>}
                        <span>{kindLabel(o)}</span>
                        {o.subtitle && <span className="max-w-[16rem] truncate">{o.subtitle}</span>}
                        <StatusBadge status={o.status} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && (
            <div className="py-3">
              <ShowMore
                remaining={filtered.length - shown.length}
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="m-0 flex-row items-center justify-between gap-2 rounded-b-xl border-t bg-zinc-50/70 px-5 py-3 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {t('bundle.selectedCount', { count: value.length })}
          </span>
          <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
            {t('category.doneSelecting')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
