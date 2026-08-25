'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SECTION_SCHEMAS, labelOf, type SectionSchema } from '@/lib/section-schemas';
import { cn } from '@/lib/utils';
import { SectionPreview } from './SectionPreviews';

interface AddSectionDialogProps {
  locale: string;
  pageType: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'CATALOG_TEMPLATE' | 'COLLECTION_TEMPLATE' | 'HEADER' | 'FOOTER';
  onAdd: (sectionKey: string) => Promise<void> | void;
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

// When a section schema declares `pageTypes`, the palette only shows it for
// those page types. When omitted, the section is available on every page type
// EXCEPT HEADER/FOOTER (so page-content sections don't pollute the chrome
// builder). Chrome-only sections set pageTypes: ['HEADER'] or ['FOOTER'].
function isAvailableForPageType(
  schema: SectionSchema,
  pageType: AddSectionDialogProps['pageType'],
): boolean {
  if (schema.pageTypes && schema.pageTypes.length > 0) {
    return schema.pageTypes.includes(pageType);
  }
  // Default: hide from HEADER/FOOTER (they're chrome — only chrome-tagged
  // sections belong there).
  return pageType !== 'HEADER' && pageType !== 'FOOTER';
}

export function AddSectionDialog({ locale, pageType, onAdd }: AddSectionDialogProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<SectionSchema['category'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const isProductTemplate = pageType === 'PRODUCT_TEMPLATE';

  // Visibility rules (in order):
  // - First filter by `pageTypes` whitelist on the schema. Chrome sections
  //   (header-bar, footer-columns, …) only show on HEADER/FOOTER; chrome
  //   palettes hide all other sections by default.
  // - PRODUCT_TEMPLATE additionally allows magic sections.
  // - Other regular page types drop magic sections (they need product context).
  //   CATALOG_TEMPLATE / COLLECTION_TEMPLATE behave like HOME/LANDING here; the
  //   `product-listing` section reaches them via its own `pageTypes` whitelist.
  const visible = SECTION_SCHEMAS.filter((s) => {
    if (!isAvailableForPageType(s, pageType)) return false;
    if (isProductTemplate) return true;
    return !MAGIC_SECTION_KEYS.has(s.id);
  });

  // Per-category counts drive both the chip badges and the "hide empty
  // categories" rule below.
  const categoryCounts = new Map<SectionSchema['category'], number>();
  for (const s of visible) {
    categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
  }
  const allCategories: { id: SectionSchema['category'] | 'all'; label: string; count: number }[] = [
    { id: 'all', label: t('builder.catAll'), count: visible.length },
    { id: 'showcase', label: t('builder.catShowcase'), count: categoryCounts.get('showcase') ?? 0 },
    { id: 'content', label: t('builder.catContent'), count: categoryCounts.get('content') ?? 0 },
    { id: 'commerce', label: t('builder.catCommerce'), count: categoryCounts.get('commerce') ?? 0 },
    { id: 'social', label: t('builder.catSocial'), count: categoryCounts.get('social') ?? 0 },
    { id: 'layout', label: t('builder.catLayout'), count: categoryCounts.get('layout') ?? 0 },
    { id: 'header', label: t('builder.catHeader'), count: categoryCounts.get('header') ?? 0 },
    { id: 'footer', label: t('builder.catFooter'), count: categoryCounts.get('footer') ?? 0 },
  ];
  const categories = allCategories.filter((c) => c.id === 'all' || c.count > 0);

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
    : filter === 'all'
      ? visible
      : visible.filter((s) => s.category === filter);

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
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {t('builder.addSection')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('builder.addASection')}</DialogTitle>
          <DialogDescription>
            {t('builder.addSectionDesc')}
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
                filter === c.id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100',
              )}
            >
              {c.label}
              <span
                className={cn(
                  'ms-1.5 tabular-nums',
                  filter === c.id ? 'text-zinc-400' : 'text-zinc-400/80',
                )}
              >
                · {c.count}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <SearchX className="w-5 h-5 text-zinc-300" />
            <p className="text-sm text-zinc-500">{t('builder.noSectionsFound')}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-3 max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={adding}
              onClick={async () => {
                setAdding(true);
                try {
                  await onAdd(s.id);
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
