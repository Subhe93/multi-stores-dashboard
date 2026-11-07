// Unit tests of the own Stripe key helpers (input validation, checklist, domains).
// Run: node --experimental-strip-types --test src/lib/ownStripeKey.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  domainRows,
  domainStatusTone,
  missingFromError,
  permissionCheck,
  publishableKeyMode,
  restrictedKeyMode,
  validateKeyInputs,
} from './ownStripeKey.ts';

const TAIL = 'a1B2c3D4e5F6g7H8';
const RK_TEST = `rk_test_${TAIL}`;
const RK_LIVE = `rk_live_${TAIL}`;
const PK_TEST = `pk_test_${TAIL}`;
const PK_LIVE = `pk_live_${TAIL}`;

test('key modes', () => {
  assert.equal(restrictedKeyMode(RK_TEST), 'test');
  assert.equal(restrictedKeyMode(` ${RK_LIVE} `), 'live');
  assert.equal(restrictedKeyMode(`sk_live_${TAIL}`), null);
  assert.equal(publishableKeyMode(PK_LIVE), 'live');
  assert.equal(publishableKeyMode('pk_live_'), null);
});

test('validateKeyInputs', () => {
  assert.deepEqual(validateKeyInputs(RK_TEST, PK_TEST), { restricted: null, publishable: null, pair: null });
  assert.equal(validateKeyInputs('', PK_TEST).restricted, 'restricted_empty');
  assert.equal(validateKeyInputs(`sk_live_${TAIL}`, PK_LIVE).restricted, 'restricted_secret_key');
  assert.equal(validateKeyInputs(PK_LIVE, PK_LIVE).restricted, 'restricted_publishable_swapped');
  assert.equal(validateKeyInputs('xyz', PK_LIVE).restricted, 'restricted_prefix');
  assert.equal(validateKeyInputs(RK_LIVE, RK_LIVE).publishable, 'publishable_restricted_swapped');
  assert.equal(validateKeyInputs(RK_LIVE, `sk_test_${TAIL}`).publishable, 'publishable_secret_key');
  assert.equal(validateKeyInputs(RK_LIVE, PK_TEST).pair, 'mode_mismatch');
});

test('permission checklist', () => {
  assert.equal(permissionCheck({ charge_read: 'ok' }, 'charge_read'), 'ok');
  assert.equal(permissionCheck({}, 'charge_read'), 'unknown');
  assert.equal(permissionCheck({ charge_read: 'ok' }, 'charge_read', ['charge_read']), 'missing');
  assert.deepEqual(missingFromError({ code: 'X', missing: ['webhook_write', 'bogus'] }), ['webhook_write']);
  assert.deepEqual(missingFromError(null), []);
});

test('domains', () => {
  assert.equal(domainStatusTone('active'), 'ok');
  assert.equal(domainStatusTone('inactive'), 'error');
  assert.equal(domainStatusTone(undefined), 'unknown');
  const rows = domainRows({ 'b.se': { apple_pay: 'active' }, 'a.se': { link: 'inactive' } });
  assert.deepEqual(rows.map((r) => r.host), ['a.se', 'b.se']);
  assert.equal(rows[0].methods.link, 'error');
  assert.equal(rows[1].methods.apple_pay, 'ok');
  assert.equal(rows[1].methods.klarna, 'unknown');
});

test('domain host error', () => {
  const rows = domainRows({ 'x.se': { error: 'permission_missing' } });
  assert.equal(rows[0].error, 'permission_missing');
  assert.equal(rows[0].methods.apple_pay, 'error');
});
