// Parity test of the M171 reviews strings in all six dashboard locales, and
// of the static keys the review components ask for.
// Run: node --experimental-strip-types --test src/lib/reviewsI18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const cache = new Map();
const messages = (locale) => {
  if (!cache.has(locale)) cache.set(locale, JSON.parse(read(`../i18n/messages/${locale}.json`)));
  return cache.get(locale);
};
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Every leaf path of a message subtree ("tabs.pending", ...). */
function leaves(node, prefix = '') {
  if (typeof node === 'string') return [prefix];
  return Object.entries(node ?? {}).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const NAMESPACES = ['creator.reviews', 'creator.orders.reviewLinks', 'creator.apps.items.reviews'];
const SINGLE_KEYS = [
  'nav.productReviews',
  'errors.REVIEWS_NOT_ENABLED',
  'errors.REVIEW_NOT_FOUND',
  'errors.REVIEW_REPLY_INVALID',
  'errors.REVIEW_ORDER_NOT_ELIGIBLE',
  'errors.REVIEW_CHANGED',
  // Reused by the reviews UI.
  'errors.generic',
  'errors.ORDER_NOT_FOUND',
  'common.actions',
  'common.close',
  'common.retry',
  'common.loading',
];

// Keys the design lists (section 9); extra keys may exist, these must.
const DESIGN_KEYS = {
  'creator.reviews': [
    'title', 'subtitle',
    'tabs.pending', 'tabs.approved', 'tabs.rejected', 'tabs.all',
    'filters.rating', 'filters.product', 'filters.allRatings', 'filters.allProducts',
    'columns.rating', 'columns.product', 'columns.review', 'columns.customer', 'columns.source', 'columns.language', 'columns.date', 'columns.status',
    'source.ACCOUNT', 'source.LINK', 'verified',
    'status.PENDING', 'status.APPROVED', 'status.REJECTED',
    'actions.approve', 'actions.reject', 'actions.delete', 'actions.reply', 'actions.saveReply', 'actions.removeReply', 'actions.view',
    'confirmDelete.title', 'confirmDelete.text', 'confirmDelete.confirm',
    'dialog.title', 'dialog.order', 'dialog.customer', 'dialog.written', 'dialog.published', 'dialog.readOnlyHint',
    'reply.label', 'reply.placeholder', 'reply.counter',
    'settings.title', 'settings.autoPublish', 'settings.autoPublishHint', 'settings.policyNote',
    'empty.pending', 'empty.approved', 'empty.rejected', 'empty.all',
    'toasts.approved', 'toasts.rejected', 'toasts.deleted', 'toasts.replySaved', 'toasts.replyRemoved', 'toasts.settingsSaved',
  ],
  'creator.orders.reviewLinks': ['title', 'description', 'buyerOnlyNote', 'create', 'copy', 'copied', 'validUntil', 'notEligible', 'alreadyReviewed'],
  'creator.apps.items.reviews': ['name', 'description'],
};

const filled = (value) => typeof value === 'string' && value.trim().length > 0;

for (const locale of UI_LOCALES) {
  test(`${locale}: every M171 key exists and is not empty`, () => {
    const m = messages(locale);
    for (const [ns, keys] of Object.entries(DESIGN_KEYS)) {
      for (const key of keys) assert.ok(filled(get(m, `${ns}.${key}`)), `${locale}: ${ns}.${key}`);
    }
    for (const ns of NAMESPACES) {
      for (const key of leaves(get(m, ns))) assert.ok(filled(get(m, `${ns}.${key}`)), `${locale}: ${ns}.${key}`);
    }
    for (const key of SINGLE_KEYS) assert.ok(filled(get(m, key)), `${locale}: ${key}`);
  });
}

test('the key sets are identical across locales', () => {
  const en = messages('en');
  for (const ns of NAMESPACES) {
    const base = leaves(get(en, ns)).sort();
    assert.ok(base.length > 0, ns);
    for (const locale of UI_LOCALES) assert.deepEqual(leaves(get(messages(locale), ns)).sort(), base, `${locale} ${ns}`);
  }
});

test('every locale keeps the same placeholders as English', () => {
  const PLURAL_WORDS = ['zero', 'one', 'two', 'few', 'many', 'other'];
  const vars = (text) => [...new Set([...text.matchAll(/\{(\w+)/g)].map((m) => m[1]))].filter((v) => !PLURAL_WORDS.includes(v)).sort();
  const en = messages('en');
  for (const ns of NAMESPACES) {
    for (const key of leaves(get(en, ns))) {
      const expected = vars(get(en, `${ns}.${key}`));
      for (const locale of UI_LOCALES) assert.deepEqual(vars(get(messages(locale), `${ns}.${key}`)), expected, `${locale}: ${ns}.${key}`);
    }
  }
});

test('the other locales are translated, not copies of the English text', () => {
  const en = messages('en');
  // Words that are legitimately the same in several languages.
  const same = new Set(['reply.counter', 'columns.status', 'columns.source', 'columns.date', 'source.LINK', 'dialog.order']);
  for (const locale of UI_LOCALES.filter((l) => l !== 'en')) {
    const m = messages(locale);
    const identical = leaves(get(en, 'creator.reviews')).filter(
      (key) => !same.has(key) && get(m, `creator.reviews.${key}`) === get(en, `creator.reviews.${key}`),
    );
    assert.deepEqual(identical, [], `${locale}: untranslated creator.reviews keys`);
  }
});

// Static `t('...')` keys of each component must exist under its namespace.
const COMPONENTS = [
  ['../components/reviews/ReviewsManager.tsx', 'creator.reviews'],
  ['../components/reviews/ReviewDialog.tsx', 'creator.reviews'],
  ['../components/reviews/ReviewStars.tsx', 'creator.reviews'],
  ['../app/creator/reviews/page.tsx', 'creator.reviews'],
  ['../components/reviews/ReviewSettingsCard.tsx', 'creator.reviews.settings'],
  ['../components/orders/OrderReviewLinks.tsx', 'creator.orders.reviewLinks'],
];

test('every static key the review components use exists in English', () => {
  const en = messages('en');
  for (const [file, ns] of COMPONENTS) {
    const code = read(file);
    assert.ok(code.includes(`useTranslations('${ns}')`), `${file}: namespace ${ns}`);
    const keys = [...code.matchAll(/[^\w.]t\('([\w.]+)'/g)].map((m) => m[1]);
    assert.ok(keys.length > 0, file);
    for (const key of keys) assert.equal(typeof get(en, `${ns}.${key}`), 'string', `${file}: ${ns}.${key}`);
  }
});

test('the creator nav uses the product-reviews label with the pending badge', () => {
  const layout = read('../app/creator/layout.tsx');
  assert.match(layout, /label: t\('productReviews'\)/);
  assert.match(layout, /href: '\/creator\/reviews'/);
  assert.match(layout, /badge: pendingBadge\(reviewsPending\)/);
});
