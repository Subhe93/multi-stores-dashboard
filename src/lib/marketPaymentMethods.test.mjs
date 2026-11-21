// Unit tests of the M157 per-market payment methods helpers (dashboard
// mirror of the API rules, design doc §2.3, §3.1, §4.9, §8.5).
// Run: node --experimental-strip-types --test src/lib/marketPaymentMethods.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_PAYMENT_METHODS,
  customModeBlocked,
  isCodOnly,
  paymentCheckPassesFor,
  paymentMethodRows,
  paymentMethodsInvalidKey,
  paymentMethodsPayload,
  paymentMethodsSummaryKey,
  providerUsedInMarket,
  readPaymentMethods,
  samePaymentMethods,
  sortPaymentMethods,
  storeAvailableMethods,
  togglePaymentMethod,
  validatePaymentMethods,
} from './marketPaymentMethods.ts';

const row = (method, available, reason = null, extra = {}) => ({ method, available, reason: available ? null : reason, ...extra });

// Namez after Alaa connects the own live key: card + Kustom, no COD.
const NAMEZ_STORE = {
  methods: [row('card', true), row('kustom', true), row('cod', false, 'cod_disabled')],
};
const NO_CARD_STORE = {
  methods: [row('card', false, 'card_not_connected'), row('kustom', true), row('cod', false, 'cod_disabled')],
};
const TEST_KEY_STORE = {
  methods: [row('card', true, null, { test_mode: true }), row('kustom', false, 'kustom_not_configured'), row('cod', true)],
};

test('canonical order of the contract', () => {
  assert.deepEqual([...MARKET_PAYMENT_METHODS], ['card', 'kustom', 'cod']);
  assert.deepEqual(sortPaymentMethods(['cod', 'card', 'cod', 'x']), ['card', 'cod']);
});

test('readPaymentMethods: missing / null = store mode, malformed fail-closed, sorted', () => {
  assert.equal(readPaymentMethods(undefined), null); // API before M157
  assert.equal(readPaymentMethods(null), null);
  assert.deepEqual(readPaymentMethods('card'), []);
  assert.deepEqual(readPaymentMethods({ card: true }), []);
  assert.deepEqual(readPaymentMethods(['kustom', 'card', 'bogus']), ['card', 'kustom']);
});

test('samePaymentMethods is order-insensitive and keeps null distinct from []', () => {
  assert.equal(samePaymentMethods(null, null), true);
  assert.equal(samePaymentMethods(['card', 'kustom'], ['kustom', 'card']), true);
  assert.equal(samePaymentMethods(['card'], ['card', 'kustom']), false);
  assert.equal(samePaymentMethods(null, []), false);
  assert.equal(samePaymentMethods([], null), false);
  assert.equal(samePaymentMethods(null, ['card']), false);
});

test('togglePaymentMethod keeps a sorted, unique list', () => {
  assert.deepEqual(togglePaymentMethod(['kustom'], 'card', true), ['card', 'kustom']);
  assert.deepEqual(togglePaymentMethod(['card', 'kustom'], 'card', true), ['card', 'kustom']);
  assert.deepEqual(togglePaymentMethod(['card', 'kustom'], 'card', false), ['kustom']);
  assert.deepEqual(togglePaymentMethod(['card'], 'card', false), []);
});

test('validatePaymentMethods: only an empty restriction is refused', () => {
  assert.equal(validatePaymentMethods(null), null);
  assert.equal(validatePaymentMethods(['card']), null);
  assert.equal(validatePaymentMethods([]), 'empty');
});

test('paymentMethodsPayload: omitted when unchanged, null back to store mode, sorted otherwise', () => {
  assert.equal(paymentMethodsPayload(null, null), undefined);
  assert.equal(paymentMethodsPayload(['kustom', 'card'], ['card', 'kustom']), undefined);
  assert.equal(paymentMethodsPayload(null, ['card']), null);
  assert.deepEqual(paymentMethodsPayload(['card'], null), ['card']);
  assert.deepEqual(paymentMethodsPayload(['kustom', 'card'], ['card']), ['card', 'kustom']);
  // Namez: SE default market -> Kustom only; eu -> card only.
  assert.deepEqual(paymentMethodsPayload(['kustom'], null), ['kustom']);
  assert.deepEqual(paymentMethodsPayload(['card'], null), ['card']);
});

test('storeAvailableMethods lists what the store offers', () => {
  assert.deepEqual(storeAvailableMethods(null), []);
  assert.deepEqual(storeAvailableMethods(NAMEZ_STORE), ['card', 'kustom']);
  assert.deepEqual(storeAvailableMethods(TEST_KEY_STORE), ['card', 'cod']);
});

test('paymentMethodRows: unavailable methods are disabled with their reason', () => {
  const rows = paymentMethodRows(NAMEZ_STORE, ['card']);
  assert.deepEqual(
    rows.map((r) => [r.method, r.checked, r.disabled, r.reason, r.stale]),
    [
      ['card', true, false, null, false],
      ['kustom', false, false, null, false],
      ['cod', false, true, 'cod_disabled', false],
    ],
  );
});

test('paymentMethodRows: a stored method the store lost is stale and can be unchecked', () => {
  const rows = paymentMethodRows(NO_CARD_STORE, ['card', 'kustom']);
  const card = rows.find((r) => r.method === 'card');
  assert.equal(card.checked, true);
  assert.equal(card.stale, true);
  assert.equal(card.available, false);
  assert.equal(card.disabled, false); // uncheckable so the owner can remove it
  assert.equal(card.reason, 'card_not_connected');
  assert.equal(rows.find((r) => r.method === 'kustom').stale, false);
  // Once unchecked it can never be checked again.
  const after = paymentMethodRows(NO_CARD_STORE, togglePaymentMethod(['card', 'kustom'], 'card', false));
  assert.equal(after.find((r) => r.method === 'card').disabled, true);
});

test('paymentMethodRows: store read not loaded = everything disabled, nothing stale', () => {
  for (const r of paymentMethodRows(null, ['card', 'cod'])) {
    assert.equal(r.disabled, true, r.method);
    assert.equal(r.stale, false, r.method);
  }
});

test('paymentMethodRows: TEST key card is enabled with a test-mode flag', () => {
  const card = paymentMethodRows(TEST_KEY_STORE, ['card']).find((r) => r.method === 'card');
  assert.equal(card.disabled, false);
  assert.equal(card.testMode, true);
  assert.equal(paymentMethodRows(NAMEZ_STORE, ['card'])[0].testMode, false);
});

test('paymentMethodsSummaryKey covers every subset', () => {
  assert.equal(paymentMethodsSummaryKey(null), null);
  assert.equal(paymentMethodsSummaryKey([]), null);
  assert.equal(paymentMethodsSummaryKey(['card']), 'card');
  assert.equal(paymentMethodsSummaryKey(['kustom']), 'kustom');
  assert.equal(paymentMethodsSummaryKey(['cod']), 'cod');
  assert.equal(paymentMethodsSummaryKey(['kustom', 'card']), 'cardKustom');
  assert.equal(paymentMethodsSummaryKey(['cod', 'card']), 'cardCod');
  assert.equal(paymentMethodsSummaryKey(['cod', 'kustom']), 'kustomCod');
  assert.equal(paymentMethodsSummaryKey(['cod', 'kustom', 'card']), 'all');
});

test('providerUsedInMarket maps card -> stripe, kustom -> kustom', () => {
  assert.equal(providerUsedInMarket('stripe', null), true);
  assert.equal(providerUsedInMarket('kustom', null), true);
  assert.equal(providerUsedInMarket('stripe', ['kustom']), false);
  assert.equal(providerUsedInMarket('kustom', ['card', 'cod']), false);
  assert.equal(providerUsedInMarket('stripe', ['card']), true);
});

test('paymentCheckPassesFor: unrestricted equals the pre-M157 rule (regression)', () => {
  const old = (c) => !!c && (c.stripe === 'ok' || c.kustom === 'ok');
  const states = ['ok', 'missing', 'unknown'];
  for (const stripe of states) {
    for (const kustom of states) {
      const check = { stripe, kustom };
      assert.equal(paymentCheckPassesFor(check, null), old(check), `${stripe}/${kustom}`);
    }
  }
  assert.equal(paymentCheckPassesFor(null, null), false);
  assert.equal(paymentCheckPassesFor(undefined, ['card']), false);
});

test('paymentCheckPassesFor: only allowed providers count, COD never does', () => {
  // Namez eu: card only, Stripe ok, Kustom "ok" (static table) -> passes on Stripe.
  assert.equal(paymentCheckPassesFor({ stripe: 'ok', kustom: 'ok' }, ['card']), true);
  // eu before the key is connected: Stripe missing, Kustom ok -> fails.
  assert.equal(paymentCheckPassesFor({ stripe: 'missing', kustom: 'ok' }, ['card']), false);
  // Namez SE: Kustom only.
  assert.equal(paymentCheckPassesFor({ stripe: 'ok', kustom: 'missing' }, ['kustom']), false);
  assert.equal(paymentCheckPassesFor({ stripe: 'missing', kustom: 'ok' }, ['kustom']), true);
  assert.equal(paymentCheckPassesFor({ stripe: 'ok', kustom: 'ok' }, ['cod']), false);
  assert.equal(paymentCheckPassesFor({ stripe: 'missing', kustom: 'ok' }, ['card', 'cod']), false);
  assert.equal(paymentCheckPassesFor({ stripe: 'missing', kustom: 'ok' }, ['card', 'kustom']), true);
});

test('isCodOnly', () => {
  assert.equal(isCodOnly(['cod']), true);
  assert.equal(isCodOnly(['card', 'cod']), false);
  assert.equal(isCodOnly(null), false);
});

test('paymentMethodsInvalidKey maps the reason to a flat errors key', () => {
  assert.equal(paymentMethodsInvalidKey('unknown'), 'MARKET_PAYMENT_METHODS_INVALID_UNKNOWN');
  assert.equal(paymentMethodsInvalidKey('duplicate'), 'MARKET_PAYMENT_METHODS_INVALID_DUPLICATE');
  assert.equal(paymentMethodsInvalidKey('empty'), 'MARKET_PAYMENT_METHODS_INVALID_EMPTY');
  assert.equal(paymentMethodsInvalidKey(undefined), 'MARKET_PAYMENT_METHODS_INVALID');
  assert.equal(paymentMethodsInvalidKey('constructor'), 'MARKET_PAYMENT_METHODS_INVALID');
});

test('customModeBlocked: custom mode needs a loaded store read with an available method', () => {
  const NONE_STORE = { methods: [row('card', false, 'card_not_connected'), row('kustom', false, 'kustom_not_configured'), row('cod', false, 'cod_disabled')] };
  // Loading or failed store read (null): entering custom mode would open on [] with every box disabled.
  assert.equal(customModeBlocked({ restricted: false, unsupported: false, store: null }), true);
  assert.equal(storeAvailableMethods(null).length, 0);
  // Store read loaded but nothing available.
  assert.equal(customModeBlocked({ restricted: false, unsupported: false, store: NONE_STORE }), true);
  // Old API without the endpoint.
  assert.equal(customModeBlocked({ restricted: false, unsupported: true, store: NAMEZ_STORE }), true);
  // Loaded with methods: allowed, and it starts from them.
  assert.equal(customModeBlocked({ restricted: false, unsupported: false, store: NAMEZ_STORE }), false);
  assert.deepEqual(storeAvailableMethods(NAMEZ_STORE), ['card', 'kustom']);
  // A stored restriction stays editable whatever the store read says.
  assert.equal(customModeBlocked({ restricted: true, unsupported: false, store: null }), false);
  assert.equal(customModeBlocked({ restricted: true, unsupported: true, store: null }), false);
});
