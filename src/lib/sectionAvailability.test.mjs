// Unit test of the "Add section" palette rule (which sections a page type offers).
// Run: node --experimental-strip-types --test src/lib/sectionAvailability.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAvailableForPageType } from './sectionAvailability.ts';
import { SECTION_SCHEMAS } from './section-schemas.ts';

const CONTENT_PAGES = ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE'];
const CHROME_PAGES = ['HEADER', 'FOOTER'];

test('a section without pageTypes shows on content pages only', () => {
  for (const type of CONTENT_PAGES) assert.equal(isAvailableForPageType({}, type), true, type);
  for (const type of CHROME_PAGES) assert.equal(isAvailableForPageType({}, type), false, type);
  // An empty list behaves like an omitted one.
  assert.equal(isAvailableForPageType({ pageTypes: [] }, 'HOME'), true);
  assert.equal(isAvailableForPageType({ pageTypes: [] }, 'HEADER'), false);
});

test('pageTypes is a whitelist', () => {
  const headerOnly = { pageTypes: ['HEADER'] };
  assert.equal(isAvailableForPageType(headerOnly, 'HEADER'), true);
  assert.equal(isAvailableForPageType(headerOnly, 'FOOTER'), false);
  assert.equal(isAvailableForPageType(headerOnly, 'HOME'), false);
});

test('chrome: true adds HEADER and FOOTER to the default', () => {
  for (const type of [...CONTENT_PAGES, ...CHROME_PAGES]) {
    assert.equal(isAvailableForPageType({ chrome: true }, type), true, type);
  }
});

test('chrome: true adds HEADER and FOOTER to a whitelist without widening it', () => {
  const schema = { pageTypes: ['HOME'], chrome: true };
  assert.equal(isAvailableForPageType(schema, 'HOME'), true);
  assert.equal(isAvailableForPageType(schema, 'HEADER'), true);
  assert.equal(isAvailableForPageType(schema, 'FOOTER'), true);
  assert.equal(isAvailableForPageType(schema, 'LANDING'), false);
});

test('chrome: false changes nothing', () => {
  assert.equal(isAvailableForPageType({ chrome: false }, 'HEADER'), false);
  assert.equal(isAvailableForPageType({ chrome: false }, 'HOME'), true);
});

test('embed-code is offered on every page type, header and footer included', () => {
  const embed = SECTION_SCHEMAS.find((s) => s.id === 'embed-code');
  assert.ok(embed, 'embed-code schema exists');
  assert.equal(embed.chrome, true);
  for (const type of [...CONTENT_PAGES, ...CHROME_PAGES]) {
    assert.equal(isAvailableForPageType(embed, type), true, type);
  }
});

test('the other sections keep their previous availability', () => {
  // Reference rule as it was before the `chrome` flag existed.
  const before = (schema, type) =>
    schema.pageTypes && schema.pageTypes.length > 0
      ? schema.pageTypes.includes(type)
      : type !== 'HEADER' && type !== 'FOOTER';
  for (const schema of SECTION_SCHEMAS) {
    if (schema.id === 'embed-code') continue;
    // Gated sections (layout containers) are new; covered in sectionTree.test.mjs.
    if (schema.gate) continue;
    assert.notEqual(schema.chrome, true, `${schema.id} is not chrome-flagged`);
    for (const type of [...CONTENT_PAGES, ...CHROME_PAGES]) {
      assert.equal(isAvailableForPageType(schema, type), before(schema, type), `${schema.id} on ${type}`);
    }
  }
});
