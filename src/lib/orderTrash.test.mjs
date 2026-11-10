// Unit tests of the order trash helpers (deletable pre-check, 409 code mapping).
// Run: node --experimental-strip-types --test src/lib/orderTrash.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkIds,
  deletableBlocker,
  isOrderDeletable,
  skippedReasons,
  testFlagErrorKey,
  trashErrorKey,
} from './orderTrash.ts';

test('test orders are always deletable, even when paid', () => {
  assert.equal(isOrderDeletable({ is_test: true, payment_status: 'paid', paid_at: '2026-01-01' }), true);
});

test('unpaid orders without money movement are deletable', () => {
  assert.equal(isOrderDeletable({ payment_status: null }), true);
  assert.equal(isOrderDeletable({ payment_status: 'pending' }), true);
  assert.equal(isOrderDeletable({ payment_status: 'awaiting_payment' }), true);
  assert.equal(isOrderDeletable({ payment_status: 'failed' }), true);
  assert.equal(isOrderDeletable({ payment_status: 'cancelled', payouts: [] }), true);
});

test('paid or captured orders are not deletable', () => {
  assert.equal(isOrderDeletable({ payment_status: 'paid' }), false);
  assert.equal(isOrderDeletable({ payment_status: 'refunded' }), false);
  assert.equal(isOrderDeletable({ payment_status: 'pending', paid_at: '2026-01-01T00:00:00Z' }), false);
  assert.equal(isOrderDeletable({ payment_status: 'pending', stripe_charge_id: 'ch_1' }), false);
  assert.equal(isOrderDeletable({ payment_status: 'pending', kustom_capture_id: 'cap_1' }), false);
  assert.equal(isOrderDeletable({ payment_status: 'pending', payouts: [{ status: 'paid' }] }), false);
  assert.equal(isOrderDeletable(null), false);
});

test('_count of invoices / payouts blocks deletion and names the reason', () => {
  assert.equal(isOrderDeletable({ payment_status: 'pending', _count: { invoices: 1, payouts: 0 } }), false);
  assert.equal(isOrderDeletable({ payment_status: 'pending', _count: { invoices: 0, payouts: 2 } }), false);
  assert.equal(isOrderDeletable({ payment_status: 'pending', _count: { invoices: 0, payouts: 0 } }), true);
  assert.equal(deletableBlocker({ payment_status: 'paid', _count: { invoices: 1, payouts: 1 } }), 'invoiced');
  assert.equal(deletableBlocker({ payment_status: 'paid', _count: { invoices: 0, payouts: 1 } }), 'paid_out');
  assert.equal(deletableBlocker({ payment_status: 'pending', payouts: [{}] }), 'paid_out');
  assert.equal(deletableBlocker({ payment_status: 'paid' }), 'paid');
  assert.equal(deletableBlocker({ payment_status: 'pending', kustom_capture_id: 'c' }), 'paid');
  assert.equal(deletableBlocker({ payment_status: 'pending' }), null);
  // Test orders ignore every blocker.
  assert.equal(deletableBlocker({ is_test: true, payment_status: 'paid', _count: { invoices: 1, payouts: 1 } }), null);
});

test('409 codes map to friendly message keys', () => {
  assert.equal(trashErrorKey({ code: 'ORDER_NOT_DELETABLE', payload: { reason: 'paid' } }), 'errNotDeletablePaid');
  assert.equal(trashErrorKey({ code: 'ORDER_NOT_DELETABLE', payload: { reason: 'invoiced' } }), 'errNotDeletableInvoiced');
  assert.equal(trashErrorKey({ code: 'ORDER_NOT_DELETABLE', payload: { reason: 'paid_out' } }), 'errNotDeletablePaidOut');
  assert.equal(trashErrorKey({ code: 'ORDER_NOT_DELETABLE' }), 'errNotDeletablePaid');
  assert.equal(trashErrorKey({ code: 'ORDER_ALREADY_DELETED' }), 'errAlreadyDeleted');
  assert.equal(trashErrorKey({ code: 'ORDER_NOT_DELETED' }), 'errNotDeleted');
  assert.equal(trashErrorKey({ code: 'SOMETHING_ELSE' }), null);
  assert.equal(trashErrorKey(new Error('network')), null);
  assert.equal(testFlagErrorKey({ code: 'ORDER_DELETED' }), 'errOrderDeleted');
  assert.equal(testFlagErrorKey({ code: 'ORDER_INVOICED' }), 'errOrderInvoiced');
  assert.equal(testFlagErrorKey({ code: 'ORDER_NOT_DELETABLE' }), null);
});

test('bulk helpers: chunking and distinct skip reasons in a stable order', () => {
  assert.deepEqual(chunkIds(['a', 'b', 'c'], 2), [['a', 'b'], ['c']]);
  assert.deepEqual(chunkIds([]), []);
  assert.deepEqual(
    skippedReasons([
      { id: '1', code: 'ORDER_NOT_DELETABLE', reason: 'invoiced' },
      { id: '2', code: 'ORDER_NOT_DELETABLE', reason: 'paid' },
      { id: '3', code: 'ORDER_NOT_DELETABLE', reason: 'paid' },
      { id: '4', code: 'ORDER_ALREADY_DELETED' },
    ]),
    ['paid', 'invoiced', 'ORDER_ALREADY_DELETED'],
  );
});
