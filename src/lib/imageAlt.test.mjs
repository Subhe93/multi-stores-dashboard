// Unit test of the product image alt text form helpers (M170 A), and the
// parity of its strings in the six dashboard locales.
// Run: node --experimental-strip-types --test src/lib/imageAlt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  IMAGE_ALT_MAX,
  altFilledLocales,
  altTranslationsPayload,
  altTranslationsSnapshot,
  altValueFor,
  readAltTranslations,
  withImageAlt,
} from './imageAlt.ts';

const img = (extra = {}) => ({ id: 'i1', url: '/uploads/products/a.webp', ...extra });

test('the limit matches the API', () => {
  assert.equal(IMAGE_ALT_MAX, 300);
});

test('altValueFor: the primary language reads alt_text, others their map key', () => {
  const image = img({ alt_text: 'Röd häst', alt_translations: { de: 'Rotes Pferd' } });
  assert.equal(altValueFor(image, 'sv', 'sv'), 'Röd häst');
  assert.equal(altValueFor(image, 'de', 'sv'), 'Rotes Pferd');
  assert.equal(altValueFor(image, 'fr', 'sv'), '');
  assert.equal(altValueFor(img(), 'sv', 'sv'), '');
  assert.equal(altValueFor(img({ alt_text: null, alt_translations: null }), 'de', 'sv'), '');
});

test('altValueFor: a primary-language key in the map is never shown for the primary language', () => {
  const image = img({ alt_text: 'Default', alt_translations: { sv: 'Shadow' } });
  assert.equal(altValueFor(image, 'sv', 'sv'), 'Default');
});

test('withImageAlt: the primary language edits alt_text only', () => {
  const image = img({ alt_text: 'Old', alt_translations: { de: 'Pferd' } });
  const next = withImageAlt(image, 'sv', 'sv', 'New text ');
  assert.equal(next.alt_text, 'New text ');
  assert.deepEqual(next.alt_translations, { de: 'Pferd' });
  assert.equal(next.id, 'i1');
  // The input is not mutated.
  assert.equal(image.alt_text, 'Old');
});

test('withImageAlt: another language edits its map key; emptying removes it', () => {
  const image = img({ alt_text: 'Default', alt_translations: { de: 'Pferd' } });
  const en = withImageAlt(image, 'en', 'sv', 'Horse');
  assert.deepEqual(en.alt_translations, { de: 'Pferd', en: 'Horse' });
  assert.equal(en.alt_text, 'Default');
  const cleared = withImageAlt(en, 'de', 'sv', '');
  assert.deepEqual(cleared.alt_translations, { en: 'Horse' });
  assert.equal(withImageAlt(cleared, 'en', 'sv', '').alt_translations, null);
  assert.deepEqual(image.alt_translations, { de: 'Pferd' });
});

test('withImageAlt: typing keeps spaces (trimmed only when saved)', () => {
  const next = withImageAlt(img(), 'de', 'sv', 'Rotes ');
  assert.deepEqual(next.alt_translations, { de: 'Rotes ' });
  assert.deepEqual(altTranslationsPayload(next, 'sv'), { de: 'Rotes' });
});

test('altTranslationsPayload: trimmed, whitespace collapsed, empties dropped, null when empty', () => {
  assert.deepEqual(
    altTranslationsPayload(img({ alt_translations: { de: '  Rotes   Pferd ', en: '   ', fr: 'Cheval' } }), 'sv'),
    { de: 'Rotes Pferd', fr: 'Cheval' },
  );
  assert.equal(altTranslationsPayload(img({ alt_translations: { de: ' ' } }), 'sv'), null);
  assert.equal(altTranslationsPayload(img({ alt_translations: {} }), 'sv'), null);
  assert.equal(altTranslationsPayload(img({ alt_translations: null }), 'sv'), null);
  assert.equal(altTranslationsPayload(img(), 'sv'), null);
});

test('altTranslationsPayload: the primary-language key is never sent', () => {
  assert.deepEqual(altTranslationsPayload(img({ alt_translations: { sv: 'Häst', de: 'Pferd' } }), 'sv'), { de: 'Pferd' });
  assert.equal(altTranslationsPayload(img({ alt_translations: { sv: 'Häst' } }), 'sv'), null);
});

test('altTranslationsPayload: languages the store no longer lists are kept', () => {
  assert.deepEqual(altTranslationsPayload(img({ alt_translations: { nb: 'Hest' } }), 'sv'), { nb: 'Hest' });
});

test('readAltTranslations: non-string values and non-objects are dropped', () => {
  assert.deepEqual(readAltTranslations({ de: 'Pferd', en: 5, fr: null }), { de: 'Pferd' });
  assert.deepEqual(readAltTranslations(null), {});
  assert.deepEqual(readAltTranslations(['de']), {});
  assert.deepEqual(readAltTranslations('de'), {});
});

test('altTranslationsSnapshot: the same texts give the same snapshot whatever the key order', () => {
  const a = altTranslationsSnapshot(img({ alt_translations: { en: 'Horse', de: 'Pferd ' } }), 'sv');
  const b = altTranslationsSnapshot(img({ alt_translations: { de: 'Pferd', en: 'Horse', fr: '' } }), 'sv');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(altTranslationsSnapshot(img(), 'sv'), {});
  assert.deepEqual(altTranslationsSnapshot(img({ alt_translations: null }), 'sv'), {});
  assert.notEqual(
    JSON.stringify(altTranslationsSnapshot(img({ alt_translations: { de: 'Pferd' } }), 'sv')),
    JSON.stringify(altTranslationsSnapshot(img({ alt_translations: { de: 'Ross' } }), 'sv')),
  );
});

test('altFilledLocales: a language is filled when any image has its alt', () => {
  const images = [img({ alt_text: 'Häst' }), img({ alt_translations: { de: 'Pferd', fr: '  ' } })];
  assert.deepEqual(altFilledLocales(images, ['sv', 'de', 'fr', 'en'], 'sv'), { sv: true, de: true, fr: false, en: false });
  assert.deepEqual(altFilledLocales([], ['sv', 'de'], 'sv'), { sv: false, de: false });
});

// ── i18n parity ───────────────────────────────────────────

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const IMAGE_KEYS = ['altTitle', 'altHelpPrimary', 'altHelpLocale', 'altInputLabel', 'altPlaceholder', 'altCounter'];
const ERROR_CODE = 'PRODUCT_IMAGE_ALT_INVALID';

const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

test('every alt text key exists, non-empty, in all six locales with the same placeholders', () => {
  const en = messages('en');
  for (const locale of UI_LOCALES) {
    const m = messages(locale);
    for (const key of IMAGE_KEYS) {
      assert.ok(nonEmpty(m.image?.[key]), `${locale}.image.${key}`);
      assert.deepEqual(placeholders(m.image[key]), placeholders(en.image[key]), `${locale}.image.${key} placeholders`);
    }
    assert.ok(nonEmpty(m.errors?.[ERROR_CODE]), `${locale}.errors.${ERROR_CODE}`);
    assert.ok(m.errors[ERROR_CODE].includes(String(IMAGE_ALT_MAX)), `${locale}.errors.${ERROR_CODE} names the limit`);
  }
});

test('the error key sits directly after the option label errors in all six files', () => {
  for (const locale of UI_LOCALES) {
    const keys = Object.keys(messages(locale).errors);
    const at = keys.indexOf(ERROR_CODE);
    assert.equal(keys[at - 1], 'PRODUCT_OPTION_LABELS_PRIMARY_LOCALE', locale);
  }
});

test('the non-English locales are translated (not a copy of the English text)', () => {
  const en = messages('en');
  for (const locale of UI_LOCALES.filter((l) => l !== 'en')) {
    const m = messages(locale);
    for (const key of ['altTitle', 'altHelpPrimary', 'altHelpLocale', 'altInputLabel', 'altPlaceholder']) {
      assert.notEqual(m.image[key], en.image[key], `${locale}.image.${key}`);
    }
    assert.notEqual(m.errors[ERROR_CODE], en.errors[ERROR_CODE], locale);
  }
});
