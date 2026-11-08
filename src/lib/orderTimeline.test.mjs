// Unit tests of the order timeline labels (no raw enums, known system notes translated).
// Run: node --experimental-strip-types --test src/lib/orderTimeline.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humanizeStatus, paymentTimelineLabel, timelineEntryText } from './orderTimeline.ts';

const t = (key) => `t:${key}`;
const pageLabels = { PENDING: 'Pending', SHIPPED: 'Shipped' };
const statusLabel = (s) => pageLabels[s];

test('creation row reads as one translated event', () => {
  assert.deepEqual(timelineEntryText(t, 'PENDING', 'Order created', statusLabel), { label: 't:ORDER_PLACED', note: null });
});

test('PAID uses the timeline namespace, not the raw enum', () => {
  assert.equal(timelineEntryText(t, 'PAID', 'Stripe pi', statusLabel).label, 't:PAID');
  assert.equal(paymentTimelineLabel(t, 'PAID'), 't:PAID');
});

test('order statuses use the page label; admin note translated', () => {
  assert.deepEqual(timelineEntryText(t, 'SHIPPED', 'Status changed to SHIPPED by admin', statusLabel), {
    label: 'Shipped',
    note: 't:noteChangedByAdmin',
  });
  assert.equal(timelineEntryText(t, 'PENDING', 'custom note', statusLabel).note, 'custom note');
});

test('unknown status (page returns raw or nothing) is humanized', () => {
  assert.equal(timelineEntryText(t, 'SOME_NEW_EVENT', null, (s) => s).label, 'Some new event');
  assert.equal(timelineEntryText(t, 'OTHER', undefined, () => undefined).label, 'Other');
  assert.equal(humanizeStatus(''), '—');
});
