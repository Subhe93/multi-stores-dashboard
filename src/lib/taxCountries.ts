// Country options for the tax pages. The shipping country list only covers
// the regions the platform ships to, while tax rates exist for every seeded
// country (EU, GB/CH/NO/TR, GCC), so both sets are merged and named through
// Intl.DisplayNames in the dashboard UI locale.

import { COUNTRIES, countryFlag } from '@/components/common/CountryMultiSelect';

export const EU_COUNTRY_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

// Countries the seed endpoint creates rates for (see API-CONTRACT-TAX.md §3).
export const SEEDED_TAX_COUNTRY_CODES = [
  ...EU_COUNTRY_CODES,
  'GB', 'CH', 'NO', 'TR',
  'AE', 'SA', 'BH', 'OM', 'QA', 'KW', 'EG', 'JO',
];

export interface CountryOption {
  value: string;
  label: string;
  description?: string;
}

// Localised country name; falls back to the shipping list name, then the code.
export function countryName(code: string, locale: string): string {
  const upper = (code || '').toUpperCase();
  if (upper.length !== 2) return code;
  try {
    const name = new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(upper);
    if (name && name !== upper) return name;
  } catch {
    // Unsupported locale or code; fall through to the static list.
  }
  return COUNTRIES.find((c) => c.code === upper)?.name || upper;
}

// "🇸🇪 Sweden" for table cells.
export function countryLabel(code: string, locale: string): string {
  return `${countryFlag(code)} ${countryName(code, locale)}`;
}

// Searchable-select options: merged country set, sorted by localised name.
// `extraCodes` lets a page include codes that already appear in its data.
export function taxCountryOptions(locale: string, extraCodes: string[] = []): CountryOption[] {
  const codes = new Set<string>([
    ...COUNTRIES.map((c) => c.code),
    ...SEEDED_TAX_COUNTRY_CODES,
    ...extraCodes.map((c) => c.toUpperCase()).filter((c) => c.length === 2),
  ]);
  return Array.from(codes)
    .map((code) => ({ value: code, label: countryLabel(code, locale), description: code }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
