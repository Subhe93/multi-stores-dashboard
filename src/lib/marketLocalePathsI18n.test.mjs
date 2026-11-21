// Parity test of the M156 "Language-country URLs" strings: every key the
// editor and the error mapping use exists in all six dashboard locales, with
// the same ICU placeholders.
// Run: node --experimental-strip-types --test src/lib/marketLocalePathsI18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));

const EDITOR_KEYS = [
  'title', 'hint', 'enable', 'enableHint', 'empty', 'addRow', 'row', 'language', 'country', 'allCountries', 'url',
  'hreflang', 'plainCode', 'plainCodeTaken', 'status', 'active', 'inactiveLocaleNotEnabled', 'inactiveLocaleUnsupported',
  'inactiveCountry', 'moveUp', 'moveDown', 'remove', 'redirectSummary', 'rootSummary', 'rootSummaryWithPaths',
  'errorDuplicate', 'errorDefaultLocale', 'errorCountry', 'errorHreflang', 'errorSummary',
];

const ERROR_CODES = [
  'MARKET_LOCALE_PATH_INVALID',
  'MARKET_LOCALE_PATH_LANGUAGE_UNKNOWN',
  'MARKET_LOCALE_PATH_DEFAULT_LOCALE',
  'MARKET_LOCALE_PATH_MISMATCH',
  'MARKET_LOCALE_PATH_COUNTRY',
  'MARKET_LOCALE_PATH_DUPLICATE',
  'MARKET_LOCALE_PATH_HREFLANG',
];

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every editor key exists, non-empty, in all six locales (and nothing extra)', () => {
  for (const locale of UI_LOCALES) {
    const block = messages(locale).creator?.markets?.form?.localePaths;
    assert.ok(block, `${locale}: creator.markets.form.localePaths missing`);
    assert.deepEqual(Object.keys(block).sort(), [...EDITOR_KEYS].sort(), locale);
    for (const key of EDITOR_KEYS) assert.ok(typeof block[key] === 'string' && block[key].trim(), `${locale}.${key}`);
  }
});

test('every locale_paths error code is translated in all six locales', () => {
  for (const locale of UI_LOCALES) {
    const errors = messages(locale).errors;
    for (const code of ERROR_CODES) assert.ok(typeof errors[code] === 'string' && errors[code].trim(), `${locale}.errors.${code}`);
  }
});

test('ICU placeholders match English in every locale', () => {
  const en = messages('en').creator.markets.form.localePaths;
  for (const locale of UI_LOCALES) {
    const block = messages(locale).creator.markets.form.localePaths;
    for (const key of EDITOR_KEYS) assert.deepEqual(placeholders(block[key]), placeholders(en[key]), `${locale}.${key}`);
  }
});
