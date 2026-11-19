// Editorial section set: three new sections (category-tiles,
// progress-spotlight, project-cards), the edge-to-edge variants of hero-split,
// image-with-text and trust-badges, the repeater item limit and two presets.
// The keys, option values and defaults asserted here are the contract shared
// with the storefront (multi-stores-web/src/themes/minimal/sections/).
// Run: node --experimental-strip-types --test src/lib/editorialSections.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';
import { visibleInspectorFields } from './inspectorFields.ts';
import { buildEditorialPresets } from './editorialPresets.ts';
import { repeaterAtLimit } from './repeaterLimit.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const NEW_KEYS = ['category-tiles', 'progress-spotlight', 'project-cards'];
// The creative engine sections have their own test (creativeSchemas.test.mjs).
const CREATIVE_KEYS = [
  'hero-outline', 'hero-sunrise', 'stage-scenes',
  'story-pinned', 'sticky-steps', 'motion-path', 'marquee-band',
  'ornament-line',
  // Brand sections: their own rules are checked in creativeSchemas.test.mjs.
  'cover-hero',
  'look-spread',
  'object-study',
  'script-manifesto',
  'impact-arc',
  'pattern-band',
  'hero-dawn',
  'promise-band',
];
// Creative options injected into existing sections (withCreativeOptions).
const CREATIVE_OPTION_KEYS = [];

const keys = (fields) => fields.map((f) => f.key);
const field = (schema, key) => schema.schema.find((f) => f.key === key);
const optionValues = (f) => (f.options || []).map((o) => o.value);

const TONE = ['none', 'surface', 'primary', 'accent'];
const STATUS = ['none', 'planned', 'in_progress', 'completed'];
const CTA_TONE = ['primary', 'accent'];
const FOCUS = ['center', 'top', 'bottom'];
const EDGE = ['soft', 'hard'];
const TRUST_ICONS = [
  'truck', 'refresh', 'shield', 'card', 'award', 'star', 'headphones', 'leaf',
  'graduation', 'gem', 'globe', 'book', 'heart', 'sparkles',
];

/** Every label / description / option label under `fields`, with its path. */
function collectTexts(fields, path, out = []) {
  for (const f of fields) {
    const at = `${path}.${f.key}`;
    out.push([`${at} label`, f.label]);
    if (f.description) out.push([`${at} description`, f.description]);
    for (const o of f.options || []) out.push([`${at} option ${o.value}`, o.label]);
    if (f.fields) collectTexts(f.fields, at, out);
  }
  return out;
}

function assertSixLocales(texts) {
  for (const [where, text] of texts) {
    assert.ok(text && typeof text === 'object', `${where}: missing`);
    for (const loc of LOCALES) {
      assert.ok(typeof text[loc] === 'string' && text[loc].trim(), `${where}: no ${loc}`);
    }
  }
}

// ── The three new sections ──────────────────────────────────────────────

test('the three new sections exist with the agreed translatable keys', () => {
  assert.deepEqual(findSectionSchema('category-tiles').translatable, ['heading', 'subheading', 'items']);
  assert.deepEqual(findSectionSchema('progress-spotlight').translatable, [
    'eyebrow', 'heading', 'body', 'item_title', 'item_meta', 'unit_label', 'note', 'cta_text', 'alt',
  ]);
  assert.deepEqual(findSectionSchema('project-cards').translatable, ['heading', 'subheading', 'link_label', 'items']);
});

test('category, icon and position in the catalog', () => {
  const ids = SECTION_SCHEMAS.map((s) => s.id);
  const tiles = findSectionSchema('category-tiles');
  assert.equal(tiles.category, 'commerce');
  assert.equal(tiles.icon, 'layout-grid');
  assert.equal(ids[ids.indexOf('bento-grid') + 1], 'category-tiles');

  const spotlight = findSectionSchema('progress-spotlight');
  assert.equal(spotlight.category, 'content');
  assert.equal(spotlight.icon, 'target');
  const cards = findSectionSchema('project-cards');
  assert.equal(cards.category, 'content');
  assert.equal(cards.icon, 'layout-grid');
  assert.deepEqual(ids.slice(ids.indexOf('team-grid') + 1, ids.indexOf('team-grid') + 3), [
    'progress-spotlight',
    'project-cards',
  ]);
  // Section ids stay unique.
  assert.equal(new Set(ids).size, ids.length);
});

test('defaultSettings of the three new sections (true defaults are written out)', () => {
  assert.deepEqual(findSectionSchema('category-tiles').defaultSettings, {
    card_style: 'caption',
    aspect: 'square',
    columns: 4,
    columns_tablet: 3,
    columns_mobile: 2,
    mobile_scroll: false,
    heading_align: 'center',
    heading_rule: false,
    show_arrow: true,
    card_surface: true,
    rounded: true,
  });
  assert.deepEqual(findSectionSchema('progress-spotlight').defaultSettings, {
    layout: 'split',
    image_side: 'start',
    image_focus: 'center',
    tone: 'surface',
    icon: 'none',
    status: 'in_progress',
    goal: 100,
    reached: 0,
    show_progress: true,
    show_percent: true,
    cta_tone: 'primary',
    cta_arrow: false,
  });
  assert.deepEqual(findSectionSchema('project-cards').defaultSettings, {
    columns: 3,
    columns_tablet: 2,
    columns_mobile: 1,
    aspect: 'landscape',
    card_style: 'bordered',
    show_status: true,
    heading_align: 'start',
    heading_rule: false,
    rounded: true,
  });
});

test('defaultContent of the three new sections', () => {
  assert.deepEqual(findSectionSchema('category-tiles').defaultContent, {
    heading: 'Shop by category',
    items: [
      { title: 'New in', subtitle: 'The latest arrivals', url: '/products' },
      { title: 'Clothing', subtitle: 'Everyday pieces', url: '/products' },
      { title: 'Accessories', subtitle: 'Finishing touches', url: '/products' },
      { title: 'Gifts', subtitle: 'Something for everyone', url: '/products' },
    ],
  });
  assert.deepEqual(findSectionSchema('progress-spotlight').defaultContent, {
    eyebrow: 'Our goal',
    heading: 'Follow our progress',
    body: 'Describe what you are working towards and why it matters. The bar is calculated from the two numbers you enter.',
    item_title: 'Name of the goal',
    item_meta: 'Where or when',
    unit_label: 'completed',
    cta_text: 'Learn more',
  });
  const text = 'Describe the project in one or two sentences.';
  assert.deepEqual(findSectionSchema('project-cards').defaultContent, {
    heading: 'Our projects',
    subheading: 'What is planned, what is under way and what is done.',
    items: [
      { title: 'First project', category: 'Category', location: 'Location', status: 'completed', description: text },
      { title: 'Second project', category: 'Category', location: 'Location', status: 'in_progress', description: text },
      { title: 'Third project', category: 'Category', location: 'Location', status: 'planned', description: text },
    ],
  });
});

test('every boolean default of true is stored in defaultSettings (unset reads as off)', () => {
  for (const id of NEW_KEYS) {
    const schema = findSectionSchema(id);
    for (const f of schema.schema) {
      if (f.type !== 'boolean') continue;
      assert.equal(typeof f.defaultValue, 'boolean', `${id}.${f.key} defaultValue`);
      assert.equal(schema.defaultSettings[f.key], f.defaultValue, `${id}.${f.key}`);
    }
  }
});

test('defaults split by translatable: content keys in defaultContent, the rest in defaultSettings', () => {
  for (const id of NEW_KEYS) {
    const schema = findSectionSchema(id);
    const known = new Set(keys(schema.schema));
    const translatable = new Set(schema.translatable);
    for (const k of schema.translatable) assert.ok(known.has(k), `${id}: translatable ${k} has a field`);
    for (const k of Object.keys(schema.defaultSettings)) {
      assert.ok(known.has(k), `${id}: setting ${k} has a field`);
      assert.ok(!translatable.has(k), `${id}: ${k} is a setting`);
    }
    for (const k of Object.keys(schema.defaultContent)) assert.ok(translatable.has(k), `${id}: ${k} is content`);
    // Select and number defaults are valid values of their field.
    for (const f of schema.schema) {
      const v = schema.defaultSettings[f.key];
      if (v === undefined) continue;
      if (f.type === 'select') {
        assert.ok(optionValues(f).includes(v), `${id}.${f.key} = ${v}`);
        assert.equal(f.defaultValue, v, `${id}.${f.key} defaultValue`);
      }
      if (f.type === 'number') {
        if (f.min !== undefined) assert.ok(v >= f.min, `${id}.${f.key} min`);
        if (f.max !== undefined) assert.ok(v <= f.max, `${id}.${f.key} max`);
      }
    }
  }
});

test('category-tiles: fields, option values, limits', () => {
  const s = findSectionSchema('category-tiles');
  assert.deepEqual(keys(field(s, 'items').fields), ['image', 'title', 'subtitle', 'url', 'alt']);
  assert.equal(field(s, 'items').maxItems, 12);
  assert.deepEqual(optionValues(field(s, 'card_style')), ['caption', 'overlay']);
  assert.deepEqual(optionValues(field(s, 'aspect')), ['square', 'portrait', 'landscape']);
  assert.deepEqual(optionValues(field(s, 'heading_align')), ['start', 'center']);
  const range = (k) => [field(s, k).min, field(s, k).max];
  assert.deepEqual(range('columns'), [2, 6]);
  assert.deepEqual(range('columns_tablet'), [2, 4]);
  assert.deepEqual(range('columns_mobile'), [1, 2]);
  assert.deepEqual(field(s, 'card_surface').showIf, { key: 'card_style', in: ['', 'caption'] });
  for (const k of ['heading_color', 'subheading_color', 'title_color', 'subtitle_color', 'arrow_bg_color', 'arrow_color']) {
    assert.equal(field(s, k).type, 'color', k);
  }
  for (const k of ['mobile_scroll', 'heading_rule', 'show_arrow', 'card_surface', 'rounded']) {
    assert.equal(field(s, k).type, 'boolean', k);
  }
  assert.equal(field(s, 'heading').maxLength, 120);
  assert.equal(field(s, 'subheading').maxLength, 240);
  const item = Object.fromEntries(field(s, 'items').fields.map((f) => [f.key, f]));
  assert.equal(item.title.maxLength, 60);
  assert.equal(item.subtitle.maxLength, 80);
  assert.equal(item.alt.maxLength, 160);
  assert.equal(item.image.type, 'image');
  assert.equal(item.url.type, 'url');
});

test('progress-spotlight: fields, option values, limits', () => {
  const s = findSectionSchema('progress-spotlight');
  assert.deepEqual(optionValues(field(s, 'layout')), ['split', 'card']);
  assert.deepEqual(optionValues(field(s, 'image_side')), ['start', 'end']);
  assert.deepEqual(optionValues(field(s, 'image_focus')), FOCUS);
  assert.deepEqual(optionValues(field(s, 'tone')), TONE);
  assert.deepEqual(optionValues(field(s, 'status')), STATUS);
  assert.deepEqual(optionValues(field(s, 'cta_tone')), CTA_TONE);
  assert.deepEqual(optionValues(field(s, 'icon')), ['none', ...TRUST_ICONS]);
  // The image fields follow the split layout (unset = split).
  for (const k of ['image', 'alt', 'image_side', 'image_focus']) {
    assert.deepEqual(field(s, k).showIf, { key: 'layout', in: ['', 'split'] }, k);
  }
  // Two plain numbers, no typed percentage; both may be left empty.
  for (const k of ['goal', 'reached']) {
    assert.equal(field(s, k).type, 'number', k);
    assert.equal(field(s, k).min, 0, k);
    assert.equal(field(s, k).max, undefined, k);
    assert.ok(!field(s, k).required, k);
  }
  assert.ok(!keys(s.schema).some((k) => /percent/.test(k) && k !== 'show_percent'));
  const max = (k) => field(s, k).maxLength;
  assert.deepEqual(
    ['alt', 'eyebrow', 'heading', 'body', 'item_title', 'item_meta', 'unit_label', 'note', 'cta_text'].map(max),
    [160, 40, 120, 400, 120, 80, 40, 160, 40],
  );
  for (const k of ['eyebrow_color', 'heading_color', 'body_color', 'bar_color', 'bg_color', 'cta_bg_color', 'cta_text_color', 'cta_border_color']) {
    assert.equal(field(s, k).type, 'color', k);
  }
  assert.deepEqual([field(s, 'cta_border_width').min, field(s, 'cta_border_width').max], [0, 8]);
  assert.deepEqual([field(s, 'cta_border_radius').min, field(s, 'cta_border_radius').max], [0, 100]);
  assert.equal(field(s, 'cta_url').type, 'url');
});

test('project-cards: fields, option values, limits', () => {
  const s = findSectionSchema('project-cards');
  const items = field(s, 'items');
  assert.deepEqual([...keys(items.fields)].sort(), [
    'alt', 'category', 'description', 'image', 'location', 'status', 'title', 'url',
  ]);
  // The collapsed repeater row previews the first text field: the title.
  assert.equal(items.fields.find((f) => ['text', 'textarea', 'richtext'].includes(f.type)).key, 'title');
  assert.equal(items.maxItems, 24);
  const item = Object.fromEntries(items.fields.map((f) => [f.key, f]));
  assert.deepEqual(optionValues(item.status), STATUS);
  assert.equal(item.status.defaultValue, 'none');
  assert.deepEqual(
    ['alt', 'title', 'category', 'location', 'description'].map((k) => item[k].maxLength),
    [160, 120, 60, 80, 240],
  );
  assert.deepEqual(optionValues(field(s, 'aspect')), ['landscape', 'square', 'portrait', 'wide']);
  assert.deepEqual(optionValues(field(s, 'card_style')), ['plain', 'bordered', 'surface']);
  assert.deepEqual(optionValues(field(s, 'heading_align')), ['start', 'center']);
  const range = (k) => [field(s, k).min, field(s, k).max];
  assert.deepEqual(range('columns'), [1, 4]);
  assert.deepEqual(range('columns_tablet'), [1, 3]);
  assert.deepEqual(range('columns_mobile'), [1, 2]);
  assert.equal(field(s, 'link_label').maxLength, 40);
  assert.equal(field(s, 'link_url').type, 'url');
  for (const k of ['heading_color', 'subheading_color', 'title_color', 'body_color', 'link_color']) {
    assert.equal(field(s, k).type, 'color', k);
  }
});

test('no repeater in the new schemas lacks maxItems', () => {
  for (const id of NEW_KEYS) {
    for (const f of findSectionSchema(id).schema) {
      if (f.type !== 'repeater') continue;
      assert.ok(Number.isInteger(f.maxItems) && f.maxItems > 0, `${id}.${f.key}`);
    }
  }
  // Repeaters of the other sections stay unlimited.
  for (const schema of SECTION_SCHEMAS) {
    if (NEW_KEYS.includes(schema.id) || CREATIVE_KEYS.includes(schema.id)) continue;
    for (const f of schema.schema) assert.equal(f.maxItems, undefined, `${schema.id}.${f.key}`);
  }
});

test('the three new sections are offered on HOME, STATIC and LANDING, not in the chrome', () => {
  for (const id of NEW_KEYS) {
    const schema = findSectionSchema(id);
    assert.equal(schema.pageTypes, undefined, id);
    assert.ok(!schema.chrome, id);
    assert.equal(schema.gate, undefined, id);
    for (const page of ['HOME', 'STATIC', 'LANDING']) assert.equal(isAvailableForPageType(schema, page), true, `${id} ${page}`);
    for (const page of ['HEADER', 'FOOTER']) assert.equal(isAvailableForPageType(schema, page), false, `${id} ${page}`);
  }
});

test('heading machinery: h2 for the three, eyebrow tag for progress-spotlight only', () => {
  for (const id of NEW_KEYS) {
    const level = field(findSectionSchema(id), 'heading_level');
    assert.ok(level, `${id} heading_level`);
    assert.equal(level.defaultValue, 'h2', id);
    // The tag selects are settings, right after their text.
    const k = keys(findSectionSchema(id).schema);
    assert.equal(k[k.indexOf('heading') + 1], 'heading_level', id);
    assert.ok(!findSectionSchema(id).translatable.includes('heading_level'), id);
  }
  const spotlight = findSectionSchema('progress-spotlight');
  assert.equal(field(spotlight, 'eyebrow_tag').defaultValue, 'span');
  assert.equal(field(spotlight, 'subheading_tag'), undefined);
  for (const id of ['category-tiles', 'project-cards']) {
    assert.equal(field(findSectionSchema(id), 'subheading_tag').defaultValue, 'p', id);
    assert.equal(field(findSectionSchema(id), 'eyebrow_tag'), undefined, id);
  }
});

test('labels of the three new sections cover every dashboard locale', () => {
  for (const id of NEW_KEYS) {
    const schema = findSectionSchema(id);
    assertSixLocales([
      [`${id} label`, schema.label],
      [`${id} description`, schema.description],
      ...collectTexts(schema.schema, id),
    ]);
  }
});

// ── The three variants ──────────────────────────────────────────────────

// The hero emblem (optional decor, last four fields of hero-split and hero-banner).
const HERO_EMBLEM_KEYS = ['emblem_image', 'emblem_motion', 'emblem_size', 'emblem_position'];
const HERO_SPLIT_ADDED = ['variant', 'alt', 'image_width', 'image_focus', 'tone', 'bg_color', 'edge', 'mobile_order', 'cta_tone', 'cta_arrow', 'heading_accent', 'heading_accent_color', ...CREATIVE_OPTION_KEYS, ...HERO_EMBLEM_KEYS];
const IMAGE_WITH_TEXT_ADDED = [
  'alt', 'image_style', 'min_height', 'image_focus', 'tone', 'bg_color', 'edge',
  'cta_secondary_text', 'cta_secondary_url', 'cta_tone',
  'cta_secondary_bg_color', 'cta_secondary_text_color', 'cta_secondary_border_color',
  'cta_secondary_border_width', 'cta_secondary_border_radius',
  'heading_accent', 'heading_accent_color', ...CREATIVE_OPTION_KEYS,
];
const TRUST_BADGES_ADDED = ['icon_color'];

// Field keys of the three sections before the editorial set, in order.
const HERO_SPLIT_BEFORE = [
  'image', 'image_side', 'height', 'eyebrow', 'eyebrow_tag', 'heading', 'heading_level', 'subheading', 'subheading_tag',
  'cta_text', 'cta_url', 'cta_secondary_text', 'cta_secondary_url',
  'eyebrow_color', 'heading_color', 'subheading_color',
  'cta_bg_color', 'cta_text_color', 'cta_border_color', 'cta_border_width', 'cta_border_radius',
  'cta_secondary_bg_color', 'cta_secondary_text_color', 'cta_secondary_border_color',
  'cta_secondary_border_width', 'cta_secondary_border_radius',
];
const IMAGE_WITH_TEXT_BEFORE = [
  'image', 'image_source', 'image_index', 'image_position', 'aspect', 'eyebrow', 'eyebrow_tag', 'heading', 'heading_level',
  'body', 'cta_text', 'cta_url', 'eyebrow_color', 'heading_color', 'body_color',
  'cta_bg_color', 'cta_text_color', 'cta_border_color', 'cta_border_width', 'cta_border_radius',
];
const TRUST_BADGES_BEFORE = ['layout', 'padding', 'items'];

test('the three existing sections keep their defaultSettings and their previous fields', () => {
  const hero = findSectionSchema('hero-split');
  assert.deepEqual(hero.defaultSettings, { image_side: 'start', height: 'md' });
  assert.deepEqual(keys(hero.schema).filter((k) => !HERO_SPLIT_ADDED.includes(k)), HERO_SPLIT_BEFORE);
  assert.deepEqual(keys(hero.schema).filter((k) => HERO_SPLIT_ADDED.includes(k)).sort(), [...HERO_SPLIT_ADDED].sort());

  const iwt = findSectionSchema('image-with-text');
  assert.deepEqual(iwt.defaultSettings, { image_position: 'left', aspect: 'square' });
  assert.deepEqual(keys(iwt.schema).filter((k) => !IMAGE_WITH_TEXT_ADDED.includes(k)), IMAGE_WITH_TEXT_BEFORE);
  assert.deepEqual(keys(iwt.schema).filter((k) => IMAGE_WITH_TEXT_ADDED.includes(k)).sort(), [...IMAGE_WITH_TEXT_ADDED].sort());

  const trust = findSectionSchema('trust-badges');
  assert.deepEqual(trust.defaultSettings, { layout: 'cards', padding: 'comfortable' });
  assert.deepEqual(keys(trust.schema).filter((k) => !TRUST_BADGES_ADDED.includes(k)), TRUST_BADGES_BEFORE);
  assert.deepEqual(trust.translatable, ['items']);
  // Default content untouched as well.
  assert.equal(hero.defaultContent.heading, 'Everyday essentials, elevated');
  assert.equal(iwt.defaultContent.heading, 'Crafted with care');
  assert.equal(trust.defaultContent.items.length, 4);
});

test('hero-split: bleed variant fields', () => {
  const s = findSectionSchema('hero-split');
  assert.deepEqual(s.translatable, ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text', 'alt']);
  const k = keys(s.schema);
  assert.equal(k[0], 'variant');
  assert.equal(k[k.indexOf('image') + 1], 'alt');
  assert.deepEqual(optionValues(field(s, 'variant')), ['framed', 'bleed']);
  assert.equal(field(s, 'variant').defaultValue, 'framed');
  assert.equal(field(s, 'alt').maxLength, 160);
  assert.deepEqual(optionValues(field(s, 'image_width')), ['half', 'wide']);
  assert.deepEqual(optionValues(field(s, 'image_focus')), FOCUS);
  assert.deepEqual(optionValues(field(s, 'tone')), TONE);
  assert.deepEqual(optionValues(field(s, 'edge')), EDGE);
  assert.deepEqual(optionValues(field(s, 'mobile_order')), ['image-first', 'text-first']);
  assert.deepEqual(optionValues(field(s, 'cta_tone')), CTA_TONE);
  assert.deepEqual(
    ['image_width', 'image_focus', 'tone', 'edge', 'mobile_order', 'cta_tone'].map((key) => field(s, key).defaultValue),
    ['half', 'center', 'surface', 'soft', 'image-first', 'primary'],
  );
  for (const key of ['image_width', 'image_focus', 'tone', 'bg_color', 'edge', 'mobile_order', 'cta_arrow']) {
    assert.deepEqual(field(s, key).showIf, { key: 'variant', in: ['bleed'] }, key);
  }
  // Both variants: no showIf.
  for (const key of ['variant', 'alt', 'cta_tone']) assert.equal(field(s, key).showIf, undefined, key);
  // No new boolean defaults to true on an existing section.
  assert.equal(field(s, 'cta_arrow').type, 'boolean');
  assert.equal(field(s, 'cta_arrow').defaultValue, false);
});

test('hero-split inspector: the bleed fields show only for the bleed variant', () => {
  const s = findSectionSchema('hero-split');
  const bleedOnly = ['image_width', 'image_focus', 'tone', 'bg_color', 'edge', 'mobile_order', 'cta_arrow'];
  for (const settings of [{}, { variant: 'framed' }, { image_side: 'start', height: 'md' }]) {
    const v = visibleInspectorFields(s, settings, 'HOME');
    for (const key of bleedOnly) assert.ok(!keys(v.settingsFields).includes(key), `${key} hidden`);
    assert.ok(keys(v.settingsFields).includes('variant'));
    assert.ok(keys(v.settingsFields).includes('cta_tone'));
    // `alt` is written to the per-locale content.
    assert.ok(keys(v.contentFields).includes('alt'));
    assert.ok(!keys(v.settingsFields).includes('alt'));
  }
  const bleed = visibleInspectorFields(s, { variant: 'bleed' }, 'HOME');
  for (const key of bleedOnly) assert.ok(keys(bleed.settingsFields).includes(key), `${key} shown`);
});

test('image-with-text: bleed style, second button, alt', () => {
  const s = findSectionSchema('image-with-text');
  assert.deepEqual(s.translatable, ['eyebrow', 'heading', 'body', 'cta_text', 'cta_secondary_text', 'alt']);
  const k = keys(s.schema);
  assert.equal(k[k.indexOf('image') + 1], 'alt');
  assert.equal(k[k.indexOf('image_position') + 1], 'image_style');
  assert.deepEqual(field(s, 'alt').showIf, { key: 'image_source', in: ['', 'static'] });
  assert.equal(field(s, 'alt').maxLength, 160);
  assert.deepEqual(optionValues(field(s, 'image_style')), ['framed', 'bleed']);
  assert.deepEqual(optionValues(field(s, 'min_height')), ['sm', 'md', 'lg']);
  assert.deepEqual(optionValues(field(s, 'image_focus')), FOCUS);
  assert.deepEqual(optionValues(field(s, 'tone')), TONE);
  assert.deepEqual(optionValues(field(s, 'edge')), EDGE);
  assert.deepEqual(optionValues(field(s, 'cta_tone')), CTA_TONE);
  assert.deepEqual(
    ['image_style', 'min_height', 'image_focus', 'tone', 'edge', 'cta_tone'].map((key) => field(s, key).defaultValue),
    ['framed', 'md', 'center', 'none', 'hard', 'primary'],
  );
  for (const key of ['min_height', 'image_focus', 'tone', 'bg_color', 'edge']) {
    assert.deepEqual(field(s, key).showIf, { key: 'image_style', in: ['bleed'] }, key);
  }
  for (const key of ['image_style', 'cta_secondary_text', 'cta_secondary_url', 'cta_tone']) {
    assert.equal(field(s, key).showIf, undefined, key);
  }
  assert.equal(field(s, 'cta_secondary_text').maxLength, 40);
  assert.equal(field(s, 'cta_secondary_url').type, 'url');
  // The second button's style fields come last (before the image reveal pair).
  assert.deepEqual(k.slice(-5), [
    'cta_secondary_bg_color', 'cta_secondary_text_color', 'cta_secondary_border_color',
    'cta_secondary_border_width', 'cta_secondary_border_radius',
  ]);
  // Stored values of image_position are unchanged; only the labels became logical.
  const position = field(s, 'image_position');
  assert.deepEqual(optionValues(position), ['left', 'right']);
  assert.equal(position.defaultValue, 'left');
  assert.equal(position.options[0].label.en, 'Start');
  assert.equal(position.options[1].label.en, 'End');
  assert.equal(position.options[0].label.ar, 'البداية');
  assert.equal(position.options[1].label.ar, 'النهاية');
  // No new boolean on the section.
  for (const key of IMAGE_WITH_TEXT_ADDED) assert.notEqual(field(s, key).type, 'boolean', key);
});

test('image-with-text inspector: content keys and the bleed gate', () => {
  const s = findSectionSchema('image-with-text');
  const framed = visibleInspectorFields(s, {}, 'HOME');
  assert.ok(keys(framed.contentFields).includes('alt'));
  assert.ok(keys(framed.contentFields).includes('cta_secondary_text'));
  assert.ok(keys(framed.settingsFields).includes('cta_secondary_url'));
  for (const key of ['min_height', 'image_focus', 'tone', 'bg_color', 'edge']) {
    assert.ok(!keys(framed.settingsFields).includes(key), `${key} hidden`);
  }
  const bleed = visibleInspectorFields(s, { image_style: 'bleed' }, 'HOME');
  for (const key of ['min_height', 'image_focus', 'tone', 'bg_color', 'edge']) {
    assert.ok(keys(bleed.settingsFields).includes(key), `${key} shown`);
  }
  // A product image has no upload and therefore no alt field.
  const dynamic = visibleInspectorFields(s, { image_source: 'product_featured' }, 'PRODUCT_TEMPLATE');
  assert.ok(!keys(dynamic.contentFields).includes('alt'));
});

test('trust-badges: strip layout, icon colour, six more icons', () => {
  const s = findSectionSchema('trust-badges');
  assert.deepEqual(optionValues(field(s, 'layout')), ['cards', 'inline', 'strip']);
  assert.equal(field(s, 'layout').defaultValue, 'cards');
  assert.equal(field(s, 'icon_color').type, 'color');
  assert.deepEqual(field(s, 'icon_color').showIf, { key: 'layout', in: ['strip'] });
  const icon = (schema, repeater) => field(schema, repeater).fields.find((f) => f.key === 'icon');
  // The three trust repeaters render through the storefront's shared icon map.
  assert.deepEqual(optionValues(icon(s, 'items')), TRUST_ICONS);
  assert.deepEqual(optionValues(icon(findSectionSchema('product-page'), 'trust_badges')), TRUST_ICONS);
  assert.deepEqual(optionValues(icon(findSectionSchema('product-trust'), 'trust_badges')), TRUST_ICONS);
  // The feature grid has its own renderer: its icon list is as it was.
  assert.deepEqual(optionValues(icon(findSectionSchema('feature-grid'), 'items')), [
    'truck', 'refresh', 'shield', 'card', 'award', 'star', 'headphones', 'leaf',
    'gift', 'heart', 'package', 'sparkles', 'zap',
  ]);
});

test('labels of the added variant fields cover every dashboard locale', () => {
  const added = (id, list) => findSectionSchema(id).schema.filter((f) => list.includes(f.key));
  assertSixLocales(collectTexts(added('hero-split', HERO_SPLIT_ADDED), 'hero-split'));
  assertSixLocales(collectTexts(added('image-with-text', IMAGE_WITH_TEXT_ADDED), 'image-with-text'));
  assertSixLocales(collectTexts(added('trust-badges', TRUST_BADGES_ADDED), 'trust-badges'));
  // Touched option labels: Start / End, the strip layout, the trust icons.
  const iwt = findSectionSchema('image-with-text');
  assertSixLocales(field(iwt, 'image_position').options.map((o) => [`image_position ${o.value}`, o.label]));
  const trust = findSectionSchema('trust-badges');
  assertSixLocales([['layout strip', field(trust, 'layout').options.find((o) => o.value === 'strip').label]]);
  const icons = field(trust, 'items').fields.find((f) => f.key === 'icon').options;
  assertSixLocales(icons.map((o) => [`icon ${o.value}`, o.label]));
});

// ── Manual line breaks in headings ──────────────────────────────────────

const MULTILINE_HEADINGS = ['hero-split', 'category-tiles', 'image-with-text', 'progress-spotlight', 'project-cards'];

/** Every field named `heading` under `fields`, repeater items included. */
function headingFields(fields, out = []) {
  for (const f of fields) {
    if (f.key === 'heading') out.push(f);
    if (f.fields) headingFields(f.fields, out);
  }
  return out;
}

test('the heading is a textarea in exactly the five sections that keep typed line breaks', () => {
  // Catalog order; same five as the storefront schemas (the web test compares the types).
  const catalog = SECTION_SCHEMAS.filter((s) => !CREATIVE_KEYS.includes(s.id));
  const textarea = catalog.filter((s) => field(s, 'heading')?.type === 'textarea').map((s) => s.id);
  assert.deepEqual(textarea, MULTILINE_HEADINGS);
  // Every other heading, nested ones included, is still a one-line text field.
  for (const schema of catalog) {
    const multiline = MULTILINE_HEADINGS.includes(schema.id);
    for (const f of headingFields(schema.schema)) {
      const top = f === field(schema, 'heading');
      assert.equal(f.type, multiline && top ? 'textarea' : 'text', `${schema.id} heading`);
      // The Enter hint is on the five only.
      if (!(multiline && top)) assert.ok(!/Enter/.test(f.description?.en ?? ''), `${schema.id} heading description`);
    }
  }
});

test('the multi-line headings explain the Enter key in six locales, limits unchanged', () => {
  const hint = 'Press Enter to start a new line (up to 4 lines).';
  const bleedHint = `${hint} Line breaks show in the edge-to-edge style only.`;
  for (const id of MULTILINE_HEADINGS) {
    const heading = field(findSectionSchema(id), 'heading');
    assertSixLocales([[`${id}.heading description`, heading.description]]);
    // The framed variants of the two existing sections render one flowing line.
    const bleedOnly = id === 'hero-split' || id === 'image-with-text';
    assert.equal(heading.description.en, bleedOnly ? bleedHint : hint, id);
    for (const loc of LOCALES) assert.ok(heading.description[loc].includes('4'), `${id} ${loc}: line limit`);
    // The heading is content in both variants: no showIf, not required.
    assert.equal(heading.showIf, undefined, id);
    assert.ok(!heading.required, id);
  }
  // maxLength is as before the change.
  assert.deepEqual(
    MULTILINE_HEADINGS.map((id) => field(findSectionSchema(id), 'heading').maxLength),
    [120, 120, undefined, 120, 120],
  );
  // The labels are untouched (en / ar on the two existing sections).
  for (const id of ['hero-split', 'image-with-text']) {
    assert.deepEqual(field(findSectionSchema(id), 'heading').label, { en: 'Heading', ar: 'العنوان' }, id);
  }
  // Still content, still translatable, and the tag select still follows it.
  for (const id of MULTILINE_HEADINGS) {
    const schema = findSectionSchema(id);
    assert.ok(schema.translatable.includes('heading'), id);
    assert.ok(keys(visibleInspectorFields(schema, {}, 'HOME').contentFields).includes('heading'), id);
    const k = keys(schema.schema);
    assert.equal(k[k.indexOf('heading') + 1], 'heading_level', id);
  }
});

test('no other field of the five sections changed its type', () => {
  // The fields that are textareas besides the heading, as before the change.
  const textareas = (id) => findSectionSchema(id).schema.filter((f) => f.type === 'textarea').map((f) => f.key);
  assert.deepEqual(textareas('hero-split'), ['heading', 'subheading']);
  assert.deepEqual(textareas('category-tiles'), ['heading', 'subheading']);
  assert.deepEqual(textareas('image-with-text'), ['heading', 'body']);
  assert.deepEqual(textareas('progress-spotlight'), ['heading', 'body']);
  assert.deepEqual(textareas('project-cards'), ['heading', 'subheading']);
  // Eyebrows, tile and card titles stay one-line.
  assert.equal(field(findSectionSchema('hero-split'), 'eyebrow').type, 'text');
  assert.equal(field(findSectionSchema('image-with-text'), 'eyebrow').type, 'text');
  assert.equal(field(findSectionSchema('progress-spotlight'), 'eyebrow').type, 'text');
  assert.equal(field(findSectionSchema('progress-spotlight'), 'item_title').type, 'text');
  for (const id of ['category-tiles', 'project-cards']) {
    const title = field(findSectionSchema(id), 'items').fields.find((f) => f.key === 'title');
    assert.equal(title.type, 'text', id);
  }
});

// ── Repeater limit ──────────────────────────────────────────────────────

test('repeaterAtLimit: unset means unlimited, the add control stops at the limit', () => {
  for (const none of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(repeaterAtLimit(0, none), false, String(none));
    assert.equal(repeaterAtLimit(500, none), false, String(none));
  }
  assert.equal(repeaterAtLimit(0, 12), false);
  assert.equal(repeaterAtLimit(11, 12), false);
  assert.equal(repeaterAtLimit(12, 12), true);
  // Content saved before a limit existed (or pasted) may exceed it: still blocked.
  assert.equal(repeaterAtLimit(30, 24), true);
});

// ── Presets ─────────────────────────────────────────────────────────────

const PRESETS = buildEditorialPresets((key) => {
  const schema = findSectionSchema(key);
  return { settings: schema?.defaultSettings ?? {}, content: schema?.defaultContent ?? {} };
});
const preset = (id) => PRESETS.find((p) => p.id === id);

test('two presets with the agreed sections, page types and message keys', () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ['editorial-home', 'projects-page']);
  const home = preset('editorial-home');
  assert.deepEqual(home.pageTypes, ['HOME', 'LANDING']);
  assert.equal(home.icon, 'layout');
  assert.deepEqual(home.i18n, { name: 'presetEditorialHomeName', description: 'presetEditorialHomeDesc' });
  assert.deepEqual(home.sections.map((s) => s.section_key), [
    'hero-split', 'trust-badges', 'category-tiles', 'featured-products', 'image-with-text',
  ]);
  const projects = preset('projects-page');
  assert.deepEqual(projects.pageTypes, ['STATIC', 'LANDING']);
  assert.equal(projects.icon, 'target');
  assert.deepEqual(projects.i18n, { name: 'presetProjectsPageName', description: 'presetProjectsPageDesc' });
  assert.deepEqual(projects.sections.map((s) => s.section_key), ['rich-text', 'progress-spotlight', 'project-cards']);
  for (const p of PRESETS) {
    assert.equal(p.gate, undefined);
    assert.equal(p.blockedBy, undefined);
    assert.ok(p.name.en && p.name.ar && p.description.en && p.description.ar, p.id);
  }
});

test('presets reference existing schemas and keep translatable keys in content, the rest in settings', () => {
  for (const p of PRESETS) {
    for (const s of p.sections) {
      const schema = findSectionSchema(s.section_key);
      assert.ok(schema, `${p.id}: schema ${s.section_key}`);
      const where = `${p.id}/${s.section_key}`;
      const known = new Set(keys(schema.schema));
      const translatable = new Set(schema.translatable);
      for (const [k, v] of Object.entries(s.settings)) {
        assert.ok(known.has(k), `${where}: unknown setting ${k}`);
        assert.ok(!translatable.has(k), `${where}: ${k} belongs in content`);
        const f = field(schema, k);
        if (f.type === 'select') assert.ok(optionValues(f).includes(v), `${where}: ${k} = ${v}`);
        if (f.type === 'boolean') assert.equal(typeof v, 'boolean', `${where}: ${k}`);
        if (f.type === 'number') {
          assert.equal(typeof v, 'number', `${where}: ${k}`);
          if (f.min !== undefined) assert.ok(v >= f.min, `${where}: ${k} min`);
          if (f.max !== undefined) assert.ok(v <= f.max, `${where}: ${k} max`);
        }
        // No images in a preset: the creator uploads their own.
        assert.notEqual(f.type, 'image', `${where}: ${k}`);
      }
      assert.deepEqual(Object.keys(s.content), ['en', 'ar', 'sv'], where);
      const enKeys = Object.keys(s.content.en).sort();
      for (const [locale, content] of Object.entries(s.content)) {
        assert.deepEqual(Object.keys(content).sort(), enKeys, `${where} ${locale}: same keys as en`);
        for (const [k, v] of Object.entries(content)) {
          assert.ok(translatable.has(k), `${where} ${locale}: ${k} belongs in settings`);
          const f = field(schema, k);
          if (f.type !== 'repeater') {
            assert.ok(typeof v === 'string' && v.trim(), `${where} ${locale}: ${k}`);
            if (f.maxLength) assert.ok(v.length <= f.maxLength, `${where} ${locale}: ${k} too long`);
            continue;
          }
          // Repeater items: known item keys, valid select values, no image, within the limit.
          const itemFields = Object.fromEntries(f.fields.map((x) => [x.key, x]));
          assert.equal(v.length, s.content.en[k].length, `${where} ${locale}: ${k} count`);
          if (f.maxItems) assert.ok(v.length <= f.maxItems, `${where} ${locale}: ${k} limit`);
          for (const item of v) {
            for (const [ik, iv] of Object.entries(item)) {
              const itemField = itemFields[ik];
              assert.ok(itemField, `${where} ${locale}: ${k}.${ik}`);
              assert.notEqual(itemField.type, 'image', `${where} ${locale}: ${k}.${ik}`);
              if (itemField.type === 'select') assert.ok(optionValues(itemField).includes(iv), `${where} ${locale}: ${k}.${ik} = ${iv}`);
              if (itemField.maxLength) assert.ok(String(iv).length <= itemField.maxLength, `${where} ${locale}: ${k}.${ik} too long`);
            }
          }
        }
      }
    }
  }
});

test('presets: the agreed settings of the variants, schema defaults for the new sections', () => {
  const [hero, trust, tiles, products, story] = preset('editorial-home').sections;
  assert.deepEqual(hero.settings, {
    variant: 'bleed',
    image_side: 'end',
    height: 'lg',
    image_width: 'half',
    image_focus: 'center',
    tone: 'surface',
    edge: 'soft',
    mobile_order: 'image-first',
    cta_tone: 'primary',
    cta_url: '/products',
    cta_secondary_url: '/',
  });
  assert.deepEqual(hero.content.en, {
    eyebrow: 'New season',
    heading: 'Made to be worn, kept and passed on',
    subheading: 'One or two lines about what you sell and why it is worth a closer look.',
    cta_text: 'Shop the collection',
    cta_secondary_text: 'Our story',
  });
  assert.deepEqual(trust.settings, { layout: 'strip', padding: 'compact' });
  assert.deepEqual(trust.content.en.items, [
    { icon: 'truck', label: 'Delivery', description: 'State your delivery terms' },
    { icon: 'refresh', label: 'Returns', description: 'State your return terms' },
    { icon: 'shield', label: 'Secure payment', description: 'Encrypted checkout' },
    { icon: 'headphones', label: 'Support', description: 'How customers reach you' },
  ]);
  // Same icons in every language.
  for (const locale of ['ar', 'sv']) {
    assert.deepEqual(trust.content[locale].items.map((i) => i.icon), ['truck', 'refresh', 'shield', 'headphones'], locale);
  }
  assert.deepEqual(products.settings, { filter: 'newest', aspect: 'portrait', limit: 8, columns: 4, columns_tablet: 3, columns_mobile: 2 });
  assert.deepEqual(products.content.en, { heading: 'New arrivals' });
  assert.deepEqual(story.settings, {
    image_style: 'bleed',
    image_position: 'right',
    aspect: 'landscape',
    min_height: 'md',
    tone: 'surface',
    edge: 'hard',
    cta_tone: 'primary',
  });
  assert.deepEqual(story.content.en, {
    eyebrow: 'Our story',
    heading: 'What we stand for',
    body: 'Two or three sentences about how your products are made and what matters to you.',
    cta_text: 'Read more',
  });

  const [intro, spotlight, cards] = preset('projects-page').sections;
  // The intro heading is the page's h1: nothing else on the page provides one.
  assert.deepEqual(intro.settings, { width: 'normal', alignment: 'left', padding: 'medium', surface: false, heading_level: 'h1' });
  assert.equal(findSectionSchema('rich-text').defaultSettings?.heading_level, undefined);
  assert.deepEqual(intro.content.en, {
    heading: 'Our projects',
    html: '<p>Explain what the projects are, how they are chosen and how results are reported.</p>',
  });

  for (const [section, id] of [[tiles, 'category-tiles'], [spotlight, 'progress-spotlight'], [cards, 'project-cards']]) {
    const schema = findSectionSchema(id);
    assert.deepEqual(section.settings, schema.defaultSettings, id);
    assert.deepEqual(section.content.en, schema.defaultContent, id);
    // Copies, not the schema's own objects.
    assert.notEqual(section.settings, schema.defaultSettings, id);
    assert.notEqual(section.content.en, schema.defaultContent, id);
  }
  // Project statuses and tile links are the same in every language.
  for (const locale of ['ar', 'sv']) {
    assert.deepEqual(cards.content[locale].items.map((i) => i.status), ['completed', 'in_progress', 'planned'], locale);
    assert.deepEqual(tiles.content[locale].items.map((i) => i.url), ['/products', '/products', '/products', '/products'], locale);
  }
  // The progress spotlight starts at zero: no progress is claimed.
  assert.equal(spotlight.settings.reached, 0);
});

test('message keys of the presets and of the repeater limit exist in the six locales', () => {
  for (const locale of LOCALES) {
    const file = fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url));
    const builder = JSON.parse(readFileSync(file, 'utf8')).builder;
    for (const p of PRESETS) {
      assert.ok(typeof builder[p.i18n.name] === 'string' && builder[p.i18n.name].trim(), `${locale} ${p.i18n.name}`);
      assert.ok(typeof builder[p.i18n.description] === 'string' && builder[p.i18n.description].trim(), `${locale} ${p.i18n.description}`);
    }
    assert.ok(builder.repeaterMaxItems.includes('{max}'), `${locale} repeaterMaxItems`);
  }
});

test('the three new sections have a preview in the Add section dialog', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../components/builder/SectionPreviews.tsx', import.meta.url)),
    'utf8',
  );
  assert.ok(source.includes("'category-tiles': CategoryTilesPreview"));
  assert.ok(source.includes("'progress-spotlight': ProgressSpotlightPreview"));
  assert.ok(source.includes("'project-cards': ProjectCardsPreview"));
});
