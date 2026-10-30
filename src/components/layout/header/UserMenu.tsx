'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locales, LOCALE_COOKIE } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useShell } from '../shell-context';
import { DARK_FOCUS_RING, initialsOf } from './utils';

// Native language names (kept in sync with DashboardLocaleSwitcher). This
// switches the dashboard UI language only, never a store's content locales.
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};

/** Avatar button opening the account menu: identity, language, log out. */
export function UserMenu() {
  const { user, onLogout } = useShell();
  const t = useTranslations('shell');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initials = initialsOf(user.label || user.email);

  function changeLocale(next: string) {
    if (next === locale) return;
    // Persist for a year; refresh re-renders server components with the new locale.
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('userMenuOpen', { name: user.label })}
        className={cn(
          'flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-white/10 data-popup-open:bg-white/10 lg:rounded-lg lg:pe-2',
          DARK_FOCUS_RING,
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-teal-600 text-xs font-semibold text-white ring-1 ring-white/20"
        >
          {initials}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-zinc-100 lg:inline">
          {user.label}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal text-foreground">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-teal-600 text-sm font-semibold text-white"
            >
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{user.label}</span>
              {user.email && (
                // Isolate the LTR address inline so the line still aligns to the start in RTL.
                <span className="truncate text-xs text-muted-foreground">
                  <bdi dir="ltr">{user.email}</bdi>
                </span>
              )}
              {user.roleLabel && (
                <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {user.roleLabel}
                </span>
              )}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 px-2 py-1.5" disabled={pending}>
            <Globe className="text-muted-foreground" />
            <span className="flex-1">{t('language')}</span>
            <span className="text-xs text-muted-foreground">{LOCALE_LABELS[locale] ?? locale.toUpperCase()}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-40">
            <DropdownMenuRadioGroup value={locale} onValueChange={(v) => changeLocale(String(v))}>
              {locales.map((l) => (
                <DropdownMenuRadioItem key={l} value={l} lang={l} className="py-1.5">
                  {LOCALE_LABELS[l] ?? l.toUpperCase()}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onLogout} className="gap-2 px-2 py-1.5">
          <LogOut className="text-muted-foreground" />
          {tc('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
