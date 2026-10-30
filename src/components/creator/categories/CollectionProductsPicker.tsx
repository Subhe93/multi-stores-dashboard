'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  ArrowUpToLine,
  Check,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

/** Own product as returned by `/products/mine` and the collection detail. */
export interface OwnProductRow {
  id: string;
  base_price?: number | string;
  status?: string;
  sku?: string | null;
  translations?: { locale: string; title: string; slug?: string }[];
  images?: { url: string; is_featured?: boolean }[];
}

/** Custom product as returned by `/custom-products` and the collection detail. */
export interface CustomProductRow {
  id: string;
  final_price?: number | string;
  status?: string;
  sku?: string | null;
  translations?: { locale: string; title: string; slug?: string }[];
  mockup_images?: { url: string }[];
  product?: {
    base_price?: number | string;
    translations?: { locale: string; title: string }[];
    images?: { url: string }[];
  };
}

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ViewMode = 'list' | 'grid';
type Source = 'all' | 'own' | 'custom';

interface Props {
  /** Selected ids in their manual order (`p:` / `cp:` prefixed). */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Display data for products already seen (collection detail + search results). */
  known: Record<string, CollectionProductOption>;
  /** Called with every product the search loads, so the parent can cache it. */
  onDiscover: (options: CollectionProductOption[]) => void;
  token?: string | null;
  /** Locale used to pick the product title (store primary locale). */
  locale: string;
  /** Marketplace stores can also attach imported (custom) products. */
  includeCustom: boolean;
  loading?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = 'collection-products-view';
/** Selected items rendered per "Show more" step, so large selections stay light. */
const PAGE_SIZE = 60;
/** Server page size per product source in the add-products dialog. */
const SEARCH_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

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

// ── Row → option mapping (shared with CategoryForm) ───────────────────────────

function pickTranslation<T extends { locale: string }>(list: T[] | undefined, locale: string) {
  return list?.find((tr) => tr.locale === locale) || list?.[0];
}

function toNumber(v: number | string | undefined | null): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ownProductOption(
  p: OwnProductRow,
  locale: string,
  untitled: string,
): CollectionProductOption {
  const trans = pickTranslation(p.translations, locale);
  const featured = p.images?.find((img) => img.is_featured)?.url || p.images?.[0]?.url || null;
  return {
    id: `p:${p.id}`,
    title: trans?.title || untitled,
    kind: 'own',
    thumbnail: featured,
    subtitle: [p.sku, trans?.slug].filter(Boolean).join(' · ') || null,
    price: toNumber(p.base_price),
    status: p.status ?? null,
  };
}

export function customProductOption(
  cp: CustomProductRow,
  locale: string,
  untitled: string,
): CollectionProductOption {
  const trans =
    pickTranslation(cp.translations, locale) || pickTranslation(cp.product?.translations, locale);
  const thumb = cp.mockup_images?.[0]?.url || cp.product?.images?.[0]?.url || null;
  const ownTrans = pickTranslation(cp.translations, locale);
  return {
    id: `cp:${cp.id}`,
    title: trans?.title || untitled,
    kind: 'custom',
    thumbnail: thumb,
    subtitle: [cp.sku, ownTrans?.slug].filter(Boolean).join(' · ') || null,
    price: toNumber(cp.final_price ?? cp.product?.base_price),
    status: cp.status ?? null,
  };
}

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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
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
    <img src={url} alt="" loading="lazy" draggable={false} className={cn('object-cover', className)} />
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

// ── Reordering pieces ─────────────────────────────────────────────────────────

interface ItemProps {
  id: string;
  index: number;
  total: number;
  option?: CollectionProductOption;
  name: string;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

/** Up/down/top/bottom actions: the touch- and mouse-friendly alternative to dragging. */
function ReorderMenu({
  index,
  total,
  name,
  onMove,
  onRemove,
  className,
}: Omit<ItemProps, 'id' | 'option'> & { className?: string }) {
  const t = useTranslations();
  const label = t('category.reorderActions', { name });
  const first = index === 0;
  const last = index === total - 1;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition',
          'hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-zinc-100',
          className,
        )}
      >
        <ArrowUpDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={first} onClick={() => onMove(index, index - 1)}>
          <ArrowUp />
          {t('customField.moveUp')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={last} onClick={() => onMove(index, index + 1)}>
          <ArrowDown />
          {t('customField.moveDown')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={first} onClick={() => onMove(index, 0)}>
          <ArrowUpToLine />
          {t('category.moveToTop')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={last} onClick={() => onMove(index, total - 1)}>
          <ArrowDownToLine />
          {t('category.moveToBottom')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <Trash2 />
          {t('bundle.removeNamed', { name })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortableRow({ id, index, total, option: o, name, onMove, onRemove }: ItemProps) {
  const t = useTranslations();
  const { fmt } = useCurrency();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const price = o?.price !== null && o?.price !== undefined ? fmt(o.price) : null;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative flex items-center gap-2 bg-white p-2.5 first:rounded-t-md last:rounded-b-md sm:gap-3',
        isDragging && 'z-10 rounded-md shadow-lg ring-1 ring-zinc-300',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('category.dragHandleNamed', { name, position: index + 1, total })}
        title={t('creator.menus.dragHandle')}
        className="inline-flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-6 shrink-0 text-center text-[11px] font-medium tabular-nums text-muted-foreground" aria-hidden>
        {index + 1}
      </span>
      <Thumb src={o?.thumbnail} className="size-11 shrink-0 rounded-md border border-zinc-100" />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', !o && 'text-muted-foreground italic')}>{name}</p>
        {o && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {price && <span className="tabular-nums font-medium text-zinc-700">{price}</span>}
            <span>{o.kind === 'own' ? t('bundle.ownSuffix') : t('bundle.customSuffix')}</span>
            {o.subtitle && <span className="max-w-[16rem] truncate">{o.subtitle}</span>}
            <StatusBadge status={o.status} />
          </div>
        )}
      </div>
      <ReorderMenu index={index} total={total} name={name} onMove={onMove} onRemove={onRemove} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('bundle.removeNamed', { name })}
        title={t('bundle.removeNamed', { name })}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

// Visible on touch and keyboard focus; revealed on hover for pointer devices.
const HOVER_REVEAL =
  'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100';

function SortableCard({ id, index, total, option: o, name, onMove, onRemove }: ItemProps) {
  const t = useTranslations();
  const { fmt } = useCurrency();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const price = o?.price !== null && o?.price !== undefined ? fmt(o.price) : null;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:border-zinc-300 hover:shadow-sm',
        isDragging && 'z-10 shadow-lg ring-1 ring-zinc-300',
      )}
    >
      <Thumb src={o?.thumbnail} className="aspect-square w-full" />
      {/* Drag handle + position in the start corner */}
      <div className="absolute top-1.5 inset-s-1.5 flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('category.dragHandleNamed', { name, position: index + 1, total })}
          title={t('creator.menus.dragHandle')}
          className="inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900/80 px-1.5 text-[10px] font-semibold tabular-nums text-white"
          aria-hidden
        >
          {index + 1}
        </span>
      </div>
      {/* Reorder menu + remove in the end corner */}
      <div className="absolute top-1.5 inset-e-1.5 flex items-center gap-1">
        <ReorderMenu
          index={index}
          total={total}
          name={name}
          onMove={onMove}
          onRemove={onRemove}
          className={cn(
            'size-7 rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm hover:bg-white',
            HOVER_REVEAL,
          )}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('bundle.removeNamed', { name })}
          title={t('bundle.removeNamed', { name })}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition',
            'hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            HOVER_REVEAL,
          )}
        >
          <X className="size-3.5" />
        </button>
      </div>
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
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Manual product selection for a collection. The selected products are shown
 * in a list or grid (choice remembered per browser) in their storefront order,
 * which the creator sets by dragging the handle (pointer or keyboard) or with
 * the per-item reorder menu. "Add products" opens a server-side search dialog.
 *
 * Long selections render 60 at a time ("Show more"). The rendered part is
 * always a prefix of the full order, so dragging inside it maps to the same
 * positions in the full list; "Move to bottom" moves across the whole list.
 */
export function CollectionProductsPicker({
  value,
  onChange,
  known,
  onDiscover,
  token,
  locale,
  includeCustom,
  loading = false,
}: Props) {
  const t = useTranslations();
  const dndId = useId();
  const [view, setView] = useViewMode();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const total = value.length;
  const shown = value.slice(0, visible);
  const nameOf = useCallback(
    (id: UniqueIdentifier) => known[String(id)]?.title ?? t('category.productUnavailable'),
    [known, t],
  );
  const positionOf = (id: UniqueIdentifier) => value.indexOf(String(id)) + 1;

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= total) return;
    const id = value[from]!;
    onChange(arrayMove(value, from, to));
    setAnnouncement(t('category.movedToPosition', { name: nameOf(id), position: to + 1, total }));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = value.indexOf(String(active.id));
    const to = value.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(value, from, to));
  };

  // Localised screen-reader feedback for pointer and keyboard dragging.
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('category.dndPickedUp', { name: nameOf(active.id), position: positionOf(active.id), total }),
    onDragOver: ({ active, over }) =>
      over
        ? t('category.dndMovedOver', { name: nameOf(active.id), position: positionOf(over.id), total })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('category.dndDropped', { name: nameOf(active.id), position: positionOf(over.id), total })
        : undefined,
    onDragCancel: ({ active }) =>
      t('category.dndCancelled', { name: nameOf(active.id), position: positionOf(active.id) }),
  };

  const renderItem = (id: string, index: number) => {
    const props: ItemProps = {
      id,
      index,
      total,
      option: known[id],
      name: nameOf(id),
      onMove: move,
      onRemove: () => remove(id),
    };
    return view === 'grid' ? <SortableCard key={id} {...props} /> : <SortableRow key={id} {...props} />;
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-700">
            {t('category.selectedProducts')}{' '}
            <span className="font-normal text-muted-foreground">({total})</span>
          </p>
          {total > 1 && <p className="text-[11px] text-muted-foreground">{t('category.reorderHint')}</p>}
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-[11px] text-red-500 hover:underline">
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
      {loading && total > 0 ? (
        view === 'grid' ? (
          <GridSkeleton count={Math.min(total, 10)} className={GRID_CLASSES} />
        ) : (
          <ListSkeleton rows={Math.min(total, 5)} />
        )
      ) : loading ? (
        <ListSkeleton rows={2} />
      ) : total === 0 ? (
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
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t('category.dndInstructions') },
          }}
        >
          <SortableContext
            items={shown}
            strategy={view === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
          >
            <ul
              className={
                view === 'grid' ? GRID_CLASSES : 'divide-y rounded-md border border-zinc-200 bg-white'
              }
            >
              {shown.map(renderItem)}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {!loading && <ShowMore remaining={total - shown.length} onClick={() => setVisible((v) => v + PAGE_SIZE)} />}

      {/* Feedback for the reorder-menu moves */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={value}
        onChange={onChange}
        onDiscover={onDiscover}
        token={token}
        locale={locale}
        includeCustom={includeCustom}
        view={view}
        onViewChange={setView}
      />
    </div>
  );
}

// ── Server-side product search ────────────────────────────────────────────────

type SearchStatus = 'idle' | 'loading' | 'loadingMore' | 'error';

interface SourceCursor {
  next: number;
  done: boolean;
}

/**
 * Paged search across own products (`/products/mine?search=`) and, for
 * marketplace stores, custom products (`/custom-products?q=`). Each "load more"
 * fetches the next page of every source that still has results. Stale
 * requests are aborted when the query or source changes.
 */
function useProductSearch({
  open,
  token,
  query,
  source,
  includeCustom,
  locale,
  onDiscover,
}: {
  open: boolean;
  token?: string | null;
  query: string;
  source: Source;
  includeCustom: boolean;
  locale: string;
  onDiscover: (options: CollectionProductOption[]) => void;
}) {
  const t = useTranslations();
  const [items, setItems] = useState<CollectionProductOption[]>([]);
  const [status, setStatus] = useState<SearchStatus>('loading');
  const [hasMore, setHasMore] = useState(false);

  const cursors = useRef<{ own: SourceCursor; custom: SourceCursor }>({
    own: { next: 1, done: false },
    custom: { next: 1, done: false },
  });
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);

  const wantOwn = source !== 'custom';
  const wantCustom = includeCustom && source !== 'own';
  const untitled = t('bundle.untitledProduct');

  const fetchOwn = useCallback(
    async (page: number, q: string, signal: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), limit: String(SEARCH_PAGE_SIZE), sort: 'newest' });
      if (q) params.set('search', q);
      const res = await api<{ data: OwnProductRow[]; meta?: ListMeta } | OwnProductRow[]>(
        `/products/mine?${params}`,
        { token: token ?? undefined, signal },
      );
      const rows = Array.isArray(res) ? res : res?.data ?? [];
      const meta = Array.isArray(res) ? undefined : res?.meta;
      return {
        options: rows.map((r) => ownProductOption(r, locale, untitled)),
        done: meta ? page >= meta.totalPages : rows.length < SEARCH_PAGE_SIZE,
      };
    },
    [token, locale, untitled],
  );

  const fetchCustom = useCallback(
    async (page: number, q: string, signal: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), limit: String(SEARCH_PAGE_SIZE) });
      if (q) params.set('q', q);
      const res = await api<{ data: CustomProductRow[]; meta?: ListMeta } | CustomProductRow[]>(
        `/custom-products?${params}`,
        { token: token ?? undefined, signal },
      );
      const rows = Array.isArray(res) ? res : res?.data ?? [];
      const meta = Array.isArray(res) ? undefined : res?.meta;
      return {
        options: rows.map((r) => customProductOption(r, locale, untitled)),
        done: meta ? page >= meta.totalPages : rows.length < SEARCH_PAGE_SIZE,
      };
    },
    [token, locale, untitled],
  );

  const load = useCallback(
    async (reset: boolean) => {
      if (!token) return;
      if (reset) {
        controller.current?.abort();
        controller.current = new AbortController();
        cursors.current = { own: { next: 1, done: !wantOwn }, custom: { next: 1, done: !wantCustom } };
        busy.current = false;
      } else if (busy.current || !controller.current) {
        return;
      }
      const ctrl = controller.current!;
      busy.current = true;
      setStatus(reset ? 'loading' : 'loadingMore');
      if (reset) setItems([]);

      const { own, custom } = cursors.current;
      try {
        const [ownRes, customRes] = await Promise.all([
          own.done ? null : fetchOwn(own.next, query, ctrl.signal),
          custom.done ? null : fetchCustom(custom.next, query, ctrl.signal),
        ]);
        if (ctrl.signal.aborted) return;
        // Advance only after both sources succeeded, so "retry" repeats the same pages.
        cursors.current = {
          own: ownRes ? { next: own.next + 1, done: ownRes.done } : own,
          custom: customRes ? { next: custom.next + 1, done: customRes.done } : custom,
        };
        const batch = [...(ownRes?.options ?? []), ...(customRes?.options ?? [])];
        setItems((prev) => {
          const seen = new Set(prev.map((o) => o.id));
          return [...prev, ...batch.filter((o) => !seen.has(o.id))];
        });
        setHasMore(!cursors.current.own.done || !cursors.current.custom.done);
        setStatus('idle');
        if (batch.length) onDiscover(batch);
      } catch {
        if (ctrl.signal.aborted) return;
        setStatus('error');
      } finally {
        if (controller.current === ctrl) busy.current = false;
      }
    },
    [token, wantOwn, wantCustom, query, fetchOwn, fetchCustom, onDiscover],
  );

  // New query / source (or reopening): start over from page 1.
  useEffect(() => {
    if (!open) return;
    void load(true);
  }, [open, load]);

  // Closing the dialog cancels whatever is still in flight.
  useEffect(() => {
    if (open) return;
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
  }, [open]);

  useEffect(() => () => controller.current?.abort(), []);

  const loadMore = useCallback(() => void load(false), [load]);
  const retry = useCallback(() => {
    // A failed first page restarts; a failed later page repeats that page.
    if (items.length === 0) void load(true);
    else void load(false);
  }, [items.length, load]);

  return { items, status, hasMore, loadMore, retry };
}

// ── Picker dialog ─────────────────────────────────────────────────────────────

function ProductPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onDiscover,
  token,
  locale,
  includeCustom,
  view,
  onViewChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string[];
  onChange: (ids: string[]) => void;
  onDiscover: (options: CollectionProductOption[]) => void;
  token?: string | null;
  locale: string;
  includeCustom: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  const t = useTranslations();
  const { fmt } = useCurrency();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<Source>('all');
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { items, status, hasMore, loadMore, retry } = useProductSearch({
    open,
    token,
    query,
    source,
    includeCustom,
    locale,
    onDiscover,
  });

  const selectedSet = useMemo(() => new Set(value), [value]);
  const toggle = (id: string) =>
    onChange(selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const priceText = (o: CollectionProductOption) =>
    o.price !== null && o.price !== undefined ? fmt(o.price) : null;
  const kindLabel = (o: CollectionProductOption) =>
    o.kind === 'own' ? t('bundle.ownSuffix') : t('bundle.customSuffix');

  // Infinite scroll: load the next page when the sentinel nears the bottom.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const canLoadMore = open && hasMore && status === 'idle';
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!canLoadMore || !root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root, rootMargin: '0px 0px 240px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore, items.length]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      setSource('all');
    }
    onOpenChange(next);
  };

  const sources: { key: Source; label: string }[] = [
    { key: 'all', label: t('category.sourceAll') },
    { key: 'own', label: t('bundle.ownSuffix') },
    { key: 'custom', label: t('bundle.customSuffix') },
  ];

  const firstLoad = status === 'loading';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn('flex max-h-[85vh] flex-col gap-3 p-0', view === 'grid' ? 'sm:max-w-4xl' : 'sm:max-w-2xl')}
      >
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{t('category.addProductsTitle')}</DialogTitle>
          <DialogDescription>{t('category.addProductsHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-5">
          <div className="relative min-w-48 flex-1">
            {status === 'loading' && query ? (
              <Loader2 className="pointer-events-none absolute top-1/2 inset-s-2.5 size-3.5 -translate-y-1/2 animate-spin text-zinc-400" />
            ) : (
              <Search className="pointer-events-none absolute top-1/2 inset-s-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
            )}
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('bundle.searchProducts')}
              aria-label={t('bundle.searchProducts')}
              className="h-9 w-full rounded-md border border-input bg-background ps-8 pe-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {includeCustom && (
            <div
              role="group"
              aria-label={t('category.sourceFilter')}
              className="inline-flex shrink-0 items-center rounded-md border border-zinc-200 bg-white p-0.5"
            >
              {sources.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={source === key}
                  onClick={() => setSource(key)}
                  className={cn(
                    'h-7 rounded px-2.5 text-xs font-medium transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    source === key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <ViewModeToggle value={view} onChange={onViewChange} />
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-1" aria-busy={status !== 'idle'}>
          {firstLoad ? (
            view === 'grid' ? (
              <GridSkeleton count={10} className={DIALOG_GRID_CLASSES} />
            ) : (
              <ListSkeleton rows={6} />
            )
          ) : status === 'error' && items.length === 0 ? (
            <SearchError onRetry={retry} />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Package className="size-6 text-zinc-300" />
              <p className="text-xs text-muted-foreground">{t('bundle.noProductsFound')}</p>
            </div>
          ) : view === 'grid' ? (
            <div className={DIALOG_GRID_CLASSES}>
              {items.map((o) => {
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
                      isSel ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm',
                    )}
                  >
                    <Thumb src={o.thumbnail} className="aspect-square w-full" />
                    <span
                      className={cn(
                        'absolute top-1.5 inset-e-1.5 flex size-5 items-center justify-center rounded-full border transition',
                        isSel ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white/90 text-transparent',
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
                        {includeCustom && <span>{kindLabel(o)}</span>}
                        <StatusBadge status={o.status} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="divide-y rounded-md border border-zinc-200">
              {items.map((o) => {
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

          {(items.length > 0 || hasMore) && !(status === 'error' && items.length === 0) && (
            <div className="flex justify-center py-3">
              {status === 'loadingMore' ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('common.loading')}
                </span>
              ) : status === 'error' ? (
                <SearchError onRetry={retry} compact />
              ) : hasMore ? (
                <Button type="button" variant="outline" size="sm" onClick={loadMore}>
                  {t('creator.production.queue.loadMore')}
                </Button>
              ) : null}
            </div>
          )}
          <div ref={sentinelRef} aria-hidden className="h-px" />
        </div>

        <DialogFooter className="m-0 flex-row items-center justify-between gap-2 rounded-b-xl border-t bg-zinc-50/70 px-5 py-3 sm:justify-between">
          <span className="text-xs text-muted-foreground">{t('bundle.selectedCount', { count: value.length })}</span>
          <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
            {t('category.doneSelecting')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SearchError({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  const t = useTranslations();
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2 text-center', compact ? 'py-0' : 'py-10')}
    >
      <p className="inline-flex items-center gap-1.5 text-xs text-red-600">
        <AlertTriangle className="size-3.5" />
        {t('category.productsLoadFailed')}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('creator.myProducts.retry')}
      </Button>
    </div>
  );
}
