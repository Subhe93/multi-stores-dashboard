// Every product block the storefront registers (web registryB1.ts +
// registryB2.ts) must have a dashboard schema, or the builder cannot add or
// edit it. The list is hard-coded on purpose: adding a web block means
// adding it here and in section-schemas.ts.
// Run: node --experimental-strip-types --test src/lib/productBlockSchemas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

// New blocks (product layout wave 2), gated with the layout containers.
const NEW_BLOCK_KEYS = [
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
// Older split sections rebuilt on the shared state; they keep their keys and
// setting names and stay ungated so existing templates keep their palette.
const REBUILT_KEYS = ['product-gallery', 'product-details', 'add-to-cart', 'product-tabs'];
const WEB_BLOCK_KEYS = [...NEW_BLOCK_KEYS, ...REBUILT_KEYS];

const OTHER_PAGES = ['HOME', 'STATIC', 'LANDING', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'HEADER', 'FOOTER'];

test('every web product block key has exactly one dashboard schema', () => {
  for (const key of WEB_BLOCK_KEYS) {
    const matches = SECTION_SCHEMAS.filter((s) => s.id === key);
    assert.equal(matches.length, 1, key);
  }
});

test('product blocks are category product and PRODUCT_TEMPLATE only', () => {
  for (const key of WEB_BLOCK_KEYS) {
    const schema = findSectionSchema(key);
    assert.equal(schema.category, 'product', key);
    assert.deepEqual(schema.pageTypes, ['PRODUCT_TEMPLATE'], key);
    assert.ok(schema.label.en && schema.label.ar, `${key} EN+AR label`);
  }
});

test('the add palette offers product blocks on the product template only', () => {
  for (const key of WEB_BLOCK_KEYS) {
    const schema = findSectionSchema(key);
    assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE', { layoutContainers: true }), true, key);
    for (const page of OTHER_PAGES) {
      assert.equal(isAvailableForPageType(schema, page, { layoutContainers: true }), false, `${key} on ${page}`);
    }
  }
});

test('new blocks follow the layout-containers flag; rebuilt sections do not', () => {
  for (const key of NEW_BLOCK_KEYS) {
    const schema = findSectionSchema(key);
    assert.equal(schema.gate, 'layout-containers', key);
    assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE', { layoutContainers: false }), false, key);
  }
  for (const key of REBUILT_KEYS) {
    const schema = findSectionSchema(key);
    assert.equal(schema.gate, undefined, key);
    assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE'), true, key);
  }
});

test('rebuilt sections keep their old setting names', () => {
  const keysOf = (id) => findSectionSchema(id).schema.map((f) => f.key);
  const expectIncludes = (id, keys) => {
    const have = keysOf(id);
    for (const k of keys) assert.ok(have.includes(k), `${id}.${k}`);
  };
  expectIncludes('product-gallery', ['layout', 'aspect', 'enable_zoom']);
  expectIncludes('product-details', ['show_sale_badge', 'show_price', 'show_compare_at', 'show_description', 'show_share']);
  expectIncludes('add-to-cart', ['button_style', 'full_width', 'show_quantity', 'show_stock', 'sticky_on_mobile', 'button_label']);
  expectIncludes('product-tabs', [
    'show_description', 'show_faqs', 'show_shipping', 'show_returns',
    'tab_description_label', 'tab_faqs_label', 'tab_shipping_label', 'tab_returns_label',
    'shipping_html', 'returns_html', 'show_specifications', 'tab_specifications_label',
  ]);
  // The fake rating row is gone from the form.
  assert.equal(keysOf('product-details').includes('show_rating'), false);
  // The classic gallery layout (the monolith gallery) is offered.
  const layout = findSectionSchema('product-gallery').schema.find((f) => f.key === 'layout');
  assert.ok(layout.options.some((o) => o.value === 'classic'));
});

// Standalone pieces of product-tabs: field keys, translatable keys and
// defaults must equal the web definitions (web registryB3.ts); the builder
// adds the heading tag select (heading_level) on top.
const B3_PARITY = {
  'product-description': {
    fields: ['show_heading', 'heading'],
    translatable: ['heading'],
    defaults: { show_heading: true },
  },
  'product-specifications': {
    fields: ['show_heading', 'heading', 'style'],
    translatable: ['heading'],
    defaults: { show_heading: true, style: 'striped' },
  },
  'product-faq': {
    fields: ['show_heading', 'heading', 'open_first', 'allow_multiple'],
    translatable: ['heading'],
    defaults: { show_heading: true, open_first: false, allow_multiple: true },
  },
  'product-shipping-returns': {
    fields: ['show_shipping', 'show_returns', 'show_heading', 'shipping_heading', 'shipping_html', 'returns_heading', 'returns_html'],
    translatable: ['shipping_heading', 'returns_heading', 'shipping_html', 'returns_html'],
    defaults: { show_shipping: true, show_returns: true, show_heading: true },
  },
};

test('standalone product-tabs pieces match the web block definitions', () => {
  for (const [key, want] of Object.entries(B3_PARITY)) {
    const schema = findSectionSchema(key);
    const keys = schema.schema.map((f) => f.key);
    assert.deepEqual(keys.filter((k) => k !== 'heading_level'), want.fields, key);
    assert.ok(keys.includes('heading_level'), `${key} heading tag select`);
    assert.equal(keys.includes('subheading_tag'), false, `${key} has no subheading`);
    assert.deepEqual(schema.translatable, want.translatable, key);
    assert.deepEqual(schema.defaultSettings, want.defaults, key);
    assert.equal(schema.gate, 'layout-containers', key);
  }
  // The heading tag select sits right after the heading text, or after
  // show_heading for shipping & returns (no single heading field).
  for (const [key, anchor] of [
    ['product-description', 'heading'],
    ['product-faq', 'heading'],
    ['product-shipping-returns', 'show_heading'],
  ]) {
    const keys = findSectionSchema(key).schema.map((f) => f.key);
    assert.equal(keys[keys.indexOf(anchor) + 1], 'heading_level', `${key} heading_level position`);
  }
  const faq = findSectionSchema('product-faq').schema;
  assert.equal(faq.find((f) => f.key === 'open_first').defaultValue, false);
  assert.equal(faq.find((f) => f.key === 'allow_multiple').defaultValue, true);
  const style = findSectionSchema('product-specifications').schema.find((f) => f.key === 'style');
  assert.deepEqual(style.options.map((o) => o.value), ['striped', 'table', 'list']);
});

test('product-tabs is unchanged and still offered next to its pieces', () => {
  const tabs = findSectionSchema('product-tabs');
  assert.equal(tabs.gate, undefined);
  assert.deepEqual(tabs.defaultSettings, {
    show_description: true, show_specifications: true, show_faqs: true, show_shipping: false, show_returns: false,
  });
});
