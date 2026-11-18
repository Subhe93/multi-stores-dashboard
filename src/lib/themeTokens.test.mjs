// Unit test of the optional theme tokens edited in the theme customizer: the
// Arabic fallback fonts (typography.fontFamilyArabic) and the button radius
// (spacing.radius.button). The names and the value rules are the contract
// shared with the storefront (multi-stores-web/src/lib/arabicFonts.ts,
// src/themes/tokens.ts).
// Run: node --experimental-strip-types --test src/lib/themeTokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ARABIC_FONT_FAMILIES,
  BUTTON_RADIUS_OPTIONS,
  arabicFontValue,
  buttonRadiusValue,
  withArabicFont,
  withButtonRadius,
} from './themeTokens.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

// A store that customized everything the customizer and an imported template
// can write, without the new keys.
const full = () => ({
  preset_id: 'editorial-serif',
  colors: { primary: '#111111', accent: '#b45309', muted: '#6b7280' },
  typography: {
    fontFamily: { heading: 'Playfair Display', body: 'Inter' },
    scale: { base: '16px', h1: '48px' },
    lineHeight: { tight: '1.1', normal: '1.6' },
    fontWeight: { regular: 400, bold: 700 },
  },
  spacing: {
    radius: { sm: '2px', md: '4px', lg: '8px', full: '9999px' },
    shadow: { sm: 'none' },
    containerMaxWidth: '1200px',
  },
  product: { swatchShape: 'square' },
  customCss: '.store-root h1 { letter-spacing: 0.02em; }',
});

test('the six Arabic families and the four button shapes are pinned', () => {
  assert.deepEqual([...ARABIC_FONT_FAMILIES], [
    'Noto Naskh Arabic',
    'Markazi Text',
    'Noto Kufi Arabic',
    'Noto Sans Arabic',
    'IBM Plex Sans Arabic',
    'Cairo',
  ]);
  assert.deepEqual([...BUTTON_RADIUS_OPTIONS], ['0px', '4px', '8px', '9999px']);
});

test('unset reads as an empty string', () => {
  for (const tokens of [undefined, null, {}, full(), { typography: {} }, { typography: { fontFamilyArabic: {} } }, { spacing: {} }, { spacing: { radius: {} } }]) {
    assert.equal(arabicFontValue(tokens, 'heading'), '');
    assert.equal(arabicFontValue(tokens, 'body'), '');
    assert.equal(buttonRadiusValue(tokens), '');
  }
});

test('arabicFontValue returns an allow-listed name only (compared after trim)', () => {
  for (const family of ARABIC_FONT_FAMILIES) {
    assert.equal(arabicFontValue({ typography: { fontFamilyArabic: { heading: family } } }, 'heading'), family);
    assert.equal(arabicFontValue({ typography: { fontFamilyArabic: { body: `  ${family} ` } } }, 'body'), family);
  }
  // The two slots are independent.
  const tokens = { typography: { fontFamilyArabic: { heading: 'Cairo' } } };
  assert.equal(arabicFontValue(tokens, 'heading'), 'Cairo');
  assert.equal(arabicFontValue(tokens, 'body'), '');
  // Invalid stored values read as unset.
  for (const bad of ['', '   ', 'Comic Sans', 'cairo', 'Amiri', 'Playfair Display', 5, null, true, ['Cairo'], { name: 'Cairo' }]) {
    assert.equal(arabicFontValue({ typography: { fontFamilyArabic: { heading: bad } } }, 'heading'), '', String(bad));
  }
  for (const bad of ['Cairo', 5, null, ['Cairo']]) {
    assert.equal(arabicFontValue({ typography: { fontFamilyArabic: bad } }, 'heading'), '', String(bad));
    assert.equal(arabicFontValue({ typography: bad }, 'heading'), '', String(bad));
  }
  // The Latin slot is never read as the Arabic one.
  assert.equal(arabicFontValue({ typography: { fontFamily: { heading: 'Cairo' } } }, 'heading'), '');
});

test('buttonRadiusValue returns a px string of one to four digits only', () => {
  for (const good of ['0px', '4px', '8px', '12px', '999px', '9999px']) {
    assert.equal(buttonRadiusValue({ spacing: { radius: { button: good } } }), good);
  }
  for (const bad of ['', '12', 'px', '12 px', ' 12px', '12px ', '-4px', '1.5px', '10000px', '1rem', '50%', '1px;}body{', '12PX', 12, null, true, ['4px']]) {
    assert.equal(buttonRadiusValue({ spacing: { radius: { button: bad } } }), '', String(bad));
  }
  for (const bad of ['4px', 4, null, ['4px']]) {
    assert.equal(buttonRadiusValue({ spacing: { radius: bad } }), '', String(bad));
    assert.equal(buttonRadiusValue({ spacing: bad }), '', String(bad));
  }
  // The sibling radius tokens are not the button radius.
  assert.equal(buttonRadiusValue({ spacing: { radius: { full: '9999px', sm: '2px' } } }), '');
});

test('withArabicFont sets a slot and keeps every other key', () => {
  const before = full();
  const heading = withArabicFont(before, 'heading', 'Noto Naskh Arabic');
  assert.deepEqual(heading, {
    ...full(),
    typography: { ...full().typography, fontFamilyArabic: { heading: 'Noto Naskh Arabic' } },
  });
  const both = withArabicFont(heading, 'body', 'Noto Sans Arabic');
  assert.deepEqual(both.typography.fontFamilyArabic, { heading: 'Noto Naskh Arabic', body: 'Noto Sans Arabic' });
  // The Latin fonts are a sibling and stay as they were.
  assert.deepEqual(both.typography.fontFamily, { heading: 'Playfair Display', body: 'Inter' });
  assert.deepEqual(both.spacing, full().spacing);
  // Replacing a slot keeps the other one.
  assert.deepEqual(withArabicFont(both, 'heading', 'Cairo').typography.fontFamilyArabic, {
    heading: 'Cairo',
    body: 'Noto Sans Arabic',
  });
  // The inputs are not mutated.
  assert.deepEqual(before, full());
  assert.deepEqual(heading.typography.fontFamilyArabic, { heading: 'Noto Naskh Arabic' });
  // A store with no customizations at all.
  assert.deepEqual(withArabicFont({}, 'body', 'Cairo'), { typography: { fontFamilyArabic: { body: 'Cairo' } } });
  // The stored name is the trimmed one.
  assert.deepEqual(withArabicFont({}, 'body', ' Cairo '), { typography: { fontFamilyArabic: { body: 'Cairo' } } });
});

test('withArabicFont: an empty value deletes the key and prunes what it emptied', () => {
  const both = withArabicFont(withArabicFont(full(), 'heading', 'Cairo'), 'body', 'Markazi Text');
  const bodyOnly = withArabicFont(both, 'heading', '');
  assert.deepEqual(bodyOnly.typography.fontFamilyArabic, { body: 'Markazi Text' });
  // Clearing the last slot removes fontFamilyArabic: the object is as before the feature.
  const none = withArabicFont(bodyOnly, 'body', '');
  assert.deepEqual(none, full());
  assert.equal('fontFamilyArabic' in none.typography, false);
  // typography goes too when the Arabic font was all it held.
  assert.deepEqual(withArabicFont({ colors: { primary: '#000' }, typography: { fontFamilyArabic: { heading: 'Cairo' } } }, 'heading', ''), {
    colors: { primary: '#000' },
  });
  // An invalid stored value can be cleared the same way.
  assert.deepEqual(withArabicFont({ typography: { fontFamilyArabic: { heading: 'Comic Sans' } } }, 'heading', ''), {});
  // Nothing invalid is written: a name outside the six clears the slot.
  assert.deepEqual(withArabicFont(both, 'heading', 'Comic Sans').typography.fontFamilyArabic, { body: 'Markazi Text' });
});

test('withButtonRadius sets the key and keeps every other key', () => {
  const before = full();
  const after = withButtonRadius(before, '0px');
  assert.deepEqual(after, {
    ...full(),
    spacing: { ...full().spacing, radius: { ...full().spacing.radius, button: '0px' } },
  });
  // The sibling radius tokens, shadow and container width are untouched.
  assert.deepEqual(after.spacing.radius, { sm: '2px', md: '4px', lg: '8px', full: '9999px', button: '0px' });
  assert.deepEqual(after.typography, full().typography);
  assert.deepEqual(before, full());
  for (const value of [...BUTTON_RADIUS_OPTIONS, '12px']) {
    assert.deepEqual(withButtonRadius({}, value), { spacing: { radius: { button: value } } });
    assert.equal(buttonRadiusValue(withButtonRadius(full(), value)), value);
  }
});

test('withButtonRadius: an empty value deletes the key and prunes what it emptied', () => {
  const set = withButtonRadius(full(), '8px');
  const cleared = withButtonRadius(set, '');
  assert.deepEqual(cleared, full());
  assert.equal('button' in cleared.spacing.radius, false);
  // radius and spacing go when the button radius was all they held.
  assert.deepEqual(withButtonRadius({ colors: { primary: '#000' }, spacing: { radius: { button: '4px' } } }, ''), {
    colors: { primary: '#000' },
  });
  assert.deepEqual(withButtonRadius({ spacing: { radius: { button: '4px' }, shadow: { sm: 'none' } } }, ''), {
    spacing: { shadow: { sm: 'none' } },
  });
  // Nothing invalid is written.
  for (const bad of ['12', '1px;}body{', '10000px', '1rem']) {
    assert.deepEqual(withButtonRadius(set, bad), full(), bad);
    assert.deepEqual(withButtonRadius({}, bad), {}, bad);
  }
});

test('clearing a key that was never set returns a deep-equal object', () => {
  const inputs = [
    {},
    full(),
    { typography: {} },
    { typography: { fontFamily: {} } },
    { typography: { fontFamilyArabic: {} } },
    { typography: { fontFamilyArabic: { body: 'Cairo' } } },
    { spacing: {} },
    { spacing: { radius: {} } },
    { spacing: { radius: { full: '9999px' } } },
    { colors: {}, product: {}, customCss: 'a{}' },
  ];
  for (const input of inputs) {
    const copy = structuredClone(input);
    const after = withButtonRadius(withArabicFont(input, 'heading', ''), '');
    assert.deepEqual(after, copy);
    // Same keys in the same order: the saved JSON is the same text.
    assert.equal(JSON.stringify(after), JSON.stringify(copy));
    assert.deepEqual(input, copy);
    // A copy, as with the other customizer setters.
    assert.notEqual(after, input);
  }
});

test('set then clear restores the saved JSON text of a store without the keys', () => {
  const before = JSON.stringify(full());
  let tokens = full();
  tokens = withArabicFont(tokens, 'heading', 'Noto Naskh Arabic');
  tokens = withArabicFont(tokens, 'body', 'Noto Naskh Arabic');
  tokens = withButtonRadius(tokens, '9999px');
  assert.notEqual(JSON.stringify(tokens), before);
  tokens = withButtonRadius(tokens, '');
  tokens = withArabicFont(tokens, 'body', '');
  tokens = withArabicFont(tokens, 'heading', '');
  assert.equal(JSON.stringify(tokens), before);
});

test('the customizer message keys exist in the six locales', () => {
  const keys = [
    'arabicHeadingFont', 'arabicBodyFont', 'arabicFontNone', 'arabicFontHint',
    'buttons', 'buttonShape', 'buttonShapeHint',
    'buttonShapeSquare', 'buttonShapeSlight', 'buttonShapeRounded', 'buttonShapePill', 'buttonShapeCustom',
  ];
  for (const locale of LOCALES) {
    const file = fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url));
    const builder = JSON.parse(readFileSync(file, 'utf8')).builder;
    for (const key of keys) {
      assert.ok(typeof builder[key] === 'string' && builder[key].trim(), `${locale} ${key}`);
    }
    assert.ok(builder.buttonShapeCustom.includes('{value}'), `${locale} buttonShapeCustom`);
    // No other placeholder in the new texts.
    for (const key of keys.filter((k) => k !== 'buttonShapeCustom')) {
      assert.ok(!/[{}]/.test(builder[key]), `${locale} ${key}`);
    }
  }
  const en = JSON.parse(
    readFileSync(fileURLToPath(new URL('../i18n/messages/en.json', import.meta.url)), 'utf8'),
  ).builder;
  assert.equal(en.arabicHeadingFont, 'Arabic heading font');
  assert.equal(en.arabicBodyFont, 'Arabic body font');
  assert.equal(en.arabicFontNone, 'None (device font)');
  assert.equal(en.buttonShapeCustom, 'Custom ({value})');
});

test('the customizer offers the Arabic fonts and the button shape through the helpers', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../components/builder/ThemeCustomizer.tsx', import.meta.url)),
    'utf8',
  );
  for (const name of ['withArabicFont(draft, slot, v)', 'withButtonRadius(draft, v)', "arabicFontValue(draft, 'heading')", "arabicFontValue(draft, 'body')", 'buttonRadiusValue(draft)']) {
    assert.ok(source.includes(name), name);
  }
  // Right-to-left: no physical side classes in the customizer.
  assert.equal(/\b(?:ml|mr|pl|pr|left|right)-\d/.test(source), false);
});

// ── Look reset keeps the store's own settings (same vectors as the API) ────

test('keepOwnerSettings keeps the custom CSS, motion and product.card only', async () => {
  const { keepOwnerSettings } = await import('./themeTokens.ts');
  assert.deepEqual(
    keepOwnerSettings({
      colors: { primary: '#111111' },
      customCss: 'a{}',
      motion: { reveal: 'off' },
      product: { swatchShape: 'square', card: { x: 1 } },
    }),
    { customCss: 'a{}', motion: { reveal: 'off' }, product: { card: { x: 1 } } },
  );
  for (const input of [{ motion: {} }, { motion: [] }, { product: { swatchShape: 'square' } }, null, 'x', undefined, [], { customCss: '   ' }, { product: { card: null } }, { product: 'card' }]) {
    assert.deepEqual(keepOwnerSettings(input), {}, JSON.stringify(input));
  }
  // Each key is kept on its own.
  assert.deepEqual(keepOwnerSettings({ motion: { zoom: 'subtle' }, colors: {} }), { motion: { zoom: 'subtle' } });
  assert.deepEqual(keepOwnerSettings({ product: { card: false } }), { product: { card: false } });
  assert.deepEqual(keepOwnerSettings(full()), { customCss: full().customCss });
  // The input is not mutated.
  const before = { ...full(), motion: { reveal: 'calm' } };
  const copy = structuredClone(before);
  keepOwnerSettings(before);
  assert.deepEqual(before, copy);
});

test('hasLookOverrides ignores the custom CSS, motion, product.card and preset_id', async () => {
  const { hasLookOverrides, keepOwnerSettings } = await import('./themeTokens.ts');
  for (const input of [
    undefined, null, 'x', [], {},
    { customCss: 'a{}' },
    { motion: { reveal: 'off' } },
    { product: { card: { x: 1 } } },
    { preset_id: 'editorial-serif' },
    { customCss: 'a{}', motion: { zoom: 'off' }, product: { card: 1 }, preset_id: 'p' },
  ]) {
    assert.equal(hasLookOverrides(input), false, JSON.stringify(input));
  }
  for (const input of [
    full(),
    { colors: { primary: '#000' } },
    { colors: {} },
    { typography: { fontFamily: { heading: 'Inter' } } },
    { product: { swatchShape: 'square' } },
    { product: { swatchShape: 'square', card: { x: 1 } } },
    { product: {} },
    { motion: { reveal: 'off' }, spacing: { radius: { button: '0px' } } },
  ]) {
    assert.equal(hasLookOverrides(input), true, JSON.stringify(input));
  }
  // What a reset keeps is never a look override.
  assert.equal(hasLookOverrides(keepOwnerSettings({ ...full(), motion: { reveal: 'off' }, product: { swatchShape: 'square', card: { x: 1 } } })), false);
});

test('the customizer reset and the builder theme switch keep the owner settings', () => {
  const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const customizer = read('../components/builder/ThemeCustomizer.tsx');
  assert.ok(customizer.includes('apply(keepOwnerSettings(draft)'), 'customizer reset');
  const builder = read('../components/builder/BuilderLayout.tsx');
  assert.ok(builder.includes('setThemeCustomizations((prev) => keepOwnerSettings(prev)'), 'theme switch mirror');
  assert.ok(builder.includes('hasLookOverrides(themeCustomizations)'), 'customized flag');
});

// ── Product card (store.theme_customizations.product.card) ─────────────────
// Mirror of multi-stores-web/src/lib/productCard/settings.ts: the object
// exists = the enhanced card; only what the owner chose is stored.

const CARD_OFF = {
  enabled: false,
  style: 'classic',
  aspect: '',
  corners: '',
  hover_image: false,
  swatches: false,
  sizes_line: false,
  availability: 'off',
  low_stock_threshold: 3,
  badge: 'percent',
  quick_add: false,
};

test('product card: the value lists, the cap and the defaults are the storefront contract', async () => {
  const m = await import('./themeTokens.ts');
  assert.deepEqual([...m.CARD_STYLES], ['classic', 'editorial']);
  assert.deepEqual([...m.CARD_ASPECTS], ['square', 'portrait', 'landscape']);
  assert.deepEqual([...m.CARD_CORNERS], ['theme', 'square']);
  assert.deepEqual([...m.CARD_AVAILABILITY], ['off', 'sold_out', 'sold_out_and_low']);
  assert.deepEqual([...m.CARD_BADGES], ['percent', 'sale', 'none']);
  assert.equal(m.LOW_STOCK_CAP, 10);
  assert.equal(m.LOW_STOCK_DEFAULT, 3);
  assert.deepEqual(m.cardStyleDefaults('classic'), { aspect: 'square', corners: 'theme' });
  assert.deepEqual(m.cardStyleDefaults('editorial'), { aspect: 'portrait', corners: 'square' });
});

test('product card: anything but a plain card object reads as off', async () => {
  const { productCardValue } = await import('./themeTokens.ts');
  for (const tokens of [
    undefined,
    null,
    {},
    full(),
    { product: null },
    { product: 'card' },
    { product: {} },
    { product: { swatchShape: 'square' } },
    { product: { card: null } },
    { product: { card: true } },
    { product: { card: 'editorial' } },
    { product: { card: [] } },
  ]) {
    assert.deepEqual(productCardValue(tokens), CARD_OFF, JSON.stringify(tokens));
  }
});

test('product card: an empty object is on with every default; junk values fall back', async () => {
  const { productCardValue } = await import('./themeTokens.ts');
  assert.deepEqual(productCardValue({ product: { card: {} } }), { ...CARD_OFF, enabled: true });
  assert.deepEqual(
    productCardValue({
      product: {
        card: {
          style: 'fancy', aspect: 'wide', corners: 1, hover_image: 'true', swatches: 1, sizes_line: null,
          availability: 'low', low_stock_threshold: 'x', badge: 'big', quick_add: 'yes',
        },
      },
    }),
    { ...CARD_OFF, enabled: true },
  );
  assert.deepEqual(
    productCardValue({
      product: {
        card: {
          style: 'editorial', aspect: 'landscape', corners: 'theme', hover_image: true, swatches: true, sizes_line: true,
          availability: 'sold_out_and_low', low_stock_threshold: 5, badge: 'sale', quick_add: true,
        },
      },
    }),
    {
      enabled: true, style: 'editorial', aspect: 'landscape', corners: 'theme', hover_image: true, swatches: true,
      sizes_line: true, availability: 'sold_out_and_low', low_stock_threshold: 5, badge: 'sale', quick_add: true,
    },
  );
  // The threshold is clamped to 1..10, as the storefront reads it.
  assert.equal(productCardValue({ product: { card: { low_stock_threshold: 25 } } }).low_stock_threshold, 10);
  assert.equal(productCardValue({ product: { card: { low_stock_threshold: 0 } } }).low_stock_threshold, 1);
  assert.equal(productCardValue({ product: { card: { low_stock_threshold: 2.5 } } }).low_stock_threshold, 3);
});

test('product card: switching on stores {} and nothing else moves', async () => {
  const { withProductCard } = await import('./themeTokens.ts');
  const before = full();
  const on = withProductCard(before, { enabled: true });
  assert.deepEqual(on, { ...full(), product: { swatchShape: 'square', card: {} } });
  assert.deepEqual(before, full(), 'input not mutated');
  assert.deepEqual(withProductCard({}, { enabled: true }), { product: { card: {} } });
  assert.deepEqual(withProductCard({ product: 'junk' }, { enabled: true }), { product: { card: {} } });
});

test('product card: only what differs from the default is stored', async () => {
  const { withProductCard } = await import('./themeTokens.ts');
  let t = withProductCard({}, { enabled: true });
  t = withProductCard(t, { style: 'editorial' });
  assert.deepEqual(t, { product: { card: { style: 'editorial' } } });
  t = withProductCard(t, { hover_image: true, swatches: true, sizes_line: true, quick_add: true });
  t = withProductCard(t, { availability: 'sold_out_and_low', low_stock_threshold: 2, badge: 'sale' });
  t = withProductCard(t, { aspect: 'portrait', corners: 'theme' });
  assert.deepEqual(t.product.card, {
    style: 'editorial', aspect: 'portrait', corners: 'theme', hover_image: true, swatches: true, sizes_line: true,
    availability: 'sold_out_and_low', low_stock_threshold: 2, badge: 'sale', quick_add: true,
  });
  // Back to every default: the object stays (still opted in) and is empty.
  t = withProductCard(t, {
    style: 'classic', aspect: '', corners: '', hover_image: false, swatches: false, sizes_line: false,
    availability: 'off', low_stock_threshold: 3, badge: 'percent', quick_add: false,
  });
  assert.deepEqual(t, { product: { card: {} } });
  // Out-of-range and junk patches never reach the store.
  assert.deepEqual(withProductCard(t, { low_stock_threshold: 99 }).product.card, { low_stock_threshold: 10 });
  assert.deepEqual(withProductCard(t, { low_stock_threshold: -4 }).product.card, { low_stock_threshold: 1 });
  assert.deepEqual(withProductCard(t, { style: 'fancy', badge: 'big', aspect: 'wide' }).product.card, {});
});

test('product card: switching off removes the key and prunes an emptied product', async () => {
  const { withProductCard, keepOwnerSettings, hasLookOverrides } = await import('./themeTokens.ts');
  const stored = { ...full(), product: { swatchShape: 'square', card: { style: 'editorial', quick_add: true } } };
  assert.deepEqual(withProductCard(stored, { enabled: false }), full());
  assert.deepEqual(withProductCard({ product: { card: {} } }, { enabled: false }), {});
  assert.deepEqual(withProductCard({ colors: {}, product: { card: { style: 'editorial' } } }, { enabled: false }), { colors: {} });
  // Nothing stored: the copy is deep-equal to the input.
  assert.deepEqual(withProductCard(full(), { enabled: false }), full());
  assert.deepEqual(withProductCard({ product: 'junk' }, { enabled: false }), { product: 'junk' });
  // Keys the editor does not know survive an edit.
  assert.deepEqual(
    withProductCard({ product: { card: { future: 1, style: 'editorial' } } }, { style: 'classic' }).product.card,
    { future: 1 },
  );
  // The card is a store setting: a look reset keeps it and it is not a look override.
  const on = withProductCard({ colors: { primary: '#000' } }, { enabled: true, style: 'editorial' });
  assert.deepEqual(keepOwnerSettings(on), { product: { card: { style: 'editorial' } } });
  assert.equal(hasLookOverrides(keepOwnerSettings(on)), false);
});

test('product card: the customizer edits it through the helpers, with texts in six locales', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../components/builder/ThemeCustomizer.tsx', import.meta.url)),
    'utf8',
  );
  for (const name of ['productCardValue(draft)', 'withProductCard(draft, patch)', "t('card.lowStockThresholdHint', { max: LOW_STOCK_CAP })"]) {
    assert.ok(source.includes(name), name);
  }
  // Every card.* key the customizer names exists, non-empty, in every locale.
  const used = new Set([...source.matchAll(/'card\.([A-Za-z]+)'/g)].map((m) => m[1]));
  assert.ok(used.size >= 30, `card keys used: ${used.size}`);
  const en = JSON.parse(readFileSync(fileURLToPath(new URL('../i18n/messages/en.json', import.meta.url)), 'utf8')).builder.card;
  for (const locale of LOCALES) {
    const file = fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url));
    const card = JSON.parse(readFileSync(file, 'utf8')).builder.card;
    assert.deepEqual(Object.keys(card), Object.keys(en), `${locale} key set`);
    for (const key of used) assert.ok(typeof card[key] === 'string' && card[key].trim(), `${locale} card.${key}`);
    for (const [key, text] of Object.entries(card)) {
      const placeholders = text.match(/\{[^}]*\}/g) ?? [];
      assert.deepEqual(placeholders, key === 'lowStockThresholdHint' ? ['{max}'] : [], `${locale} card.${key}`);
    }
  }
  for (const key of Object.keys(en)) assert.ok(used.has(key), `unused key card.${key}`);
});
