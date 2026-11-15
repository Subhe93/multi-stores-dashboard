// Unit test of the checkout settings form helpers (M5 W2-A).
// Run: node --experimental-strip-types --test src/lib/checkoutSettings.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHECKOUT_SETTINGS,
  NAMEZ_RECOMMENDED,
  checkoutFormErrors,
  externalSiteNeedsReauth,
  externalUrlProblem,
  externalUrlRejection,
  parseCouponParams,
  toCheckoutBody,
  toCheckoutForm,
} from './checkoutSettings.ts';

test('toCheckoutForm: null / garbage → defaults; stored value → form', () => {
  const blank = toCheckoutForm(null);
  assert.deepEqual(blank, {
    after_add_to_cart: 'stay',
    phone_required: false,
    pay_button_label: {},
    coupon_param_text: 'coupon',
    coupon_autoapply: false,
    external_site_url: '',
    return_url: '',
    return_mode: 'button',
    back_label: {},
  });
  assert.deepEqual(toCheckoutForm('x'), blank);
  const namez = toCheckoutForm(NAMEZ_RECOMMENDED);
  assert.equal(namez.after_add_to_cart, 'checkout');
  assert.equal(namez.coupon_param_text, 'coupon, coupon1');
  assert.deepEqual(namez.pay_button_label, { sv: 'Betala med kort' });
});

test('toCheckoutBody: an untouched / all-default form saves null (G0)', () => {
  assert.equal(toCheckoutBody(toCheckoutForm(null)), null);
  assert.equal(toCheckoutBody({ ...toCheckoutForm(null), pay_button_label: { sv: '   ' }, coupon_param_text: ' coupon ' }), null);
});

test('toCheckoutBody: trims labels, parses params, fills defaults', () => {
  assert.deepEqual(toCheckoutBody(toCheckoutForm(NAMEZ_RECOMMENDED)), NAMEZ_RECOMMENDED);
  assert.deepEqual(
    toCheckoutBody({ ...toCheckoutForm(null), coupon_autoapply: true, coupon_param_text: '' }),
    { ...DEFAULT_CHECKOUT_SETTINGS, coupon_autoapply: true },
  );
});

test('parseCouponParams + checkoutFormErrors', () => {
  assert.deepEqual(parseCouponParams('coupon, coupon1 kampanj;coupon'), ['coupon', 'coupon1', 'kampanj']);
  assert.deepEqual(checkoutFormErrors(toCheckoutForm(null)), {});
  assert.deepEqual(checkoutFormErrors({ ...toCheckoutForm(null), coupon_param_text: 'ok, bad!key' }), { coupon_param: 'bad!key' });
  assert.deepEqual(checkoutFormErrors({ ...toCheckoutForm(null), pay_button_label: { sv: 'x'.repeat(61) } }), { pay_button_label: 'sv' });
});

// ── External website (headless booking P3) ──────────────────────────────────

const SITE = 'https://primatrafikskola.se/';
const withSite = (over = {}) => ({ ...toCheckoutForm(null), external_site_url: SITE, ...over });

test('P3: stores without a site keep the exact former body', () => {
  assert.deepEqual(toCheckoutBody(toCheckoutForm(NAMEZ_RECOMMENDED)), NAMEZ_RECOMMENDED);
  assert.equal('external_site_url' in toCheckoutBody({ ...toCheckoutForm(null), phone_required: true }), false);
  assert.equal(toCheckoutBody(toCheckoutForm(null), false), null);
});

test('P3: a site sends the four keys; clearing it sends null', () => {
  const stored = { external_site_url: SITE, return_url: 'https://primatrafikskola.se/tack?order={order_number}', return_mode: 'auto', back_label: { sv: 'Till skolan' } };
  const form = toCheckoutForm(stored);
  assert.equal(form.return_mode, 'auto');
  assert.deepEqual(toCheckoutBody(form, true), { ...DEFAULT_CHECKOUT_SETTINGS, ...stored });
  // Cleared with every other value at the default: null clears all.
  assert.equal(toCheckoutBody({ ...form, external_site_url: '', return_url: '' }, true), null);
  // Cleared while another value is set: explicit nulls.
  assert.deepEqual(toCheckoutBody({ ...form, external_site_url: '', return_url: '', phone_required: true }, true), {
    ...DEFAULT_CHECKOUT_SETTINGS,
    phone_required: true,
    external_site_url: null,
    return_url: null,
  });
  // Keys stored without a site are ignored by the form.
  assert.equal(toCheckoutForm({ return_mode: 'auto' }).return_mode, 'button');
});

test('P3: URL problems mirror the API reasons', () => {
  assert.equal(externalUrlProblem('http://a.se', false), 'https_required');
  assert.equal(externalUrlProblem('https://u:p@a.se', false), 'userinfo_not_allowed');
  assert.equal(externalUrlProblem('https://a.se:8443', false), 'port_not_allowed');
  assert.equal(externalUrlProblem('https://127.0.0.1', false), 'host_not_allowed');
  assert.equal(externalUrlProblem('https://localhost', false), 'host_not_allowed');
  assert.equal(externalUrlProblem('https://a.se/?o={order_number}', false), 'placeholder_not_allowed');
  assert.equal(externalUrlProblem('https://a.se/?o={order_number}', true), null);
  assert.equal(externalUrlProblem('https://a.se/?e={email}', true), 'placeholder_not_allowed');
  assert.equal(externalUrlProblem('https://{order_number}.a.se/', true), 'placeholder_not_allowed');
  assert.equal(externalUrlProblem('https://a.se/' + 'x'.repeat(600), false), 'too_long');
});

test('P3: return_url host must be the site host or its www twin', () => {
  assert.deepEqual(checkoutFormErrors(withSite({ return_url: 'https://www.primatrafikskola.se/tack' })), {});
  assert.deepEqual(checkoutFormErrors(withSite({ return_url: 'https://evil.se/tack' })), { return_url: 'host_not_allowed' });
  assert.deepEqual(checkoutFormErrors(withSite({ return_url: 'https://boka.primatrafikskola.se/' })), { return_url: 'host_not_allowed' });
  assert.deepEqual(checkoutFormErrors({ ...toCheckoutForm(null), return_url: 'https://a.se/' }), { return_url: 'external_site_url_required' });
  assert.deepEqual(checkoutFormErrors(withSite({ back_label: { sv: 'x'.repeat(61) } })), { back_label: 'sv' });
});

test('P3: re-auth only when the site is set or replaced', () => {
  const none = toCheckoutForm(null);
  const saved = withSite();
  assert.equal(externalSiteNeedsReauth(withSite(), none), true);
  assert.equal(externalSiteNeedsReauth(withSite({ external_site_url: 'https://primatrafikskola.se' }), saved), false);
  assert.equal(externalSiteNeedsReauth(withSite({ external_site_url: 'https://other.se' }), saved), true);
  assert.equal(externalSiteNeedsReauth({ ...saved, external_site_url: '' }, saved), false);
  assert.equal(externalSiteNeedsReauth(withSite({ return_url: 'https://primatrafikskola.se/tack' }), saved), false);
});

test('P3: API rejection is read from the error payload', () => {
  assert.deepEqual(
    externalUrlRejection({ code: 'CHECKOUT_EXTERNAL_URL_NOT_ALLOWED', payload: { field: 'return_url', reason: 'host_not_allowed' } }),
    { field: 'return_url', reason: 'host_not_allowed' },
  );
  assert.deepEqual(
    externalUrlRejection({ code: 'CHECKOUT_EXTERNAL_URL_NOT_ALLOWED', payload: { reason: 'weird' } }),
    { field: 'external_site_url', reason: 'invalid_url' },
  );
  assert.equal(externalUrlRejection({ code: 'OTHER' }), null);
});
