// Section inspector field visibility (dynamic sources on the product
// template) and the dashboard/web schema parity of the source fields.
// Run: node --experimental-strip-types --test src/lib/inspectorFields.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CONTENT_SOURCE_FIELDS,
  IMAGE_SOURCE_FIELDS,
  SECTION_SCHEMAS,
  findSectionSchema,
} from './section-schemas.ts';
import { activeDynamicSource, isFieldVisible, visibleInspectorFields } from './inspectorFields.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

const keys = (fields) => fields.map((f) => f.key);
const OTHER_PAGES = ['HOME', 'STATIC', 'LANDING', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'HEADER', 'FOOTER'];

test('rich-text: source fields only on the product template; html stays for static', () => {
  const schema = findSectionSchema('rich-text');
  for (const page of OTHER_PAGES) {
    const { settingsFields, contentFields } = visibleInspectorFields(schema, {}, page);
    assert.ok(!keys(settingsFields).includes('content_source'), page);
    assert.ok(!keys(settingsFields).includes('attribute_key'), page);
    assert.ok(keys(contentFields).includes('html'), page);
  }
  const product = visibleInspectorFields(schema, {}, 'PRODUCT_TEMPLATE');
  assert.ok(keys(product.settingsFields).includes('content_source'));
  assert.ok(!keys(product.settingsFields).includes('attribute_key'));
  assert.ok(keys(product.contentFields).includes('html'));
  // Without a page type (older callers) the product-only fields stay hidden.
  assert.ok(!keys(visibleInspectorFields(schema, {}, undefined).settingsFields).includes('content_source'));
});

test('rich-text: a dynamic source hides html and shows attribute_key only for product_attribute', () => {
  const schema = findSectionSchema('rich-text');
  const desc = visibleInspectorFields(schema, { content_source: 'product_description' }, 'PRODUCT_TEMPLATE');
  assert.ok(!keys(desc.contentFields).includes('html'));
  assert.deepEqual(keys(desc.contentFields), ['eyebrow', 'heading']);
  assert.ok(!keys(desc.settingsFields).includes('attribute_key'));
  const attr = visibleInspectorFields(schema, { content_source: 'product_attribute' }, 'PRODUCT_TEMPLATE');
  assert.ok(keys(attr.settingsFields).includes('attribute_key'));
  const stat = visibleInspectorFields(schema, { content_source: 'static' }, 'PRODUCT_TEMPLATE');
  assert.ok(keys(stat.contentFields).includes('html'));
});

test('image sections: upload hidden for a product source; image_index only for product_image_n', () => {
  for (const id of ['image-with-text', 'single-image']) {
    const schema = findSectionSchema(id);
    const all = (s, page = 'PRODUCT_TEMPLATE') => {
      const v = visibleInspectorFields(schema, s, page);
      return [...keys(v.settingsFields), ...keys(v.contentFields)];
    };
    assert.ok(all({}).includes('image'), id);
    assert.ok(all({}).includes('image_source'), id);
    assert.ok(!all({}).includes('image_index'), id);
    assert.ok(!all({}, 'HOME').includes('image_source'), id);
    assert.ok(all({}, 'HOME').includes('image'), id);
    assert.ok(!all({ image_source: 'variant_image' }).includes('image'), id);
    assert.ok(all({ image_source: 'product_image_n' }).includes('image_index'), id);
  }
});

test('a section carrying a dynamic source onto another page still shows the source field', () => {
  const schema = findSectionSchema('rich-text');
  const v = visibleInspectorFields(schema, { content_source: 'product_description' }, 'HOME');
  assert.ok(keys(v.settingsFields).includes('content_source'));
});

test('fields without pageTypes / showIf are unaffected on every page', () => {
  for (const schema of SECTION_SCHEMAS) {
    for (const f of schema.schema) {
      if (f.pageTypes || f.showIf) continue;
      for (const page of ['PRODUCT_TEMPLATE', ...OTHER_PAGES]) {
        assert.equal(isFieldVisible(f, {}, page), true, `${schema.id}.${f.key} on ${page}`);
      }
    }
  }
});

test('only the dynamic source fields are page-type limited', () => {
  const limited = [];
  for (const schema of SECTION_SCHEMAS) {
    for (const f of schema.schema) if (f.pageTypes) limited.push(`${schema.id}.${f.key}`);
  }
  assert.deepEqual(limited.sort(), [
    'image-with-text.image_index',
    'image-with-text.image_source',
    'rich-text.attribute_key',
    'rich-text.content_source',
    'single-image.image_index',
    'single-image.image_source',
  ]);
});

test('activeDynamicSource drives the Content tab note', () => {
  const rt = findSectionSchema('rich-text');
  assert.equal(activeDynamicSource(rt, {}, 'PRODUCT_TEMPLATE'), null);
  assert.equal(activeDynamicSource(rt, { content_source: 'static' }, 'PRODUCT_TEMPLATE'), null);
  assert.equal(activeDynamicSource(rt, { content_source: 'bogus' }, 'PRODUCT_TEMPLATE'), null);
  assert.deepEqual(activeDynamicSource(rt, { content_source: 'product_title' }, 'PRODUCT_TEMPLATE'), {
    key: 'content_source',
    value: 'product_title',
  });
  const iwt = findSectionSchema('image-with-text');
  assert.deepEqual(activeDynamicSource(iwt, { image_source: 'variant_image' }, 'PRODUCT_TEMPLATE'), {
    key: 'image_source',
    value: 'variant_image',
  });
});

test('source fields are settings, never translatable', () => {
  for (const id of ['rich-text', 'image-with-text', 'single-image']) {
    const schema = findSectionSchema(id);
    for (const k of ['content_source', 'attribute_key', 'image_source', 'image_index']) {
      assert.ok(!schema.translatable.includes(k), `${id}.${k}`);
    }
  }
  assert.ok(!('content_source' in (findSectionSchema('rich-text').defaultSettings || {})));
  assert.ok(!('image_source' in (findSectionSchema('image-with-text').defaultSettings || {})));
});

test('single-image is a content section available on every page except chrome', () => {
  const schema = findSectionSchema('single-image');
  assert.equal(schema.category, 'content');
  assert.equal(schema.pageTypes, undefined);
  for (const page of ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE']) {
    assert.equal(isAvailableForPageType(schema, page), true, page);
  }
  assert.equal(isAvailableForPageType(schema, 'HEADER'), false);
});

test('source field labels cover every dashboard locale', () => {
  for (const f of [...CONTENT_SOURCE_FIELDS, ...IMAGE_SOURCE_FIELDS]) {
    for (const loc of ['en', 'ar', 'tr', 'de', 'fr', 'sv']) {
      assert.ok(f.label[loc], `${f.key} label ${loc}`);
      for (const o of f.options || []) assert.ok(o.label[loc], `${f.key}.${o.value} ${loc}`);
    }
  }
});

// Parity with the web copy (the storefront renders these keys). Skipped when
// the web repo is not checked out next to the dashboard.
const WEB_FIELDS = fileURLToPath(
  new URL('../../../multi-stores-web/src/themes/minimal/sections/_shared/dynamicSourceFields.ts', import.meta.url),
);

const shape = (fields) =>
  fields.map((f) => ({
    key: f.key,
    type: f.type,
    defaultValue: f.defaultValue,
    min: f.min,
    max: f.max,
    pageTypes: f.pageTypes,
    showIf: f.showIf,
    options: (f.options || []).map((o) => o.value),
  }));

test('dashboard and web dynamic source fields match', { skip: !existsSync(WEB_FIELDS) && 'web repo not found' }, async () => {
  const web = await import(pathToFileURL(WEB_FIELDS).href);
  assert.deepEqual(shape(CONTENT_SOURCE_FIELDS), shape(web.CONTENT_SOURCE_FIELDS));
  assert.deepEqual(shape(IMAGE_SOURCE_FIELDS), shape(web.IMAGE_SOURCE_FIELDS));
  const dash = await import('./section-schemas.ts');
  assert.deepEqual(dash.STATIC_CONTENT_SHOW_IF, web.STATIC_CONTENT_SHOW_IF);
  assert.deepEqual(dash.STATIC_IMAGE_SHOW_IF, web.STATIC_IMAGE_SHOW_IF);
});

// The renderer's own source lists (what the storefront actually resolves):
// every non-static option the inspector offers must render, and vice versa.
const WEB_KEYS = fileURLToPath(
  new URL('../../../multi-stores-web/src/themes/minimal/sections/_shared/dynamicSourceKeys.ts', import.meta.url),
);

test('inspector source options equal the web renderer source lists', { skip: !existsSync(WEB_KEYS) && 'web repo not found' }, async () => {
  const web = await import(pathToFileURL(WEB_KEYS).href);
  const offered = (fields, key) =>
    fields.find((f) => f.key === key).options.map((o) => o.value).filter((v) => v !== 'static');
  assert.deepEqual(offered(CONTENT_SOURCE_FIELDS, 'content_source'), [...web.CONTENT_SOURCES]);
  assert.deepEqual(offered(IMAGE_SOURCE_FIELDS, 'image_source'), [...web.IMAGE_SOURCES]);
});
