import { api } from '@/lib/api';

// Client of the Zoho Mail store app (contract: plans/namez-store-apps/ZOHO-MAIL-APP-PLAN.md).

export interface ZohoMailStatus {
  // The store's own Zoho OAuth client (client_id + secret) is saved.
  client_configured: boolean;
  client_id: string | null;
  has_client_secret: boolean;
  // Our OAuth callback; the creator pastes it into the Zoho API console.
  redirect_uri: string | null;
  enabled: boolean;
  connected: boolean;
  region: string | null;
  connected_email: string | null;
  from_address: string | null;
  from_name: string | null;
  available_from: string[];
  connected_at: string | null;
  verified_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  /** Human detail of last_error (no secrets); last_error itself is a code. */
  last_error_detail: string | null;
}

export interface ZohoMailTestResult {
  ok: boolean;
  error?: string;
}

// Zoho data centres; `key` is the i18n key under `creator.zohoMail.regions`.
export const ZOHO_REGIONS = [
  { value: 'zoho.com', key: 'us' },
  { value: 'zoho.eu', key: 'eu' },
  { value: 'zoho.in', key: 'in' },
  { value: 'zoho.com.cn', key: 'cn' },
  { value: 'zoho.com.au', key: 'au' },
  { value: 'zoho.jp', key: 'jp' },
  { value: 'zohocloud.ca', key: 'ca' },
  { value: 'zoho.sa', key: 'sa' },
] as const;

export const DEFAULT_ZOHO_REGION = 'zoho.com';

/** Zoho API console of a data centre, where the store creates its OAuth client. */
export const zohoApiConsoleUrl = (region: string) => `https://api-console.${region}`;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** Coerces the API response into a safe status object. */
export function normalizeZohoStatus(value: unknown): ZohoMailStatus {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    client_configured: v.client_configured === true,
    client_id: str(v.client_id),
    has_client_secret: v.has_client_secret === true,
    redirect_uri: str(v.redirect_uri),
    enabled: v.enabled !== false,
    connected: v.connected === true,
    region: str(v.region),
    connected_email: str(v.connected_email),
    from_address: str(v.from_address),
    from_name: str(v.from_name),
    available_from: Array.isArray(v.available_from)
      ? v.available_from.filter((a): a is string => typeof a === 'string' && a.length > 0)
      : [],
    connected_at: str(v.connected_at),
    verified_at: str(v.verified_at),
    last_error: str(v.last_error),
    last_error_at: str(v.last_error_at),
    last_error_detail: str(v.last_error_detail),
  };
}

const BASE = '/stores/my/zoho-mail';

export const zohoMailApi = {
  status: (token: string) => api<unknown>(BASE, { token }).then(normalizeZohoStatus),
  saveClient: (token: string, body: { region: string; client_id: string; client_secret?: string }) =>
    api<unknown>(`${BASE}/client`, { method: 'PUT', token, body: JSON.stringify(body) }).then(normalizeZohoStatus),
  // The region comes from the saved client.
  connect: (token: string) =>
    api<{ authorize_url: string }>(`${BASE}/connect`, { method: 'POST', token, body: JSON.stringify({}) }),
  save: (token: string, body: { from_address: string; from_name: string }) =>
    api<unknown>(BASE, { method: 'PUT', token, body: JSON.stringify(body) }).then(normalizeZohoStatus),
  refreshAddresses: (token: string) =>
    api<unknown>(`${BASE}/refresh-addresses`, { method: 'POST', token }).then(normalizeZohoStatus),
  test: (token: string, to: string) =>
    api<ZohoMailTestResult>(`${BASE}/test`, { method: 'POST', token, body: JSON.stringify({ to }) }),
  // keepClient: drop only the token, keep the saved client credentials.
  disconnect: (token: string, keepClient = false) =>
    api<unknown>(keepClient ? `${BASE}?keep_client=1` : BASE, { method: 'DELETE', token }).then(normalizeZohoStatus),
};
