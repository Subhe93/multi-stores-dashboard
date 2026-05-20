'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
  pageType: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER';
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
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<SectionSchema['category'] | 'all'>('all');
  const [adding, setAdding] = useState(false);

  const isProductTemplate = pageType === 'PRODUCT_TEMPLATE';

  // Visibility rules (in order):
  // - First filter by `pageTypes` whitelist on the schema. Chrome sections
  //   (header-bar, footer-columns, …) only show on HEADER/FOOTER; chrome
  //   palettes hide all other sections by default.
  // - PRODUCT_TEMPLATE additionally allows magic sections.
  // - Other regular page types drop magic sections (they need product context).
  const visible = SECTION_SCHEMAS.filter((s) => {
    if (!isAvailableForPageType(s, pageType)) return false;
    if (isProductTemplate) return true;
    return !MAGIC_SECTION_KEYS.has(s.id);
  });

  // Hide a category tab entirely if no visible section uses it.
  const usedCategories = new Set<SectionSchema['category']>(visible.map((s) => s.category));
  const allCategories: { id: SectionSchema['category'] | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'showcase', label: 'Showcase' },
    { id: 'content', label: 'Content' },
    { id: 'commerce', label: 'Commerce' },
    { id: 'social', label: 'Social' },
    { id: 'layout', label: 'Layout' },
    { id: 'header', label: 'Header' },
    { id: 'footer', label: 'Footer' },
  ];
  const categories = allCategories.filter(
    (c) => c.id === 'all' || usedCategories.has(c.id),
  );

  const filtered = filter === 'all' ? visible : visible.filter((s) => s.category === filter);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add section
          </Button>
        }
      />
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>
            Pick a section type to add to this page. The preview shows the rough layout.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b -mx-6 px-6 pb-3">
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
            </button>
          ))}
        </div>

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
              className="group flex flex-col w-full h-max text-left rounded-lg border border-zinc-200 hover:border-zinc-900 hover:shadow-md bg-white overflow-hidden transition-all disabled:opacity-50 disabled:hover:border-zinc-200 disabled:hover:shadow-none"
            >
              {/* Thumbnail — flex shrink so it doesn't eat the text area */}
              <div className="aspect-5/3 bg-zinc-50 border-b border-zinc-100 overflow-hidden shrink-0">
                <SectionPreview
                  sectionKey={s.id}
                  className="block w-full h-full transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </div>
              {/* Text area — explicit min-width-0 so long names truncate cleanly */}
              <div className="flex flex-col gap-1.5 p-3.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold leading-tight text-zinc-900 truncate">
                    {labelOf(s.label, locale)}
                  </h4>
                  <span className="text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                    {s.category}
                  </span>
                </div>
                {s.description && (
                  <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
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
