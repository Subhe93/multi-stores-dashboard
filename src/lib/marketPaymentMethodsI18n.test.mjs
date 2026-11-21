// Parity test of the M157 "Payment methods" strings: every key the editor,
// the payment check card, the markets list and the error mapping use exists
// in all six dashboard locales, with the same ICU placeholders.
// Run: node --experimental-strip-types --test src/lib/marketPaymentMethodsI18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));

const EDITOR_KEYS = [
  'title', 'hint', 'modeStore', 'modeStoreHint', 'modeStoreHintUnknown', 'storeNone', 'loading', 'modeCustom',
  'modeCustomHint', 'card', 'kustom', 'cod', 'unavailable', 'stale', 'testMode', 'appliesToNew', 'codOnly',
  'defaultMarketHint', 'loadFailed', 'retry', 'unsupported',
  'reasons.card_not_connected', 'reasons.kustom_not_configured', 'reasons.cod_disabled', 'reasons.not_independent',
  'links.card', 'links.kustom', 'links.cod', 'errors.empty', 'errorSummary',
];

const SUMMARY_KEYS = ['card', 'kustom', 'cod', 'cardKustom', 'cardCod', 'kustomCod', 'all'];

const ERROR_CODES = [
  'MARKET_PAYMENT_METHODS_INVALID',
  'MARKET_PAYMENT_METHODS_INVALID_UNKNOWN',
  'MARKET_PAYMENT_METHODS_INVALID_DUPLICATE',
  'MARKET_PAYMENT_METHODS_INVALID_EMPTY',
  'MARKET_PAYMENT_METHODS_NOT_READY',
  'MARKET_PAYMENT_METHOD_NOT_ALLOWED',
  'KUSTOM_CURRENCY_NOT_ENABLED',
];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const leaves = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

test('every editor key exists, non-empty, in all six locales (and nothing extra)', () => {
  for (const locale of UI_LOCALES) {
    const block = messages(locale).creator?.markets?.form?.paymentMethods;
    assert.ok(block, `${locale}: creator.markets.form.paymentMethods missing`);
    assert.deepEqual(leaves(block).sort(), [...EDITOR_KEYS].sort(), locale);
    for (const key of EDITOR_KEYS) assert.ok(nonEmpty(get(block, key)), `${locale}.${key}`);
  }
});

test('the list summary, the check card label and every reason key exist in all six locales', () => {
  for (const locale of UI_LOCALES) {
    const markets = messages(locale).creator.markets;
    for (const key of SUMMARY_KEYS) assert.ok(nonEmpty(markets.paymentMethods?.summary?.[key]), `${locale}.summary.${key}`);
    assert.ok(nonEmpty(markets.check?.notUsedInMarket), `${locale}.check.notUsedInMarket`);
  }
});

test('every M157 error code is translated in all six locales (flat keys)', () => {
  for (const locale of UI_LOCALES) {
    const errors = messages(locale).errors;
    for (const code of ERROR_CODES) assert.ok(nonEmpty(errors[code]), `${locale}.errors.${code}`);
  }
});

test('ICU placeholders match English in every locale', () => {
  const en = messages('en').creator.markets.form.paymentMethods;
  for (const locale of UI_LOCALES) {
    const block = messages(locale).creator.markets.form.paymentMethods;
    for (const key of EDITOR_KEYS) assert.deepEqual(placeholders(get(block, key)), placeholders(get(en, key)), `${locale}.${key}`);
  }
});
