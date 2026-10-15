// Mirror of multi-stores-api/src/modules/b2b/b2b-settings.ts — keep in sync.
//
// The "b2b" store app keeps its settings in `StoreApp.settings` (no table of
// its own). The API is authoritative and validates on write
// (`STORE_APP_SETTINGS_INVALID`); this file only gives the dashboard a typed,
// default-merged view of whatever the API returned so the settings card can
// render before the creator has ever saved.

export type BuyerType = 'PERSON' | 'COMPANY';

// Buyer kinds in the order the dashboard lists them (select options, filters).
export const BUYER_TYPES: readonly BuyerType[] = ['PERSON', 'COMPANY'] as const;

export interface B2bSettings {
  // Whether shoppers may switch to "company" on the storefront at all.
  allow_company: boolean;
  // Buyer type a new visitor starts with when no cookie is set.
  default_buyer_type: BuyerType;
  // Company checkout must include a VAT number.
  require_vat_number: boolean;
  // ISO 3166-1 alpha-2 codes whose organisation-number format is validated
  // strictly (SE/FI/DK/NO have rules; other listed codes use the generic rule).
  org_number_countries: string[];
  // M2.5: remove VAT for VIES-validated EU business buyers shipping to
  // another EU country (reverse charge). Off by default.
  reverse_charge_enabled: boolean;
  // INCLUSIVE stores only: 'net' = the company pays the price excluding VAT,
  // 'gross' = the company pays the consumer price with a 0 % VAT line.
  reverse_charge_pricing: ReverseChargePricing;
  // VAT number sent to VIES as the requester (null = the invoices seller VAT
  // number); a requester makes VIES return a consultation number.
  vies_requester_vat: string | null;
}

export type ReverseChargePricing = 'net' | 'gross';
export const REVERSE_CHARGE_PRICINGS: readonly ReverseChargePricing[] = ['net', 'gross'] as const;

export const DEFAULT_B2B_SETTINGS: B2bSettings = {
  allow_company: true,
  default_buyer_type: 'PERSON',
  require_vat_number: false,
  org_number_countries: ['SE'],
  reverse_charge_enabled: false,
  reverse_charge_pricing: 'net',
  vies_requester_vat: null,
};

export function isReverseChargePricing(value: unknown): value is ReverseChargePricing {
  return value === 'net' || value === 'gross';
}

// Uppercase without spaces, dots or dashes ("se 5560-36079301" -> "SE556036079301").
export function normalizeVatNumber(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[\s.\-]/g, '');
}

// ISO country of a VAT number prefix (EL is Greece's VIES code).
export function vatNumberCountry(vat: string | null | undefined): string | null {
  const prefix = normalizeVatNumber(vat).slice(0, 2);
  if (!/^[A-Z]{2}$/.test(prefix)) return null;
  return prefix === 'EL' ? 'GR' : prefix;
}

export function isBuyerType(value: unknown): value is BuyerType {
  return value === 'PERSON' || value === 'COMPANY';
}

// Lenient read: never throws, unknown/invalid fields fall back to the default.
export function normalizeB2bSettings(raw: unknown): B2bSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const countries = Array.isArray(src.org_number_countries)
    ? src.org_number_countries
        .filter((c): c is string => typeof c === 'string' && /^[A-Za-z]{2}$/.test(c))
        .map((c) => c.toUpperCase())
    : DEFAULT_B2B_SETTINGS.org_number_countries;
  return {
    allow_company: typeof src.allow_company === 'boolean' ? src.allow_company : DEFAULT_B2B_SETTINGS.allow_company,
    default_buyer_type: isBuyerType(src.default_buyer_type) ? src.default_buyer_type : DEFAULT_B2B_SETTINGS.default_buyer_type,
    require_vat_number:
      typeof src.require_vat_number === 'boolean' ? src.require_vat_number : DEFAULT_B2B_SETTINGS.require_vat_number,
    org_number_countries: Array.from(new Set(countries)),
    reverse_charge_enabled:
      typeof src.reverse_charge_enabled === 'boolean'
        ? src.reverse_charge_enabled
        : DEFAULT_B2B_SETTINGS.reverse_charge_enabled,
    reverse_charge_pricing: isReverseChargePricing(src.reverse_charge_pricing)
      ? src.reverse_charge_pricing
      : DEFAULT_B2B_SETTINGS.reverse_charge_pricing,
    vies_requester_vat:
      typeof src.vies_requester_vat === 'string' && src.vies_requester_vat.trim()
        ? normalizeVatNumber(src.vies_requester_vat)
        : null,
  };
}

export function sameB2bSettings(a: B2bSettings, b: B2bSettings): boolean {
  return (
    a.allow_company === b.allow_company &&
    a.default_buyer_type === b.default_buyer_type &&
    a.require_vat_number === b.require_vat_number &&
    a.org_number_countries.join(',') === b.org_number_countries.join(',') &&
    a.reverse_charge_enabled === b.reverse_charge_enabled &&
    a.reverse_charge_pricing === b.reverse_charge_pricing &&
    (a.vies_requester_vat ?? '') === (b.vies_requester_vat ?? '')
  );
}

// Form copy sent to the API: the requester VAT number goes out normalised
// ("se 5560…" -> "SE5560…") or null when blank.
export function prepareB2bSettings(form: B2bSettings): B2bSettings {
  return {
    ...form,
    vies_requester_vat: form.vies_requester_vat ? normalizeVatNumber(form.vies_requester_vat) || null : null,
  };
}

// Company snapshot columns written on an order placed as a company
// (all null for person orders / orders placed before the app existed).
export interface OrderB2bSnapshot {
  customer_type?: BuyerType | null;
  company_name?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
  buyer_reference?: string | null;
}

// Company defaults stored on the customer account (prefill, not the legal
// snapshot — the order columns above are what was actually bought under).
export interface CustomerB2bDefaults {
  customer_type?: BuyerType | null;
  company_name?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
}

export function isCompanyOrder(order: OrderB2bSnapshot | null | undefined): boolean {
  return order?.customer_type === 'COMPANY';
}

// True when the customer's stored defaults differ from what the order was
// placed with (the detail card then shows the defaults as a muted hint).
export function customerDefaultsDiffer(
  order: OrderB2bSnapshot,
  customer: CustomerB2bDefaults | null | undefined,
): boolean {
  if (!customer) return false;
  const norm = (v: string | null | undefined) => (v ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const hasAny = !!(customer.company_name || customer.org_number || customer.vat_number);
  if (!hasAny) return false;
  return (
    norm(customer.company_name) !== norm(order.company_name) ||
    norm(customer.org_number) !== norm(order.org_number) ||
    norm(customer.vat_number) !== norm(order.vat_number)
  );
}

// ── Reverse charge / tax exemptions (M2.5) ─────────────────────────────

// Why an order carries no VAT. Null/absent = taxed normally.
export type TaxExemptReason = 'REVERSE_CHARGE' | 'CUSTOMER_EXEMPT';
export type TaxExemptionKind = 'REVERSE_CHARGE' | 'FULL';
export const TAX_EXEMPTION_KINDS: readonly TaxExemptionKind[] = ['REVERSE_CHARGE', 'FULL'] as const;
export type VatCheckStatus = 'valid' | 'invalid' | 'unavailable' | 'format_invalid' | 'not_eu';

// Evidence snapshot on `Order.vat_validation` (VIES result or manual exemption).
export interface VatEvidence {
  source: 'VIES' | 'MANUAL';
  vat_number: string;
  country_code: string;
  status: VatCheckStatus;
  valid: boolean;
  name: string | null;
  address: string | null;
  request_identifier: string | null;
  requester: string | null;
  checked_at: string;
  check_id: string | null;
  error_code?: string | null;
  seller_country?: string;
  destination_country?: string;
  vat_country_matches_destination?: boolean;
  exemption_id?: string;
  exemption_kind?: TaxExemptionKind;
  // ISO time the manual exemption was created (MANUAL evidence only). The
  // merchant's note is not on the order; it lives on the exemption record.
  exemption_created_at?: string;
}

// Order columns written when the order was priced without VAT.
export interface OrderTaxExemptionFields {
  tax_exempt_reason?: TaxExemptReason | null;
  vat_validation?: VatEvidence | null;
}

// GET /b2b/my/tax-exemptions rows.
export interface TaxExemptionView {
  id: string;
  customer: { id: string; first_name: string | null; last_name: string | null; email: string | null };
  kind: TaxExemptionKind;
  vat_number: string | null;
  note: string | null;
  created_at: string;
  created_by: string;
  revoked_at: string | null;
}

export interface CreateTaxExemptionInput {
  customer_id?: string;
  order_id?: string;
  kind: TaxExemptionKind;
  vat_number?: string | null;
  note?: string | null;
}

// True when the evidence's VAT-number country differs from where the goods
// were shipped (allowed, Shopify rule, but worth flagging to the merchant).
export function vatCountryMismatch(evidence: VatEvidence | null | undefined): boolean {
  if (!evidence) return false;
  if (evidence.vat_country_matches_destination === false) return true;
  if (evidence.vat_country_matches_destination === true) return false;
  const vatCountry = vatNumberCountry(evidence.vat_number) ?? (evidence.country_code === 'EL' ? 'GR' : evidence.country_code);
  return !!evidence.destination_country && !!vatCountry && vatCountry !== evidence.destination_country.toUpperCase();
}
