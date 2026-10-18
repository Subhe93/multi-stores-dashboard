// Unit test of the checkout settings form helpers (M5 W2-A).
// Run: node --experimental-strip-types --test src/lib/checkoutSettings.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHECKOUT_SETTINGS,
  NAMEZ_RECOMMENDED,
  checkoutFormErrors,
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
