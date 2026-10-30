'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/common/NotificationBell';
import { useShell } from './shell-context';
import { CommandSearch } from './header/CommandSearch';
import { UserMenu } from './header/UserMenu';
import { DARK_FOCUS_RING, initialsOf } from './header/utils';

interface DashboardHeaderProps {
  /** Extra controls placed before the notifications (e.g. the "Visit store" button). */
  extras?: ReactNode;
}

/**
 * Restyles light-theme controls passed in as `extras` (shadcn outline buttons)
 * for the dark top bar, without touching the components themselves.
 */
const DARK_EXTRAS =
  '[&_[data-slot=button]]:border-zinc-700 [&_[data-slot=button]]:bg-zinc-900 [&_[data-slot=button]]:text-zinc-100 [&_[data-slot=button]:hover]:border-zinc-600 [&_[data-slot=button]:hover]:bg-zinc-800 [&_[data-slot=button]:hover]:text-white [&_a]:rounded-lg [&_a]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-white/70';

/**
 * NotificationBell was built for a light header: recolour its trigger for the
 * dark bar while its popover keeps dark text on white (hence text-zinc-900).
 */
const DARK_BELL =
  'text-zinc-900 [&>div>button]:text-zinc-300 [&>div>button:hover]:bg-white/10 [&>div>button:hover]:text-white [&>div>button]:outline-none [&>div>button:focus-visible]:ring-2 [&>div>button:focus-visible]:ring-white/70';

/** Shopify-style dark top bar: menu + brand, global search, actions + account. */
export function DashboardHeader({ extras }: DashboardHeaderProps) {
  const { nav, user, brandTitle, mobileNavOpen, setMobileNavOpen } = useShell();
  const t = useTranslations('shell');

  const homeHref = nav.groups[0]?.items[0]?.href ?? '/';

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-zinc-950 px-2 text-white sm:gap-3 sm:px-4">
      {/* Inline-start: mobile menu + brand */}
      <div className="flex min-w-0 items-center gap-1.5 lg:w-56 lg:shrink-0">
        <button
          type="button"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label={mobileNavOpen ? t('closeMenu') : t('openMenu')}
          aria-expanded={mobileNavOpen}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden',
            DARK_FOCUS_RING,
          )}
        >
          {mobileNavOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>

        <Link
          href={homeHref}
          aria-label={t('brandHome', { name: brandTitle })}
          className={cn('flex min-w-0 items-center gap-2.5 rounded-md py-1 pe-1.5', DARK_FOCUS_RING)}
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-bold tracking-tight text-zinc-950"
          >
            {initialsOf(brandTitle, '•')}
          </span>
          <span className="hidden min-w-0 flex-col leading-tight min-[420px]:flex">
            <span className="truncate text-sm font-semibold text-white">{brandTitle}</span>
            {user.roleLabel && (
              <span className="truncate text-[11px] font-medium text-zinc-400">{user.roleLabel}</span>
            )}
          </span>
        </Link>
      </div>

      {/* Center: global search. A single instance (one shortcut listener, one dialog):
          a full field on md+, an icon pushed to the end group on small screens. */}
      <div className="ms-auto flex min-w-0 items-center md:ms-0 md:flex-1 md:justify-center">
        <CommandSearch />
      </div>

      {/* Inline-end: actions + account */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:min-w-56 lg:justify-end">
        {extras && <div className={cn('flex items-center', DARK_EXTRAS)}>{extras}</div>}
        <div className={DARK_BELL}>
          <NotificationBell role={user.role} />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
