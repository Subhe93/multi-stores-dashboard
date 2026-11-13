// Unit test of the tracking id rules (Tracking & cookies card).
// Run: node --experimental-strip-types --test src/lib/trackingIds.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clarityPatch,
  isValidTrackingId,
  normalizeTrackingId,
  showClarityConsentWarning,
} from './trackingIds.ts';

test('Clarity project id: 8-12 letters/digits, any case, empty clears', () => {
  for (const ok of ['sxtuobatm6', 'SXTUOBATM6', ' sxtuobatm6 ', 'abcd1234', 'abcdef123456', '']) {
    assert.equal(isValidTrackingId('clarity_project_id', ok), true, ok);
  }
  for (const bad of [
    'abc1234',
    'abcdefghij123',
    'sxtuo-atm6',
    'sxtuo atm6',
    'https://www.clarity.ms/tag/sxtuobatm6',
    '<script>(function(c,l,a,r,i,t,y){})</script>',
  ]) {
    assert.equal(isValidTrackingId('clarity_project_id', bad), false, bad);
  }
});

test('normalization: Clarity lower-cased, GA4/TikTok upper-cased, Meta as typed', () => {
  assert.equal(normalizeTrackingId('clarity_project_id', ' SXTUOBATM6 '), 'sxtuobatm6');
  assert.equal(normalizeTrackingId('ga4_measurement_id', ' g-abcd1234 '), 'G-ABCD1234');
  assert.equal(normalizeTrackingId('tiktok_pixel_id', 'cabcdefgh'), 'CABCDEFGH');
  assert.equal(normalizeTrackingId('meta_pixel_id', ' 12345 '), '12345');
});

test('the other id rules are unchanged', () => {
  assert.equal(isValidTrackingId('ga4_measurement_id', 'G-0LQ8TWPC6V'), true);
  assert.equal(isValidTrackingId('ga4_measurement_id', 'UA-1-1'), false);
  assert.equal(isValidTrackingId('meta_pixel_id', '1064861581891343'), true);
  assert.equal(isValidTrackingId('meta_pixel_id', 'abc'), false);
  assert.equal(isValidTrackingId('tiktok_pixel_id', 'short'), false);
});

test('clarityPatch: sent only when the id changed', () => {
  // Untouched (also when the parent did not seed the id): not sent.
  assert.deepEqual(clarityPatch('', ''), {});
  assert.deepEqual(clarityPatch('sxtuobatm6', 'sxtuobatm6'), {});
  assert.deepEqual(clarityPatch(' SXTUOBATM6 ', 'sxtuobatm6'), {});
  // Set, replaced, cleared.
  assert.deepEqual(clarityPatch('SXTUOBATM6', ''), { clarity_project_id: 'sxtuobatm6' });
  assert.deepEqual(clarityPatch('abcdefghij', 'sxtuobatm6'), { clarity_project_id: 'abcdefghij' });
  assert.deepEqual(clarityPatch('  ', 'sxtuobatm6'), { clarity_project_id: '' });
});

test('consent-off warning only with a Clarity id and consent off', () => {
  assert.equal(showClarityConsentWarning('sxtuobatm6', false), true);
  assert.equal(showClarityConsentWarning('sxtuobatm6', true), false);
  assert.equal(showClarityConsentWarning('', false), false);
  assert.equal(showClarityConsentWarning('  ', false), false);
});
