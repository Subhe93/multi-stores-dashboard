'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, CornerDownLeft, FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useShell } from '../shell-context';
import type { NavItem } from '../nav-types';
import { DARK_FOCUS_RING, isEditableTarget } from './utils';
import { useIsMac } from './useIsMac';

interface SearchEntry {
  key: string;
  label: string;
  href: string;
  icon?: ReactNode;
  /** Parent item label, shown as context for nested entries. */
  parent?: string;
}

interface SearchSection {
  id: string;
  heading: string;
  entries: SearchEntry[];
}

/** Flatten an item list (items + children) into searchable entries. */
function flatten(items: NavItem[], keyPrefix: string): SearchEntry[] {
  const out: SearchEntry[] = [];
  items.forEach((item, i) => {
    const key = `${keyPrefix}-${i}`;
    out.push({ key, label: item.label, href: item.href, icon: item.icon });
    item.children?.forEach((child, j) => {
      out.push({
        key: `${key}-${j}`,
        label: child.label,
        href: child.href,
        // Children inherit the parent's icon when they have none, for visual grouping.
        icon: child.icon ?? item.icon,
        parent: item.label,
      });
    });
  });
  return out;
}

/**
 * Palette filter: plain (locale-aware lowercase) substring matching over the
 * entry's label and parent label only. cmdk's default fuzzy scorer matched
 * scattered letters across keywords (and the href), so "the" listed nearly
 * every page. Label prefix > word prefix > substring; parent-only matches rank last.
 */
function filterEntry(_value: string, search: string, keywords?: string[]): number {
  const q = search.trim().toLocaleLowerCase();
  if (!q) return 1;
  const [label = '', parent = ''] = (keywords ?? []).map((k) => k.toLocaleLowerCase());
  if (label.startsWith(q)) return 1;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 0.8;
  if (label.includes(q)) return 0.6;
  if (parent.includes(q)) return 0.3;
  return 0;
}

/** Keyboard hint, e.g. "⌘ K" or "Ctrl K". Rendered LTR so it reads the same in RTL. */
function ShortcutHint({ className }: { className?: string }) {
  const isMac = useIsMac();
  return (
    <kbd
      dir="ltr"
      aria-hidden="true"
      className={cn(
        'pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border px-1.5 font-sans text-[10px] font-medium',
        className,
      )}
    >
      {isMac ? <span className="text-xs leading-none">⌘</span> : <span>Ctrl</span>}
      <span>K</span>
    </kbd>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-muted/50 px-1 font-sans text-[10px]">
      {children}
    </kbd>
  );
}

/**
 * Top-bar search: a field-like trigger (icon-only on small screens) that opens a
 * command palette over every navigation entry. Shortcuts: Cmd/Ctrl+K anywhere,
 * "/" when focus is not inside a text field.
 */
export function CommandSearch() {
  const { nav } = useShell();
  const router = useRouter();
  const t = useTranslations('shell');
  const [open, setOpen] = useState(false);

  const sections = useMemo<SearchSection[]>(() => {
    const list: SearchSection[] = nav.groups
      .map((group, gi) => ({
        id: group.id,
        heading: group.title || t('searchGroupNavigation'),
        entries: flatten(group.items, `g${gi}`),
      }))
      .filter((s) => s.entries.length > 0);
    if (nav.footerItems?.length) {
      list.push({ id: '__footer', heading: t('searchGroupMore'), entries: flatten(nav.footerItems, 'f') });
    }
    return list;
  }, [nav, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // Rich-text editors commonly bind Mod+K (insert link): leave it to them.
      const inRichText = e.target instanceof HTMLElement && e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k' && !inRichText) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <>
      {/* md+: field-like trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('searchOpen')}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
        className={cn(
          'hidden h-9 w-full max-w-xl items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 ps-3 pe-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 md:flex',
          DARK_FOCUS_RING,
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-start">{t('searchPlaceholder')}</span>
        <ShortcutHint className="border-zinc-600 bg-zinc-900/60 text-zinc-400" />
      </button>

      {/* Small screens: icon-only trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('searchOpen')}
        aria-haspopup="dialog"
        className={cn(
          'flex size-9 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white md:hidden',
          DARK_FOCUS_RING,
        )}
      >
        <Search className="size-[18px]" aria-hidden="true" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('searchTitle')}
        description={t('searchDescription')}
        className="gap-0 sm:max-w-xl"
      >
        <Command loop filter={filterEntry} className="rounded-none! p-0">
          <div className="border-b border-border p-1.5 **:data-[slot=command-input-wrapper]:p-0! **:data-[slot=input-group]:h-10! **:data-[slot=input-group]:border-0! **:data-[slot=input-group]:bg-transparent!">
            <CommandInput placeholder={t('searchInputPlaceholder')} aria-label={t('searchInputPlaceholder')} />
          </div>
          <CommandList className="max-h-[min(60vh,26rem)] p-1">
            <CommandEmpty className="py-10 text-muted-foreground">
              <Search className="mx-auto mb-2 size-5 opacity-40" aria-hidden="true" />
              {t('searchEmpty')}
            </CommandEmpty>
            {sections.map((section) => (
              <CommandGroup key={section.id} heading={section.heading}>
                {section.entries.map((entry) => (
                  <CommandItem
                    key={entry.key}
                    // Unique value (labels can repeat); filterEntry reads only the keywords.
                    value={entry.key}
                    keywords={[entry.label, entry.parent ?? '']}
                    onSelect={() => go(entry.href)}
                    className="gap-2.5 py-2"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground [&_svg]:size-3.5!">
                      {entry.icon ?? <FileText />}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      {entry.parent && (
                        <>
                          <span className="truncate text-muted-foreground">{entry.parent}</span>
                          <ChevronRight className="size-3! text-muted-foreground/60 rtl:rotate-180" aria-hidden="true" />
                        </>
                      )}
                      <span className="truncate font-medium">{entry.label}</span>
                    </span>
                    <CornerDownLeft
                      className="size-3.5! text-muted-foreground opacity-0 group-data-selected/command-item:opacity-100"
                      aria-hidden="true"
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="hidden items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1">
              <Key>↑</Key>
              <Key>↓</Key>
              {t('searchHintNavigate')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Key>↵</Key>
              {t('searchHintOpen')}
            </span>
            <span className="ms-auto inline-flex items-center gap-1">
              <Key>Esc</Key>
              {t('searchHintClose')}
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
