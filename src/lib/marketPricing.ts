// Mirror of multi-stores-api/src/modules/markets/pricing.util.ts (plus the
// currencyDecimals/roundMoney helpers it uses from
// src/common/money/currency.util.ts) — keep in sync.
//
// Client-side preview of the market price math so the rule editor shows the
// same number the API will store. The API remains the source of truth.

import type { PriceRule } from '@/lib/markets.api';

type PriceRounding = NonNullable<PriceRule['rounding']>;

/** Stripe zero-decimal currencies: an amount is already the whole unit. */
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/** How many minor units this currency has (2 for most, 0 for JPY-likes). */
export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2;
}

/** Round a major-unit amount to what the database stores for this currency. */
export function roundMoney(amount: number, currency?: string): number {
  const decimals = currency ? currencyDecimals(currency) : 2;
  const factor = 10 ** decimals;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function convertAmount(amountBase: number, rate: number): number {
  const a = Number(amountBase);
  const r = Number(rate);
  if (!Number.isFinite(a) || !Number.isFinite(r) || r <= 0) return 0;
  return a * r;
}

/** The candidate closest to `value`; ties go to the higher one. */
function nearest(value: number, candidates: number[]): number {
  let best = candidates[0];
  for (const c of candidates) {
    const d = Math.abs(c - value);
    const bd = Math.abs(best - value);
    if (d < bd || (d === bd && c > best)) best = c;
  }
  return best;
}

/**
 * Round a converted amount to a "nice" price: first to a multiple of
 * `increment`, then to the chosen ending. Decimal endings ('.99', '.90',
 * '.95') move to the nearest value with that fraction; '9' to the nearest
 * whole number ending in 9; '0' to the nearest multiple of 10. Zero-decimal
 * currencies ignore the decimal endings. Always ends with roundMoney().
 */
export function applyRounding(amount: number, rounding: PriceRounding | null | undefined, currency: string): number {
  let value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return roundMoney(value, currency);
  const increment = Number(rounding?.increment);
  if (Number.isFinite(increment) && increment > 0) {
    value = Math.round(value / increment) * increment;
  }
  const ending = rounding?.ending ?? 'none';
  const zeroDecimal = currencyDecimals(currency) === 0;
  switch (ending) {
    case '.99':
    case '.90':
    case '.95': {
      if (zeroDecimal) break;
      const fraction = Number(ending);
      const base = Math.floor(value);
      value = nearest(value, [base - 1 + fraction, base + fraction, base + 1 + fraction].filter((c) => c > 0));
      break;
    }
    case '9': {
      const k = Math.round((value - 9) / 10);
      value = Math.max(9, k * 10 + 9);
      break;
    }
    case '0': {
      value = Math.max(10, Math.round(value / 10) * 10);
      break;
    }
    default:
      break;
  }
  return roundMoney(value, currency);
}

/** Converted + rounded market price for a base amount (null without a rate). */
export function previewMarketPrice(
  basePrice: number,
  rate: number | null,
  rounding: PriceRounding | null | undefined,
  currency: string,
): number | null {
  if (rate == null) return null;
  return applyRounding(convertAmount(basePrice, rate), rounding, currency);
}
