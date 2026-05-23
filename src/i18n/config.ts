// Dashboard UI locales. This is the language of the dashboard interface itself
// (buttons, labels, navigation) — distinct from a store's CONTENT locales
// (primary_locale / secondary_locales) which control product/page translations.
export const locales = ['en', 'ar', 'tr', 'de', 'fr', 'sv'] as const;
export type Locale = (typeof locales)[number];

// English is the default dashboard UI language.
export const defaultLocale: Locale = 'en';

// Cookie that stores the user's chosen dashboard UI language. Deliberately
// separate from the storefront's `x-store-locale` so the dashboard UI language
// is independent of the store content language being edited.
export const LOCALE_COOKIE = 'dashboard-locale';

export const rtlLocales: Locale[] = ['ar'];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}
