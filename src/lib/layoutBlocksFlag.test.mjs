// Gating of the layout containers + product blocks by the store's
// `product_layout` app (beta flag, default off).
// Run: node --experimental-strip-types --test src/lib/layoutBlocksFlag.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutBlocksEnabled } from './layoutBlocksFlag.ts';
import { SECTION_SCHEMAS } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';
import { buildListRows, isDropAllowed, resolveDropTarget } from './sectionListRows.ts';
import { flattenTree } from './sectionTree.ts';
import { STORE_APPS, STORE_APP_HREFS, STORE_APP_KEYS } from './storeApps.registry.ts';

// Same list as the API (pages-v2 section-tree.ts): containers + new blocks.
const GATED_KEYS = [
  'layout-row',
  'layout-column',
  'layout-grid',
  'product-breadcrumb',
  'product-title',
  'product-price',
  'product-short-description',
  'product-promotions',
  'product-bundles',
  'product-variants',
  'product-personalization',
  'product-buy',
  'product-trust',
  'product-shipping',
  'product-description',
  'product-specifications',
  'product-faq',
  'product-shipping-returns',
];

const s = (id, section_key, sort_order, parent_id = null) => ({ id, section_key, sort_order, parent_id });
const projection = (parentId, index, allowed = true) => ({ depth: parentId ? 2 : 1, maxDepth: 3, minDepth: 1, parentId, index, allowed });

test('product_layout is a registered store app without a settings page', () => {
  assert.ok(STORE_APP_KEYS.includes('product_layout'));
  assert.equal(STORE_APPS.product_layout.requiresIndependent, false);
  assert.deepEqual(STORE_APPS.product_layout.dependsOn, []);
  assert.equal(STORE_APP_HREFS.product_layout, null);
});

test('flag is on only for the product template with the app enabled', () => {
  assert.equal(layoutBlocksEnabled('PRODUCT_TEMPLATE', true), true);
  assert.equal(layoutBlocksEnabled('PRODUCT_TEMPLATE', false), false);
  for (const type of ['HOME', 'STATIC', 'LANDING', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'HEADER', 'FOOTER', null, undefined]) {
    assert.equal(layoutBlocksEnabled(type, true), false, String(type));
  }
});

test('app off: the product template palette is exactly the pre-container one', () => {
  const off = layoutBlocksEnabled('PRODUCT_TEMPLATE', false);
  const offered = SECTION_SCHEMAS.filter((sc) => isAvailableForPageType(sc, 'PRODUCT_TEMPLATE', { layoutContainers: off })).map(
    (sc) => sc.id,
  );
  for (const key of GATED_KEYS) assert.ok(!offered.includes(key), key);
  // The monolith and the older split sections stay available.
  for (const key of ['product-page', 'product-gallery', 'product-details', 'add-to-cart', 'product-tabs']) {
    assert.ok(offered.includes(key), key);
  }
});

test('app on: every container and new product block is offered', () => {
  const on = layoutBlocksEnabled('PRODUCT_TEMPLATE', true);
  for (const key of GATED_KEYS) {
    const schema = SECTION_SCHEMAS.find((sc) => sc.id === key);
    assert.ok(schema, key);
    assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE', { layoutContainers: on }), true, key);
  }
});

test('every gated key carries the layout-containers gate (hidden while off)', () => {
  const gated = SECTION_SCHEMAS.filter((sc) => sc.gate === 'layout-containers').map((sc) => sc.id);
  assert.deepEqual([...gated].sort(), [...GATED_KEYS].sort());
});

const tree = [
  s('row', 'layout-row', 0),
  s('col', 'layout-column', 0, 'row'),
  s('gallery', 'product-gallery', 0, 'col'),
  s('tabs', 'product-tabs', 1),
];

test('app off: saved containers still list but get no "+ add here" slot', () => {
  const items = flattenTree(tree);
  const off = buildListRows(items, { addSlots: false });
  assert.deepEqual(
    off.map((r) => r.kind === 'section' && r.item.id),
    ['row', 'col', 'gallery', 'tabs'],
  );
  const on = buildListRows(items);
  assert.ok(on.some((r) => r.kind === 'add'));
});

test('app off: drags keep the saved parent or go to the root, never into a container', () => {
  const items = flattenTree(tree);
  const tabs = items.find((i) => i.id === 'tabs');
  const gallery = items.find((i) => i.id === 'gallery');
  const off = { allowNewParent: false };
  // Into a container: refused.
  assert.equal(isDropAllowed(tabs, projection('col', 1), off), false);
  assert.equal(resolveDropTarget(tabs, projection('col', 1), off), null);
  // Reorder at the root and moving a nested section out: allowed.
  assert.deepEqual(resolveDropTarget(tabs, projection(null, 0), off), { parentId: null, index: 0 });
  assert.deepEqual(resolveDropTarget(gallery, projection(null, 2), off), { parentId: null, index: 2 });
  // Staying in the saved container: allowed (index change only).
  assert.equal(isDropAllowed(gallery, projection('col', 0), off), true);
  // Re-parenting between saved containers is a new parent: refused.
  assert.equal(isDropAllowed(gallery, projection('row', 1), off), false);
  // App on: the same drop into a container works.
  assert.deepEqual(resolveDropTarget(tabs, projection('col', 1)), { parentId: 'col', index: 1 });
  // A projection the tree rules refuse stays refused either way.
  assert.equal(isDropAllowed(tabs, projection(null, 0, false)), false);
});
