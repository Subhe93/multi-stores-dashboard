// Tax helpers shared by the tax pages, settings, product form and order pages.
//
// Rates travel as basis points (2500 = 25 %). Stores and the platform keep
// their own `TaxRate` rows (see plans/tax-system/API-CONTRACT-TAX.md); orders
// snapshot the resolved lines in `Order.tax_lines` and keep `tax_rate_bp` as
// the headline (highest) rate with `tax_amount` as the tax total.

import { API_URL } from '@/lib/api';

export type TaxPricingMode = 'INCLUSIVE' | 'EXCLUSIVE';
export type TaxBasis = 'SHIPPING' | 'BILLING' | 'STORE';
export type TaxRegistrant = 'STORE' | 'PLATFORM';

// Localised text map ({ en: "VAT", sv: "Moms" }). Older rows may hold a string.
export type LocalizedText = Record<string, string> | string | null | undefined;

export interface TaxClass {
  id: string;
  store_id: string | null;
  key: string;
  name: LocalizedText;
  is_default: boolean;
  sort_order: number;
}

export interface TaxRateRow {
  id: string;
  store_id: string | null;
  tax_class_id: string;
  country: string;
  region: string | null;
  postcode_pattern: string | null;
  rate_bp: number;
  label: LocalizedText;
  priority: number;
  applies_to_shipping: boolean;
  is_active: boolean;
  tax_class?: TaxClass;
}

// One itemised tax row on an order (major units, order currency).
export interface TaxLine {
  label: string;
  rate_bp: number;
  taxable_amount: number;
  tax_amount: number;
}

export interface TaxReportRow {
  country: string;
  label: string;
  rate_bp: number;
  taxable_amount: number;
  tax_amount: number;
  order_count: number;
  currency: string;
}

// GET /taxes/my/settings
export interface MyTaxSettings {
  registrant: TaxRegistrant;
  pricing_mode: TaxPricingMode;
  basis: TaxBasis;
  tax_country: string | null;
  oss_registered: boolean;
  use_platform_tax_rates: boolean;
  shipping_tax_class_id: string | null;
  display_prices_incl_tax: boolean;
  classes: TaxClass[];
  platform_rates_count: number;
  // Number of the store's own rate rows (independent stores; 0 for marketplace
  // stores). Absent on older API builds.
  store_rates_count?: number;
  // Country the tax engine actually uses: the stored `tax_country` when set,
  // else the platform's registration country. `tax_country` above stays the
  // raw stored value (null = "platform default").
  effective_tax_country?: string | null;
}

// GET /taxes/admin/settings
export interface PlatformTaxSettings {
  default_tax_pricing_mode: TaxPricingMode;
  platform_tax_country: string | null;
  platform_oss_registered: boolean;
  tax_rates_seeded_at?: string | null;
}

// Basis points -> percent string for a numeric input (2500 -> "25", 1250 -> "12.5").
export function formatTaxRatePercent(bp?: number | null): string {
  if (!bp) return '0';
  return String(Math.round(bp) / 100);
}

// Basis points -> human label with the unit ("25 %").
export function formatTaxRateLabel(bp?: number | null): string {
  return `${formatTaxRatePercent(bp)} %`;
}

// Percent string -> basis points, clamped to 0-100 % with two decimals allowed
// (8.1 %, 25.5 %). Returns null when the input is not a number.
export function parseTaxRateBp(input: string): number | null {
  const value = Number(input.trim().replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped * 100);
}

// Picks the best translation of a localised map: requested locale, then
// English, then the first value. Strings are returned as-is.
export function localizedTaxText(value: LocalizedText, locale: string, fallback = ''): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[locale] || value.en || Object.values(value).find(Boolean) || fallback;
}

// Itemised tax lines of an order. Orders created before the tax system have no
// `tax_lines`; they are rebuilt from the legacy headline rate + tax total.
export function orderTaxLines(order: {
  tax_lines?: TaxLine[] | null;
  tax_rate_bp?: number | null;
  tax_amount?: number | string | null;
  total?: number | string | null;
}): TaxLine[] {
  if (Array.isArray(order.tax_lines) && order.tax_lines.length > 0) {
    return order.tax_lines.filter((line) => Number(line.tax_amount) > 0 || Number(line.rate_bp) > 0);
  }
  const taxAmount = Number(order.tax_amount ?? 0);
  const rateBp = Number(order.tax_rate_bp ?? 0);
  if (taxAmount <= 0 || rateBp <= 0) return [];
  return [{ label: 'VAT', rate_bp: rateBp, taxable_amount: Number(order.total ?? 0) - taxAmount, tax_amount: taxAmount }];
}

// Format an amount in a specific currency (the order's own, which for an
// independent store can differ from the dashboard default).
export function formatAmountIn(amount: number | string | null | undefined, currency: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount ?? 0));
}

// YYYY-MM-DD in local time, for <input type="date"> defaults.
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Downloads an authenticated CSV endpoint and saves it through a temporary
// object URL. `api()` only handles JSON, so the fetch is done directly here.
export async function downloadCsv(endpoint: string, token: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let message = 'Download failed';
    try {
      const json = await res.json();
      if (json?.message) message = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
