// Unit tests of the variation cards v2 helpers.
// Run: node --experimental-strip-types --test src/lib/variantCards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardLayoutOf,
  cardSavings,
  cardShowSavingsOf,
  cheapestVariantFor,
  parseUnits,
  perUnitPrice,
  readableTextOn,
} from './variantCards.ts';

test('layout and savings defaults', () => {
  assert.equal(cardLayoutOf({}), 'grid');
  assert.equal(cardLayoutOf({ card_layout: 'list' }), 'list');
  assert.equal(cardLayoutOf({ card_layout: 'rows' }), 'grid');
  assert.equal(cardLayoutOf(null), 'grid');
  assert.equal(cardShowSavingsOf({}), false);
  assert.equal(cardShowSavingsOf({ card_show_savings: false }), false);
  assert.equal(cardShowSavingsOf({ card_show_savings: true }), true);
  assert.equal(cardShowSavingsOf({ card_show_savings: 'yes' }), false);
});

test('parseUnits', () => {
  assert.equal(parseUnits(''), undefined);
  assert.equal(parseUnits('  '), undefined);
  assert.equal(parseUnits('2'), 2);
  assert.equal(parseUnits('99'), 99);
  assert.equal(parseUnits('1'), null);
  assert.equal(parseUnits('100'), null);
  assert.equal(parseUnits('2.5'), null);
  assert.equal(parseUnits('-3'), null);
});

test('cardSavings: percent rounded down, amount = difference', () => {
  assert.deepEqual(cardSavings(129.9, 209.8), { percent: 38, amount: 79.9 });
  assert.deepEqual(cardSavings(50, 100), { percent: 50, amount: 50 });
});

test('cardSavings: none when compare-at is missing, lower, equal or within 0.5%', () => {
  assert.equal(cardSavings(100, 0), null);
  assert.equal(cardSavings(100, null), null);
  assert.equal(cardSavings(100, 90), null);
  assert.equal(cardSavings(100, 100), null);
  assert.equal(cardSavings(100, 100.4), null);
  assert.notEqual(cardSavings(100, 101), null);
});

test('perUnitPrice', () => {
  assert.equal(perUnitPrice(30, 3), 10);
  assert.equal(perUnitPrice(10, 3), 3.33);
  assert.equal(perUnitPrice(10, undefined), null);
  assert.equal(perUnitPrice(10, 1), null);
});

test('readableTextOn', () => {
  assert.equal(readableTextOn('#111827'), '#ffffff');
  assert.equal(readableTextOn('#000'), '#ffffff');
  assert.equal(readableTextOn('#fbde31'), '#111827');
  assert.equal(readableTextOn('#ffffff'), '#111827');
  assert.equal(readableTextOn('bad'), '#ffffff');
});

test('cheapestVariantFor picks the cheapest active variant with the value', () => {
  const variants = [
    { options: { Pack: '2' }, price: 20, compare_at_price: 30 },
    { options: { Pack: '2' }, price: 15, compare_at_price: 25, is_active: false },
    { options: { Pack: '2' }, price: 18, compare_at_price: 0 },
    { options: { Pack: '3' }, price: 10 },
  ];
  assert.equal(cheapestVariantFor(variants, 'Pack', '2')?.price, 18);
  assert.equal(cheapestVariantFor(variants, 'Pack', '4'), null);
});
