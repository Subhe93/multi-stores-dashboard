// Creative engine: the eight creative section schemas (a hand-made mirror of
// multi-stores-web/src/themes/creative/schemas.ts, compared field by field
// by the storefront's creative.contract.test.tsx) and the creative options
// injected into existing sections. Checked here: presence, six-locale texts,
// the owner's "no giant words" rule (sizes are Small / Medium only) and that
// the injected options are never defaults.
// Run: node --experimental-strip-types --test src/lib/creativeSchemas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const CREATIVE = [
  'hero-outline', 'hero-sunrise', 'stage-scenes', 'story-pinned',
  'sticky-steps', 'motion-path', 'marquee-band', 'ornament-line',
];
const HEADING_OPTION_SECTIONS = ['hero-banner', 'hero-split', 'parallax-banner', 'image-with-text', 'brand-band'];
const IMAGE_REVEAL_SECTIONS = ['hero-split', 'image-with-text', 'single-image'];
const HEADING_OPTION_KEYS = ['heading_reveal', 'heading_emphasis', 'heading_emphasis_color'];
const IMAGE_OPTION_KEYS = ['image_reveal', 'image_reveal_direction'];

const keys = (schema) => schema.schema.map((f) => f.key);
const field = (schema, key) => schema.schema.find((f) => f.key === key);
const optionValues = (f) => (f.options || []).map((o) => o.value);

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

function assertFieldTexts(where, f) {
  assertSixLocales(`${where} label`, f.label);
  if (f.description) assertSixLocales(`${where} description`, f.description);
  for (const o of f.options || []) assertSixLocales(`${where} option ${o.value}`, o.label);
}

// ── The eight sections ──────────────────────────────────────────────────

test('the eight creative schemas exist once, with unique field keys', () => {
  for (const id of CREATIVE) {
    assert.equal(SECTION_SCHEMAS.filter((s) => s.id === id).length, 1, id);
    const schema = findSectionSchema(id);
    for (const [where, f] of walk(schema.schema, id)) {
      if (!f.fields) continue;
      const sub = f.fields.map((x) => x.key);
      assert.equal(new Set(sub).size, sub.length, `${where}: duplicate keys`);
    }
    const k = keys(schema);
    assert.equal(new Set(k).size, k.length, `${id}: duplicate keys`);
  }
});

test('categories and page types', () => {
  const category = Object.fromEntries(CREATIVE.map((id) => [id, findSectionSchema(id).category]));
  assert.deepEqual(category, {
    'hero-outline': 'showcase',
    'hero-sunrise': 'showcase',
    'stage-scenes': 'showcase',
    'story-pinned': 'content',
    'sticky-steps': 'content',
    'motion-path': 'content',
    'marquee-band': 'showcase',
    'ornament-line': 'content',
  });
  for (const id of CREATIVE) {
    const schema = findSectionSchema(id);
    const footer = id === 'marquee-band' || id === 'ornament-line';
    assert.deepEqual(schema.pageTypes, footer ? ['HOME', 'STATIC', 'LANDING', 'FOOTER'] : ['HOME', 'STATIC', 'LANDING'], id);
    assert.equal(schema.chrome, undefined, id);
    assert.equal(schema.gate, undefined, id);
    for (const pageType of ['HOME', 'STATIC', 'LANDING']) assert.equal(isAvailableForPageType(schema, pageType), true, `${id} ${pageType}`);
    assert.equal(isAvailableForPageType(schema, 'FOOTER'), footer, `${id} FOOTER`);
    // Commerce pages stay fast: never on the product or listing templates.
    for (const pageType of ['HEADER', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE']) {
      assert.equal(isAvailableForPageType(schema, pageType), false, `${id} ${pageType}`);
    }
  }
});

test('every label, description and option label is in six locales', () => {
  for (const id of CREATIVE) {
    const schema = findSectionSchema(id);
    assertSixLocales(`${id} label`, schema.label);
    assertSixLocales(`${id} description`, schema.description);
    for (const [where, f] of walk(schema.schema, id)) assertFieldTexts(where, f);
  }
});

test('no giant words: every size field offers Small / Medium only, Medium by default', () => {
  const seen = [];
  for (const id of CREATIVE) {
    const schema = findSectionSchema(id);
    for (const [where, f] of walk(schema.schema, id)) {
      if (f.key !== 'size' && !f.key.endsWith('_size')) continue;
      seen.push(where);
      assert.equal(f.type, 'select', where);
      assert.deepEqual(optionValues(f), ['sm', 'md'], where);
      assert.equal(f.defaultValue, 'md', where);
      if (f.key in (schema.defaultSettings || {})) assert.equal(schema.defaultSettings[f.key], 'md', where);
    }
  }
  assert.deepEqual(seen, [
    'hero-outline.accent_size',
    'hero-sunrise.sun_size',
    'stage-scenes.artwork_size',
    'sticky-steps.numeral_size',
    'motion-path.artwork_size',
    'marquee-band.size',
  ]);
  // The other decorative scales follow the same rule.
  for (const [id, path] of [['hero-sunrise', ['foreground_height']], ['stage-scenes', ['scenes', 'scale']]]) {
    let f = { fields: findSectionSchema(id).schema };
    for (const key of path) f = f.fields.find((x) => x.key === key);
    assert.deepEqual(optionValues(f), ['sm', 'md'], `${id}.${path.join('.')}`);
    assert.equal(f.defaultValue, 'md', `${id}.${path.join('.')}`);
  }
  // No option anywhere in the creative schemas is named xl / giant / huge.
  for (const id of CREATIVE) {
    for (const [where, f] of walk(findSectionSchema(id).schema, id)) {
      for (const value of optionValues(f)) assert.ok(!['xl', '2xl', 'giant', 'huge'].includes(value), `${where}: ${value}`);
    }
  }
});

test('defaults: every select default is one of its options, every boolean default is a default setting', () => {
  for (const id of CREATIVE) {
    const schema = findSectionSchema(id);
    for (const [where, f] of walk(schema.schema, id)) {
      if (f.type === 'select') assert.ok(optionValues(f).includes(f.defaultValue), `${where}: default ${f.defaultValue}`);
    }
    for (const f of schema.schema) {
      if (f.type === 'boolean') assert.equal(schema.defaultSettings[f.key], f.defaultValue, `${id}.${f.key}`);
    }
    // Default settings are settings; default content is translatable content.
    for (const key of Object.keys(schema.defaultSettings || {})) {
      assert.ok(keys(schema).includes(key), `${id}: defaultSettings.${key} is a field`);
      assert.equal(schema.translatable.includes(key), false, `${id}: ${key} is not content`);
    }
    for (const key of Object.keys(schema.defaultContent || {})) {
      assert.ok(schema.translatable.includes(key), `${id}: defaultContent.${key} is content`);
    }
    for (const key of schema.translatable) assert.ok(keys(schema).includes(key), `${id}: translatable ${key} is a field`);
  }
});

test('repeaters are bounded', () => {
  const limits = {};
  for (const id of CREATIVE) {
    for (const f of findSectionSchema(id).schema) if (f.type === 'repeater') limits[`${id}.${f.key}`] = f.maxItems;
  }
  assert.deepEqual(limits, {
    'hero-outline.stats': 3,
    'stage-scenes.scenes': 5,
    'story-pinned.items': 8,
    'sticky-steps.items': 8,
    'motion-path.stops': 7,
    'marquee-band.items': 16,
    'ornament-line.paths': 12,
    'ornament-line.corner_paths': 4,
  });
});

test('heading tag: h1 for the two heroes, h2 for the rest, none on the marquee band', () => {
  const level = (id) => field(findSectionSchema(id), 'heading_level');
  assert.equal(level('hero-outline').defaultValue, 'h1');
  assert.equal(level('hero-sunrise').defaultValue, 'h1');
  for (const id of ['stage-scenes', 'story-pinned', 'sticky-steps', 'motion-path', 'ornament-line']) {
    assert.equal(level(id).defaultValue, 'h2', id);
  }
  assert.equal(level('marquee-band'), undefined);
  // The select follows the heading; stage-scenes has no top-level heading, so
  // it sits before the scenes repeater.
  for (const id of ['hero-outline', 'hero-sunrise', 'story-pinned', 'sticky-steps', 'motion-path', 'ornament-line']) {
    const k = keys(findSectionSchema(id));
    assert.equal(k[k.indexOf('heading') + 1], 'heading_level', id);
  }
  const stage = keys(findSectionSchema('stage-scenes'));
  assert.equal(stage[stage.indexOf('marker_image') + 1], 'heading_level');
  assert.equal(stage[stage.length - 1], 'scenes');
  // Only the heading tag is read by the storefront for these sections.
  for (const id of CREATIVE) {
    const k = keys(findSectionSchema(id));
    assert.equal(k.includes('subheading_tag'), false, id);
    assert.equal(k.includes('eyebrow_tag'), false, id);
    assert.equal(k.includes('heading_accent'), false, id);
  }
});

test('accent phrase: italic by default in the new sections, markers explained in six locales', () => {
  for (const id of CREATIVE.filter((x) => x !== 'marquee-band' && x !== 'ornament-line')) {
    const schema = findSectionSchema(id);
    const emphasis = field(schema, 'heading_emphasis');
    assert.deepEqual(optionValues(emphasis), ['none', 'color', 'italic'], id);
    assert.equal(emphasis.defaultValue, 'italic', id);
    assert.equal(schema.defaultSettings.heading_emphasis, 'italic', id);
    for (const loc of LOCALES) {
      assert.match(emphasis.description[loc], /\*[^*]+\*/, `${id} ${loc}: shows the *marker* syntax`);
    }
    assert.deepEqual(field(schema, 'heading_emphasis_color').showIf, { key: 'heading_emphasis', in: ['color', 'italic'] }, id);
  }
});

test('scene group: none / dark / light / accent with three colour overrides', () => {
  const defaults = {
    'hero-outline': 'none', 'hero-sunrise': 'light', 'story-pinned': 'none',
    'sticky-steps': 'none', 'motion-path': 'none', 'marquee-band': 'none', 'ornament-line': 'none',
  };
  for (const [id, fallback] of Object.entries(defaults)) {
    const schema = findSectionSchema(id);
    const scene = field(schema, 'scene');
    assert.deepEqual(optionValues(scene), ['none', 'dark', 'light', 'accent'], id);
    assert.equal(scene.defaultValue, fallback, id);
    assert.equal(schema.defaultSettings.scene, fallback, id);
    const k = keys(schema);
    assert.deepEqual(k.slice(k.indexOf('scene'), k.indexOf('scene') + 4), ['scene', 'scene_bg', 'scene_text', 'scene_accent'], id);
    for (const key of ['scene_bg', 'scene_text', 'scene_accent']) assert.equal(field(schema, key).type, 'color', `${id}.${key}`);
  }
  // The stage owns its scenes: no section-level scene, one per repeater item.
  const stage = findSectionSchema('stage-scenes');
  assert.equal(field(stage, 'scene'), undefined);
  const item = field(stage, 'scenes').fields.find((f) => f.key === 'scene');
  assert.deepEqual(optionValues(item), ['dark', 'light', 'accent']);
  assert.equal(item.defaultValue, 'dark');
});

test('general sections: no brand name or retired tagline in any schema text', () => {
  const banned = [/newroj/i, /memory of kurds/i];
  for (const id of CREATIVE) {
    const text = JSON.stringify(findSectionSchema(id));
    for (const pattern of banned) assert.equal(pattern.test(text), false, `${id}: ${pattern}`);
  }
});

// ── Options on existing sections ────────────────────────────────────────

test('heading reveal and accent phrase are in exactly the five heading sections', () => {
  for (const key of HEADING_OPTION_KEYS) {
    const withKey = SECTION_SCHEMAS.filter((s) => !CREATIVE.includes(s.id) && keys(s).includes(key)).map((s) => s.id);
    assert.deepEqual([...withKey].sort(), [...HEADING_OPTION_SECTIONS].sort(), key);
  }
  assert.deepEqual(
    SECTION_SCHEMAS.filter((s) => keys(s).includes('heading_reveal')).map((s) => s.id).sort(),
    [...HEADING_OPTION_SECTIONS].sort(),
  );
});

test('the heading trio sits right after the heading accent pair', () => {
  for (const id of HEADING_OPTION_SECTIONS) {
    const schema = findSectionSchema(id);
    const k = keys(schema);
    const at = k.indexOf('heading_accent_color');
    assert.ok(at >= 0, `${id}: heading_accent_color`);
    assert.deepEqual(k.slice(at + 1, at + 4), HEADING_OPTION_KEYS, id);
    assert.equal(new Set(k).size, k.length, `${id}: duplicate keys`);

    const reveal = field(schema, 'heading_reveal');
    assert.equal(reveal.type, 'select', id);
    assert.equal(reveal.defaultValue, 'none', id);
    assert.deepEqual(optionValues(reveal), ['none', 'lines'], id);

    const emphasis = field(schema, 'heading_emphasis');
    assert.equal(emphasis.type, 'select', id);
    // Existing sections: unset = asterisks print literally, as today.
    assert.equal(emphasis.defaultValue, 'none', id);
    assert.deepEqual(optionValues(emphasis), ['none', 'color', 'italic'], id);
    for (const loc of LOCALES) assert.match(emphasis.description[loc], /\*[^*]+\*/, `${id} ${loc}`);

    const color = field(schema, 'heading_emphasis_color');
    assert.equal(color.type, 'color', id);
    assert.equal('defaultValue' in color, false, id);
    assert.deepEqual(color.showIf, { key: 'heading_emphasis', in: ['color', 'italic'] }, id);
  }
});

test('the image reveal pair is the last two fields of exactly the three image sections', () => {
  for (const key of IMAGE_OPTION_KEYS) {
    const withKey = SECTION_SCHEMAS.filter((s) => keys(s).includes(key)).map((s) => s.id);
    assert.deepEqual([...withKey].sort(), [...IMAGE_REVEAL_SECTIONS].sort(), key);
  }
  for (const id of IMAGE_REVEAL_SECTIONS) {
    const schema = findSectionSchema(id);
    assert.deepEqual(keys(schema).slice(-2), IMAGE_OPTION_KEYS, id);
    const reveal = field(schema, 'image_reveal');
    assert.equal(reveal.type, 'select', id);
    assert.equal(reveal.defaultValue, 'none', id);
    assert.deepEqual(optionValues(reveal), ['none', 'mask'], id);
    const direction = field(schema, 'image_reveal_direction');
    assert.equal(direction.type, 'select', id);
    assert.equal(direction.defaultValue, 'up', id);
    assert.deepEqual(optionValues(direction), ['up', 'start', 'end'], id);
    assert.deepEqual(direction.showIf, { key: 'image_reveal', in: ['mask'] }, id);
  }
});

test('the options are settings: not translatable, in no defaultSettings or defaultContent', () => {
  for (const s of SECTION_SCHEMAS) {
    if (CREATIVE.includes(s.id)) continue;
    for (const key of [...HEADING_OPTION_KEYS, ...IMAGE_OPTION_KEYS]) {
      assert.equal(s.translatable.includes(key), false, `${s.id} translatable ${key}`);
      assert.equal(key in (s.defaultSettings || {}), false, `${s.id} defaultSettings ${key}`);
      assert.equal(key in (s.defaultContent || {}), false, `${s.id} defaultContent ${key}`);
    }
  }
});

test('option texts in six locales', () => {
  for (const key of HEADING_OPTION_KEYS) assertFieldTexts(key, field(findSectionSchema('hero-banner'), key));
  for (const key of IMAGE_OPTION_KEYS) assertFieldTexts(key, field(findSectionSchema('single-image'), key));
  assert.equal(field(findSectionSchema('hero-banner'), 'heading_reveal').label.en, 'Heading reveal');
  assert.equal(field(findSectionSchema('single-image'), 'image_reveal').label.en, 'Image reveal');
});

test('sections outside the two lists carry none of the options', () => {
  for (const id of ['rich-text', 'trust-badges', 'hero-slider', 'hero-video', 'category-tiles']) {
    const k = keys(findSectionSchema(id));
    for (const key of [...HEADING_OPTION_KEYS, ...IMAGE_OPTION_KEYS]) assert.equal(k.includes(key), false, `${id}.${key}`);
  }
});
