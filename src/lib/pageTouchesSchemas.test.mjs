// Page touches: the heading accent pair of the hero-type sections, the
// brand-band section and the compact header switch. Keys, types, option
// values, limits and defaults are the contract shared with the storefront
// (multi-stores-web/src/themes/minimal/sections/: BrandBand.tsx,
// _shared/headingAccentFields.ts, chrome/HeaderBar.tsx).
// Run: node --experimental-strip-types --test src/lib/pageTouchesSchemas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const ACCENT_SECTIONS = [
  'hero-banner', 'hero-split', 'hero-slider', 'hero-video',
  'parallax-banner', 'image-with-text', 'brand-band',
];

const keys = (schema) => schema.schema.map((f) => f.key);
const field = (schema, key) => schema.schema.find((f) => f.key === key);
const optionValues = (f) => (f.options || []).map((o) => o.value);

function assertSixLocales(where, text) {
  assert.ok(text && typeof text === 'object', `${where}: missing`);
  assert.deepEqual(Object.keys(text), LOCALES, `${where}: locales`);
  for (const loc of LOCALES) {
    assert.ok(typeof text[loc] === 'string' && text[loc].trim(), `${where}: no ${loc}`);
  }
}

/** Label, description and option labels of one field, in six locales. */
function assertFieldTexts(where, f) {
  assertSixLocales(`${where} label`, f.label);
  if (f.description) assertSixLocales(`${where} description`, f.description);
  for (const o of f.options || []) assertSixLocales(`${where} option ${o.value}`, o.label);
}

// ── Heading accent ──────────────────────────────────────────────────────

test('the accent pair is in exactly the seven sections', () => {
  const withAccent = SECTION_SCHEMAS.filter((s) => keys(s).includes('heading_accent')).map((s) => s.id);
  const withColor = SECTION_SCHEMAS.filter((s) => keys(s).includes('heading_accent_color')).map((s) => s.id);
  assert.deepEqual([...withAccent].sort(), [...ACCENT_SECTIONS].sort());
  assert.deepEqual([...withColor].sort(), [...ACCENT_SECTIONS].sort());
});

test('the pair sits right after the heading tag select, once', () => {
  for (const id of ACCENT_SECTIONS) {
    const k = keys(findSectionSchema(id));
    const at = k.indexOf('heading_level');
    assert.ok(at >= 0, `${id}: heading_level`);
    assert.equal(k[at + 1], 'heading_accent', id);
    assert.equal(k[at + 2], 'heading_accent_color', id);
    assert.equal(k.filter((x) => x === 'heading_accent').length, 1, id);
    assert.equal(k.filter((x) => x === 'heading_accent_color').length, 1, id);
    assert.equal(new Set(k).size, k.length, `${id}: duplicate keys`);
  }
});

test('heading_accent: select none / line / brush, default none', () => {
  for (const id of ACCENT_SECTIONS) {
    const f = field(findSectionSchema(id), 'heading_accent');
    assert.equal(f.type, 'select', id);
    assert.equal(f.defaultValue, 'none', id);
    assert.deepEqual(optionValues(f), ['none', 'line', 'brush'], id);
    assert.equal(f.showIf, undefined, id);
    for (const limit of ['min', 'max', 'maxItems', 'maxLength']) assert.equal(f[limit], undefined, `${id} ${limit}`);
  }
});

test('heading_accent_color: colour without default, shown for line and brush', () => {
  for (const id of ACCENT_SECTIONS) {
    const f = field(findSectionSchema(id), 'heading_accent_color');
    assert.equal(f.type, 'color', id);
    assert.equal('defaultValue' in f, false, id);
    assert.deepEqual(f.showIf, { key: 'heading_accent', in: ['line', 'brush'] }, id);
    for (const limit of ['min', 'max', 'maxItems', 'maxLength']) assert.equal(f[limit], undefined, `${id} ${limit}`);
  }
});

test('the pair is a setting: not translatable, in no defaultSettings or defaultContent', () => {
  for (const s of SECTION_SCHEMAS) {
    for (const key of ['heading_accent', 'heading_accent_color']) {
      assert.equal(s.translatable.includes(key), false, `${s.id} translatable ${key}`);
      assert.equal(key in (s.defaultSettings || {}), false, `${s.id} defaultSettings ${key}`);
      assert.equal(key in (s.defaultContent || {}), false, `${s.id} defaultContent ${key}`);
    }
  }
});

test('accent texts in six locales', () => {
  const s = findSectionSchema('hero-banner');
  const accent = field(s, 'heading_accent');
  const color = field(s, 'heading_accent_color');
  assertFieldTexts('heading_accent', accent);
  assertFieldTexts('heading_accent_color', color);
  assert.equal(accent.label.en, 'Heading accent');
  assert.deepEqual(accent.options.map((o) => o.label.en), ['None', 'Line', 'Brush stroke']);
  assert.equal(color.label.en, 'Accent colour');
  assert.equal(color.description.en, 'Empty = the theme accent colour.');
});

// ── brand-band ──────────────────────────────────────────────────────────

const band = findSectionSchema('brand-band');

test('brand-band: identity and field order', () => {
  assert.ok(band, 'brand-band schema');
  assert.equal(band.category, 'showcase');
  assert.equal(band.icon, 'image');
  assert.equal(band.chrome, undefined);
  assert.equal(band.gate, undefined);
  assert.deepEqual(band.pageTypes, ['HOME', 'STATIC', 'LANDING', 'FOOTER']);
  assert.deepEqual(band.translatable, ['alt', 'heading', 'tagline', 'cta_text']);
  assert.deepEqual(keys(band), [
    'image', 'alt', 'image_focus', 'overlay_opacity', 'height', 'logo', 'logo_height',
    'heading', 'heading_level', 'heading_accent', 'heading_accent_color',
    'heading_reveal', 'heading_emphasis', 'heading_emphasis_color', 'heading_style',
    'tagline', 'text_color', 'cta_text', 'cta_url',
  ]);
  assert.equal(SECTION_SCHEMAS.filter((s) => s.id === 'brand-band').length, 1);
});

test('brand-band: types, limits and option values', () => {
  const shape = (key) => {
    const f = field(band, key);
    const out = { type: f.type };
    for (const k of ['defaultValue', 'min', 'max', 'maxLength', 'showIf', 'required']) if (k in f) out[k] = f[k];
    if (f.options) out.options = optionValues(f);
    return out;
  };
  assert.deepEqual(shape('image'), { type: 'image' });
  assert.deepEqual(shape('alt'), { type: 'text', maxLength: 160 });
  assert.deepEqual(shape('image_focus'), { type: 'select', defaultValue: 'center', options: ['center', 'top', 'bottom'] });
  assert.deepEqual(shape('overlay_opacity'), { type: 'number', defaultValue: 40, min: 0, max: 80 });
  assert.deepEqual(shape('height'), { type: 'select', defaultValue: 'md', options: ['sm', 'md', 'lg'] });
  assert.deepEqual(shape('logo'), { type: 'image' });
  assert.deepEqual(shape('logo_height'), { type: 'number', defaultValue: 72, min: 32, max: 160 });
  assert.deepEqual(shape('heading'), { type: 'text', maxLength: 80 });
  assert.deepEqual(shape('heading_style'), { type: 'select', defaultValue: 'ruled', options: ['ruled', 'plain'] });
  assert.deepEqual(shape('tagline'), { type: 'text', maxLength: 160 });
  assert.deepEqual(shape('text_color'), { type: 'color' });
  assert.deepEqual(shape('cta_text'), { type: 'text', maxLength: 40 });
  assert.deepEqual(shape('cta_url'), { type: 'url' });
});

test('brand-band: defaults', () => {
  assert.deepEqual(band.defaultSettings, {
    image_focus: 'center',
    overlay_opacity: 40,
    height: 'md',
    logo_height: 72,
    heading_style: 'ruled',
  });
  assert.deepEqual(band.defaultContent, {
    heading: 'Your brand',
    tagline: 'A short line about what you stand for',
  });
});

test('brand-band: heading tag defaults to h2, no subheading or eyebrow tag', () => {
  const level = field(band, 'heading_level');
  assert.equal(level.type, 'select');
  assert.equal(level.defaultValue, 'h2');
  assert.equal(keys(band).includes('subheading_tag'), false);
  assert.equal(keys(band).includes('eyebrow_tag'), false);
});

test('brand-band: offered on HOME, STATIC, LANDING and FOOTER only', () => {
  for (const pageType of ['HOME', 'STATIC', 'LANDING', 'FOOTER']) {
    assert.equal(isAvailableForPageType(band, pageType), true, pageType);
  }
  for (const pageType of ['HEADER', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE']) {
    assert.equal(isAvailableForPageType(band, pageType), false, pageType);
  }
});

test('brand-band: every text in six locales', () => {
  assertSixLocales('brand-band label', band.label);
  assertSixLocales('brand-band description', band.description);
  for (const f of band.schema) assertFieldTexts(`brand-band.${f.key}`, f);
});

// ── Compact header ──────────────────────────────────────────────────────

const header = findSectionSchema('header-bar');

test('compact_on_scroll: boolean, off by default, right after sticky_mode', () => {
  const k = keys(header);
  assert.equal(k[k.indexOf('sticky_mode') + 1], 'compact_on_scroll');
  const f = field(header, 'compact_on_scroll');
  assert.equal(f.type, 'boolean');
  assert.equal(f.defaultValue, false);
  assert.equal(f.showIf, undefined);
  // A new header does not start compact: the key is not a default setting.
  assert.equal('compact_on_scroll' in header.defaultSettings, false);
  assert.equal(header.translatable.includes('compact_on_scroll'), false);
});

test('compact_on_scroll: label and description in six locales', () => {
  const f = field(header, 'compact_on_scroll');
  assertFieldTexts('compact_on_scroll', f);
  assert.deepEqual(f.label, {
    en: 'Compact on scroll',
    ar: 'تصغير عند التمرير',
    tr: 'Kaydırınca küçült',
    de: 'Beim Scrollen verkleinern',
    fr: 'Compact au défilement',
    sv: 'Kompakt vid rullning',
  });
  assert.equal(
    f.description.en,
    'The bar gets lower and the logo smaller once the page is scrolled. Needs "Sticky on scroll".',
  );
  // The description names the setting it depends on by its label.
  const sticky = field(header, 'sticky_mode');
  for (const loc of LOCALES) {
    const stickyLabel = sticky.label[loc] || sticky.label.en;
    assert.ok(f.description[loc].includes(stickyLabel), `description ${loc} names "${stickyLabel}"`);
  }
});
