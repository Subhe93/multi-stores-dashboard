// Unit test of the Reviews page helpers (M171): URL state, API query, response
// shaping, friendly errors, the app registry entry and the "moderation only"
// shape of the API client.
// Run: node --experimental-strip-types --test src/lib/reviews.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  REVIEW_REPLY_MAX,
  REVIEW_TABS,
  isOrderNotEligible,
  isReviewChanged,
  refreshedReview,
  isReplyValid,
  isReviewListFiltered,
  normalizeOwnerReview,
  normalizePendingCount,
  normalizeReviewCounts,
  normalizeReviewLinks,
  normalizeReviewsPage,
  normalizeReviewsSettings,
  parseReviewListState,
  patchReviewListParams,
  pendingBadge,
  replyLength,
  reviewErrorKey,
  reviewListQuery,
  reviewProductHref,
  reviewProductOptions,
  reviewSourceKey,
  serializeReviewListState,
  tabCount,
  tabStatus,
} from './reviews.ts';
import { STORE_APPS, STORE_APP_HREFS, STORE_APP_KEYS, VISIBLE_STORE_APP_KEYS, isStoreAppKey } from './storeApps.registry.ts';

const ID = '11111111-2222-3333-4444-555555555555';
const parse = (qs) => parseReviewListState(new URLSearchParams(qs));
const source = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

// ─── URL state ──────────────────────────────────────────────────────────────

test('parseReviewListState: an empty URL opens the Pending tab, page 1, no filters', () => {
  assert.deepEqual(parse(''), { tab: 'pending', rating: '', product: '', page: 1 });
});

test('parseReviewListState: reads valid values', () => {
  assert.deepEqual(parse(`tab=approved&rating=4&product=${ID}&page=3`), { tab: 'approved', rating: '4', product: ID, page: 3 });
  assert.equal(parse('tab=all').tab, 'all');
  assert.equal(parse('tab=rejected').tab, 'rejected');
});

test('parseReviewListState: junk falls back to the defaults', () => {
  assert.deepEqual(parse('tab=PENDING&rating=6&product=abc&page=-2'), { tab: 'pending', rating: '', product: '', page: 1 });
  assert.equal(parse('rating=0').rating, '');
  assert.equal(parse('rating=4.5').rating, '');
  assert.equal(parse('page=1e3').page, 1);
  assert.equal(parse('page=0').page, 1);
  assert.equal(parse(`product=${ID}%27--`).product, '');
});

test('serializeReviewListState: defaults are left out and the state round-trips', () => {
  assert.equal(serializeReviewListState({ tab: 'pending', rating: '', product: '', page: 1 }), '');
  const state = { tab: 'rejected', rating: '2', product: ID, page: 4 };
  assert.deepEqual(parse(serializeReviewListState(state)), state);
});

test('patchReviewListParams: a tab or filter change goes back to page 1, a page change keeps the rest', () => {
  assert.equal(patchReviewListParams('tab=approved&page=3', { rating: '5' }), 'tab=approved&rating=5');
  assert.equal(patchReviewListParams('tab=approved&rating=5&page=3', { tab: '' }), 'rating=5');
  assert.equal(patchReviewListParams('tab=approved&rating=5', { page: '2' }), 'tab=approved&rating=5&page=2');
  assert.equal(patchReviewListParams('rating=5&page=2', { page: '' }), 'rating=5');
  assert.equal(patchReviewListParams('rating=5&product=' + ID, { rating: '', product: '' }), '');
});

test('tabStatus: every tab maps to one API status, "all" to none', () => {
  assert.deepEqual(REVIEW_TABS.map(tabStatus), ['PENDING', 'APPROVED', 'REJECTED', null]);
});

test('reviewListQuery: builds the API query; "all" sends no status', () => {
  assert.equal(reviewListQuery(parse('')), '?page=1&limit=25&status=PENDING');
  assert.equal(reviewListQuery(parse('tab=all')), '?page=1&limit=25');
  assert.equal(
    reviewListQuery(parse(`tab=approved&rating=3&product=${ID}&page=2`)),
    `?page=2&limit=25&status=APPROVED&rating=3&product_id=${ID}`,
  );
  assert.equal(reviewListQuery(parse('tab=rejected'), 50), '?page=1&limit=50&status=REJECTED');
});

test('reviewListQuery: never carries a store id or slug (the store comes from the session)', () => {
  const q = reviewListQuery(parse(`tab=all&rating=1&product=${ID}&page=9&store=x&store_id=y&slug=z`));
  assert.deepEqual([...new URLSearchParams(q.slice(1)).keys()].sort(), ['limit', 'page', 'product_id', 'rating']);
});

test('isReviewListFiltered: tabs and pages are not filters', () => {
  assert.equal(isReviewListFiltered(parse('tab=all&page=2')), false);
  assert.equal(isReviewListFiltered(parse('rating=5')), true);
  assert.equal(isReviewListFiltered(parse(`product=${ID}`)), true);
});

// ─── Response shaping ───────────────────────────────────────────────────────

test('normalizeReviewCounts: missing or malformed values count as 0; ALL is the sum', () => {
  assert.deepEqual(normalizeReviewCounts({ PENDING: 3, APPROVED: 10, REJECTED: 1 }), { PENDING: 3, APPROVED: 10, REJECTED: 1, ALL: 14 });
  assert.deepEqual(normalizeReviewCounts(null), { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: 0 });
  assert.deepEqual(normalizeReviewCounts({ PENDING: '4', APPROVED: -2, REJECTED: Number.NaN }), { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: 0 });
  assert.deepEqual(normalizeReviewCounts({ PENDING: 2.9 }), { PENDING: 2, APPROVED: 0, REJECTED: 0, ALL: 2 });
});

test('tabCount: the count of each tab', () => {
  const counts = normalizeReviewCounts({ PENDING: 3, APPROVED: 10, REJECTED: 1 });
  assert.deepEqual(REVIEW_TABS.map((tab) => tabCount(counts, tab)), [3, 10, 1, 14]);
});

const apiRow = {
  id: 'r1',
  status: 'PENDING',
  rating: 4,
  title: 'Nice',
  body: 'Good quality <b>shirt</b>',
  display_name: 'Sara A.',
  locale: 'sv',
  verified: true,
  source: 'LINK',
  created_at: '2026-11-20T10:00:00.000Z',
  updated_at: '2026-11-21T10:00:00.000Z',
  published_at: null,
  reply: { body: 'Thanks', replied_at: '2026-11-22T10:00:00.000Z' },
  product: { id: 'p1', kind: 'custom_product', title: 'Shirt', slug: 'shirt', image_url: '/uploads/a.jpg' },
  order: { id: 'o1', order_number: 'ORD-1' },
  customer: { id: 'c1', name: 'Sara Andersson' },
};

test('normalizeOwnerReview: keeps the API row as is (text untouched, still plain text)', () => {
  assert.deepEqual(normalizeOwnerReview(apiRow), apiRow);
});

test('normalizeOwnerReview: drops rows without an id or with an unknown status', () => {
  assert.equal(normalizeOwnerReview(null), null);
  assert.equal(normalizeOwnerReview({ ...apiRow, id: '' }), null);
  assert.equal(normalizeOwnerReview({ ...apiRow, status: 'HIDDEN' }), null);
});

test('normalizeOwnerReview: tolerates missing product / order / customer / reply and odd values', () => {
  const row = normalizeOwnerReview({ id: 'r2', status: 'APPROVED', rating: 9, body: 'x', product: null, order: null, customer: null, reply: { body: '' } });
  assert.equal(row.rating, 5);
  assert.equal(row.product, null);
  assert.equal(row.order, null);
  assert.equal(row.customer, null);
  assert.equal(row.reply, null);
  assert.equal(row.title, null);
  assert.equal(row.verified, false);
  assert.equal(normalizeOwnerReview({ id: 'r3', status: 'REJECTED', rating: 'five' }).rating, 0);
  assert.equal(normalizeOwnerReview({ ...apiRow, product: { id: 'p', kind: 'weird' } }).product.kind, 'product');
});

test('normalizeOwnerReview: never carries fields the owner payload does not define (no email)', () => {
  const row = normalizeOwnerReview({ ...apiRow, email: 'a@b.se', customer: { id: 'c1', name: 'Sara', email: 'a@b.se', phone: '1' } });
  assert.equal('email' in row, false);
  assert.deepEqual(row.customer, { id: 'c1', name: 'Sara' });
});

test('normalizeReviewsPage: rows, DataTable meta and counts', () => {
  const page = normalizeReviewsPage({ items: [apiRow, { id: 'bad' }], total: 51, page: 2, limit: 25, counts: { PENDING: 51 } });
  assert.equal(page.items.length, 1);
  assert.deepEqual(page.meta, { total: 51, page: 2, limit: 25, totalPages: 3 });
  assert.equal(page.counts.ALL, 51);
});

test('normalizeReviewsPage: a malformed answer is an empty page, never a crash', () => {
  for (const raw of [null, undefined, 'x', [], { items: 'no' }]) {
    assert.deepEqual(normalizeReviewsPage(raw), {
      items: [],
      meta: { total: 0, page: 1, limit: 25, totalPages: 0 },
      counts: { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: 0 },
    });
  }
});

test('normalizePendingCount + pendingBadge: hidden at 0, capped at 99+', () => {
  assert.equal(normalizePendingCount({ count: 7 }), 7);
  assert.equal(normalizePendingCount({ count: '7' }), 0);
  assert.equal(normalizePendingCount(null), 0);
  assert.equal(pendingBadge(0), undefined);
  assert.equal(pendingBadge(-1), undefined);
  assert.equal(pendingBadge(Number.NaN), undefined);
  assert.equal(pendingBadge(1), '1');
  assert.equal(pendingBadge(99), '99');
  assert.equal(pendingBadge(100), '99+');
});

test('normalizeReviewLinks: keeps http(s) links only and unknown statuses become null', () => {
  const links = normalizeReviewLinks({
    links: [
      { order_item_id: 'i1', product_title: 'Shirt', url: 'https://shop.example/reviews/write#token=abc', expires_at: '2027-02-20T00:00:00.000Z', review_status: 'APPROVED' },
      { order_item_id: 'i2', product_title: 'Mug', url: 'javascript:alert(1)', expires_at: null, review_status: null },
      { order_item_id: '', product_title: 'X', url: 'https://shop.example/x' },
      { order_item_id: 'i3', product_title: 'Cap', url: 'http://localhost:3000/reviews/write#token=d', review_status: 'ODD' },
      null,
    ],
  });
  assert.deepEqual(links.map((l) => l.order_item_id), ['i1', 'i3']);
  assert.equal(links[0].review_status, 'APPROVED');
  assert.equal(links[1].review_status, null);
  assert.equal(links[1].expires_at, null);
  assert.deepEqual(normalizeReviewLinks(null), []);
  assert.deepEqual(normalizeReviewLinks({ links: 'x' }), []);
});

// ─── Display helpers ────────────────────────────────────────────────────────

test('reply validation: 1..1000 characters after trimming', () => {
  assert.equal(replyLength('  hi  '), 2);
  assert.equal(isReplyValid(''), false);
  assert.equal(isReplyValid('   \n '), false);
  assert.equal(isReplyValid('a'), true);
  assert.equal(isReplyValid('a'.repeat(REVIEW_REPLY_MAX)), true);
  assert.equal(isReplyValid('a'.repeat(REVIEW_REPLY_MAX + 1)), false);
  assert.equal(isReplyValid(` ${'a'.repeat(REVIEW_REPLY_MAX)} `), true);
});

test('reviewSourceKey: known sources only', () => {
  assert.equal(reviewSourceKey('ACCOUNT'), 'ACCOUNT');
  assert.equal(reviewSourceKey('LINK'), 'LINK');
  assert.equal(reviewSourceKey('IMPORT'), null);
  assert.equal(reviewSourceKey(''), null);
});

test('reviewProductHref: own product vs custom product page', () => {
  assert.equal(reviewProductHref({ id: 'p 1', kind: 'product' }), '/creator/products/own/p%201');
  assert.equal(reviewProductHref({ id: 'c1', kind: 'custom_product' }), '/creator/custom-products/c1');
});

test('normalizeReviewsSettings: only a real `true` switches auto publish on', () => {
  assert.deepEqual(normalizeReviewsSettings({ auto_publish: true }), { auto_publish: true });
  for (const raw of [null, {}, [], { auto_publish: 'true' }, { auto_publish: 1 }]) {
    assert.deepEqual(normalizeReviewsSettings(raw), { auto_publish: false });
  }
});

test('reviewProductOptions: products and custom products, locale title, no duplicates', () => {
  const options = reviewProductOptions(
    {
      data: [
        { id: 'p1', translations: [{ locale: 'en', title: 'Shirt' }, { locale: 'sv', title: 'Skjorta' }], images: [{ url: '/uploads/p1.jpg' }] },
        { id: 'p2', translations: [{ locale: 'de', title: 'Tasse' }] },
        { translations: [{ locale: 'en', title: 'No id' }] },
      ],
    },
    [
      { id: 'c1', translations: [{ locale: 'en', title: 'Custom' }], mockup_images: [], product: { images: [{ url: '/uploads/base.jpg' }] } },
      { id: 'p1', translations: [{ locale: 'en', title: 'Duplicate' }] },
      { id: 'c2', translations: [] },
    ],
    'sv',
  );
  assert.deepEqual(options, [
    { value: 'p1', label: 'Skjorta', image: '/uploads/p1.jpg' },
    { value: 'p2', label: 'Tasse', image: null },
    { value: 'c1', label: 'Custom', image: '/uploads/base.jpg' },
    { value: 'c2', label: 'c2', image: null },
  ]);
  assert.deepEqual(reviewProductOptions(null, null, 'en'), []);
});

// ─── Errors ─────────────────────────────────────────────────────────────────

test('reviewErrorKey: a translated code wins; raw API text is never used', () => {
  const known = (code) => ['REVIEW_NOT_FOUND', 'REVIEW_REPLY_INVALID'].includes(code);
  assert.equal(reviewErrorKey({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' }, known), 'REVIEW_NOT_FOUND');
  assert.equal(reviewErrorKey({ code: 'SOMETHING_NEW', message: 'raw text' }, known), 'generic');
  // Raw class-validator output: a 400 without a code.
  assert.equal(reviewErrorKey({ status: 400, message: 'status must be one of the following values: APPROVED, REJECTED' }, known), 'generic');
  assert.equal(reviewErrorKey(new TypeError('Failed to fetch'), known), 'generic');
  assert.equal(reviewErrorKey(null, known), 'generic');
  assert.equal(reviewErrorKey('boom', known), 'generic');
  const err = Object.assign(new Error('x'), { code: 'REVIEW_REPLY_INVALID' });
  assert.equal(reviewErrorKey(err, known), 'REVIEW_REPLY_INVALID');
});

test('isReviewChanged: only that code', () => {
  assert.equal(isReviewChanged({ code: 'REVIEW_CHANGED', status: 409 }), true);
  assert.equal(isReviewChanged(Object.assign(new Error('x'), { code: 'REVIEW_CHANGED' })), true);
  assert.equal(isReviewChanged({ code: 'REVIEW_NOT_FOUND' }), false);
  assert.equal(isReviewChanged({ status: 409 }), false);
  assert.equal(isReviewChanged(null), false);
});

test('refreshedReview: the fresh row of the same review, or null when it left the list', () => {
  const rows = [{ id: 'a', updated_at: '2026-11-25T10:00:01.000Z' }, { id: 'b', updated_at: '2026-11-25T09:00:00.000Z' }];
  assert.equal(refreshedReview(rows, 'a'), rows[0]);
  assert.equal(refreshedReview(rows, 'c'), null);
  assert.equal(refreshedReview([], 'a'), null);
});

test('REVIEW_CHANGED reloads the list and refreshes the open dialog', () => {
  const manager = source('../components/reviews/ReviewsManager.tsx');
  assert.match(manager, /if \(isReviewChanged\(err\)\) \{[\s\S]*?refreshId\.current = review\.id;[\s\S]*?reload\(\);/);
  assert.match(manager, /refreshedReview\(page\.items, changedId\)/);
});

test('isOrderNotEligible: only that code', () => {
  assert.equal(isOrderNotEligible({ code: 'REVIEW_ORDER_NOT_ELIGIBLE' }), true);
  assert.equal(isOrderNotEligible(Object.assign(new Error('x'), { code: 'REVIEW_ORDER_NOT_ELIGIBLE' })), true);
  assert.equal(isOrderNotEligible({ code: 'REVIEWS_NOT_ENABLED' }), false);
  assert.equal(isOrderNotEligible(null), false);
});

// ─── Registry ───────────────────────────────────────────────────────────────

test('reviews is a registered, visible store app for every store type with its own page', () => {
  assert.ok(STORE_APP_KEYS.includes('reviews'));
  assert.ok(VISIBLE_STORE_APP_KEYS.includes('reviews'));
  assert.ok(isStoreAppKey('reviews'));
  assert.equal(STORE_APPS.reviews.key, 'reviews');
  assert.equal(STORE_APPS.reviews.requiresIndependent, false);
  assert.deepEqual(STORE_APPS.reviews.dependsOn, []);
  assert.equal(STORE_APP_HREFS.reviews, '/creator/reviews');
});

// The shared sources sit next to this repo on a developer machine; a build
// host that only has the packaged core skips the comparison.
const SHARED_REGISTRY = fileURLToPath(new URL('../../../multi-stores-shared/src/constants/store-apps.ts', import.meta.url));

test('the dashboard registry lists the same app keys, in the same order, as the shared package', { skip: !existsSync(SHARED_REGISTRY) }, () => {
  const shared = readFileSync(SHARED_REGISTRY, 'utf8');
  const block = shared.match(/STORE_APP_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(block, 'shared STORE_APP_KEYS not found');
  const sharedKeys = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...STORE_APP_KEYS], sharedKeys);
});

// ─── API client: moderation only ────────────────────────────────────────────

// Comments stripped, so only the code is inspected.
const apiCode = source('./reviews.api.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the API client only calls /stores/my/reviews routes and takes the store from the session', () => {
  assert.match(apiCode, /const BASE = '\/stores\/my\/reviews';/);
  const endpoints = [...apiCode.matchAll(/api<unknown>\(`([^`]*)`/g)].map((m) => m[1]);
  assert.equal(endpoints.length, 7);
  for (const endpoint of endpoints) assert.ok(endpoint.startsWith('${BASE}'), endpoint);
  assert.doesNotMatch(apiCode, /store_id|storeId|slug/);
});

test('the owner cannot create a review or edit rating, title, text or display name', () => {
  // The only POST creates buyer links for an order; it never carries review content.
  const posts = [...apiCode.matchAll(/api<unknown>\(`([^`]*)`,\s*\{\s*method: 'POST'[^}]*\}/g)];
  assert.equal(posts.length, 1);
  assert.equal(posts[0][1], '${BASE}/links');
  // Request bodies: status, reply body, order id, and the version of the
  // row the owner read (never review content).
  const bodies = [...apiCode.matchAll(/JSON\.stringify\((\{[^)]*\})\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(bodies, [
    '{ body, expected_updated_at: seen }',
    '{ order_id: orderId }',
    '{ status, expected_updated_at: seen }',
  ]);
  assert.doesNotMatch(apiCode, /rating|title|display_name/);
  // The reply body is only ever sent to the reply route.
  assert.match(apiCode, /\/reply`, \{\s*method: 'PUT',\s*token,\s*body: JSON\.stringify\(\{ body, expected_updated_at: seen \}\),?\s*\}/);
  // Both decisions carry the version; the manager passes the row it shows.
  const manager = source('../components/reviews/ReviewsManager.tsx');
  assert.match(manager, /setReviewStatus\(token, review\.id, status, review\.updated_at\)/);
  assert.match(manager, /saveReviewReply\(token, review\.id, body, review\.updated_at\)/);
});

test('review text is rendered as plain text: no HTML injection or rich-text path in the review UI', () => {
  for (const file of [
    '../components/reviews/ReviewsManager.tsx',
    '../components/reviews/ReviewDialog.tsx',
    '../components/orders/OrderReviewLinks.tsx',
  ]) {
    assert.doesNotMatch(source(file), /dangerouslySetInnerHTML|RichTextEditor|innerHTML/, file);
  }
});

test('review links stay in memory: the order card never logs, stores or prints them', () => {
  const code = source('../components/orders/OrderReviewLinks.tsx');
  assert.doesNotMatch(code, /console\.|localStorage|sessionStorage|router\./);
  // The link is only ever handed to the clipboard.
  assert.deepEqual([...code.matchAll(/link\.url/g)].length, 1);
  assert.match(code, /navigator\.clipboard\.writeText\(link\.url\)/);
});
