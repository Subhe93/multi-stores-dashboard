// Mirror of multi-stores-shared/src/constants/store-apps.ts — keep in sync.
//
// Static registry of the optional "Store Apps" a store can switch on. The API
// holds the source of truth for availability/enabled state; this file only
// describes each app so the dashboard can render names, badges and
// dependency hints without an extra request.

export const STORE_APP_KEYS = ['markets', 'b2b', 'invoices', 'importer', 'personalization', 'production', 'designer', 'feeds', 'zoho_mail'] as const;

export type StoreAppKey = (typeof STORE_APP_KEYS)[number];

export interface StoreAppDefinition {
  key: StoreAppKey;
  // i18n keys under `creator.apps.items.<key>` (same strings the API returns
  // as name_key / description_key).
  nameKey: string;
  descriptionKey: string;
  // Only INDEPENDENT stores may enable the app.
  requiresIndependent: boolean;
  // Apps that must be enabled before this one can be switched on.
  dependsOn: StoreAppKey[];
}

export const STORE_APPS: Record<StoreAppKey, StoreAppDefinition> = {
  markets: {
    key: 'markets',
    nameKey: 'creator.apps.items.markets.name',
    descriptionKey: 'creator.apps.items.markets.description',
    requiresIndependent: true,
    dependsOn: [],
  },
  b2b: {
    key: 'b2b',
    nameKey: 'creator.apps.items.b2b.name',
    descriptionKey: 'creator.apps.items.b2b.description',
    requiresIndependent: false,
    dependsOn: [],
  },
  invoices: {
    key: 'invoices',
    nameKey: 'creator.apps.items.invoices.name',
    descriptionKey: 'creator.apps.items.invoices.description',
    requiresIndependent: true,
    dependsOn: [],
  },
  importer: {
    key: 'importer',
    nameKey: 'creator.apps.items.importer.name',
    descriptionKey: 'creator.apps.items.importer.description',
    requiresIndependent: true,
    dependsOn: ['markets'],
  },
  personalization: {
    key: 'personalization',
    nameKey: 'creator.apps.items.personalization.name',
    descriptionKey: 'creator.apps.items.personalization.description',
    requiresIndependent: false,
    dependsOn: [],
  },
  production: {
    key: 'production',
    nameKey: 'creator.apps.items.production.name',
    descriptionKey: 'creator.apps.items.production.description',
    requiresIndependent: false,
    dependsOn: [],
  },
  designer: {
    key: 'designer',
    nameKey: 'creator.apps.items.designer.name',
    descriptionKey: 'creator.apps.items.designer.description',
    requiresIndependent: true,
    dependsOn: [],
  },
  feeds: {
    key: 'feeds',
    nameKey: 'creator.apps.items.feeds.name',
    descriptionKey: 'creator.apps.items.feeds.description',
    requiresIndependent: false,
    dependsOn: [],
  },
  zoho_mail: {
    key: 'zoho_mail',
    nameKey: 'creator.apps.items.zoho_mail.name',
    descriptionKey: 'creator.apps.items.zoho_mail.description',
    requiresIndependent: true,
    dependsOn: [],
  },
};

// Apps not built yet: kept in the registry (the API still returns them) but
// hidden from every dashboard surface (creator catalog, admin pages). Empty
// since M4.4 (the importer is visible; admins still make it available per store).
export const HIDDEN_APPS: readonly StoreAppKey[] = [];

export function isHiddenApp(key: StoreAppKey): boolean {
  return HIDDEN_APPS.includes(key);
}

// Registry keys the dashboard renders (registry order, hidden apps removed).
export const VISIBLE_STORE_APP_KEYS: readonly StoreAppKey[] = STORE_APP_KEYS.filter((key) => !isHiddenApp(key));

// Dashboard page holding each app's own settings ("Open settings" target).
export const STORE_APP_HREFS: Record<StoreAppKey, string | null> = {
  markets: '/creator/markets',
  b2b: '/creator/b2b',
  invoices: '/creator/invoices?tab=settings',
  importer: '/creator/importer',
  personalization: '/creator/personalization',
  production: '/creator/production?tab=settings',
  designer: '/creator/designer?tab=settings',
  feeds: '/creator/feeds',
  zoho_mail: '/creator/zoho-mail',
};

export function isStoreAppKey(value: unknown): value is StoreAppKey {
  return typeof value === 'string' && (STORE_APP_KEYS as readonly string[]).includes(value);
}

// ─── API view shapes ─────────────────────────────────────────────────────────

export type StoreAppBlockedReason = 'NOT_AVAILABLE' | 'REQUIRES_INDEPENDENT' | 'DEPENDENCY_MISSING';

/**
 * Creator view: GET /stores/my/apps returns every registry key. Apps the admin
 * has not made available come back with `available: false`,
 * `can_enable: false` and `blocked_reason: 'NOT_AVAILABLE'`.
 * `enabled` is already the effective value (available && enabled).
 */
export interface MyStoreAppView {
  key: StoreAppKey;
  name_key: string;
  description_key: string;
  available: boolean;
  enabled: boolean;
  settings: Record<string, unknown>;
  enabled_at: string | null;
  requires_independent: boolean;
  depends_on: StoreAppKey[];
  can_enable: boolean;
  blocked_reason: StoreAppBlockedReason | null;
}

/**
 * Admin view: GET /stores/by-creator/:creatorId/apps (every registry key).
 * `enabled` is the raw creator toggle, so a row can be available=false and
 * enabled=true at the same time.
 */
export interface AdminStoreAppView {
  key: StoreAppKey;
  name_key: string;
  description_key: string;
  available: boolean;
  enabled: boolean;
  requires_independent: boolean;
  depends_on: StoreAppKey[];
}
