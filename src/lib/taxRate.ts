// VAT rate helpers shared by the settings, creator and order pages.
//
// Rates travel as basis points (2500 = 25 %). `Store.tax_rate_bp` is nullable
// (null = inherit `PlatformConfig.default_tax_rate_bp`); orders snapshot the
// resolved rate in `Order.tax_rate_bp` together with the included VAT amount.

// Basis points -> percent string for a numeric input (2500 -> "25", 1250 -> "12.5").
export function formatTaxRatePercent(bp?: number | null): string {
  if (!bp) return '0';
  return String(Math.round(bp) / 100);
}

// Basis points -> human label with the unit ("25 %").
export function formatTaxRateLabel(bp?: number | null): string {
  return `${formatTaxRatePercent(bp)} %`;
}

// Percent string -> basis points, clamped to 0-100 % with one decimal allowed.
// Returns null when the input is not a number.
export function parseTaxRateBp(input: string): number | null {
  const value = Number(input.trim().replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped * 10) * 10;
}

// Effective rate for a store: its override, or the platform default.
export function resolveTaxRateBp(storeBp: number | null | undefined, platformBp: number | null | undefined): number {
  return storeBp ?? platformBp ?? 0;
}

// Format an amount in a specific currency (the order's own, which for an
// independent store can differ from the dashboard default).
export function formatAmountIn(amount: number | string | null | undefined, currency: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount ?? 0));
}
