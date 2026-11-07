// Pure helpers for the "own Stripe account" (restricted key) settings of
// INDEPENDENT stores. Mirrors the API contract in
// multi-stores-api/src/modules/payments/own-key/own-key.types.ts
// (plans/stripe-restricted-keys/SPEC.md). Free of React so node:test can run it.

export type OwnKeyState = 'ACTIVE' | 'NEEDS_RECONNECT' | 'DISABLED';
export type OwnKeyPermission =
  | 'payment_intent_write'
  | 'charge_read'
  | 'webhook_write'
  | 'payment_method_domain_write'
  | 'balance_read'
  | 'dispute_read';
export type OwnKeyCheck = 'ok' | 'missing' | 'unknown';

/** `GET /stores/my/payments/stripe-key` (null when no key is stored). Never secrets. */
export interface OwnKeyStatus {
  status: OwnKeyState;
  livemode: boolean;
  key_last4: string;
  account_id: string | null;
  permissions: Partial<Record<OwnKeyPermission, OwnKeyCheck>>;
  webhook_ok: boolean;
  /**
   * host -> payment method (apple_pay, google_pay, link, klarna, paypal,
   * amazon_pay) -> 'active' | 'inactive' | ..., or `{ error: code }` when the
   * host could not be registered (e.g. 'permission_missing').
   */
  payment_method_domains: Record<string, Record<string, string>>;
  verified_at: string | null;
  last_check_at: string | null;
  last_error_code: string | null;
  /**
   * How Payment Intents write was proven: `test_create` (test PI created and
   * canceled) or `live_hint` (live mode; confirmed at the first checkout).
   */
  pi_write_check?: 'test_create' | 'live_hint' | null;
}

/** `GET /admin/stores/:storeId/stripe-key`: status and booleans only (no secrets). */
export interface AdminOwnKeySummary {
  configured: boolean;
  status: OwnKeyState | null;
  livemode: boolean | null;
  webhook_ok: boolean | null;
  permissions_ok: boolean | null;
  wallet_domains_ok: boolean | null;
  verified_at: string | null;
  last_check_at: string | null;
  last_error_code: string | null;
}

export const OWN_KEY_ENDPOINT = '/stores/my/payments/stripe-key';

/** DOM id of the settings card (deep links: /creator/settings?tab=payments#own-stripe-key). */
export const OWN_KEY_ANCHOR = 'own-stripe-key';

/**
 * Our API's egress IP, for the optional Stripe "Access policy" (IP allowlist).
 * Configurable per deploy; merchants are emailed before it changes.
 */
export const OWN_KEY_EGRESS_IP = process.env.NEXT_PUBLIC_EGRESS_IP?.trim() || '188.245.167.190';

export const STRIPE_API_KEYS_URL = 'https://dashboard.stripe.com/apikeys';
/** Opens the API keys page in the account's sandbox (test) environment. */
export const STRIPE_SANDBOX_API_KEYS_URL = 'https://dashboard.stripe.com/test/apikeys';
export const STRIPE_PAYMENT_METHODS_URL = 'https://dashboard.stripe.com/settings/payment_methods';

export interface PermissionRow {
  key: OwnKeyPermission;
  /** Resource group as named in the Stripe Dashboard. */
  group: string;
  /** Resource name as shown in the Stripe Dashboard (kept in English, like Stripe's UI). */
  resource: string;
  level: 'write' | 'read';
  required: boolean;
}

/** Exact permission table from SPEC.md; everything else stays "None". */
export const OWN_KEY_PERMISSIONS: readonly PermissionRow[] = [
  { key: 'payment_intent_write', group: 'Core', resource: 'Payment Intents', level: 'write', required: true },
  { key: 'charge_read', group: 'Core', resource: 'Charges and Refunds', level: 'read', required: true },
  {
    key: 'webhook_write',
    group: 'Webhook Endpoints',
    resource: 'Webhook Endpoints, Event Destinations',
    level: 'write',
    required: true,
  },
  { key: 'payment_method_domain_write', group: 'Core', resource: 'Payment Method Domains', level: 'write', required: true },
  { key: 'balance_read', group: 'Core', resource: 'Balance', level: 'read', required: true },
  { key: 'dispute_read', group: 'Core', resource: 'Payment Disputes', level: 'read', required: false },
];

export type KeyMode = 'live' | 'test';

/** Client-side input problems, mapped to friendly messages in the UI. */
export type KeyInputIssue =
  | 'restricted_empty'
  | 'restricted_secret_key'
  | 'restricted_publishable_swapped'
  | 'restricted_prefix'
  | 'publishable_empty'
  | 'publishable_secret_key'
  | 'publishable_restricted_swapped'
  | 'publishable_prefix'
  | 'mode_mismatch';

export function restrictedKeyMode(value: string): KeyMode | null {
  const v = value.trim();
  if (/^rk_live_[A-Za-z0-9]{8,}$/.test(v)) return 'live';
  if (/^rk_test_[A-Za-z0-9]{8,}$/.test(v)) return 'test';
  return null;
}

export function publishableKeyMode(value: string): KeyMode | null {
  const v = value.trim();
  if (/^pk_live_[A-Za-z0-9]{8,}$/.test(v)) return 'live';
  if (/^pk_test_[A-Za-z0-9]{8,}$/.test(v)) return 'test';
  return null;
}

/** First problem of each field (restricted, publishable) plus the pair check. */
export function validateKeyInputs(restricted: string, publishable: string): {
  restricted: KeyInputIssue | null;
  publishable: KeyInputIssue | null;
  pair: KeyInputIssue | null;
} {
  const r = restricted.trim();
  const p = publishable.trim();
  let rIssue: KeyInputIssue | null = null;
  let pIssue: KeyInputIssue | null = null;
  if (!r) rIssue = 'restricted_empty';
  else if (r.startsWith('sk_')) rIssue = 'restricted_secret_key';
  else if (r.startsWith('pk_')) rIssue = 'restricted_publishable_swapped';
  else if (!restrictedKeyMode(r)) rIssue = 'restricted_prefix';

  if (!p) pIssue = 'publishable_empty';
  else if (p.startsWith('sk_')) pIssue = 'publishable_secret_key';
  else if (p.startsWith('rk_')) pIssue = 'publishable_restricted_swapped';
  else if (!publishableKeyMode(p)) pIssue = 'publishable_prefix';

  let pair: KeyInputIssue | null = null;
  if (!rIssue && !pIssue && restrictedKeyMode(r) !== publishableKeyMode(p)) pair = 'mode_mismatch';
  return { restricted: rIssue, publishable: pIssue, pair };
}

/** Effective check per permission row (absent from the API answer = unknown). */
export function permissionCheck(
  permissions: Partial<Record<OwnKeyPermission, OwnKeyCheck>> | null | undefined,
  key: OwnKeyPermission,
  missing?: readonly string[] | null,
): OwnKeyCheck {
  if (missing?.includes(key)) return 'missing';
  const v = permissions?.[key];
  return v === 'ok' || v === 'missing' ? v : 'unknown';
}

/** Payment methods shown in the wallet-domains table, in display order. */
export const WALLET_METHODS = ['apple_pay', 'google_pay', 'link', 'klarna'] as const;
export type WalletMethod = (typeof WALLET_METHODS)[number];

export type DomainTone = 'ok' | 'pending' | 'error' | 'unknown';

/** Stripe payment-method-domain statuses: active / inactive (+ our pending/error). */
export function domainStatusTone(status: string | null | undefined): DomainTone {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'ok':
      return 'ok';
    case 'pending':
      return 'pending';
    case 'inactive':
    case 'error':
    case 'failed':
      return 'error';
    default:
      return 'unknown';
  }
}

/** Domain table rows sorted by host; unknown methods are ignored. */
export function domainRows(
  domains: Record<string, Record<string, string>> | null | undefined,
): { host: string; methods: Record<WalletMethod, DomainTone>; error: string | null }[] {
  return Object.keys(domains ?? {})
    .sort()
    .map((host) => {
      const per = domains?.[host] ?? {};
      const error = typeof per.error === 'string' && per.error ? per.error : null;
      const methods = {} as Record<WalletMethod, DomainTone>;
      for (const m of WALLET_METHODS) methods[m] = error ? 'error' : domainStatusTone(per[m]);
      return { host, methods, error };
    });
}

/** Missing permission keys from an OWN_KEY_MISSING_PERMISSIONS error body. */
export function missingFromError(payload: unknown): OwnKeyPermission[] {
  if (!payload || typeof payload !== 'object') return [];
  const o = payload as { missing?: unknown; data?: { missing?: unknown } };
  const raw = Array.isArray(o.missing) ? o.missing : Array.isArray(o.data?.missing) ? o.data?.missing : [];
  const known = new Set<string>(OWN_KEY_PERMISSIONS.map((p) => p.key));
  return (raw as unknown[]).filter((x): x is OwnKeyPermission => typeof x === 'string' && known.has(x));
}

/** Permission checklist carried by an OWN_KEY_* error body, when present. */
export function permissionsFromError(payload: unknown): Partial<Record<OwnKeyPermission, OwnKeyCheck>> {
  if (!payload || typeof payload !== 'object') return {};
  const o = payload as { permissions?: unknown; data?: { permissions?: unknown } };
  const raw = (o.permissions && typeof o.permissions === 'object' ? o.permissions : o.data?.permissions) as
    | Record<string, unknown>
    | undefined;
  const out: Partial<Record<OwnKeyPermission, OwnKeyCheck>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const row of OWN_KEY_PERMISSIONS) {
    const v = raw[row.key];
    if (v === 'ok' || v === 'missing' || v === 'unknown') out[row.key] = v;
  }
  return out;
}

/** Guide screenshot path for step n (1-based); Alaa supplies the files. */
export function guideImagePath(step: number): string {
  return `/guides/stripe-own-key/step-${step}.png`;
}
