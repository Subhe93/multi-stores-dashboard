// Motion engine: the one section it adds, the ornament divider (a hand-made
// mirror of multi-stores-web/src/themes/creative/schemas.ts, compared field
// by field by the storefront's creative.contract.test.tsx). Checked here:
// presence, six-locale texts, that it is a divider only, and that the
// compositions and per-section options of the first draft are gone (motion
// is automatic: one store switch, one per-section override).
// Run: node --experimental-strip-types --test src/lib/creativeSchemas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const DROPPED = ['hero-outline', 'hero-sunrise', 'stage-scenes', 'story-pinned', 'sticky-steps', 'motion-path', 'marquee-band'];
const DROPPED_OPTION_KEYS = ['heading_reveal', 'heading_emphasis', 'heading_emphasis_color', 'image_reveal', 'image_reveal_direction'];

/** Every field under `fields`, repeater sub-fields included, with its path. */
function walk(fields, path, out = []) {
  for (const f of fields) {
    out.push([`${path}.${f.key}`, f]);
    if (f.fields) walk(f.fields, `${path}.${f.key}`, out);
  }
  return out;
}

function assertSixLocales(where, text) {
  assert.ok(text && typeof text === 'object', `${where}: missing`);
  assert.deepEqual(Object.keys(text), LOCALES, `${where}: locales`);
  for (const loc of LOCALES) assert.ok(typeof text[loc] === 'string' && text[loc].trim(), `${where}: no ${loc}`);
}

test('the ornament divider exists, as a divider only', () => {
  const schema = findSectionSchema('ornament-line');
  assert.ok(schema);
  assert.deepEqual(
    schema.schema.map((f) => f.key),
    ['tile_width', 'tile_height', 'paths', 'color_a', 'color_b', 'color_c', 'stroke', 'width', 'draw'],
  );
  assert.deepEqual(schema.translatable, []);
  assert.deepEqual(schema.defaultSettings, {
    tile_width: 120,
    tile_height: 48,
    stroke: 'regular',
    width: 'contained',
    draw: 'once',
  });
  assert.deepEqual(schema.pageTypes, ['HOME', 'STATIC', 'LANDING', 'FOOTER']);
  assert.equal(isAvailableForPageType(schema, 'HOME'), true);
  assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE'), false);
});

test('every text of the ornament divider exists in six locales', () => {
  const schema = findSectionSchema('ornament-line');
  assertSixLocales('label', schema.label);
  assertSixLocales('description', schema.description);
  for (const [path, f] of walk(schema.schema, 'ornament-line')) {
    assertSixLocales(`${path} label`, f.label);
    if (f.description) assertSixLocales(`${path} description`, f.description);
    for (const o of f.options || []) assertSixLocales(`${path}.${o.value}`, o.label);
  }
});

test('the compositions of the first draft are not offered', () => {
  for (const id of DROPPED) assert.equal(findSectionSchema(id), undefined, id);
});

test('no section carries a per-section motion option: motion is automatic', () => {
  for (const schema of SECTION_SCHEMAS) {
    const keys = schema.schema.map((f) => f.key);
    for (const key of DROPPED_OPTION_KEYS) assert.ok(!keys.includes(key), `${schema.id}.${key}`);
    for (const key of ['scene', 'scene_bg', 'scene_text', 'scene_accent']) assert.ok(!keys.includes(key), `${schema.id}.${key}`);
  }
});
