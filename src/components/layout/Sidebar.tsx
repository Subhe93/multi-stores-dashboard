'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { NavItem, ShellNav } from './nav-types';

interface AppSidebarProps {
  nav: ShellNav;
  /** Called after any link click (the mobile drawer uses it to close itself). */
  onNavigate?: () => void;
}

/* ───────────────────────── Active matching ───────────────────────── */

/** Drop query string / hash and any trailing slash (except the root). */
function normalizePath(path: string): string {
  const bare = path.split(/[?#]/)[0] || '/';
  return bare.length > 1 ? bare.replace(/\/+$/, '') : bare;
}

/**
 * Score how well `href` matches `pathname`: the matched href length, or -1.
 * Prefix matches are segment-aware, so /creator/products does not match
 * /creator/productsX. `exact` entries only match the identical path.
 */
function matchScore(pathname: string, item: NavItem): number {
  const href = normalizePath(item.href);
  if (pathname === href) return href.length;
  if (item.exact) return -1;
  const prefix = href === '/' ? '/' : `${href}/`;
  return pathname.startsWith(prefix) ? href.length : -1;
}

/** Stable key for every entry, independent of possibly duplicated hrefs. */
type Keyed = { key: string; item: NavItem; parentKey?: string };

function flatten(nav: ShellNav): Keyed[] {
  const out: Keyed[] = [];
  const walk = (items: NavItem[], prefix: string) => {
    items.forEach((item, i) => {
      const key = `${prefix}-${i}`;
      out.push({ key, item });
      item.children?.forEach((child, ci) => {
        out.push({ key: `${key}-c${ci}`, item: child, parentKey: key });
      });
    });
  };
  nav.groups.forEach((g) => walk(g.items, `g:${g.id}`));
  if (nav.footerItems) walk(nav.footerItems, 'footer');
  return out;
}

/**
 * Longest-prefix wins across all items, children and footer entries.
 * Returns the active entry key and, when that entry is a child, its parent key.
 */
function useActiveEntry(nav: ShellNav): { activeKey?: string; activeParentKey?: string } {
  const pathname = normalizePath(usePathname() ?? '/');
  const entries = useMemo(() => flatten(nav), [nav]);
  return useMemo(() => {
    let best: Keyed | undefined;
    let bestScore = -1;
    for (const entry of entries) {
      const score = matchScore(pathname, entry.item);
      // Strictly greater keeps the first declared entry on ties.
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
    return { activeKey: best?.key, activeParentKey: best?.parentKey };
  }, [entries, pathname]);
}

/* ───────────────────────── Presentation ───────────────────────── */

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50';

function Badge({ value, inverted }: { value: string | number; inverted?: boolean }) {
  return (
    <span
      className={cn(
        'ms-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums',
        inverted ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700',
      )}
    >
      {value}
    </span>
  );
}

interface ItemProps {
  item: NavItem;
  itemKey: string;
  activeKey?: string;
  activeParentKey?: string;
  onNavigate?: () => void;
}

function SidebarItem({ item, itemKey, activeKey, activeParentKey, onNavigate }: ItemProps) {
  const isActive = activeKey === itemKey;
  // A child is the active entry: the parent stays marked as the open section.
  const isSectionOpen = activeParentKey === itemKey;
  const expanded = (isActive || isSectionOpen) && !!item.children?.length;

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors',
          focusRing,
          isActive
            ? 'bg-zinc-900 font-medium text-white'
            : isSectionOpen
              ? 'bg-zinc-200/60 font-semibold text-zinc-900'
              : 'font-medium text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-900',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-4 shrink-0 items-center justify-center [&_svg]:size-4',
            isActive ? 'text-white' : isSectionOpen ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-700',
          )}
        >
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.badge != null && item.badge !== '' && <Badge value={item.badge} inverted={isActive} />}
      </Link>

      {expanded && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children!.map((child, ci) => {
            const childKey = `${itemKey}-c${ci}`;
            const childActive = activeKey === childKey;
            return (
              <li key={childKey}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    // ps-[34px] = item padding (10px) + icon (16px) + gap (8px): aligns under the parent label.
                    'flex h-8 items-center gap-2 rounded-lg pe-2.5 ps-[34px] text-[13px] transition-colors',
                    focusRing,
                    // Same dark highlight as a top-level active entry (owner preference).
                    childActive
                      ? 'bg-zinc-900 font-medium text-white'
                      : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  {child.badge != null && child.badge !== '' && <Badge value={child.badge} inverted={childActive} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * Shopify-style navigation list. Renders only the navigation itself; the
 * caller decides the container (desktop <aside> or the mobile drawer).
 */
export function AppSidebar({ nav, onNavigate }: AppSidebarProps) {
  const t = useTranslations('shell');
  const { activeKey, activeParentKey } = useActiveEntry(nav);
  // The desktop sidebar and the mobile drawer can be mounted together: keep heading ids unique.
  const idPrefix = useId();
  const footerItems = nav.footerItems ?? [];

  return (
    <nav aria-label={t('mainNavigation')} className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {nav.groups.map((group) => {
          const headingId = group.title ? `${idPrefix}-group-${group.id}` : undefined;
          return (
            <div key={group.id}>
              {group.title && (
                <p id={headingId} className="mb-1 px-2.5 text-xs font-medium text-zinc-500">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5" aria-labelledby={headingId}>
                {group.items.map((item, i) => {
                  const key = `g:${group.id}-${i}`;
                  return (
                    <SidebarItem
                      key={key}
                      item={item}
                      itemKey={key}
                      activeKey={activeKey}
                      activeParentKey={activeParentKey}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {footerItems.length > 0 && (
        <ul className="shrink-0 space-y-0.5 border-t border-zinc-200 px-3 py-3">
          {footerItems.map((item, i) => {
            const key = `footer-${i}`;
            return (
              <SidebarItem
                key={key}
                item={item}
                itemKey={key}
                activeKey={activeKey}
                activeParentKey={activeParentKey}
                onNavigate={onNavigate}
              />
            );
          })}
        </ul>
      )}
    </nav>
  );
}
