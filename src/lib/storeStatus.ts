// Pure helpers for the store lifecycle UI (plans/platform-onboarding SPEC §3):
// status labels, the setup checklist derived from the API's go-live checklist,
// the onboarding survey and the unverified-email grace period. Kept free of
// React and browser globals so they can be unit-tested with node:test.

export type StoreStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'LIVE'
  | 'PAUSED'
  | 'SUSPENDED';

export const STORE_STATUSES: readonly StoreStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'LIVE',
  'PAUSED',
  'SUSPENDED',
];

/** `GET /stores/my/store` → `golive_checklist`. */
export interface GoLiveChecklist {
  email_verified: boolean;
  trader_details_complete: boolean;
  has_published_product: boolean;
  has_published_theme: boolean;
  payments_ready: boolean;
  legal_pages_published: boolean;
  ready: boolean;
  blocking: string[];
}

/** VIES answer stored with the trader details (wave 3); `valid` null = not verifiable now. */
export interface TraderVatCheck {
  valid: boolean | null;
  checked_at: string;
  name?: string;
  address?: string;
}

/** Legal trader identity stored as `Store.trader_details` (SPEC §1). */
export interface TraderDetails {
  legal_name: string;
  business_type: 'company' | 'private';
  org_number: string;
  vat_number?: string;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  support_email: string;
  completed_at?: string;
  vat_check?: TraderVatCheck | null;
}

/** Badge tone per store status (Tailwind classes live in the components). */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function storeStatusTone(status: StoreStatus | string | null | undefined): StatusTone {
  switch (status) {
    case 'LIVE':
      return 'success';
    case 'PENDING_REVIEW':
      return 'info';
    case 'CHANGES_REQUESTED':
    case 'PAUSED':
      return 'warning';
    case 'SUSPENDED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Only LIVE and PAUSED stores own the creator "Pause / Resume" toggle. */
export function canToggleActive(status: StoreStatus | string | null | undefined): boolean {
  return status === 'LIVE' || status === 'PAUSED';
}

/** Go-live can be requested from DRAFT and CHANGES_REQUESTED only. */
export function canRequestGoLive(status: StoreStatus | string | null | undefined): boolean {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED';
}

// ── Onboarding survey (step 1, skippable; kept client-side) ───────────────

export type SurveyStage = 'starting' | 'selling_online' | 'physical_shop' | 'agency';
export type SurveySells = 'own' | 'suppliers' | 'both';

export interface OnboardingSurvey {
  stage?: SurveyStage;
  sells?: SurveySells;
  /** ISO2 upper case. */
  country?: string;
}

export const SURVEY_STAGES: readonly SurveyStage[] = ['starting', 'selling_online', 'physical_shop', 'agency'];
export const SURVEY_SELLS: readonly SurveySells[] = ['own', 'suppliers', 'both'];

/** Parses a stored survey; unknown values are dropped, never thrown. */
export function parseSurvey(raw: unknown): OnboardingSurvey {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: OnboardingSurvey = {};
  if (typeof o.stage === 'string' && (SURVEY_STAGES as readonly string[]).includes(o.stage)) {
    out.stage = o.stage as SurveyStage;
  }
  if (typeof o.sells === 'string' && (SURVEY_SELLS as readonly string[]).includes(o.sells)) {
    out.sells = o.sells as SurveySells;
  }
  if (typeof o.country === 'string' && /^[A-Za-z]{2}$/.test(o.country)) {
    out.country = o.country.toUpperCase();
  }
  return out;
}

/**
 * Store type to pre-select on the create-store step: the sign-up card
 * (`onboarding_profile.account_kind`) wins, then the survey ("sells supplier
 * products" → marketplace), else independent.
 */
export function suggestedStoreType(
  accountKind: string | null | undefined,
  survey: OnboardingSurvey | null | undefined,
): 'MARKETPLACE' | 'INDEPENDENT' {
  if (accountKind === 'marketplace') return 'MARKETPLACE';
  if (accountKind === 'independent') return 'INDEPENDENT';
  if (survey?.sells === 'suppliers' || survey?.sells === 'both') return 'MARKETPLACE';
  return 'INDEPENDENT';
}

/**
 * Country to pre-select from the browser locale (`sv-SE` → SE). Sweden is the
 * platform's home market and the fallback.
 */
export function countryFromLocale(locale: string | null | undefined): string {
  const region = (locale ?? '').split(/[-_]/)[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : 'SE';
}

// ── Setup checklist (dashboard home) ──────────────────────────────────────

export type SetupStepKey =
  | 'verify_email'
  | 'create_store'
  | 'first_product'
  | 'theme'
  | 'shipping'
  | 'payments'
  | 'trader_details'
  | 'legal_pages'
  | 'preview'
  | 'request_golive';

export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
  /** Required before "Request go-live" is enabled (API `blocking`). */
  required: boolean;
}

/** The slice of the overview `setup` object the checklist still reads. */
export interface SetupSignals {
  has_shipping?: boolean;
  has_payment?: boolean;
}

export interface ChecklistInput {
  status: StoreStatus | string | null | undefined;
  checklist: Partial<GoLiveChecklist> | null | undefined;
  setup?: SetupSignals | null;
  /** The creator opened the storefront preview at least once (local flag). */
  previewed?: boolean;
  /** INDEPENDENT stores publish their own legal pages (required for go-live). */
  independent?: boolean;
}

const DEFAULT_ORDER: readonly SetupStepKey[] = [
  'verify_email',
  'create_store',
  'first_product',
  'theme',
  'shipping',
  'payments',
  'trader_details',
  'legal_pages',
  'preview',
  'request_golive',
];

/**
 * Step order personalised by the survey: a physical shop or an established
 * online seller usually has legal details and shipping ready, so those come
 * right after the first product; everyone else follows the default order.
 */
export function setupStepOrder(survey?: OnboardingSurvey | null): SetupStepKey[] {
  if (survey?.stage === 'physical_shop' || survey?.stage === 'selling_online') {
    return [
      'verify_email',
      'create_store',
      'first_product',
      'trader_details',
      'legal_pages',
      'shipping',
      'payments',
      'theme',
      'preview',
      'request_golive',
    ];
  }
  return [...DEFAULT_ORDER];
}

/**
 * Computes the setup checklist shown on the dashboard home. The store exists
 * whenever this runs (no store → the onboarding page), so "create store" is
 * always done. Go-live counts as done once the store is or was live, or a
 * request is pending review. INDEPENDENT stores get a required "legal pages"
 * step (own Privacy policy + Terms of sale published).
 */
export function computeSetupChecklist(input: ChecklistInput, survey?: OnboardingSurvey | null): SetupStep[] {
  const c = input.checklist ?? {};
  const status = input.status ?? 'DRAFT';
  const requested = status === 'PENDING_REVIEW' || status === 'LIVE' || status === 'PAUSED';
  const done: Record<SetupStepKey, boolean> = {
    verify_email: !!c.email_verified,
    create_store: true,
    first_product: !!c.has_published_product,
    theme: !!c.has_published_theme,
    shipping: !!input.setup?.has_shipping,
    payments: !!c.payments_ready || !!input.setup?.has_payment,
    trader_details: !!c.trader_details_complete,
    legal_pages: !!c.legal_pages_published,
    preview: !!input.previewed || requested,
    request_golive: requested,
  };
  const required = new Set<SetupStepKey>(['verify_email', 'create_store', 'first_product', 'trader_details', 'request_golive']);
  if (input.independent) required.add('legal_pages');
  // MARKETPLACE stores use the platform's legal texts: no legal pages step.
  return setupStepOrder(survey)
    .filter((key) => key !== 'legal_pages' || !!input.independent)
    .map((key) => ({ key, done: done[key], required: required.has(key) }));
}

/** Dashboard routes per checklist step (`independent` picks the product form). */
export function setupStepHref(key: SetupStepKey, independent: boolean, storeUrl?: string | null): string {
  switch (key) {
    case 'verify_email':
      return '/creator/settings?tab=account#verify-email';
    case 'create_store':
      return '/creator/store';
    case 'first_product':
      return independent ? '/creator/products/own/new' : '/creator/custom-products/new';
    case 'theme':
      return '/creator/themes';
    case 'shipping':
      return '/creator/shipping';
    case 'payments':
      return '/creator/settings?tab=payments';
    case 'trader_details':
      return '/creator/settings?tab=business';
    case 'legal_pages':
      return '/creator/legal';
    case 'preview':
      return storeUrl || '/creator/store';
    case 'request_golive':
      return '/creator#store-status';
  }
}

/** API `blocking` keys → checklist step keys (for the status card links). */
export function blockingToStep(item: string): SetupStepKey | null {
  switch (item) {
    case 'email_verified':
      return 'verify_email';
    case 'trader_details_complete':
      return 'trader_details';
    case 'has_published_product':
      return 'first_product';
    case 'has_published_theme':
      return 'theme';
    case 'payments_ready':
      return 'payments';
    default:
      return null;
  }
}

/**
 * Dashboard link for an API `blocking` key: the checklist step route when it
 * maps to one; INDEPENDENT stores' legal pages open the "Legal pages" card on
 * /creator/pages. Null = plain text.
 */
export function blockingHref(item: string, independent: boolean, storeUrl?: string | null): string | null {
  if (item === 'legal_pages_published') return independent ? setupStepHref('legal_pages', independent, storeUrl) : null;
  const step = blockingToStep(item);
  return step ? setupStepHref(step, independent, storeUrl) : null;
}

// ── Unverified email grace period ─────────────────────────────────────────

/**
 * Whole days left until the verification deadline (SPEC §2: created_at + 7 d),
 * never negative; null when there is no deadline.
 */
export function verificationDaysLeft(deadline: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const end = deadline instanceof Date ? deadline.getTime() : Date.parse(deadline);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/** True for a staff account whose email is still unverified. */
export function needsEmailVerification(user: {
  role?: string | null;
  email_verified_at?: string | null;
  verification_deadline?: string | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== 'CREATOR' && user.role !== 'PROVIDER') return false;
  // Accounts created before verification existed have no deadline and are
  // treated as verified (SPEC §1 backfill); only PENDING users carry one.
  return !user.email_verified_at && !!user.verification_deadline;
}

/** The two guard codes that mean "verify your email first". */
export function isUnverifiedCode(code: string | null | undefined): boolean {
  return code === 'ACCOUNT_EMAIL_UNVERIFIED' || code === 'ACCOUNT_EMAIL_UNVERIFIED_EXPIRED';
}

// ── Slug availability (`GET /stores/slug-available`) ──────────────────────

export type SlugAvailabilityReason = 'taken' | 'reserved' | 'invalid';

export interface SlugAvailability {
  slug: string;
  normalized: string;
  available: boolean;
  reason?: SlugAvailabilityReason;
}

export type SlugCheckState = 'idle' | 'checking' | 'available' | SlugAvailabilityReason;

/** Maps the API answer to the hint state shown under the slug input. */
export function slugCheckState(answer: SlugAvailability | null | undefined): SlugCheckState {
  if (!answer) return 'idle';
  if (answer.available) return 'available';
  return answer.reason ?? 'taken';
}

// ── Reserved slugs (mirrors the API constant for the live hint) ───────────

export const RESERVED_STORE_SLUGS: ReadonlySet<string> = new Set([
  'www', 'api', 'admin', 'app', 'dashboard', 'mail', 'smtp', 'ftp', 'static', 'assets', 'cdn',
  'images', 'img', 'media', 'files', 'blog', 'shop', 'store', 'stores', 'support', 'help', 'docs',
  'status', 'login', 'auth', 'account', 'accounts', 'checkout', 'cart', 'ms-api', 'ms-dash',
  'platform', 'shopsdoor', 'namez',
]);

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug.trim().toLowerCase());
}
