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
] as const;

export const CONTENT_LOCALE_CODES: string[] = CONTENT_LOCALES.map((l) => l.value);

// Platform-wide fallback content locale (API fallback_locale default).
export const PLATFORM_PRIMARY_LOCALE = 'en';
