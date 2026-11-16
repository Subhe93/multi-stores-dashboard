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
  withExternalFocus,
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

// ── Focused storefront (external_focus) ─────────────────────────────────────

test('focus: stores that never had it send the former body, with or without a site', () => {
  // No site: nothing new, even with a stray flag in the form.
  assert.deepEqual(toCheckoutBody(toCheckoutForm(NAMEZ_RECOMMENDED)), NAMEZ_RECOMMENDED);
  assert.equal(toCheckoutBody({ ...toCheckoutForm(null), external_focus: true }), null);
  const noSite = toCheckoutBody({ ...toCheckoutForm(null), phone_required: true, external_focus: true });
  assert.equal('external_focus' in noSite, false);
  assert.equal('external_site_url' in noSite, false);
  // A site without the flag: exactly the P3 body (no external_focus key).
  const stored = { external_site_url: SITE, return_url: null, return_mode: 'button', back_label: null };
  const form = toCheckoutForm(stored);
  assert.equal('external_focus' in form, false);
  assert.deepEqual(toCheckoutBody(form, true), { ...DEFAULT_CHECKOUT_SETTINGS, ...stored });
  assert.deepEqual(toCheckoutBody(form, true, false), { ...DEFAULT_CHECKOUT_SETTINGS, ...stored });
});

test('focus: on sends true; turning a stored one off sends an explicit false', () => {
  const stored = { external_site_url: SITE, return_url: null, return_mode: 'button', back_label: null, external_focus: true };
  const form = toCheckoutForm(stored);
  assert.equal(form.external_focus, true);
  assert.deepEqual(toCheckoutBody(form, true, true), { ...DEFAULT_CHECKOUT_SETTINGS, ...stored });
  // Turned on for a store that has a site.
  const on = withExternalFocus(withSite(), true);
  assert.equal(toCheckoutBody(on, true, false).external_focus, true);
  // Turned off: the API keeps a stored value when the key is omitted.
  const off = withExternalFocus(form, false);
  assert.equal('external_focus' in off, false);
  assert.equal(toCheckoutBody(off, true, true).external_focus, false);
  // Never on and still off: no key.
  assert.equal('external_focus' in toCheckoutBody(off, true, false), false);
});

test('focus: clearing the site clears it (explicit nulls, no focus key)', () => {
  const stored = { external_site_url: SITE, external_focus: true };
  const form = { ...toCheckoutForm(stored), external_site_url: '', return_url: '' };
  assert.equal(toCheckoutBody(form, true, true), null);
  assert.deepEqual(toCheckoutBody({ ...form, phone_required: true }, true, true), {
    ...DEFAULT_CHECKOUT_SETTINGS,
    phone_required: true,
    external_site_url: null,
    return_url: null,
  });
});

test('focus: the form reads it only next to a site; the switch keeps a stable shape', () => {
  assert.equal('external_focus' in toCheckoutForm({ external_focus: true }), false);
  assert.equal('external_focus' in toCheckoutForm({ external_site_url: SITE, external_focus: 'yes' }), false);
  // Off -> on -> off returns to the saved shape, so the card is not "dirty".
  const saved = toCheckoutForm({ external_site_url: SITE });
  const toggled = withExternalFocus(withExternalFocus(saved, true), false);
  assert.equal(JSON.stringify(toggled), JSON.stringify(saved));
  const savedOn = toCheckoutForm({ external_site_url: SITE, external_focus: true });
  assert.equal(JSON.stringify(withExternalFocus(withExternalFocus(savedOn, false), true)), JSON.stringify(savedOn));
});

test('focus: API rejections map to a field and a known reason', () => {
  assert.deepEqual(
    externalUrlRejection({ code: 'CHECKOUT_EXTERNAL_URL_NOT_ALLOWED', payload: { field: 'external_site_url', reason: 'store_host_not_allowed' } }),
    { field: 'external_site_url', reason: 'store_host_not_allowed' },
  );
  // The switch without a site: shown under the website address field.
  assert.deepEqual(
    externalUrlRejection({ code: 'CHECKOUT_EXTERNAL_URL_NOT_ALLOWED', payload: { field: 'external_focus', reason: 'external_site_url_required' } }),
    { field: 'external_site_url', reason: 'external_site_url_required' },
  );
});
