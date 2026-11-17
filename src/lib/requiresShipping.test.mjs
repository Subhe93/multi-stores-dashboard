// Unit test of the "requires shipping" helpers (products / orders that need
// no shipping). Run: node --experimental-strip-types --test src/lib/requiresShipping.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canMarkFulfilled,
  noLineRequiresShipping,
  orderLineRequiresShipping,
  orderRequiresShipping,
  orderStatusLabel,
  orderStatusLabelKind,
  productRequiresShipping,
  requiresShippingPayload,
  showNoShippingBadge,
  withoutShippedOption,
} from './requiresShipping.ts';

test('only the literal false switches shipping off', () => {
  for (const read of [productRequiresShipping, orderRequiresShipping, orderLineRequiresShipping]) {
    assert.equal(read({ requires_shipping: false }), false);
    assert.equal(read({ requires_shipping: true }), true);
    assert.equal(read({ requires_shipping: null }), true);
    assert.equal(read({}), true);
    assert.equal(read(null), true);
    assert.equal(read(undefined), true);
    // Non-boolean junk from an odd payload still means "requires shipping".
    assert.equal(read({ requires_shipping: 0 }), true);
    assert.equal(read({ requires_shipping: 'false' }), true);
  }
});

test('requiresShippingPayload: a product that never used the option saves as before (no key)', () => {
  assert.deepEqual(requiresShippingPayload(true, { mode: 'create', savedValue: true }), {});
  assert.deepEqual(requiresShippingPayload(true, { mode: 'edit', savedValue: true }), {});
});

test('requiresShippingPayload: off is always sent; on is sent only to undo a stored off', () => {
  assert.deepEqual(requiresShippingPayload(false, { mode: 'create', savedValue: true }), { requires_shipping: false });
  assert.deepEqual(requiresShippingPayload(false, { mode: 'edit', savedValue: true }), { requires_shipping: false });
  assert.deepEqual(requiresShippingPayload(false, { mode: 'edit', savedValue: false }), { requires_shipping: false });
  assert.deepEqual(requiresShippingPayload(true, { mode: 'edit', savedValue: false }), { requires_shipping: true });
});

test('orderStatusLabelKind: fulfilled only for DELIVERED without shipping', () => {
  assert.equal(orderStatusLabelKind('DELIVERED', { requires_shipping: false }), 'fulfilled');
  assert.equal(orderStatusLabelKind('DELIVERED', { requires_shipping: true }), 'default');
  assert.equal(orderStatusLabelKind('DELIVERED', {}), 'default');
  assert.equal(orderStatusLabelKind('DELIVERED', null), 'default');
  assert.equal(orderStatusLabelKind('SHIPPED', { requires_shipping: false }), 'default');
  assert.equal(orderStatusLabelKind('PROCESSING', { requires_shipping: false }), 'default');
  assert.equal(orderStatusLabelKind(null, { requires_shipping: false }), 'default');
});

test('orderStatusLabel: swaps only the DELIVERED wording of a non-shipping order', () => {
  const normal = (s) => `label:${s}`;
  assert.equal(orderStatusLabel('DELIVERED', { requires_shipping: false }, normal, 'Fulfilled'), 'Fulfilled');
  assert.equal(orderStatusLabel('DELIVERED', {}, normal, 'Fulfilled'), 'label:DELIVERED');
  assert.equal(orderStatusLabel('PENDING', { requires_shipping: false }, normal, 'Fulfilled'), 'label:PENDING');
});

const OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
];

test('withoutShippedOption: an order that ships gets the same array back', () => {
  assert.equal(withoutShippedOption(OPTIONS, { requires_shipping: true }, 'Fulfilled'), OPTIONS);
  assert.equal(withoutShippedOption(OPTIONS, {}, 'Fulfilled'), OPTIONS);
  assert.equal(withoutShippedOption(OPTIONS, null, 'Fulfilled'), OPTIONS);
});

test('withoutShippedOption: no SHIPPED and DELIVERED reads Fulfilled; the rest stays selectable', () => {
  const out = withoutShippedOption(OPTIONS, { requires_shipping: false }, 'Fulfilled');
  assert.deepEqual(out, [
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'MANUFACTURING', label: 'Manufacturing' },
    { value: 'DELIVERED', label: 'Fulfilled' },
  ]);
  // The input is not mutated.
  assert.equal(OPTIONS[4].label, 'Delivered');
  // Without a label only the SHIPPED option is dropped.
  assert.deepEqual(
    withoutShippedOption(OPTIONS, { requires_shipping: false }).map((o) => o.label),
    ['Confirmed', 'Processing', 'Manufacturing', 'Delivered'],
  );
});

test('canMarkFulfilled: open non-shipping orders only', () => {
  for (const status of ['PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED']) {
    assert.equal(canMarkFulfilled({ status, requires_shipping: false }), true, status);
    assert.equal(canMarkFulfilled({ status, requires_shipping: true }), false, status);
    assert.equal(canMarkFulfilled({ status }), false, status);
  }
  for (const status of ['DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED']) {
    assert.equal(canMarkFulfilled({ status, requires_shipping: false }), false, status);
  }
  assert.equal(canMarkFulfilled(null), false);
});

test('showNoShippingBadge: only a non-shipping line of an order that ships', () => {
  assert.equal(showNoShippingBadge({ requires_shipping: true }, { requires_shipping: false }), true);
  assert.equal(showNoShippingBadge({}, { requires_shipping: false }), true);
  assert.equal(showNoShippingBadge({ requires_shipping: true }, { requires_shipping: true }), false);
  assert.equal(showNoShippingBadge({ requires_shipping: true }, {}), false);
  // Whole order without shipping: no per-line badge.
  assert.equal(showNoShippingBadge({ requires_shipping: false }, { requires_shipping: false }), false);
});

test('noLineRequiresShipping: needs lines, and all of them off', () => {
  assert.equal(noLineRequiresShipping([{ requires_shipping: false }, { requires_shipping: false }]), true);
  assert.equal(noLineRequiresShipping([{ requires_shipping: false }, {}]), false);
  assert.equal(noLineRequiresShipping([{ requires_shipping: true }]), false);
  assert.equal(noLineRequiresShipping([]), false);
  assert.equal(noLineRequiresShipping(null), false);
});
