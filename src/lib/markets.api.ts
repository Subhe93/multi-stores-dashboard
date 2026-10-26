// Typed client for the Markets app endpoints (M1). Shapes mirror the API's
// markets module views; see plans/namez-store-apps/M1-DESIGN.md §3.1.

import { api } from '@/lib/api';

export type MarketStatus = 'DRAFT' | 'LIVE';
export type StoreDomainStatus = 'PENDING' | 'VERIFIED' | 'ACTIVE';
export type ProviderCheckState = 'ok' | 'missing' | 'unknown';
export type PriceRuleMode = 'convert' | 'fixed';
export type PriceRuleSource = 'manual' | 'platform';
export type PriceRuleEnding = 'none' | '.99' | '.90' | '.95' | '9' | '0';

export interface PriceRule {
  mode: PriceRuleMode;
  source?: PriceRuleSource;
  rate?: number | null;
  rounding?: { increment?: number | null; ending?: PriceRuleEnding };
}

export interface PaymentCheck {
  stripe: ProviderCheckState;
  kustom: ProviderCheckState;
  checked_at: string;
  details: {
    stripe?: {
      account_id?: string;
      account_country?: string;
      charges_enabled?: boolean;
      card_payments?: string;
      currency_supported?: boolean;
      settlement_currency_supported?: boolean;
      reason_code?: string;
    };
    kustom?: {
      configured: boolean;
      by_country: Record<string, 'ok' | 'mismatch' | 'unknown'>;
      expected_currency?: string;
      reason_code?: string;
    };
  };
}

export interface DomainView {
  id: string;
  hostname: string;
  is_primary: boolean;
  redirect_to: string | null;
  status: StoreDomainStatus;
  verified_at: string | null;
  // expected_cname is null while the platform has no CNAME target configured.
  dns: { expected_cname: string | null; observed: string[] | null };
}

export type MarketIndexing = 'AUTO' | 'ALWAYS' | 'NEVER';

export interface MarketView {
  id: string;
  key: string;
  name: string;
  countries: string[];
  default_locale: string;
  locales: string[];
  currency: string;
  is_default: boolean;
  status: MarketStatus;
  price_rule: PriceRule;
  payment_check: PaymentCheck | null;
  effective_rate: number | null;
  domains: DomainView[];
  platform_hostname: string;
  /**
   * Market preview: `https://<slug>--<key>.<platform host>` serves this
   * market before its domain is connected (DRAFT included) with the checkout
   * disabled. Null for the default market (its platform subdomain already
   * serves it). Built by the API from STOREFRONT_URL.
   */
  preview_url: string | null;
  /**
   * Search engine indexing mode (M6.1). AUTO: noindex on the platform
   * subdomain, indexable (and redirected to) once a custom domain is active;
   * ALWAYS: indexable on any host; NEVER: noindex everywhere.
   */
  indexing: MarketIndexing;
}

export interface MarketInput {
  key: string;
  name: string;
  countries: string[];
  default_locale: string;
  locales: string[];
  currency: string;
  price_rule: PriceRule;
  indexing?: MarketIndexing;
}

export interface DnsTarget {
  /** Null until the platform publishes a CNAME target (env CUSTOM_DOMAIN_CNAME_TARGET). */
  cname: string | null;
  a?: string | null;
}

export interface FxPreview {
  rate: number | null;
  source: 'platform' | 'none';
}

export interface ProductMarketVariantPrice {
  variant_id: string;
  label: string;
  auto_price: number | null;
  override: number | null;
}

export interface ProductMarketPriceRow {
  market_id: string;
  key: string;
  name: string;
  currency: string;
  rate: number | null;
  available: boolean;
  auto_price: number | null;
  override: number | null;
  compare_at_auto: number | null;
  compare_at_override: number | null;
  variants: ProductMarketVariantPrice[];
}

export interface ProductMarketPricesView {
  base_currency: string;
  markets: ProductMarketPriceRow[];
}

export interface ProductMarketPricesInput {
  markets: Array<{
    market_id: string;
    available: boolean;
    price: number | null;
    compare_at_price: number | null;
    variants: Array<{ variant_id: string; price: number | null }>;
  }>;
}

export interface FxRateRow {
  base: string;
  quote: string;
  rate: number;
  updated_at?: string;
}

const json = (body: unknown) => JSON.stringify(body);

// ─── Creator routes (JWT + markets app enabled) ─────────────────────────────

export const listMarkets = (token: string) => api<MarketView[]>('/markets', { token });

export const createMarket = (token: string, input: MarketInput) =>
  api<MarketView>('/markets', { method: 'POST', token, body: json(input) });

export const updateMarket = (token: string, id: string, input: Partial<MarketInput>) =>
  api<MarketView>(`/markets/${id}`, { method: 'PUT', token, body: json(input) });

export const setMarketStatus = (token: string, id: string, status: MarketStatus) =>
  api<MarketView>(`/markets/${id}/status`, { method: 'PUT', token, body: json({ status }) });

export const deleteMarket = (token: string, id: string) =>
  api<void>(`/markets/${id}`, { method: 'DELETE', token });

export const runPaymentCheck = (token: string, id: string) =>
  api<PaymentCheck>(`/markets/${id}/payment-check`, { method: 'POST', token });

export const addDomain = (token: string, marketId: string, hostname: string, redirectTo?: string) =>
  api<DomainView>(`/markets/${marketId}/domains`, {
    method: 'POST',
    token,
    body: json({ hostname, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
  });

export const removeDomain = (token: string, marketId: string, domainId: string) =>
  api<void>(`/markets/${marketId}/domains/${domainId}`, { method: 'DELETE', token });

export const verifyDomain = (token: string, marketId: string, domainId: string) =>
  api<DomainView>(`/markets/${marketId}/domains/${domainId}/verify`, { method: 'POST', token });

export const setPrimaryDomain = (token: string, marketId: string, domainId: string) =>
  api<DomainView>(`/markets/${marketId}/domains/${domainId}/primary`, { method: 'PUT', token });

export const getDnsTarget = (token: string) => api<DnsTarget>('/markets/dns-target', { token });

export const fxPreview = (token: string, from: string, to: string) =>
  api<FxPreview>(`/markets/fx-preview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { token });

export const getProductMarketPrices = (token: string, productId: string) =>
  api<ProductMarketPricesView>(`/markets/products/${productId}/prices`, { token });

export const putProductMarketPrices = (token: string, productId: string, input: ProductMarketPricesInput) =>
  api<ProductMarketPricesView>(`/markets/products/${productId}/prices`, { method: 'PUT', token, body: json(input) });

// ─── Admin routes ───────────────────────────────────────────────────────────

export const adminGetFxRates = (token: string) => api<FxRateRow[]>('/markets/admin/fx-rates', { token });

export const adminPutFxRates = (token: string, rates: FxRateRow[]) =>
  api<FxRateRow[]>('/markets/admin/fx-rates', {
    method: 'PUT',
    token,
    body: json({ rates: rates.map(({ base, quote, rate }) => ({ base, quote, rate })) }),
  });

/** Admin: delete one rate; the API answers with the refreshed list. */
export const deleteFxRate = (token: string, base: string, quote: string) =>
  api<FxRateRow[]>(`/markets/admin/fx-rates/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`, { method: 'DELETE', token });

/** Admin: every domain of the store owned by this creator (any market, any status). */
export const adminListStoreDomains = (token: string, creatorId: string) =>
  api<DomainView[]>(`/markets/admin/stores/by-creator/${creatorId}/domains`, { token });

export const adminSetDomainStatus = (token: string, domainId: string, status: StoreDomainStatus) =>
  api<DomainView>(`/markets/admin/domains/${domainId}/status`, { method: 'PUT', token, body: json({ status }) });
