// Consent v2 (plans/consent-v2/CONTRACT.md §2.2, §5.6, §6): pure helpers of
// the owner's consent log card and the category overview in the tracking
// card. No imports, so `node --test` can load this file directly.
//
// API (owner, bearer token):
//   GET /stores/my/consent-log?limit&before&consent_id&from&to → ConsentLogPage
//   GET /stores/my/consent-log/summary?days                   → ConsentLogSummary
//   GET /stores/my/consent-log/export?from&to                 → text/csv

export type ConsentLogAction =
  | 'accept_all'
  | 'reject_all'
  | 'save'
  | 'external_media_grant'
  | 'external_media_revoke'
  | 'migrated';

export type ConsentLogSource = 'banner' | 'dialog' | 'facade' | 'migration';

export interface ConsentLogItem {
  id: string;
  created_at: string;
  consent_id: string;
  action: ConsentLogAction | string;
  source: ConsentLogSource | string;
  /** null = the category was not offered / not part of this decision. */
  analytics: boolean | null;
  marketing: boolean | null;
  external_media: boolean | null;
  consent_version: string;
  vendors: string[];
  locale: string;
  text_hash: string;
}

export interface ConsentLogPage {
  items: ConsentLogItem[];
  next_before: string | null;
}

export interface ConsentLogSummary {
  days: number;
  total: number;
  accept_all: number;
  reject_all: number;
  save: number;
  analytics_granted: number;
  marketing_granted: number;
  external_media_granted: number;
}

export const CONSENT_LOG_ENDPOINT = '/stores/my/consent-log';
export const CONSENT_LOG_PAGE_SIZE = 50;
export const CONSENT_LOG_SUMMARY_DAYS = 30;
export const CONSENT_LOG_EXPORT_DEFAULT_DAYS = 90;
/** The API refuses an export range longer than this (inclusive days apart). */
export const CONSENT_LOG_EXPORT_MAX_DAYS = 366;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function query(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** A full consent id (UUID) as the visitor sees it in their cookie settings. */
export function isConsentId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Normalized search value: trimmed and lower-cased, or null when not a UUID. */
export function normalizeConsentId(value: string): string | null {
  const v = value.trim().toLowerCase();
  return UUID_RE.test(v) ? v : null;
}

/** List path; `before` is the `next_before` cursor of the previous page. */
export function consentLogListPath(opts: { before?: string | null; consentId?: string | null; limit?: number } = {}): string {
  return (
    CONSENT_LOG_ENDPOINT +
    query({
      limit: opts.limit ?? CONSENT_LOG_PAGE_SIZE,
      before: opts.before ?? null,
      consent_id: opts.consentId ?? null,
    })
  );
}

export function consentLogSummaryPath(days: number = CONSENT_LOG_SUMMARY_DAYS): string {
  return `${CONSENT_LOG_ENDPOINT}/summary${query({ days })}`;
}

export function consentLogExportPath(from: string, to: string): string {
  return `${CONSENT_LOG_ENDPOINT}/export${query({ from, to })}`;
}

/** Fallback download name when the response has no Content-Disposition. */
export function consentLogExportFileName(from: string, to: string): string {
  return `consent-log-${from}-${to}.csv`;
}

/**
 * Next list state after a page arrived. `append` keeps the rows already shown
 * ("Load more"); otherwise the page replaces them (first load, new search).
 * Rows are de-duplicated by id, in case a decision lands on the cursor edge.
 */
export function mergeConsentLogPage(
  prev: ConsentLogItem[],
  page: ConsentLogPage,
  append: boolean,
): { items: ConsentLogItem[]; nextBefore: string | null } {
  const base = append ? prev : [];
  const seen = new Set(base.map((r) => r.id));
  const items = [...base];
  for (const row of page.items ?? []) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    items.push(row);
  }
  return { items, nextBefore: page.next_before ?? null };
}

/**
 * One list request as the card makes it: builds the path (cursor + search),
 * calls `get` (the card passes `api()` with the bearer token) and merges the
 * page into the rows already shown.
 */
export async function loadConsentLogPage(
  get: (path: string) => Promise<ConsentLogPage>,
  prev: ConsentLogItem[],
  opts: { before?: string | null; consentId?: string | null },
): Promise<{ items: ConsentLogItem[]; nextBefore: string | null }> {
  const append = !!opts.before;
  const page = await get(consentLogListPath({ before: opts.before ?? null, consentId: opts.consentId ?? null }));
  return mergeConsentLogPage(prev, page ?? { items: [], next_before: null }, append);
}

/**
 * CSV export as the card runs it: validates the range, then hands the export
 * path to `download` (the card passes `downloadAuthed`, a bearer blob fetch).
 * Returns the range error instead of downloading when the range is invalid.
 */
export async function exportConsentLog(
  download: (path: string, fallbackName: string) => Promise<void>,
  from: string,
  to: string,
): Promise<'required' | 'order' | 'tooLong' | null> {
  const err = exportRangeError(from, to);
  if (err) return err;
  await download(consentLogExportPath(from, to), consentLogExportFileName(from, to));
  return null;
}

/**
 * Summary shares in whole percent. The shares are of the banner/dialog
 * decisions (accept all + reject all + custom), so they add up to about 100;
 * external-media-only and migrated rows count in `total` only.
 */
export function consentLogShares(s: ConsentLogSummary | null | undefined): {
  total: number;
  acceptPct: number;
  rejectPct: number;
  customPct: number;
} {
  const total = s?.total ?? 0;
  const accept = s?.accept_all ?? 0;
  const reject = s?.reject_all ?? 0;
  const custom = s?.save ?? 0;
  const base = accept + reject + custom;
  const pct = (n: number) => (base > 0 ? Math.round((n / base) * 100) : 0);
  return { total, acceptPct: pct(accept), rejectPct: pct(reject), customPct: pct(custom) };
}

/** i18n key under `consentLog.actions` for an action (unknown → `other`). */
export function consentLogActionKey(action: string): string {
  switch (action) {
    case 'accept_all':
      return 'acceptAll';
    case 'reject_all':
      return 'rejectAll';
    case 'save':
      return 'custom';
    case 'external_media_grant':
      return 'externalGranted';
    case 'external_media_revoke':
      return 'externalRevoked';
    case 'migrated':
      return 'migrated';
    default:
      return 'other';
  }
}

/** First 8 characters of the consent id, as shown in the table. */
export function shortConsentId(id: string): string {
  return id.slice(0, 8);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default export range: the last `days` days up to today (UTC dates). */
export function defaultExportRange(now: Date = new Date(), days: number = CONSENT_LOG_EXPORT_DEFAULT_DAYS): {
  from: string;
  to: string;
} {
  return { from: isoDay(new Date(now.getTime() - days * DAY_MS)), to: isoDay(now) };
}

/** Client-side check of the export range, mirroring the API rule. */
export function exportRangeError(from: string, to: string): 'required' | 'order' | 'tooLong' | null {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return 'required';
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 'required';
  if (a > b) return 'order';
  if ((b - a) / DAY_MS > CONSENT_LOG_EXPORT_MAX_DAYS) return 'tooLong';
  return null;
}

// ── Category overview (contract §2.2) ────────────────────────────────────────

export type TrackerVendor = 'ga4' | 'clarity' | 'meta' | 'tiktok';

/** Proper names, identical in every locale (same as the storefront labels). */
export const TRACKER_VENDOR_LABELS: Record<TrackerVendor, string> = {
  ga4: 'Google Analytics',
  clarity: 'Microsoft Clarity',
  meta: 'Meta Pixel',
  tiktok: 'TikTok Pixel',
};

export const MEDIA_VENDOR_LABELS = ['YouTube', 'Vimeo', 'Google Maps'] as const;

export interface ConsentSetupInput {
  ga4_measurement_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  clarity_project_id?: string | null;
  consent_required?: boolean;
}

export interface ConsentSetup {
  /** Vendors gated behind "Statistik". */
  analytics: TrackerVendor[];
  /** Vendors gated behind "Marknadsföring". */
  marketing: TrackerVendor[];
  /** Vendors that load without consent (consent_required = false). */
  ungated: TrackerVendor[];
  /** Whether the storefront shows the first-layer banner at all. */
  banner: boolean;
}

/**
 * The categories the storefront offers for these settings, mirroring the
 * web `storeVendors()`: Clarity is always gated; GA4/Meta/TikTok are gated
 * unless consent is turned off, then they load for everyone.
 */
export function consentSetup(input: ConsentSetupInput): ConsentSetup {
  const has = (v: string | null | undefined) => typeof v === 'string' && v.trim() !== '';
  const gated = input.consent_required !== false;
  const analytics: TrackerVendor[] = [];
  const marketing: TrackerVendor[] = [];
  const ungated: TrackerVendor[] = [];
  if (has(input.ga4_measurement_id)) (gated ? analytics : ungated).push('ga4');
  if (has(input.clarity_project_id)) analytics.push('clarity');
  if (has(input.meta_pixel_id)) (gated ? marketing : ungated).push('meta');
  if (has(input.tiktok_pixel_id)) (gated ? marketing : ungated).push('tiktok');
  return { analytics, marketing, ungated, banner: analytics.length + marketing.length > 0 };
}

/** Google's ad signals: named under Marketing when GA4 is consent-gated. */
export const GOOGLE_ADS_LABEL = 'Google Ads';

/**
 * Labels listed under "Marknadsföring", mirroring the web
 * `marketingVendorKeys()`: the gated pixels, plus Google when GA4 is gated,
 * because a marketing grant also sends GA4 the ad_storage / ad_user_data /
 * ad_personalization signals (Consent Mode v2). Empty when not offered.
 */
export function marketingVendorLabels(setup: ConsentSetup): string[] {
  if (setup.marketing.length === 0) return [];
  const labels = setup.marketing.map((v) => TRACKER_VENDOR_LABELS[v]);
  return setup.analytics.includes('ga4') ? [...labels, GOOGLE_ADS_LABEL] : labels;
}
