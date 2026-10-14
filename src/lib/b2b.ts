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
}

export const DEFAULT_B2B_SETTINGS: B2bSettings = {
  allow_company: true,
  default_buyer_type: 'PERSON',
  require_vat_number: false,
  org_number_countries: ['SE'],
};

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
