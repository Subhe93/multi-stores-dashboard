// Motion engine: the one section it adds, the ornament divider (a hand-made
// mirror of multi-stores-web/src/themes/creative/schemas.ts, compared field
// by field by the storefront's creative.contract.test.tsx). Checked here:
// presence, six-locale texts, that it is a divider only, and that the
// compositions and per-section options of the first draft are gone (motion
// is automatic: one store switch, one per-section override). Also the hero
// emblem: four optional fields at the end of hero-split and hero-banner, a
// mirror of the storefront's sections/_shared/emblemFields.ts.
// Run: node --experimental-strip-types --test src/lib/creativeSchemas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const DROPPED = [];
// The scroll sections own their emphasis and colour-scene fields.
const SCROLL_SECTIONS = ['hero-outline', 'hero-sunrise', 'stage-scenes', 'story-pinned', 'sticky-steps', 'motion-path', 'marquee-band'];
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

// ── Hero emblem ─────────────────────────────────────────────────────────

const EMBLEM_KEYS = ['emblem_image', 'emblem_motion', 'emblem_size', 'emblem_position'];
const EMBLEM_SECTIONS = ['hero-split', 'hero-banner'];

/** Key, type, default, option values and visibility rule: what the storefront compares. */
const shape = (f) => ({
  key: f.key,
  type: f.type,
  defaultValue: f.defaultValue,
  options: f.options?.map((o) => o.value),
  showIf: f.showIf,
});

test('hero emblem: the four fields are the last four of hero-split and hero-banner, in order', () => {
  for (const id of EMBLEM_SECTIONS) {
    const keys = findSectionSchema(id).schema.map((f) => f.key);
    assert.deepEqual(keys.slice(-4), EMBLEM_KEYS, id);
    assert.equal(new Set(keys).size, keys.length, `${id}: no duplicate key`);
  }
});

test('hero emblem: types, option values and defaults follow the contract', () => {
  for (const id of EMBLEM_SECTIONS) {
    const fields = findSectionSchema(id).schema.slice(-4);
    assert.deepEqual(fields.map(shape), [
      { key: 'emblem_image', type: 'image', defaultValue: undefined, options: undefined, showIf: undefined },
      { key: 'emblem_motion', type: 'select', defaultValue: 'rise', options: ['none', 'rise', 'turn'], showIf: undefined },
      { key: 'emblem_size', type: 'select', defaultValue: 'md', options: ['sm', 'md'], showIf: undefined },
      { key: 'emblem_position', type: 'select', defaultValue: 'start', options: ['start', 'end'], showIf: undefined },
    ], id);
  }
});

test('hero emblem: optional decor, never a default setting, default content or translatable', () => {
  for (const id of EMBLEM_SECTIONS) {
    const schema = findSectionSchema(id);
    for (const key of EMBLEM_KEYS) {
      assert.equal(key in (schema.defaultSettings || {}), false, `${id} defaultSettings ${key}`);
      assert.equal(key in (schema.defaultContent || {}), false, `${id} defaultContent ${key}`);
      assert.equal(schema.translatable.includes(key), false, `${id} translatable ${key}`);
    }
  }
});

test('hero emblem: no other section carries the fields', () => {
  for (const schema of SECTION_SCHEMAS) {
    if (EMBLEM_SECTIONS.includes(schema.id)) continue;
    for (const [path, f] of walk(schema.schema, schema.id)) assert.ok(!EMBLEM_KEYS.includes(f.key), path);
  }
});

test('hero emblem: every text exists in six locales', () => {
  for (const id of EMBLEM_SECTIONS) {
    for (const f of findSectionSchema(id).schema.slice(-4)) {
      assertSixLocales(`${id}.${f.key} label`, f.label);
      if (f.description) assertSixLocales(`${id}.${f.key} description`, f.description);
      for (const o of f.options || []) assertSixLocales(`${id}.${f.key}.${o.value}`, o.label);
    }
  }
});

test('the reference compositions that were never built are not offered', () => {
  for (const id of DROPPED) assert.equal(findSectionSchema(id), undefined, id);
});

test('no section carries a per-section motion option: motion is automatic', () => {
  for (const schema of SECTION_SCHEMAS) {
    if (SCROLL_SECTIONS.includes(schema.id)) continue;
    const keys = schema.schema.map((f) => f.key);
    for (const key of DROPPED_OPTION_KEYS) assert.ok(!keys.includes(key), `${schema.id}.${key}`);
    for (const key of ['scene', 'scene_bg', 'scene_text', 'scene_accent']) assert.ok(!keys.includes(key), `${schema.id}.${key}`);
  }
});

// Brand sections: one schema file each (lib/creative-sections), wired into
// the palette. The field-by-field mirror is the storefront contract test's job.
const BRAND_SECTIONS = ['cover-hero', 'look-spread', 'object-study', 'script-manifesto', 'impact-arc', 'pattern-band'];

test('the six brand sections exist with every text in six locales', () => {
  for (const id of BRAND_SECTIONS) {
    const schema = findSectionSchema(id);
    assert.ok(schema, id);
    assertSixLocales(`${id}.label`, schema.label);
    if (schema.description) assertSixLocales(`${id}.description`, schema.description);
    for (const [path, f] of walk(schema.schema, id)) {
      assertSixLocales(`${path}.label`, f.label);
      if (f.description) assertSixLocales(`${path}.description`, f.description);
      for (const o of f.options || []) assertSixLocales(`${path}.${o.value}`, o.label);
    }
  }
});
