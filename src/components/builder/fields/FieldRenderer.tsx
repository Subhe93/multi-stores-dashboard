'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { Camera, Loader2, Trash2, Plus, HelpCircle, ChevronDown, GripVertical, ImageIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { api } from '@/lib/api';
import { labelOf, type FieldDefinition } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';

interface FieldRendererProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  locale: string;
  token: string;
  apiBase: string;
}

// Fields that benefit from a horizontal label-on-left layout (Elementor 3.x
// "inline control" style). Text/textarea/richtext/image/repeater need full
// width and stay stacked.
const INLINE_TYPES = new Set(['boolean', 'select', 'color', 'number', 'menuPicker', 'collectionPicker']);

/**
 * Renders the right input for a schema field. Picks an inline vs stacked
 * shell based on the field type so simple controls (select/color/number)
 * align in a tidy column while text-heavy controls get full width.
 */
export function FieldRenderer({ field, value, onChange, locale, token, apiBase }: FieldRendererProps) {
  const label = labelOf(field.label, locale);
  const description = field.description ? labelOf(field.description, locale) : undefined;
  const inline = INLINE_TYPES.has(field.type);

  const control = (() => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            className="h-9 text-[12.5px]"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.maxLength}
          />
        );

      case 'textarea':
        return (
          <Textarea
            rows={3}
            className="text-[12.5px] resize-y min-h-18"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.maxLength}
          />
        );

      case 'richtext':
        return (
          <div className="rounded-lg border border-zinc-200 overflow-hidden focus-within:border-indigo-400 focus-within:ring-3 focus-within:ring-indigo-100 transition">
            <RichTextEditor
              content={(value as string) ?? ''}
              onChange={(html) => onChange(html)}
            />
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            className="h-9 text-[12.5px] text-center font-mono w-24"
            value={typeof value === 'number' ? value : ''}
            min={field.min}
            max={field.max}
            onChange={(e) => {
              const n = e.target.value === '' ? undefined : Number(e.target.value);
              onChange(n);
            }}
          />
        );

      case 'boolean':
        return <Switch checked={Boolean(value)} onChange={(b) => onChange(b)} />;

      case 'color':
        return <ColorControl value={(value as string) ?? ''} onChange={onChange} />;

      case 'url':
        return (
          <Input
            type="url"
            className="h-9 text-[12.5px] font-mono"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
          />
        );

      case 'select':
        return (
          <div className="min-w-35">
            <SearchableSelect
              value={(value as string) ?? (field.defaultValue as string) ?? ''}
              onChange={(v) => onChange(v)}
              options={(field.options || []).map((o) => ({
                value: o.value,
                label: labelOf(o.label, locale),
              }))}
              placeholder="Select…"
            />
          </div>
        );

      case 'menuPicker':
        return (
          <div className="min-w-44">
            <MenuPicker
              value={(value as string) ?? ''}
              onChange={(v) => onChange(v)}
              token={token}
              locale={locale}
            />
          </div>
        );

      case 'image':
        return (
          <ImageField
            value={(value as string) ?? ''}
            onChange={(v) => onChange(v)}
            token={token}
            apiBase={apiBase}
            locale={locale}
          />
        );

      case 'repeater':
        return (
          <RepeaterField
            items={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
            onChange={(items) => onChange(items)}
            fields={field.fields || []}
            locale={locale}
            token={token}
            apiBase={apiBase}
          />
        );

      case 'collectionPicker':
        return (
          <div className="min-w-44">
            <CollectionPicker
              value={(value as string) ?? ''}
              onChange={(v) => onChange(v)}
              token={token}
              locale={locale}
            />
          </div>
        );

      case 'productPicker':
        // Placeholder until the product picker is built — store the raw id for now.
        return (
          <Input
            className="h-9 text-[12.5px]"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="product id"
          />
        );

      default:
        return null;
    }
  })();

  if (!control) return null;

  return (
    <FieldShell label={label} description={description} inline={inline}>
      {control}
    </FieldShell>
  );
}

/**
 * Field row. Two variants:
 *   • inline  → label on the start, control on the end (Elementor 3.x default
 *               for select/toggle/color/number).
 *   • stacked → label above, control full width (text/textarea/richtext/image).
 * Descriptions become a help tooltip on inline rows and an inline caption on
 * stacked rows to keep simple rows compact.
 */
function FieldShell({
  label,
  description,
  inline,
  children,
}: {
  label: string;
  description?: string;
  inline: boolean;
  children: React.ReactNode;
}) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-3 min-h-9 group">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <label className="text-[11.5px] font-medium text-zinc-700 truncate">{label}</label>
          {description && (
            <span className="relative inline-block" tabIndex={0}>
              <HelpCircle className="size-3 text-zinc-300 hover:text-zinc-600 transition cursor-help" />
              <span className="pointer-events-none absolute z-30 bottom-full mb-1 inset-s-1/2 -translate-x-1/2 w-max max-w-50 rounded-md bg-zinc-900 text-white text-[10.5px] leading-snug px-2 py-1 shadow-lg opacity-0 group-focus-within:opacity-100 hover:opacity-100 transition-opacity">
                {description}
              </span>
            </span>
          )}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11.5px] font-medium text-zinc-700">{label}</label>
      </div>
      {children}
      {description && (
        <p className="text-[10.5px] text-zinc-400 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

// ── Switch (boolean) ────────────────────────────────────────

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-indigo-100',
        checked ? 'bg-indigo-600' : 'bg-zinc-200',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ── Color control with swatches ─────────────────────────────

const COLOR_SWATCHES = [
  '#000000', '#ffffff', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function ColorControl({ value, onChange }: { value: string; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const display = value || '';

  // Position the popover with fixed coordinates anchored to the trigger, and
  // render it in a portal so it escapes the inspector's `overflow` clipping
  // (the section accordion + the scroll container would otherwise crop it).
  // Flips above the trigger when there isn't room below — same approach as
  // SearchableSelect, so dropdowns behave consistently across the builder.
  useEffect(() => {
    if (!open) return;
    const PANEL_W = 220; // matches w-55 below (55 * 4px)
    const compute = () => {
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const estHeight = 280; // approx popover height for flip decision
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const placeBelow = spaceBelow >= estHeight || spaceBelow >= rect.top - margin;
      const top = placeBelow ? rect.bottom + 4 : Math.max(margin, rect.top - 4 - estHeight);
      // Right-align the panel to the trigger, clamped to the viewport.
      const left = Math.min(
        Math.max(margin, rect.right - PANEL_W),
        Math.max(margin, window.innerWidth - PANEL_W - margin),
      );
      setPos({ top, left });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // Close on outside click (the portal lives outside the trigger's subtree).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 h-9 rounded-lg border border-zinc-200 bg-white px-2 hover:border-zinc-300 transition"
      >
        <span
          className="size-5 rounded border border-zinc-200 shadow-inner shrink-0"
          style={{
            background: display
              ? display
              : 'repeating-conic-gradient(#e4e4e7 0% 25%, #fff 0% 50%) 50% / 8px 8px',
          }}
        />
        <span className="text-[11px] font-mono text-zinc-700 uppercase min-w-16 text-start">
          {display || '—'}
        </span>
        <ChevronDown className="size-3 text-zinc-400" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-9999 w-55 rounded-xl border border-zinc-200 bg-white shadow-xl p-3 space-y-2.5"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            type="color"
            value={display || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-white p-1"
          />
          <Input
            className="h-8 text-[11.5px] font-mono"
            value={display}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
          />
          <div>
            <div className="text-[9.5px] uppercase tracking-wider text-zinc-400 font-semibold mb-1.5">
              Swatches
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={cn(
                    'size-7 rounded-md border transition hover:scale-110',
                    display.toLowerCase() === c.toLowerCase()
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-zinc-200',
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          {display && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 hover:text-red-600 py-1 rounded transition"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── Menu picker ─────────────────────────────────────────────

interface MenuOption {
  id: string;
  key: string;
  name: string;
}

// Module-level cache so multiple menu pickers on the same inspector share a
// single fetch instead of each hitting the API. Keyed by token so switching
// accounts re-fetches. Stores the in-flight promise to dedupe concurrent
// mounts too.
let menusCache: { token: string; promise: Promise<MenuOption[]> } | null = null;

function fetchMenusOnce(token: string): Promise<MenuOption[]> {
  if (menusCache && menusCache.token === token) return menusCache.promise;
  const promise = api<MenuOption[]>('/menus/mine', { token })
    .then((list) => (Array.isArray(list) ? list : []))
    .catch(() => []);
  menusCache = { token, promise };
  return promise;
}

function MenuPicker({
  value,
  onChange,
  token,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  token: string;
  locale: string;
}) {
  const ar = locale === 'ar';
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMenusOnce(token)
      .then((list) => {
        if (!cancelled) setMenus(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="h-9 inline-flex items-center gap-1.5 px-2 text-[11.5px] text-zinc-400">
        <Loader2 className="size-3.5 animate-spin" />
        {ar ? 'تحميل القوائم…' : 'Loading menus…'}
      </div>
    );
  }

  if (menus.length === 0) {
    // No menus yet — guide the creator to build one rather than leaving a
    // dead dropdown. The link opens the Menus page in a new tab.
    return (
      <a
        href="/creator/menus"
        target="_blank"
        rel="noopener noreferrer"
        className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-dashed border-zinc-300 text-[11.5px] text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 transition"
      >
        <Plus className="size-3.5" />
        {ar ? 'أنشئ قائمة أولاً' : 'Create a menu first'}
      </a>
    );
  }

  // Value is the menu KEY (stable across renames-free edits). "None" clears it
  // so the section falls back to its inline links.
  const options = [
    { value: '', label: ar ? '— بدون (روابط مباشرة) —' : '— None (inline links) —' },
    ...menus.map((m) => ({ value: m.key, label: `${m.name}  ·  ${m.key}` })),
  ];

  return (
    <SearchableSelect
      value={value}
      onChange={(v) => onChange(v)}
      options={options}
      placeholder={ar ? 'اختر قائمة…' : 'Select a menu…'}
    />
  );
}

// ── Collection (creator category) picker ───────────────────

interface CategoryTranslation {
  locale: string;
  name: string;
}

interface CategoryNode {
  id: string;
  slug: string;
  translations: CategoryTranslation[];
  children?: CategoryNode[];
}

// Flat option carrying the indented display path so nested categories read as
// a tree inside the dropdown.
interface CategoryOption {
  slug: string;
  path: string;
  depth: number;
}

function categoryName(node: CategoryNode, locale: string): string {
  return (
    node.translations?.find((t) => t.locale === locale)?.name ||
    node.translations?.find((t) => t.locale === 'en')?.name ||
    node.translations?.[0]?.name ||
    node.slug
  );
}

function flattenCategories(nodes: CategoryNode[], locale: string, depth = 0, prefix = ''): CategoryOption[] {
  const out: CategoryOption[] = [];
  for (const n of nodes) {
    const name = categoryName(n, locale);
    const path = prefix ? `${prefix} / ${name}` : name;
    out.push({ slug: n.slug, path, depth });
    if (n.children?.length) out.push(...flattenCategories(n.children, locale, depth + 1, path));
  }
  return out;
}

// Module-level cache so multiple collection pickers on the same inspector
// share a single fetch. Keyed by token so switching accounts re-fetches.
let categoriesCache: { token: string; promise: Promise<CategoryNode[]> } | null = null;

function fetchCategoriesOnce(token: string): Promise<CategoryNode[]> {
  if (categoriesCache && categoriesCache.token === token) return categoriesCache.promise;
  const promise = api<CategoryNode[]>('/creator-categories', { token })
    .then((list) => (Array.isArray(list) ? list : []))
    .catch(() => []);
  categoriesCache = { token, promise };
  return promise;
}

function CollectionPicker({
  value,
  onChange,
  token,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  token: string;
  locale: string;
}) {
  const ar = locale === 'ar';
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCategoriesOnce(token)
      .then((tree) => {
        if (!cancelled) setOptions(flattenCategories(tree, locale));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, locale]);

  if (loading) {
    return (
      <div className="h-9 inline-flex items-center gap-1.5 px-2 text-[11.5px] text-zinc-400">
        <Loader2 className="size-3.5 animate-spin" />
        {ar ? 'تحميل الفئات…' : 'Loading categories…'}
      </div>
    );
  }

  if (options.length === 0) {
    // No categories yet — guide the creator to create one rather than leaving
    // a dead dropdown. The link opens the Categories page in a new tab.
    return (
      <a
        href="/creator/categories"
        target="_blank"
        rel="noopener noreferrer"
        className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-dashed border-zinc-300 text-[11.5px] text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 transition"
      >
        <Plus className="size-3.5" />
        {ar ? 'أنشئ فئة أولاً' : 'Create a category first'}
      </a>
    );
  }

  // Value is the category SLUG (the storefront's `creator_category` filter
  // resolves it). "None" clears it so the section shows its empty prompt.
  const selectOptions = [
    { value: '', label: ar ? '— بدون فئة —' : '— No category —' },
    ...options.map((o) => ({
      value: o.slug,
      // Indent nested categories with leading spaces so the hierarchy reads.
      label: `${'  '.repeat(o.depth)}${o.path.split(' / ').pop()}`,
    })),
  ];

  return (
    <SearchableSelect
      value={value}
      onChange={(v) => onChange(v)}
      options={selectOptions}
      placeholder={ar ? 'اختر فئة…' : 'Select a category…'}
    />
  );
}

// ── Image field ─────────────────────────────────────────────

export function ImageField({
  value,
  onChange,
  token,
  apiBase,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  token: string;
  apiBase: string;
  locale: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ar = locale === 'ar';
  const resolved = value.startsWith('http')
    ? value
    : value
      ? `${apiBase.replace(/\/api$/, '')}${value}`
      : '';

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiBase}/uploads?folder=page-blocks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      onChange(json.data?.url || json.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) uploadFile(f);
        }}
        className={cn(
          'relative block w-full rounded-lg border-2 border-dashed cursor-pointer overflow-hidden transition group',
          dragging
            ? 'border-indigo-500 bg-indigo-50'
            : resolved
              ? 'border-zinc-200 hover:border-zinc-300'
              : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50',
        )}
      >
        {resolved ? (
          <div className="relative aspect-video bg-zinc-100">
            <img src={resolved} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-zinc-900/0 group-hover:bg-zinc-900/40 transition flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition text-white text-[11px] font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/70 backdrop-blur">
                <Camera className="size-3.5" />
                {ar ? 'تغيير الصورة' : 'Replace image'}
              </span>
            </div>
          </div>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center gap-1.5 text-zinc-500">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <div className="size-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
                  <ImageIcon className="size-4 text-zinc-400" />
                </div>
                <span className="text-[11.5px] font-medium text-zinc-600">
                  {ar ? 'انقر أو اسحب صورة هنا' : 'Click or drop an image'}
                </span>
                <span className="text-[10px] text-zinc-400">PNG, JPG, WebP</span>
              </>
            )}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
      </label>

      <div className="flex items-center gap-1.5">
        <Input
          className="h-7 text-[11px] flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ar ? 'أو ألصق رابط الصورة' : 'or paste image URL'}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="size-7 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
            title={ar ? 'إزالة' : 'Remove'}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Repeater field ──────────────────────────────────────────

function RepeaterField({
  items,
  onChange,
  fields,
  locale,
  token,
  apiBase,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  fields: FieldDefinition[];
  locale: string;
  token: string;
  apiBase: string;
}) {
  const ar = locale === 'ar';
  // Drag-to-reorder via dnd-kit (same setup as the section rail). Items carry
  // no stable id, so we use positional ids ("0".."n") and arrayMove by index —
  // the grip in each item header is the drag handle.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((_, i) => String(i));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-4 text-center">
          <p className="text-[11px] text-zinc-500">
            {ar ? 'لا توجد عناصر بعد' : 'No items yet'}
          </p>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((item, i) => (
            <RepeaterItem
              key={i}
              id={String(i)}
              index={i}
              item={item}
              fields={fields}
              locale={locale}
              token={token}
              apiBase={apiBase}
              onChangeItem={(next) => {
                const list = items.slice();
                list[i] = next;
                onChange(list);
              }}
              onDelete={() => {
                const list = items.slice();
                list.splice(i, 1);
                onChange(list);
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, {}])}
        className="w-full h-9 border-dashed border-zinc-300 text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition"
      >
        <Plus className="size-3.5 me-1.5" />
        {ar ? 'إضافة عنصر' : 'Add item'}
      </Button>
    </div>
  );
}

function RepeaterItem({
  id,
  index,
  item,
  fields,
  locale,
  token,
  apiBase,
  onChangeItem,
  onDelete,
}: {
  id: string;
  index: number;
  item: Record<string, unknown>;
  fields: FieldDefinition[];
  locale: string;
  token: string;
  apiBase: string;
  onChangeItem: (next: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const ar = locale === 'ar';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // Derive a title preview from the first text-ish field in the item.
  const firstText = fields.find((f) => ['text', 'textarea', 'richtext'].includes(f.type));
  const preview = firstText ? String(item[firstText.key] ?? '').trim() : '';
  const titleText = preview || `${ar ? 'عنصر' : 'Item'} ${index + 1}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-zinc-200 bg-white overflow-hidden',
        isDragging && 'opacity-60 shadow-lg relative z-10',
      )}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-50/60 border-b border-zinc-200/70">
        <button
          type="button"
          className="px-0.5 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label={ar ? 'إعادة الترتيب' : 'Reorder'}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-start"
        >
          <ChevronDown
            className={cn('size-3.5 text-zinc-400 transition-transform shrink-0', !open && '-rotate-90')}
          />
          <span className="text-[11.5px] font-medium text-zinc-700 truncate">
            {titleText.length > 32 ? titleText.slice(0, 32) + '…' : titleText}
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="size-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
          title={ar ? 'حذف' : 'Delete'}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-3">
          {fields
            // Conditional fields: hide when the gating sibling's value isn't
            // in the showIf list. Lets a block show only its type's fields.
            .filter((f) => {
              if (!f.showIf) return true;
              const gate = item[f.showIf.key];
              return f.showIf.in.includes(String(gate ?? ''));
            })
            .map((f) => (
              <FieldRenderer
                key={f.key}
                field={f}
                value={item[f.key]}
                onChange={(v) => onChangeItem({ ...item, [f.key]: v })}
                locale={locale}
                token={token}
                apiBase={apiBase}
              />
            ))}
        </div>
      )}
    </div>
  );
}
