// Unit test of the owner display currency (a marketplace store never formats
// in its stale row currency).
// Run: node --experimental-strip-types --test src/lib/storeCurrency.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ownStoreCurrency } from './storeCurrency.ts';

test('the effective currency of the API wins for every store type', () => {
  assert.equal(ownStoreCurrency({ effective_currency: 'EUR', currency: 'SEK', store_type: 'MARKETPLACE' }), 'EUR');
  assert.equal(ownStoreCurrency({ effective_currency: 'SEK', currency: 'SEK', store_type: 'INDEPENDENT' }), 'SEK');
  // An independent store with an unsupported row currency: the API resolved it.
  assert.equal(ownStoreCurrency({ effective_currency: 'EUR', currency: 'XXX', store_type: 'INDEPENDENT' }), 'EUR');
  assert.equal(ownStoreCurrency({ effective_currency: ' EUR ' }), 'EUR');
});

test('without the field, only an independent store uses its row currency', () => {
  assert.equal(ownStoreCurrency({ currency: 'SEK', store_type: 'INDEPENDENT' }), 'SEK');
  // Marketplace row with a stale SEK: the platform default ('' = ask the config).
  assert.equal(ownStoreCurrency({ currency: 'SEK', store_type: 'MARKETPLACE' }), '');
  assert.equal(ownStoreCurrency({ currency: 'SEK' }), '');
  assert.equal(ownStoreCurrency({ currency: null, store_type: 'INDEPENDENT' }), '');
  assert.equal(ownStoreCurrency({ currency: '', store_type: 'INDEPENDENT' }), '');
  for (const blank of [null, '', '   ', 5]) {
    assert.equal(ownStoreCurrency({ effective_currency: blank, currency: 'SEK', store_type: 'MARKETPLACE' }), '', String(blank));
    assert.equal(ownStoreCurrency({ effective_currency: blank, currency: 'SEK', store_type: 'INDEPENDENT' }), 'SEK', String(blank));
  }
});

test('no store reads as the platform default', () => {
  assert.equal(ownStoreCurrency(null), '');
  assert.equal(ownStoreCurrency(undefined), '');
  assert.equal(ownStoreCurrency({}), '');
});

test('useCurrency resolves the creator currency through the helper', () => {
  const source = readFileSync(fileURLToPath(new URL('./useCurrency.ts', import.meta.url)), 'utf8');
  assert.ok(source.includes('ownStoreCurrency(store)'));
  assert.equal(source.includes('store?.currency) return'), false);
});
