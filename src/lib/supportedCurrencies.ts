// Mirror of multi-stores-api/src/common/money/currency.util.ts SUPPORTED_CURRENCIES — keep in sync.
//
// Currencies a store or market may be priced in. The API rejects anything
// else with MARKET_CURRENCY_UNSUPPORTED, so the market form only offers
// these codes.

import { CURRENCIES, type CurrencyOption } from '@/lib/currencies';

export const SUPPORTED_CURRENCIES = [
  'AED',
  'AUD',
  'BGN',
  'BRL',
  'CAD',
  'CHF',
  'CNY',
  'CZK',
  'DKK',
  'EGP',
  'EUR',
  'GBP',
  'HKD',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JPY',
  'KRW',
  'MAD',
  'MXN',
  'MYR',
  'NOK',
  'NZD',
  'PHP',
  'PLN',
  'QAR',
  'RON',
  'SAR',
  'SEK',
  'SGD',
  'THB',
  'TRY',
  'TWD',
  'USD',
  'ZAR',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Select options for the supported currencies only (labels from the ISO list). */
export const SUPPORTED_CURRENCY_OPTIONS: CurrencyOption[] = CURRENCIES.filter((c) =>
  (SUPPORTED_CURRENCIES as readonly string[]).includes(c.value),
);
