// Unit test of the creator "outside the platform" earnings helpers.
// Run: node --experimental-strip-types --test src/lib/creatorEarnings.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isOfflineEarning, offlineHintRows } from './creatorEarnings.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

test('only a cash-on-delivery order of a marketplace store is offline', () => {
  assert.equal(isOfflineEarning({ payment_method: 'COD' }, 'MARKETPLACE'), true);
  // Independent stores keep the display they had: the cash is their own revenue.
  assert.equal(isOfflineEarning({ payment_method: 'COD' }, 'INDEPENDENT'), false);
  // Store type still loading: nothing changes.
  assert.equal(isOfflineEarning({ payment_method: 'COD' }, null), false);
  assert.equal(isOfflineEarning({ payment_method: 'COD' }, undefined), false);
  for (const method of ['STRIPE', 'KUSTOM', '', null, undefined, 'cod']) {
    assert.equal(isOfflineEarning({ payment_method: method }, 'MARKETPLACE'), false, String(method));
  }
  assert.equal(isOfflineEarning(null, 'MARKETPLACE'), false);
  assert.equal(isOfflineEarning({}, 'MARKETPLACE'), false);
});

test('no offline field (API not deployed yet) gives no hint', () => {
  assert.deepEqual(offlineHintRows(null), []);
  assert.deepEqual(offlineHintRows(undefined), []);
  assert.deepEqual(offlineHintRows({}), []);
  assert.deepEqual(offlineHintRows({ by_currency: [{ currency: 'EUR' }] }), []);
  assert.deepEqual(offlineHintRows({ offline: 0, by_currency: [{ currency: 'EUR', offline: 0 }] }), []);
  assert.deepEqual(offlineHintRows({ offline: -5 }), []);
  assert.deepEqual(offlineHintRows({ offline: 'x' }), []);
  assert.deepEqual(offlineHintRows({ by_currency: null }), []);
});

test('one currency: one row with the summary amount', () => {
  assert.deepEqual(offlineHintRows({ offline: 12.5, by_currency: [{ currency: 'EUR', offline: 12.5 }] }), [
    { currency: null, amount: 12.5 },
  ]);
  assert.deepEqual(offlineHintRows({ offline: '7.25' }), [{ currency: null, amount: 7.25 }]);
  // Only the per-currency row carries the amount.
  assert.deepEqual(offlineHintRows({ by_currency: [{ currency: 'EUR', offline: 3 }] }), [{ currency: 'EUR', amount: 3 }]);
});

test('several currencies: one row per currency with an offline amount', () => {
  assert.deepEqual(
    offlineHintRows({
      offline: 30,
      by_currency: [
        { currency: 'EUR', offline: 10 },
        { currency: 'SEK', offline: 0 },
        { currency: 'USD', offline: 20 },
      ],
    }),
    [
      { currency: 'EUR', amount: 10 },
      { currency: 'USD', amount: 20 },
    ],
  );
  assert.deepEqual(offlineHintRows({ offline: 0, by_currency: [{ currency: 'EUR' }, { currency: 'SEK' }] }), []);
});

test('the texts exist in the six locales', () => {
  for (const locale of LOCALES) {
    const file = fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url));
    const messages = JSON.parse(readFileSync(file, 'utf8'));
    const earnings = messages.creator.earnings;
    for (const key of ['statusOffline', 'statusOfflineTitle', 'offlineHint']) {
      assert.ok(typeof earnings[key] === 'string' && earnings[key].trim(), `${locale} ${key}`);
    }
    assert.ok(earnings.offlineHint.includes('{amount}'), `${locale} offlineHint`);
    assert.ok(typeof messages.payments.statusOutsidePlatform === 'string' && messages.payments.statusOutsidePlatform.trim(), locale);
  }
});
