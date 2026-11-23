// Parity test of the M165 product link strings in all six dashboard locales.
// Run: node --experimental-strip-types --test src/lib/linkFieldI18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));

const KEYS = {
  'builder.linkField': [
    'modeLabel', 'modeCustom', 'modeProduct', 'searchProducts', 'noProductsFound', 'loading', 'loadFailed', 'retry',
    'change', 'remove', 'cancel', 'everyLanguageHint', 'statusDraft', 'statusArchived', 'notPublished', 'missingTitle',
    'missingBody', 'pickAnother', 'useCustom',
  ],
  'components.linkDialog': ['title', 'tabUrl', 'tabProduct', 'urlLabel', 'apply', 'removeLink', 'cancel'],
  'creator.menus': ['productLinkedHint', 'changeProduct', 'productMissing', 'productNotPublished'],
};

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

for (const locale of UI_LOCALES) {
  test(`${locale}: every M165 key exists and is not empty`, () => {
    const m = messages(locale);
    for (const [ns, keys] of Object.entries(KEYS)) {
      for (const key of keys) {
        const v = get(m, `${ns}.${key}`);
        assert.ok(typeof v === 'string' && v.trim().length > 0, `${locale}: ${ns}.${key}`);
      }
    }
  });
}

test('the key sets are identical across locales', () => {
  for (const ns of ['builder.linkField', 'components.linkDialog']) {
    const base = Object.keys(get(messages('en'), ns)).sort();
    for (const locale of UI_LOCALES) assert.deepEqual(Object.keys(get(messages(locale), ns)).sort(), base, `${locale} ${ns}`);
  }
});
