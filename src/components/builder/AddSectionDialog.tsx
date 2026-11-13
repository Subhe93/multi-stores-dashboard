'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, LayoutTemplate, PanelsTopLeft, Plus, Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SECTION_SCHEMAS, findSectionSchema, labelOf, type SectionSchema } from '@/lib/section-schemas';
import { presetsForPageType, type SectionPreset } from '@/lib/section-presets';
import { presetLeafKeys, visibleSectionsWithKeys } from '@/lib/productBlocksPreset';
// Palette rule: `pageTypes` whitelist, default "not HEADER/FOOTER", and the
// `chrome` flag that adds HEADER/FOOTER (embed-code).
import { isAvailableForPageType } from '@/lib/sectionAvailability';
import { canDropInto, flattenTree } from '@/lib/sectionTree';
import { cn } from '@/lib/utils';
import { SectionPreview } from './SectionPreviews';
import type { SectionInstance } from './types';

/** Where a new section goes: under `parentId` (null = page root) at sibling `index`. */
export interface SectionInsertTarget {
  parentId: string | null;
  index: number;
}

interface AddSectionDialogProps {
  locale: string;
  pageType: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'CATALOG_TEMPLATE' | 'COLLECTION_TEMPLATE' | 'HEADER' | 'FOOTER';
  // `target` is the insert target the dialog was opened for (absent = the
  // classic "append at the end of the page").
  onAdd: (sectionKey: string, target?: SectionInsertTarget) => Promise<void> | void;
  // Inserts every section of a preset in one action (M6.5). When omitted the
  // Presets tab is hidden. Presets always go to the page root, so the tab is
  // also hidden while adding into a container.
  onAddPreset?: (presetId: string) => Promise<void> | void;
  // Insert target. A non-null parentId limits the palette to sections that
  // may sit in that container (see canDropInto). Requires `sections`.
  target?: SectionInsertTarget | null;
  // The page's sections, used to resolve the target container and its depth.
  sections?: readonly SectionInstance[];
  // Offer the nested layout containers. Defaults to the product template only.
  layoutContainers?: boolean;
  // Controlled open state (optional). The trigger button is always rendered.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// 'product' is the category of the product blocks (product template only).
type FilterId = SectionSchema['category'] | 'product' | 'all' | 'presets';

// Icon for a preset card; `icon` is a hint from the preset definition.
function PresetIcon({ icon, className }: { icon?: string; className?: string }) {
  if (icon === 'gift') return <Gift className={className} />;
  if (icon === 'layout') return <PanelsTopLeft className={className} />;
  return <LayoutTemplate className={className} />;
}

// Section keys that only render meaningfully inside a product page template
// (they read from product context). Hidden from the palette on other page types
// so creators don't add an inert placeholder by mistake.
const MAGIC_SECTION_KEYS = new Set([
  'product-gallery',
  'product-details',
  'product-tabs',
  'add-to-cart',
]);

export function AddSectionDialog({
  locale,
  pageType,
  onAdd,
  onAddPreset,
  target = null,
  sections,
  layoutContainers,
  open: openProp,
  onOpenChange,
}: AddSectionDialogProps) {
  const t = useTranslations();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const isProductTemplate = pageType === 'PRODUCT_TEMPLATE';

  // Presets exist for regular page types only (not templates / chrome); the
  // tab shows only when at least one applies and the host can insert them.
  // Resolve the target container (null = page root) and the depth a new
  // section would sit at. A target whose container is gone falls back to root.
  const flat = target?.parentId && sections ? flattenTree(sections) : [];
  const targetParent = target?.parentId ? (flat.find((f) => f.id === target.parentId) ?? null) : null;
  const intoContainer = !!targetParent;
  const insertDepth = targetParent ? targetParent.depth + 1 : 1;
  const targetLabel = targetParent
    ? (() => {
        const schema = findSectionSchema(targetParent.section_key);
        return schema ? labelOf(schema.label, locale) : targetParent.section_key;
      })()
    : null;
  const containersOn = layoutContainers ?? isProductTemplate;

  const presets =
    onAddPreset && !intoContainer ? presetsForPageType(pageType, { layoutContainers: containersOn }) : [];
  // A preset with `blockedBy` stays visible but disabled while the page has a
  // visible section it must not be combined with (e.g. a second buy form).
  const presetBlockers = (p: SectionPreset) =>
    p.blockedBy && sections ? visibleSectionsWithKeys(sections, p.blockedBy) : [];

  // Visibility rules (in order):
  // - First filter by `pageTypes` whitelist on the schema. Chrome sections
  //   (header-bar, footer-columns, …) only show on HEADER/FOOTER; chrome
  //   palettes hide all other sections unless they are flagged `chrome`.
  // - PRODUCT_TEMPLATE additionally allows magic sections.
  // - Other regular page types drop magic sections (they need product context).
  //   CATALOG_TEMPLATE / COLLECTION_TEMPLATE behave like HOME/LANDING here; the
  //   `product-listing` section reaches them via its own `pageTypes` whitelist.
  // - Containers (gate 'layout-containers') only when enabled; inside a
  //   container, only sections allowed at that depth (never a container where
  //   canDropInto fails, e.g. a container at the deepest level).
  const visible = SECTION_SCHEMAS.filter((s) => {
    if (!isAvailableForPageType(s, pageType, { layoutContainers: containersOn })) return false;
    // Product blocks (category 'product') need the product context too.
    if (!isProductTemplate && (MAGIC_SECTION_KEYS.has(s.id) || s.category === 'product')) return false;
    return canDropInto(s.id, targetParent, insertDepth, 1);
  });

  // Per-category counts drive both the chip badges and the "hide empty
  // categories" rule below.
  const categoryCounts = new Map<string, number>();
  for (const s of visible) {
    categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
  }
  const allCategories: { id: FilterId; label: string; count: number }[] = [
    { id: 'presets', label: t('builder.presets.tab'), count: presets.length },
    { id: 'all', label: t('builder.catAll'), count: visible.length },
    { id: 'product', label: t('builder.catProduct'), count: categoryCounts.get('product') ?? 0 },
    { id: 'showcase', label: t('builder.catShowcase'), count: categoryCounts.get('showcase') ?? 0 },
    { id: 'content', label: t('builder.catContent'), count: categoryCounts.get('content') ?? 0 },
    { id: 'commerce', label: t('builder.catCommerce'), count: categoryCounts.get('commerce') ?? 0 },
    { id: 'social', label: t('builder.catSocial'), count: categoryCounts.get('social') ?? 0 },
    { id: 'layout', label: t('builder.catLayout'), count: categoryCounts.get('layout') ?? 0 },
    { id: 'header', label: t('builder.catHeader'), count: categoryCounts.get('header') ?? 0 },
    { id: 'footer', label: t('builder.catFooter'), count: categoryCounts.get('footer') ?? 0 },
  ];
  const categories = allCategories.filter((c) => c.id === 'all' || c.count > 0);
  // A chip that vanished (e.g. Presets while adding into a container) falls
  // back to "All" so the grid never goes empty for a hidden reason.
  const activeFilter: FilterId = categories.some((c) => c.id === filter) ? filter : 'all';

  // A non-empty search overrides the category filter: it matches against the
  // localized label and the raw section id across ALL visible sections, so
  // creators never wonder why a result is "missing" from the current tab.
  const query = search.trim().toLowerCase();
  const filtered = query
    ? visible.filter(
        (s) =>
          labelOf(s.label, locale).toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query),
      )
    : activeFilter === 'all' || activeFilter === 'presets'
      ? visible
      : visible.filter((s) => (s.category as string) === activeFilter);
  // Preset card text follows the dashboard UI locale (i18n keys) and falls
  // back to the preset's own localized strings.
  const presetName = (p: SectionPreset) => (p.i18n ? t(`builder.${p.i18n.name}`) : labelOf(p.name, locale));
  const presetDescription = (p: SectionPreset) =>
    p.i18n ? t(`builder.${p.i18n.description}`) : labelOf(p.description, locale);
  // Presets show on their own tab, and a search also matches their names.
  const filteredPresets = query
    ? presets.filter(
        (p) =>
          presetName(p).toLowerCase().includes(query) ||
          labelOf(p.name, locale).toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query),
      )
    : activeFilter === 'presets'
      ? presets
      : [];
  const showSections = query || activeFilter !== 'presets';
  const nothingFound = filteredPresets.length === 0 && (!showSections || filtered.length === 0);

  // Nested presets list their blocks, not the layout containers around them.
  const presetSectionNames = (p: SectionPreset) =>
    presetLeafKeys(p.sections)
      .map((key) => SECTION_SCHEMAS.find((schema) => schema.id === key))
      .filter((schema): schema is SectionSchema => !!schema)
      .map((schema) => labelOf(schema.label, locale));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset the search on close so the picker reopens un-filtered.
        if (!next) setSearch('');
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Plus className="w-3.5 h-3.5 me-1.5" />
            {t('builder.addSection')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('builder.addASection')}</DialogTitle>
          <DialogDescription>
            {targetLabel ? t('builder.addIntoContainer', { name: targetLabel }) : t('builder.addSectionDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Search — instant client-side filter over label + id */}
        <div className="relative">
          <Search className="absolute inset-s-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('builder.searchSections')}
            className="w-full h-9 ps-9 pe-3 text-sm rounded-md border border-zinc-200 bg-zinc-50 placeholder:text-zinc-400 outline-none transition focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Category chips with per-category counts. Dimmed while a search is
            active since search results span every category. */}
        <div
          className={cn(
            'flex items-center gap-1 flex-wrap border-b -mx-6 px-6 pb-3 transition-opacity',
            query && 'opacity-40 pointer-events-none',
          )}
        >
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition font-medium',
                activeFilter === c.id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100',
              )}
            >
              {c.label}
              <span
                className={cn(
                  'ms-1.5 tabular-nums',
                  activeFilter === c.id ? 'text-zinc-400' : 'text-zinc-400/80',
                )}
              >
                · {c.count}
              </span>
            </button>
          ))}
        </div>

        {nothingFound && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <SearchX className="w-5 h-5 text-zinc-300" />
            <p className="text-sm text-zinc-500">{t('builder.noSectionsFound')}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-3 max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {filteredPresets.map((p) => {
            const blockers = presetBlockers(p);
            const blockerNames = blockers
              .map((b) => {
                const schema = findSectionSchema(b.section_key);
                return schema ? labelOf(schema.label, locale) : b.section_key;
              })
              .filter((name, i, all) => all.indexOf(name) === i);
            return (
            <button
              key={`preset:${p.id}`}
              type="button"
              disabled={adding || blockers.length > 0}
              onClick={async () => {
                if (!onAddPreset || blockers.length > 0) return;
                setAdding(true);
                try {
                  await onAddPreset(p.id);
                  setOpen(false);
                } finally {
                  setAdding(false);
                }
              }}
              className="group flex flex-col w-full h-max text-start rounded-lg border border-indigo-200 bg-indigo-50/40 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20 hover:shadow-md overflow-hidden transition-all disabled:opacity-50 disabled:hover:border-indigo-200 disabled:hover:ring-0 disabled:hover:shadow-none"
            >
              <div className="flex flex-col gap-2 p-3.5 min-w-0">
                <div className="flex items-start gap-2">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-white border border-indigo-200 text-indigo-600">
                    <PresetIcon icon={p.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold leading-tight text-zinc-900 truncate">
                      {presetName(p)}
                    </h4>
                    <span className="text-[9px] font-medium uppercase tracking-wide text-indigo-600">
                      {t('builder.presets.tab')}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-snug">
                  {presetDescription(p)}
                </p>
                <p className="text-[11px] text-zinc-600 leading-snug">
                  <span className="font-medium">{t('builder.presets.includes')}</span>{' '}
                  {presetSectionNames(p).join(' · ')}
                </p>
                {blockers.length > 0 && (
                  <p className="text-[11px] text-amber-700 leading-snug">
                    {t('builder.presets.blockedBy', { names: blockerNames.join(', ') })}
                  </p>
                )}
              </div>
            </button>
            );
          })}
          {showSections && filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={adding}
              onClick={async () => {
                setAdding(true);
                try {
                  await onAdd(s.id, target ?? undefined);
                  setOpen(false);
                } finally {
                  setAdding(false);
                }
              }}
              // `h-max` (= height: max-content) stops the CSS grid from
              // stretching every card to match the tallest row sibling. Without
              // it, short-content cards push the text area below the visible
              // edge — looked like the descriptions had disappeared.
              className="group flex flex-col w-full h-max text-start rounded-lg border border-zinc-200 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20 hover:shadow-md bg-white overflow-hidden transition-all disabled:opacity-50 disabled:hover:border-zinc-200 disabled:hover:ring-0 disabled:hover:shadow-none"
            >
              {/* Thumbnail — flex shrink so it doesn't eat the text area */}
              <div className="aspect-5/3 bg-zinc-50 border-b border-zinc-100 overflow-hidden shrink-0">
                <SectionPreview
                  sectionKey={s.id}
                  className="block w-full h-full transition-transform duration-300 group-hover:scale-[1.05]"
                />
              </div>
              {/* Text area — explicit min-width-0 so long names truncate cleanly */}
              <div className="flex flex-col gap-1 p-3.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold leading-tight text-zinc-900 truncate">
                    {labelOf(s.label, locale)}
                  </h4>
                  <span className="text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                    {s.category}
                  </span>
                </div>
                {s.description && (
                  <p className="text-[11px] text-zinc-500 leading-snug line-clamp-1">
                    {labelOf(s.description, locale)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
