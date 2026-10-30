'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { XIcon } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { isRtl } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { DashboardHeader } from './DashboardHeader';
import { AppSidebar } from './Sidebar';
import { ShellContext, type ShellContextValue } from './shell-context';
import type { ShellNav, ShellUser } from './nav-types';

interface AppShellProps {
  nav: ShellNav;
  user: ShellUser;
  brandTitle: string;
  onLogout: () => void;
  /** Extra controls placed in the header (e.g. the "View store" button). */
  headerExtras?: ReactNode;
  children: ReactNode;
}

/** Tailwind's `lg` breakpoint: the persistent sidebar takes over from here. */
const DESKTOP_QUERY = '(min-width: 1024px)';

export function AppShell({ nav, user, brandTitle, onLogout, headerExtras, children }: AppShellProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('shell');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the drawer whenever the route changes (adjust-state-during-render
  // pattern instead of an effect, so there is no extra render with a stale drawer).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (mobileNavOpen) setMobileNavOpen(false);
  }

  // Close the drawer once the viewport grows to the desktop layout.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const ctx = useMemo<ShellContextValue>(
    () => ({ nav, user, brandTitle, onLogout, mobileNavOpen, setMobileNavOpen }),
    [nav, user, brandTitle, onLogout, mobileNavOpen],
  );

  // The Sheet only knows physical sides; pick the inline-start edge.
  const drawerSide = isRtl(locale) ? 'right' : 'left';

  return (
    <ShellContext.Provider value={ctx}>
      <div className="flex min-h-dvh flex-col bg-zinc-50">
        <DashboardHeader extras={headerExtras} />

        <div className="flex flex-1">
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-e border-zinc-200 bg-zinc-50 lg:flex">
            <AppSidebar nav={nav} />
          </aside>

          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side={drawerSide}
          showCloseButton={false}
          // Variant-qualified widths so they beat the Sheet's data-[side] defaults.
          className={cn(
            'max-w-[85vw] gap-0 border-zinc-200 bg-zinc-50 p-0 data-[side=left]:w-72 data-[side=right]:w-72 lg:hidden',
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 ps-5 pe-3">
            <SheetTitle className="truncate text-sm font-semibold text-zinc-900">{brandTitle}</SheetTitle>
            <SheetClose
              aria-label={t('closeMenu')}
              className="flex size-8 items-center justify-center rounded-lg text-zinc-500 outline-none transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <XIcon className="size-4" aria-hidden />
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1">
            <AppSidebar nav={nav} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </ShellContext.Provider>
  );
}
