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
