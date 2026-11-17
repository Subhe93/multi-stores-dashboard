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
  sameCheckoutForm,
  toCheckoutBody,
  toCheckoutForm,
  withExternalFocus,
  withNoCustomerAccounts,
  withReturnLabel,
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

// ── Store without customer accounts (no_customer_accounts) ──────────────────

test('no accounts: stores that never used it keep the former form and body', () => {
  assert.equal('no_customer_accounts' in toCheckoutForm(null), false);
  assert.equal('no_customer_accounts' in toCheckoutForm({ no_customer_accounts: false }), false);
  assert.equal('no_customer_accounts' in toCheckoutForm({ no_customer_accounts: 'yes' }), false);
  assert.equal(toCheckoutBody(toCheckoutForm(null), false, false, {}), null);
  assert.deepEqual(toCheckoutBody(toCheckoutForm(NAMEZ_RECOMMENDED), false, false, {}), NAMEZ_RECOMMENDED);
  const body = toCheckoutBody({ ...toCheckoutForm(null), phone_required: true }, false, false, { noCustomerAccounts: false });
  assert.equal('no_customer_accounts' in body, false);
  assert.equal('return_label' in body, false);
});

test('no accounts: on sends the full default object plus the key, without a site', () => {
  const on = withNoCustomerAccounts(toCheckoutForm(null), true);
  assert.deepEqual(toCheckoutBody(on), { ...DEFAULT_CHECKOUT_SETTINGS, no_customer_accounts: true });
  assert.deepEqual(toCheckoutBody(on, false, false, { noCustomerAccounts: true }), {
    ...DEFAULT_CHECKOUT_SETTINGS,
    no_customer_accounts: true,
  });
  // Read back from the stored value, independent of a site.
  const form = toCheckoutForm({ no_customer_accounts: true });
  assert.equal(form.no_customer_accounts, true);
  assert.equal(form.external_site_url, '');
  // Clearing the site does not touch it.
  const stored = { external_site_url: SITE, no_customer_accounts: true };
  const cleared = { ...toCheckoutForm(stored), external_site_url: '' };
  assert.deepEqual(toCheckoutBody(cleared, true, false, { noCustomerAccounts: true }), {
    ...DEFAULT_CHECKOUT_SETTINGS,
    external_site_url: null,
    return_url: null,
    no_customer_accounts: true,
  });
});

test('no accounts: turning a stored one off sends false, or null when all is default', () => {
  const off = withNoCustomerAccounts(toCheckoutForm({ no_customer_accounts: true }), false);
  assert.equal('no_customer_accounts' in off, false);
  assert.equal(toCheckoutBody(off, false, false, { noCustomerAccounts: true }), null);
  assert.deepEqual(toCheckoutBody({ ...off, phone_required: true }, false, false, { noCustomerAccounts: true }), {
    ...DEFAULT_CHECKOUT_SETTINGS,
    phone_required: true,
    no_customer_accounts: false,
  });
  const withSiteOff = withNoCustomerAccounts(toCheckoutForm({ external_site_url: SITE, no_customer_accounts: true }), false);
  assert.equal(toCheckoutBody(withSiteOff, true, false, { noCustomerAccounts: true }).no_customer_accounts, false);
});

// ── Button text after payment (return_label) ────────────────────────────────

test('return label: a site without one keeps the exact P3 body', () => {
  const stored = { external_site_url: SITE, return_url: null, return_mode: 'button', back_label: { sv: 'Till skolan' } };
  const form = toCheckoutForm(stored);
  assert.equal('return_label' in form, false);
  assert.deepEqual(toCheckoutBody(form, true, false, {}), { ...DEFAULT_CHECKOUT_SETTINGS, ...stored });
  // A map with only blank entries counts as none.
  assert.equal('return_label' in toCheckoutForm({ external_site_url: SITE, return_label: { sv: '  ' } }), false);
  assert.equal('return_label' in toCheckoutBody({ ...form, return_label: { sv: '   ' } }, true, false, {}), false);
});

test('return label: sent trimmed with a site; null only to clear a stored one', () => {
  const stored = { external_site_url: SITE, return_url: null, return_mode: 'button', back_label: null, return_label: { sv: 'Till bokningsbekräftelsen' } };
  const form = toCheckoutForm(stored);
  assert.deepEqual(form.return_label, { sv: 'Till bokningsbekräftelsen' });
  assert.deepEqual(toCheckoutBody(form, true, false, { returnLabel: true }), { ...DEFAULT_CHECKOUT_SETTINGS, ...stored });
  const typed = withReturnLabel(withReturnLabel(withSite(), 'sv', '  Till bekräftelsen '), 'en', '   ');
  assert.deepEqual(toCheckoutBody(typed, true).return_label, { sv: 'Till bekräftelsen' });
  // Emptied: explicit null because one was stored.
  const emptied = withReturnLabel(form, 'sv', '');
  assert.equal('return_label' in emptied, false);
  assert.equal(toCheckoutBody(emptied, true, false, { returnLabel: true }).return_label, null);
  // Never stored and still empty: no key.
  assert.equal('return_label' in toCheckoutBody(emptied, true, false, { returnLabel: false }), false);
});

test('return label: ignored without a site and not sent when the site is cleared', () => {
  assert.equal('return_label' in toCheckoutForm({ return_label: { sv: 'Tillbaka' } }), false);
  const noSite = toCheckoutBody({ ...toCheckoutForm(null), phone_required: true, return_label: { sv: 'Tillbaka' } });
  assert.equal('return_label' in noSite, false);
  assert.equal(toCheckoutBody({ ...toCheckoutForm(null), return_label: { sv: 'Tillbaka' } }), null);
  const stored = { external_site_url: SITE, return_label: { sv: 'Tillbaka' } };
  const cleared = { ...toCheckoutForm(stored), external_site_url: '', return_url: '' };
  assert.equal(toCheckoutBody(cleared, true, false, { returnLabel: true }), null);
  assert.deepEqual(toCheckoutBody({ ...cleared, phone_required: true }, true, false, { returnLabel: true }), {
    ...DEFAULT_CHECKOUT_SETTINGS,
    phone_required: true,
    external_site_url: null,
    return_url: null,
  });
});

test('return label: too long is an error only next to a site', () => {
  assert.deepEqual(checkoutFormErrors(withSite({ return_label: { sv: 'x'.repeat(61) } })), { return_label: 'sv' });
  assert.deepEqual(checkoutFormErrors(withSite({ return_label: { sv: ` ${'x'.repeat(60)} ` } })), {});
  assert.deepEqual(checkoutFormErrors({ ...toCheckoutForm(null), return_label: { sv: 'x'.repeat(61) } }), {});
});

test('new options: the helpers keep a stable form shape', () => {
  const saved = toCheckoutForm({ external_site_url: SITE });
  // On -> off returns to the saved shape, so the card is not "dirty".
  assert.equal(JSON.stringify(withNoCustomerAccounts(withNoCustomerAccounts(saved, true), false)), JSON.stringify(saved));
  assert.equal(JSON.stringify(withReturnLabel(withReturnLabel(saved, 'sv', 'Tack'), 'sv', '')), JSON.stringify(saved));
  assert.equal(JSON.stringify(withReturnLabel(saved, null)), JSON.stringify(saved));
  // Toggling one option does not reorder the others.
  const full = toCheckoutForm({ external_site_url: SITE, external_focus: true, no_customer_accounts: true, return_label: { sv: 'Tack', en: 'Thanks' } });
  assert.equal(JSON.stringify(withExternalFocus(withExternalFocus(full, false), true)), JSON.stringify(full));
  assert.equal(JSON.stringify(withNoCustomerAccounts(withNoCustomerAccounts(full, false), true)), JSON.stringify(full));
  assert.equal(JSON.stringify(withReturnLabel(withReturnLabel(full, 'sv', ''), 'sv', 'Tack')), JSON.stringify(full));
  // No accounts needs no site.
  assert.deepEqual(withNoCustomerAccounts(toCheckoutForm(null), true), { ...toCheckoutForm(null), no_customer_accounts: true });
  assert.equal(withReturnLabel(full, null).no_customer_accounts, true);
});

test('sameCheckoutForm: a locale field typed into and emptied again is not a change', () => {
  const saved = toCheckoutForm({ external_site_url: SITE, back_label: { sv: 'Tillbaka' }, return_label: { sv: 'Tack' } });
  assert.equal(sameCheckoutForm(saved, saved), true);
  // Typed one character in the English field and deleted it.
  const touched = withReturnLabel(withReturnLabel(saved, 'en', 'x'), 'en', '');
  assert.deepEqual(touched.return_label, { sv: 'Tack', en: '' });
  assert.equal(sameCheckoutForm(touched, saved), true);
  assert.deepEqual(
    toCheckoutBody(touched, true, false, { returnLabel: true }),
    toCheckoutBody(saved, true, false, { returnLabel: true }),
  );
  // Same for the other label maps.
  assert.equal(sameCheckoutForm({ ...saved, back_label: { sv: 'Tillbaka', en: '' } }, saved), true);
  assert.equal(sameCheckoutForm({ ...saved, pay_button_label: { en: '  ' } }, saved), true);
  // Real edits are still changes.
  assert.equal(sameCheckoutForm(withReturnLabel(saved, 'en', 'Thanks'), saved), false);
  assert.equal(sameCheckoutForm(withReturnLabel(saved, 'sv', 'Tack!'), saved), false);
  assert.equal(sameCheckoutForm(withReturnLabel(saved, 'sv', ''), saved), false);
  assert.equal(sameCheckoutForm({ ...saved, back_label: {} }, saved), false);
  assert.equal(sameCheckoutForm(withNoCustomerAccounts(saved, true), saved), false);
  assert.equal(sameCheckoutForm({ ...saved, phone_required: true }, saved), false);
  // A form that never had the options compares as before.
  const blank = toCheckoutForm(null);
  assert.equal(sameCheckoutForm(blank, toCheckoutForm(null)), true);
  assert.equal(sameCheckoutForm({ ...blank, coupon_param_text: 'coupon, x' }, blank), false);
});
