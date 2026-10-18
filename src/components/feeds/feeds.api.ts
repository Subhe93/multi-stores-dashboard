import { api } from '@/lib/api';

// Client of the feeds app (M5.6): settings shape (mirror of the API's
// feeds-settings.ts), the creator routes and the form helpers.

export interface FeedsSettings {
  google: boolean;
  facebook: boolean;
  default_brand: string | null;
  token: string | null;
  include_variants: boolean;
  shipping_label: string | null;
}

export const DEFAULT_FEEDS_SETTINGS: FeedsSettings = {
  google: true,
  facebook: true,
  default_brand: null,
  token: null,
  include_variants: true,
  shipping_label: null,
};

export const FEEDS_LIMITS = { default_brand: 70, shipping_label: 100 } as const;

export interface FeedUrls {
  market_key: string | null;
  market_name: string | null;
  currency: string;
  google: string;
  facebook: string;
}

export interface MyFeedsView {
  store_slug: string;
  settings: FeedsSettings;
  urls: FeedUrls[];
}

export interface FeedProductRef {
  id: string;
  title: string;
}

export interface FeedValidationReport {
  market_key: string | null;
  currency: string;
  products: number;
  items: number;
  skipped: { excluded: number; hidden_in_market: number };
  missing_gtin: FeedProductRef[];
  missing_brand: FeedProductRef[];
  missing_identifier: number;
  excluded: FeedProductRef[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s ? s : null;
}

/** Lenient read of the stored settings object (odd values -> defaults). */
export function normalizeFeedsSettings(raw: unknown): FeedsSettings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_FEEDS_SETTINGS;
  const bool = (k: keyof FeedsSettings, def: boolean) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : def);
  return {
    google: bool('google', d.google),
    facebook: bool('facebook', d.facebook),
    default_brand: text(r.default_brand, FEEDS_LIMITS.default_brand),
    token: typeof r.token === 'string' && /^[a-f0-9]{32}$/.test(r.token) ? r.token : null,
    include_variants: bool('include_variants', d.include_variants),
    shipping_label: text(r.shipping_label, FEEDS_LIMITS.shipping_label),
  };
}

export function sameFeedsSettings(a: FeedsSettings, b: FeedsSettings): boolean {
  return (
    a.google === b.google &&
    a.facebook === b.facebook &&
    a.default_brand === b.default_brand &&
    a.token === b.token &&
    a.include_variants === b.include_variants &&
    a.shipping_label === b.shipping_label
  );
}

/** Payload of the save: known keys only, texts trimmed ('' -> null). */
export function prepareFeedsSettings(form: FeedsSettings): FeedsSettings {
  return normalizeFeedsSettings(form);
}

export const feedsApi = {
  settings: (token: string) => api<MyFeedsView>('/feeds/my/settings', { token }),
  rotateToken: (token: string) => api<MyFeedsView>('/feeds/my/token/rotate', { method: 'POST', token }),
  validate: (token: string, market?: string | null) =>
    api<FeedValidationReport>(`/feeds/my/validate${market ? `?market=${encodeURIComponent(market)}` : ''}`, { token }),
};
