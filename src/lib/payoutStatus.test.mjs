// Unit test of the payout badge (paid / reversed / failed) and of the new
// timeline rows (stock returned, transfer reversal) in the six locales.
// Run: node --experimental-strip-types --test src/lib/payoutStatus.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAYOUT_BADGE_CLASS, PAYOUT_BADGE_LABEL_KEY, payoutBadgeKind } from './payoutStatus.ts';
import { PAYMENT_TIMELINE_STATUSES, timelineEntryText } from './orderTimeline.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const NEW_TIMELINE_ROWS = ['STOCK_RETURNED', 'STOCK_RETAKEN', 'TRANSFER_REVERSAL_DUE', 'TRANSFER_REVERSED', 'TRANSFER_REVERSAL_FAILED'];

const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));

test('paid and reversed have their own badge; anything else reads as failed, as before', () => {
  assert.equal(payoutBadgeKind('paid'), 'paid');
  assert.equal(payoutBadgeKind('reversed'), 'reversed');
  for (const status of ['failed', 'pending', '', 'PAID', 'Reversed', null, undefined]) {
    assert.equal(payoutBadgeKind(status), 'failed', String(status));
  }
  // The two existing looks are unchanged.
  assert.equal(PAYOUT_BADGE_CLASS.paid, 'bg-emerald-50 text-emerald-700 border-emerald-200');
  assert.equal(PAYOUT_BADGE_CLASS.failed, 'bg-red-50 text-red-700 border-red-200');
  assert.notEqual(PAYOUT_BADGE_CLASS.reversed, PAYOUT_BADGE_CLASS.failed);
  assert.deepEqual(PAYOUT_BADGE_LABEL_KEY, { paid: 'statusPaid', reversed: 'statusReversed', failed: 'statusFailed' });
});

test('the payout labels exist in the six locales', () => {
  for (const locale of LOCALES) {
    const all = messages(locale);
    for (const key of Object.values(PAYOUT_BADGE_LABEL_KEY)) {
      assert.ok(typeof all.payments[key] === 'string' && all.payments[key].trim(), `${locale} payments.${key}`);
    }
    const status = all.provider.earningsPage.status;
    assert.ok(typeof status.reversed === 'string' && status.reversed.trim(), `${locale} status.reversed`);
  }
});

test('the stock and transfer-reversal rows are labelled from the timeline namespace', () => {
  const t = (key) => `t:${key}`;
  for (const status of NEW_TIMELINE_ROWS) {
    assert.ok(PAYMENT_TIMELINE_STATUSES.includes(status), status);
    // The page's own status translator is never asked (it would return the raw enum).
    assert.deepEqual(timelineEntryText(t, status, 'a note', (s) => s), { label: `t:${status}`, note: 'a note' });
  }
});

test('every timeline row has a label in the six locales', () => {
  for (const locale of LOCALES) {
    const timeline = messages(locale).orderTimeline;
    for (const status of PAYMENT_TIMELINE_STATUSES) {
      assert.ok(typeof timeline[status] === 'string' && timeline[status].trim(), `${locale} ${status}`);
      assert.ok(!/[{}]/.test(timeline[status]), `${locale} ${status}`);
    }
  }
});
