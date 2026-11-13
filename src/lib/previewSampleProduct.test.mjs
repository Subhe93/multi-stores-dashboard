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
