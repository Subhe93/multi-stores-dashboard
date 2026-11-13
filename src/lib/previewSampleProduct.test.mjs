// Builder preview sample product: read with the owner's token so a store that
// is not LIVE still previews its product blocks with data, and posted to the
// preview iframe inside UPDATE_SECTIONS.
// Run: node --experimental-strip-types --test src/lib/previewSampleProduct.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreviewUpdateMessage,
  isPreviewProduct,
  loadPreviewSampleProduct,
  loadPreviewStoreCurrency,
  loadPreviewStoreInfo,
  normalizePreviewCurrency,
} from './previewSampleProduct.ts';

const SAMPLE = { id: 'p1', slug: 'bokstav namn', translations: [{ locale: 'sv', title: 'Bokstav' }] };
const FULL = { id: 'p1', translations: SAMPLE.translations, custom_fields: [{ id: 'f1' }], bundles: [] };

function fetcherFrom(routes) {
  const calls = [];
  const fetcher = async (endpoint) => {
    calls.push(endpoint);
    const hit = routes[endpoint];
    if (hit instanceof Error) throw hit;
    return hit;
  };
  return { fetcher, calls };
}

test('reads the sample, then the full product payload of the same product', async () => {
  const { fetcher, calls } = fetcherFrom({
    '/storefront/layout-pilot/v2/sample-product': SAMPLE,
    '/storefront/layout-pilot/products/bokstav%20namn': FULL,
  });
  const product = await loadPreviewSampleProduct(fetcher, 'layout-pilot');
  assert.deepEqual(calls, [
    '/storefront/layout-pilot/v2/sample-product',
    '/storefront/layout-pilot/products/bokstav%20namn',
  ]);
  assert.equal(product.id, 'p1');
  assert.deepEqual(product.custom_fields, [{ id: 'f1' }]);
  assert.equal(product.slug, 'bokstav namn');
});

test('falls back to the thin sample when the full read fails or is another product', async () => {
  const failing = fetcherFrom({
    '/storefront/s/v2/sample-product': SAMPLE,
    '/storefront/s/products/bokstav%20namn': new Error('404'),
  });
  assert.equal(await loadPreviewSampleProduct(failing.fetcher, 's'), SAMPLE);

  const other = fetcherFrom({
    '/storefront/s/v2/sample-product': SAMPLE,
    '/storefront/s/products/bokstav%20namn': { id: 'other' },
  });
  assert.equal(await loadPreviewSampleProduct(other.fetcher, 's'), SAMPLE);

  const noSlug = fetcherFrom({ '/storefront/s/v2/sample-product': { id: 'p1' } });
  assert.deepEqual(await loadPreviewSampleProduct(noSlug.fetcher, 's'), { id: 'p1' });
  assert.equal(noSlug.calls.length, 1);
});

test('resolves null without a product, on errors and without a store slug', async () => {
  assert.equal(await loadPreviewSampleProduct(fetcherFrom({ '/storefront/s/v2/sample-product': null }).fetcher, 's'), null);
  assert.equal(
    await loadPreviewSampleProduct(fetcherFrom({ '/storefront/s/v2/sample-product': new Error('401') }).fetcher, 's'),
    null,
  );
  const empty = fetcherFrom({});
  assert.equal(await loadPreviewSampleProduct(empty.fetcher, ''), null);
  assert.equal(empty.calls.length, 0);
});

test('isPreviewProduct accepts only objects with a non-empty string id', () => {
  assert.equal(isPreviewProduct({ id: 'x' }), true);
  for (const v of [null, undefined, 'x', [], [{ id: 'x' }], { id: '' }, { id: 1 }, {}]) {
    assert.equal(isPreviewProduct(v), false);
  }
});

test('UPDATE_SECTIONS carries the product only when one was loaded', () => {
  const base = {
    themeKey: 'minimal',
    customizations: { a: 1 },
    sections: [{ id: 's1', parent_id: null }],
    locale: 'sv',
    primaryLocale: 'sv',
    menus: [],
  };
  const without = buildPreviewUpdateMessage({ ...base, product: null });
  assert.deepEqual(without, { type: 'UPDATE_SECTIONS', ...base });
  assert.equal('product' in without, false);
  assert.equal('product' in buildPreviewUpdateMessage({ ...base, product: { id: '' } }), false);

  const withProduct = buildPreviewUpdateMessage({ ...base, product: FULL });
  assert.equal(withProduct.type, 'UPDATE_SECTIONS');
  assert.equal(withProduct.product, FULL);
  assert.deepEqual(withProduct.sections, base.sections);
});

test('normalizePreviewCurrency accepts only three-letter ISO-4217 codes', () => {
  assert.equal(normalizePreviewCurrency('SEK'), 'SEK');
  assert.equal(normalizePreviewCurrency(' sek '), 'SEK');
  for (const v of [null, undefined, '', 'kr', 'SEKK', 'S1K', 752, {}, ['SEK']]) {
    assert.equal(normalizePreviewCurrency(v), null);
  }
});

test('loadPreviewStoreCurrency reads the store with the owner fetcher', async () => {
  const { fetcher, calls } = fetcherFrom({ '/storefront/layout-pilot': { slug: 'layout-pilot', currency: 'SEK' } });
  assert.equal(await loadPreviewStoreCurrency(fetcher, 'layout-pilot'), 'SEK');
  assert.deepEqual(calls, ['/storefront/layout-pilot']);
});

test('loadPreviewStoreCurrency resolves null for the closed shell, errors and no slug', async () => {
  // The anonymous "coming soon" shell of a DRAFT store has no currency.
  const shell = fetcherFrom({ '/storefront/s': { slug: 's', coming_soon: true } });
  assert.equal(await loadPreviewStoreCurrency(shell.fetcher, 's'), null);
  assert.equal(await loadPreviewStoreCurrency(fetcherFrom({ '/storefront/s': new Error('403') }).fetcher, 's'), null);
  assert.equal(await loadPreviewStoreCurrency(fetcherFrom({ '/storefront/s': { currency: 'euro' } }).fetcher, 's'), null);
  assert.equal(await loadPreviewStoreCurrency(fetcherFrom({ '/storefront/s': null }).fetcher, 's'), null);
  const empty = fetcherFrom({});
  assert.equal(await loadPreviewStoreCurrency(empty.fetcher, ''), null);
  assert.equal(empty.calls.length, 0);
});

test('UPDATE_SECTIONS carries the currency only when it is a valid code', () => {
  const base = {
    themeKey: 'minimal',
    customizations: {},
    sections: [],
    locale: 'sv',
    primaryLocale: 'sv',
    menus: [],
  };
  assert.equal('currency' in buildPreviewUpdateMessage(base), false);
  assert.equal('currency' in buildPreviewUpdateMessage({ ...base, currency: null }), false);
  assert.equal('currency' in buildPreviewUpdateMessage({ ...base, currency: 'kr' }), false);
  assert.equal(buildPreviewUpdateMessage({ ...base, currency: 'sek' }).currency, 'SEK');
});

test('loadPreviewStoreInfo returns currency, apps and tax from one owner read', async () => {
  const apps = { personalization: { enabled: true, settings: {} } };
  const tax = { pricing_mode: 'INCLUSIVE', display_prices_incl_tax: true };
  const { fetcher, calls } = fetcherFrom({ '/storefront/layout-pilot': { currency: 'sek', apps, tax } });
  assert.deepEqual(await loadPreviewStoreInfo(fetcher, 'layout-pilot'), { currency: 'SEK', apps, tax });
  assert.deepEqual(calls, ['/storefront/layout-pilot']);
  // Missing blocks: no apps = {}, no tax = null.
  const bare = fetcherFrom({ '/storefront/s': { currency: 'EUR', apps: [], tax: 'x' } });
  assert.deepEqual(await loadPreviewStoreInfo(bare.fetcher, 's'), { currency: 'EUR', apps: {}, tax: null });
  // The closed shell (apps: {}, no currency) is not a store payload.
  const shell = fetcherFrom({ '/storefront/s': { slug: 's', coming_soon: true, apps: {} } });
  assert.equal(await loadPreviewStoreInfo(shell.fetcher, 's'), null);
});

test('UPDATE_SECTIONS carries apps and tax only after the owner read', () => {
  const base = {
    themeKey: 'minimal',
    customizations: {},
    sections: [],
    locale: 'sv',
    primaryLocale: 'sv',
    menus: [],
  };
  const without = buildPreviewUpdateMessage({ ...base, store: null });
  assert.equal('apps' in without, false);
  assert.equal('tax' in without, false);
  const apps = { personalization: { enabled: true } };
  const message = buildPreviewUpdateMessage({ ...base, store: { currency: 'SEK', apps, tax: null } });
  assert.equal(message.currency, 'SEK');
  assert.deepEqual(message.apps, apps);
  assert.equal(message.tax, null);
});
