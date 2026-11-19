// Store CONTENT locales the platform supports (mirror of the API's
// SUPPORTED_LOCALES in markets/market.types.ts and the storefront's `locales`).
// Distinct from the dashboard UI locales in '@/i18n/config'.
export const CONTENT_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'sv', label: 'Svenska' },
  // Kurdish, Kurmanji (Latin script, left to right).
  { value: 'ku', label: 'Kurdî' },
] as const;

export const CONTENT_LOCALE_CODES: string[] = CONTENT_LOCALES.map((l) => l.value);

// Locales in review (mirror of the API's REVIEW_LOCALES): a store can enable
// them and edit their content, the storefront serves them under their URL
// prefix, but keeps them out of the language switcher, hreflang, sitemaps and
// search indexing until a native speaker has reviewed the texts.
export const REVIEW_LOCALES: readonly string[] = [];

export function isReviewLocale(code: string | null | undefined): boolean {
  return REVIEW_LOCALES.includes(code ?? '');
}

// Platform-wide fallback content locale (API fallback_locale default).
export const PLATFORM_PRIMARY_LOCALE = 'en';
