'use client';

// Header chip + dropdown that lists every page in the store. Tapping the
// current-page chip opens the list; tapping a row navigates the builder to
// that page without leaving the workspace. Lives in the PublishBar where the
// static "page type + title" used to sit.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Check,
  ChevronDown,
  Columns,
  FileText,
  Home,
  Info,
  LayoutPanelTop,
  Package,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StorePageSummary {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  type: string;
  translations: { locale: string; title: string }[];
}

interface PageSwitcherProps {
  currentPageId: string;
  currentPageType: string;
  currentPageTitle: string;
  currentStatus: 'DRAFT' | 'PUBLISHED';
  locale: string;
  primaryLocale: string;
  pages: StorePageSummary[];
}

// Stable type sort order so the home page sits at the top, followed by the
// other section-builder kinds, then the legacy page types. Pages of unknown
// type land after these. HEADER/FOOTER sit at the bottom — they're chrome,
// edited less often than content pages.
const TYPE_SORT = [
  'HOME',
  'LANDING',
  'PRODUCT_TEMPLATE',
  'ABOUT',
  'CONTACT',
  'PRIVACY_POLICY',
  'TERMS',
  'SHIPPING_POLICY',
  'RETURN_POLICY',
  'CUSTOM',
  'STATIC',
  'HEADER',
  'FOOTER',
];

function pageUrlFor(p: { id: string }): string {
  return `/builder/${p.id}`;
}

// Type → icon mapping. Covers both v2 builder types and the canonical
// legacy content-page templates seen in /creator/pages.
const TYPE_ICON: Record<string, typeof Home> = {
  HOME: Home,
  STATIC: FileText,
  LANDING: Sparkles,
  PRODUCT_TEMPLATE: Package,
  ABOUT: Info,
  CONTACT: Phone,
  PRIVACY_POLICY: ShieldCheck,
  TERMS: Scale,
  SHIPPING_POLICY: Truck,
  RETURN_POLICY: RotateCcw,
  CUSTOM: ReceiptText,
  HEADER: LayoutPanelTop,
  FOOTER: Columns,
};

type Translator = ReturnType<typeof useTranslations>;

// Page-type identifiers that have a translated chrome label. Anything outside
// this set falls back to a humanized form of the raw type key.
const KNOWN_PAGE_TYPES = new Set([
  'HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'ABOUT', 'CONTACT',
  'PRIVACY_POLICY', 'TERMS', 'SHIPPING_POLICY', 'RETURN_POLICY',
  'CUSTOM', 'HEADER', 'FOOTER',
]);

function labelOfType(type: string, t: Translator): string {
  const k = type.toUpperCase();
  return KNOWN_PAGE_TYPES.has(k) ? t(`pageType.${k}`) : type.toLowerCase().replace(/_/g, ' ');
}

function titleOf(p: StorePageSummary, locale: string, primaryLocale: string): string {
  return (
    p.translations.find((t) => t.locale === locale)?.title ||
    p.translations.find((t) => t.locale === primaryLocale)?.title ||
    p.translations[0]?.title ||
    (p.type === 'HOME' ? 'Home' : p.slug || 'Untitled')
  );
}

export function PageSwitcher({
  currentPageId,
  currentPageType,
  currentPageTitle,
  currentStatus,
  locale,
  primaryLocale,
  pages,
}: PageSwitcherProps) {
  const t = useTranslations('builder');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Single flat list — all pages now open in the same section-based builder.
  // Sorted by type so the home page bubbles to the top.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = pages.filter((p) => {
      if (!q) return true;
      const title = titleOf(p, locale, primaryLocale).toLowerCase();
      return title.includes(q) || p.slug.toLowerCase().includes(q);
    });
    return matches.slice().sort((a, b) => {
      const ia = TYPE_SORT.indexOf(a.type.toUpperCase());
      const ib = TYPE_SORT.indexOf(b.type.toUpperCase());
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [pages, query, locale, primaryLocale]);

  const CurrentIcon = TYPE_ICON[currentPageType.toUpperCase()] || FileText;

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'group flex items-center gap-2 px-2 py-1 -mx-1 rounded-md transition min-w-0',
          'hover:bg-zinc-100 focus-visible:bg-zinc-100 outline-none',
          open && 'bg-zinc-100',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="size-7 rounded-md bg-zinc-100 group-hover:bg-white border border-zinc-200/80 flex items-center justify-center shrink-0 transition">
          <CurrentIcon className="size-3.5 text-zinc-600" />
        </div>
        <div className="min-w-0 text-start">
          <div className="text-[9.5px] uppercase tracking-wide text-zinc-400 leading-none">
            {labelOfType(currentPageType, t)}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[13px] font-semibold text-zinc-900 leading-tight truncate max-w-50">
              {currentPageTitle}
            </span>
            <span
              className={cn(
                'text-[9px] uppercase tracking-wide font-semibold px-1 py-0.5 rounded leading-none shrink-0',
                currentStatus === 'PUBLISHED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-200/70 text-zinc-600',
              )}
            >
              {currentStatus === 'PUBLISHED' ? t('published') : t('draft')}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn('size-3.5 text-zinc-400 shrink-0 transition-transform ms-1', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 inset-s-0 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-200/80 bg-zinc-50/50">
            <div className="relative">
              <Search className="size-3.5 text-zinc-400 absolute inset-s-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPages')}
                className="w-full h-8 ps-7 pe-2 text-[12px] rounded-md bg-white border border-zinc-200 outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11.5px] text-zinc-500">
                {t('noMatchingPages')}
              </div>
            ) : (
              filtered.map((p) => {
                const Icon = TYPE_ICON[p.type.toUpperCase()] || FileText;
                const title = titleOf(p, locale, primaryLocale);
                const isCurrent = p.id === currentPageId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (!isCurrent) router.push(pageUrlFor(p));
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-start transition',
                      isCurrent ? 'bg-indigo-50/70' : 'hover:bg-zinc-50',
                    )}
                  >
                    <div className="size-6 rounded bg-zinc-100 flex items-center justify-center shrink-0">
                      <Icon className="size-3 text-zinc-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-[12px] truncate leading-tight',
                          isCurrent ? 'font-semibold text-indigo-700' : 'font-medium text-zinc-800',
                        )}
                      >
                        {title}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono truncate leading-tight">
                        {labelOfType(p.type, t)} · /{p.slug || (p.type.toUpperCase() === 'HOME' ? '' : '—')}
                      </div>
                    </div>
                    {p.status === 'PUBLISHED' && (
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" title={t('published')} />
                    )}
                    {isCurrent && <Check className="size-3.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer action */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push('/creator/pages');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 border-t border-zinc-200/80 bg-zinc-50/60 hover:bg-zinc-100 text-[11.5px] font-medium text-zinc-700 transition"
          >
            <Plus className="size-3.5 text-zinc-500" />
            {t('managePages')}
          </button>
        </div>
      )}
    </div>
  );
}

