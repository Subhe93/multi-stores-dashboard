// Unit test of the product "Max per order" form helpers (P1 B2d).
// Run: node --experimental-strip-types --test src/lib/maxPerOrder.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxPerOrderPayload, maxPerOrderText, parseMaxPerOrder } from './maxPerOrder.ts';

test('parseMaxPerOrder: empty is unlimited, 1..9999 accepted, anything else invalid', () => {
  assert.equal(parseMaxPerOrder(''), null);
  assert.equal(parseMaxPerOrder('   '), null);
  assert.equal(parseMaxPerOrder('1'), 1);
  assert.equal(parseMaxPerOrder(' 4 '), 4);
  assert.equal(parseMaxPerOrder('9999'), 9999);
  for (const bad of ['0', '10000', '-1', '2.5', '1e2', 'abc', '3 4']) {
    assert.equal(parseMaxPerOrder(bad), 'invalid', bad);
  }
});

test('maxPerOrderText: stored value to form text', () => {
  assert.equal(maxPerOrderText(3), '3');
  assert.equal(maxPerOrderText(null), '');
  assert.equal(maxPerOrderText(undefined), '');
  assert.equal(maxPerOrderText('3'), '');
});

test('maxPerOrderPayload: a product without a limit saves exactly as before (no key)', () => {
  assert.deepEqual(maxPerOrderPayload('', { mode: 'create', serverHasKey: false, savedText: '' }), {});
  assert.deepEqual(maxPerOrderPayload('', { mode: 'edit', serverHasKey: true, savedText: '' }), {});
  assert.deepEqual(maxPerOrderPayload('', { mode: 'edit', serverHasKey: false, savedText: '' }), {});
});

test('maxPerOrderPayload: a value is sent, clearing a stored limit sends null', () => {
  assert.deepEqual(maxPerOrderPayload('2', { mode: 'create', serverHasKey: false, savedText: '' }), { max_per_order: 2 });
  assert.deepEqual(maxPerOrderPayload('5', { mode: 'edit', serverHasKey: true, savedText: '2' }), { max_per_order: 5 });
  assert.deepEqual(maxPerOrderPayload('', { mode: 'edit', serverHasKey: true, savedText: '2' }), { max_per_order: null });
  // Create never sends null.
  assert.deepEqual(maxPerOrderPayload('', { mode: 'create', serverHasKey: true, savedText: '2' }), {});
});

test('maxPerOrderPayload: invalid input sends nothing (the form blocks the save)', () => {
  assert.deepEqual(maxPerOrderPayload('0', { mode: 'edit', serverHasKey: true, savedText: '2' }), {});
});
