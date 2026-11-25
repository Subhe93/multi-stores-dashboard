// Pure helpers of the Reviews page (`/creator/reviews`, store app `reviews`,
// M171) and the "Review links" card of the order view: URL state, API query
// strings, response shaping and the friendly-error decision.
// Kept free of React, `@/` imports and browser globals so node:test can load it.
//
// The owner moderates only (approve / reject / reply / delete). Nothing here
// builds a request that creates a review or changes its rating, title, text
// or display name: reviews must be genuine.

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export const REVIEW_STATUSES: readonly ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/** Status tabs of the list; `pending` is the default (left out of the URL). */
export type ReviewTab = 'pending' | 'approved' | 'rejected' | 'all';
export const REVIEW_TABS: readonly ReviewTab[] = ['pending', 'approved', 'rejected', 'all'];

export type ReviewRatingFilter = '' | '1' | '2' | '3' | '4' | '5';
export const REVIEW_RATINGS: readonly Exclude<ReviewRatingFilter, ''>[] = ['5', '4', '3', '2', '1'];

/** Rows per page (API default; sent explicitly). */
export const REVIEWS_PAGE_SIZE = 25;
/** Owner reply limit (API: 1..1000 after trimming). */
export const REVIEW_REPLY_MAX = 1000;

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value);
}

// ─── API shapes ─────────────────────────────────────────────────────────────

export interface ReviewProduct {
  id: string;
  kind: 'product' | 'custom_product';
  title: string;
  slug: string;
  image_url: string | null;
}

/** One row of `GET /stores/my/reviews` (no email, phone or address). */
export interface OwnerReview {
  id: string;
  status: ReviewStatus;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  locale: string;
  verified: boolean;
  /** How the review reached the store: ACCOUNT or LINK (other values shown as is). */
  source: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  reply: { body: string; replied_at: string | null } | null;
  product: ReviewProduct | null;
  order: { id: string; order_number: string } | null;
  customer: { id: string; name: string } | null;
}

export interface ReviewCounts {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  /** Sum of the three (the "All" tab). */
  ALL: number;
}

export interface ReviewListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReviewsPage {
  items: OwnerReview[];
  meta: ReviewListMeta;
  counts: ReviewCounts;
}

/** One row of `POST /stores/my/reviews/links`. */
export interface ReviewLink {
  order_item_id: string;
  product_title: string;
  url: string;
  expires_at: string | null;
  review_status: ReviewStatus | null;
}

// ─── URL state ──────────────────────────────────────────────────────────────

export interface ReviewListState {
  tab: ReviewTab;
  rating: ReviewRatingFilter;
  /** Product or custom-product id ('' = all products). */
  product: string;
  page: number;
}

interface ParamsLike {
  get(name: string): string | null;
}

/** Reads the list state from the page URL; anything odd falls back to the default. */
export function parseReviewListState(params: ParamsLike): ReviewListState {
  const tab = params.get('tab') ?? '';
  const rating = params.get('rating') ?? '';
  const product = params.get('product') ?? '';
  const pageRaw = params.get('page') ?? '';
  const page = /^\d{1,6}$/.test(pageRaw) ? Number(pageRaw) : 1;
  return {
    tab: (REVIEW_TABS as readonly string[]).includes(tab) ? (tab as ReviewTab) : 'pending',
    rating: /^[1-5]$/.test(rating) ? (rating as ReviewRatingFilter) : '',
    product: ID_RE.test(product) ? product : '',
    page: page > 1 ? page : 1,
  };
}

/** URL query of a list state (defaults left out), without the leading `?`. */
export function serializeReviewListState(state: Partial<ReviewListState>): string {
  const sp = new URLSearchParams();
  if (state.tab && state.tab !== 'pending') sp.set('tab', state.tab);
  if (state.rating) sp.set('rating', state.rating);
  if (state.product) sp.set('product', state.product);
  if (state.page && state.page > 1) sp.set('page', String(state.page));
  return sp.toString();
}

/**
 * Applies a patch to the current query string. An empty value removes the
 * key; changing a tab or filter goes back to page 1 (unless `page` is in the
 * patch).
 */
export function patchReviewListParams(current: string, patch: Record<string, string>): string {
  const sp = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value) sp.set(key, value);
    else sp.delete(key);
  }
  if (!('page' in patch)) sp.delete('page');
  return sp.toString();
}

/** API status of a tab (`null` = every status). */
export function tabStatus(tab: ReviewTab): ReviewStatus | null {
  if (tab === 'pending') return 'PENDING';
  if (tab === 'approved') return 'APPROVED';
  if (tab === 'rejected') return 'REJECTED';
  return null;
}

/** API query string (with the leading `?`) of `GET /stores/my/reviews`. */
export function reviewListQuery(state: ReviewListState, limit: number = REVIEWS_PAGE_SIZE): string {
  const sp = new URLSearchParams();
  sp.set('page', String(state.page));
  sp.set('limit', String(limit));
  const status = tabStatus(state.tab);
  if (status) sp.set('status', status);
  if (state.rating) sp.set('rating', state.rating);
  if (state.product) sp.set('product_id', state.product);
  return `?${sp.toString()}`;
}

/** True when the rating or product filter narrows the list (tabs are not filters). */
export function isReviewListFiltered(state: ReviewListState): boolean {
  return !!(state.rating || state.product);
}

// ─── Response shaping ───────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const strOrNull = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

function count(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Tab counts; a missing or malformed value counts as 0. */
export function normalizeReviewCounts(raw: unknown): ReviewCounts {
  const r = isRecord(raw) ? raw : {};
  const PENDING = count(r.PENDING);
  const APPROVED = count(r.APPROVED);
  const REJECTED = count(r.REJECTED);
  return { PENDING, APPROVED, REJECTED, ALL: PENDING + APPROVED + REJECTED };
}

/** Count shown on a tab. */
export function tabCount(counts: ReviewCounts, tab: ReviewTab): number {
  const status = tabStatus(tab);
  return status ? counts[status] : counts.ALL;
}

function normalizeProduct(raw: unknown): ReviewProduct | null {
  if (!isRecord(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    kind: raw.kind === 'custom_product' ? 'custom_product' : 'product',
    title: str(raw.title),
    slug: str(raw.slug),
    image_url: strOrNull(raw.image_url),
  };
}

/** One list row; `null` when the row has no id or an unknown status. */
export function normalizeOwnerReview(raw: unknown): OwnerReview | null {
  if (!isRecord(raw) || !str(raw.id) || !isReviewStatus(raw.status)) return null;
  const rating = typeof raw.rating === 'number' && Number.isFinite(raw.rating) ? raw.rating : 0;
  const reply = isRecord(raw.reply) && str(raw.reply.body) ? { body: str(raw.reply.body), replied_at: strOrNull(raw.reply.replied_at) } : null;
  const order = isRecord(raw.order) && str(raw.order.id) ? { id: str(raw.order.id), order_number: str(raw.order.order_number) } : null;
  const customer = isRecord(raw.customer) && str(raw.customer.id) ? { id: str(raw.customer.id), name: str(raw.customer.name) } : null;
  return {
    id: str(raw.id),
    status: raw.status,
    rating: Math.min(5, Math.max(0, Math.round(rating))),
    title: strOrNull(raw.title),
    body: str(raw.body),
    display_name: str(raw.display_name),
    locale: str(raw.locale),
    verified: raw.verified === true,
    source: str(raw.source),
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
    published_at: strOrNull(raw.published_at),
    reply,
    product: normalizeProduct(raw.product),
    order,
    customer,
  };
}

/** `GET /stores/my/reviews` -> rows, pagination meta of the DataTable, tab counts. */
export function normalizeReviewsPage(raw: unknown, fallbackLimit: number = REVIEWS_PAGE_SIZE): ReviewsPage {
  const r = isRecord(raw) ? raw : {};
  const items = (Array.isArray(r.items) ? r.items : [])
    .map(normalizeOwnerReview)
    .filter((row): row is OwnerReview => row !== null);
  const total = count(r.total);
  const limit = count(r.limit) || fallbackLimit;
  const page = count(r.page) || 1;
  return {
    items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    counts: normalizeReviewCounts(r.counts),
  };
}

/** `GET /stores/my/reviews/pending-count` -> a whole number (0 on anything odd). */
export function normalizePendingCount(raw: unknown): number {
  return isRecord(raw) ? count(raw.count) : 0;
}

/** Sidebar badge of the pending count: hidden at 0, capped at "99+". */
export function pendingBadge(pending: number): string | undefined {
  if (!Number.isFinite(pending) || pending < 1) return undefined;
  return pending > 99 ? '99+' : String(Math.floor(pending));
}

/** `POST /stores/my/reviews/links` -> rows with a usable http(s) link only. */
export function normalizeReviewLinks(raw: unknown): ReviewLink[] {
  const list = isRecord(raw) && Array.isArray(raw.links) ? raw.links : [];
  const out: ReviewLink[] = [];
  for (const row of list) {
    if (!isRecord(row)) continue;
    const url = str(row.url);
    if (!str(row.order_item_id) || !/^https?:\/\//i.test(url)) continue;
    out.push({
      order_item_id: str(row.order_item_id),
      product_title: str(row.product_title),
      url,
      expires_at: strOrNull(row.expires_at),
      review_status: isReviewStatus(row.review_status) ? row.review_status : null,
    });
  }
  return out;
}

// ─── Display helpers ────────────────────────────────────────────────────────

/** Characters the API counts for a reply (trimmed). */
export function replyLength(text: string): number {
  return text.trim().length;
}

/** A reply may be saved when it has 1..1000 characters after trimming. */
export function isReplyValid(text: string): boolean {
  const n = replyLength(text);
  return n >= 1 && n <= REVIEW_REPLY_MAX;
}

/** Translation key suffix of a known source (`null` = show the raw value). */
export function reviewSourceKey(source: string): 'ACCOUNT' | 'LINK' | null {
  return source === 'ACCOUNT' || source === 'LINK' ? source : null;
}

/** Dashboard page of the reviewed product. */
export function reviewProductHref(product: Pick<ReviewProduct, 'id' | 'kind'>): string {
  const id = encodeURIComponent(product.id);
  return product.kind === 'custom_product' ? `/creator/custom-products/${id}` : `/creator/products/own/${id}`;
}

// ─── Settings (store app `reviews`) ─────────────────────────────────────────

export interface ReviewsSettings {
  /** Publish a submitted review at once instead of waiting for moderation. */
  auto_publish: boolean;
}

/** Lenient read: anything but `auto_publish: true` is moderation first. */
export function normalizeReviewsSettings(raw: unknown): ReviewsSettings {
  return { auto_publish: isRecord(raw) && raw.auto_publish === true };
}

// ─── Product filter options ─────────────────────────────────────────────────

interface ProductSearchRow {
  id?: unknown;
  translations?: Array<{ locale?: string | null; title?: string | null }> | null;
  images?: Array<{ url?: string | null }> | null;
  mockup_images?: Array<{ url?: string | null }> | null;
  product?: { images?: Array<{ url?: string | null }> | null } | null;
}

export interface ReviewProductOption {
  value: string;
  label: string;
  /** Raw image path (the caller resolves it against the API host). */
  image: string | null;
}

/** Title in the preferred locale, else English, else any. */
function titleOf(row: ProductSearchRow, locale: string): string {
  const list = Array.isArray(row.translations) ? row.translations : [];
  const hit = list.find((t) => t?.locale === locale && t.title) ?? list.find((t) => t?.locale === 'en' && t.title) ?? list.find((t) => t?.title);
  return hit?.title ?? '';
}

/**
 * Options of the product filter from the owner's product search results
 * (`GET /products/mine`) and, for marketplace stores, the custom-product
 * search (`GET /custom-products`). Rows without an id are dropped and an id
 * is listed once.
 */
export function reviewProductOptions(products: unknown, customProducts: unknown, locale: string): ReviewProductOption[] {
  const rowsOf = (raw: unknown): ProductSearchRow[] => {
    const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.data) ? raw.data : [];
    return list.filter(isRecord) as ProductSearchRow[];
  };
  const seen = new Set<string>();
  const out: ReviewProductOption[] = [];
  const push = (row: ProductSearchRow, image: string | null | undefined) => {
    const id = str(row.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ value: id, label: titleOf(row, locale) || id, image: image || null });
  };
  for (const row of rowsOf(products)) push(row, row.images?.[0]?.url);
  for (const row of rowsOf(customProducts)) push(row, row.mockup_images?.[0]?.url ?? row.product?.images?.[0]?.url);
  return out;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Translation key (under `errors.`) of a failed request. A code with a
 * translation wins; everything else (a code the dashboard does not know, raw
 * validator output, a network failure) is the generic message, so the owner
 * never reads raw API text.
 */
export function reviewErrorKey(err: unknown, hasTranslation: (code: string) => boolean): string {
  const code = isRecord(err) || err instanceof Error ? (err as { code?: unknown }).code : undefined;
  return typeof code === 'string' && code && hasTranslation(code) ? code : 'generic';
}

/**
 * True for the "this review changed since you opened it" answer of a
 * moderation call: the list is reloaded so the owner reads the new text.
 */
export function isReviewChanged(err: unknown): boolean {
  return (isRecord(err) || err instanceof Error) && (err as { code?: unknown }).code === 'REVIEW_CHANGED';
}

/**
 * The row an open dialog shows after a reload that followed REVIEW_CHANGED:
 * the fresh row of the same review, or `null` (close the dialog) when the
 * review left the current list.
 */
export function refreshedReview(rows: readonly OwnerReview[], reviewId: string): OwnerReview | null {
  return rows.find((row) => row.id === reviewId) ?? null;
}

/** True for the "order is not a real, paid purchase" answer (shown inline, not as an error). */
export function isOrderNotEligible(err: unknown): boolean {
  return (isRecord(err) || err instanceof Error) && (err as { code?: unknown }).code === 'REVIEW_ORDER_NOT_ELIGIBLE';
}
