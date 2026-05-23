'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { locales, LOCALE_COOKIE } from '@/i18n/config';

// Native language names for the dashboard UI language picker. This switches the
// dashboard interface language only (stored in the `dashboard-locale` cookie) —
// it does not affect a store's content locales.
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};

export function DashboardLocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    // Persist for a year; refresh re-renders server components with the new locale.
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className={className}>
      <div className="relative flex items-center">
        <Globe className="pointer-events-none absolute inset-s-2 h-4 w-4 text-zinc-400" />
        <select
          value={locale}
          onChange={(e) => change(e.target.value)}
          disabled={pending}
          aria-label="Language"
          className="w-full appearance-none rounded-md border border-zinc-200 bg-white py-1.5 ps-8 pe-7 text-sm text-zinc-700 transition hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50"
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l] ?? l.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
