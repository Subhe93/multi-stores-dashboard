// ── Store checkout settings (M5 W2-A, M5-PLAN §4 M5.1) ───────────────────────
// Dashboard mirror of `multi-stores-api/src/modules/stores/checkout-settings.ts`
// (the API validates; this file only shapes the form and the PUT body).
// `null` on the store means "platform defaults" = today's behaviour.

export const AFTER_ADD_TO_CART = ['stay', 'cart', 'checkout'] as const;
export type AfterAddToCart = (typeof AFTER_ADD_TO_CART)[number];

export interface CheckoutSettings {
  after_add_to_cart: AfterAddToCart;
  phone_required: boolean;
  pay_button_label: Record<string, string> | null;
  coupon_param: string[];
  coupon_autoapply: boolean;
}

export const DEFAULT_CHECKOUT_SETTINGS: Readonly<CheckoutSettings> = Object.freeze({
  after_add_to_cart: 'stay',
  phone_required: false,
  pay_button_label: null,
  coupon_param: ['coupon'],
  coupon_autoapply: false,
});

/** What the merchant edits: labels per locale as a flat map, params as text. */
export interface CheckoutSettingsForm {
  after_add_to_cart: AfterAddToCart;
  phone_required: boolean;
  pay_button_label: Record<string, string>;
  /** Comma / space separated query keys, e.g. "coupon, coupon1". */
  coupon_param_text: string;
  coupon_autoapply: boolean;
}

const COUPON_PARAM_RE = /^[A-Za-z0-9_-]{1,32}$/;
export const MAX_PAY_BUTTON_LABEL = 60;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The form state for a stored value (null / malformed → defaults). */
export function toCheckoutForm(raw: unknown): CheckoutSettingsForm {
  const s = isPlainObject(raw) ? raw : {};
  const labels: Record<string, string> = {};
  if (isPlainObject(s.pay_button_label)) {
    for (const [locale, label] of Object.entries(s.pay_button_label)) {
      if (typeof label === 'string') labels[locale] = label;
    }
  }
  const params = Array.isArray(s.coupon_param)
    ? s.coupon_param.filter((k): k is string => typeof k === 'string')
    : [...DEFAULT_CHECKOUT_SETTINGS.coupon_param];
  return {
    after_add_to_cart: (AFTER_ADD_TO_CART as readonly string[]).includes(s.after_add_to_cart as string)
      ? (s.after_add_to_cart as AfterAddToCart)
      : DEFAULT_CHECKOUT_SETTINGS.after_add_to_cart,
    phone_required: typeof s.phone_required === 'boolean' ? s.phone_required : DEFAULT_CHECKOUT_SETTINGS.phone_required,
    pay_button_label: labels,
    coupon_param_text: (params.length ? params : DEFAULT_CHECKOUT_SETTINGS.coupon_param).join(', '),
    coupon_autoapply: typeof s.coupon_autoapply === 'boolean' ? s.coupon_autoapply : DEFAULT_CHECKOUT_SETTINGS.coupon_autoapply,
  };
}

/** "coupon, coupon1 kampanj" → ['coupon', 'coupon1', 'kampanj'] (deduplicated, order kept). */
export function parseCouponParams(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const key = part.trim();
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Keys of the form that are not valid; empty when the form can be saved. */
export function checkoutFormErrors(form: CheckoutSettingsForm): { coupon_param?: string; pay_button_label?: string } {
  const errors: { coupon_param?: string; pay_button_label?: string } = {};
  const bad = parseCouponParams(form.coupon_param_text).filter((k) => !COUPON_PARAM_RE.test(k));
  if (bad.length) errors.coupon_param = bad[0];
  const long = Object.entries(form.pay_button_label).find(([, label]) => label.trim().length > MAX_PAY_BUTTON_LABEL);
  if (long) errors.pay_button_label = long[0];
  return errors;
}

/**
 * The PUT /stores/my/store body for the form: the full settings object, or
 * `null` when every value is the default so the store is stored as "no
 * overrides" (and its storefront payload stays byte-identical).
 */
export function toCheckoutBody(form: CheckoutSettingsForm): CheckoutSettings | null {
  const labels: Record<string, string> = {};
  for (const [locale, label] of Object.entries(form.pay_button_label)) {
    const trimmed = label.trim();
    if (trimmed) labels[locale] = trimmed;
  }
  const params = parseCouponParams(form.coupon_param_text);
  const settings: CheckoutSettings = {
    after_add_to_cart: form.after_add_to_cart,
    phone_required: form.phone_required,
    pay_button_label: Object.keys(labels).length ? labels : null,
    coupon_param: params.length ? params : [...DEFAULT_CHECKOUT_SETTINGS.coupon_param],
    coupon_autoapply: form.coupon_autoapply,
  };
  return isDefaultCheckoutSettings(settings) ? null : settings;
}

export function isDefaultCheckoutSettings(s: CheckoutSettings): boolean {
  const d = DEFAULT_CHECKOUT_SETTINGS;
  return (
    s.after_add_to_cart === d.after_add_to_cart &&
    s.phone_required === d.phone_required &&
    s.coupon_autoapply === d.coupon_autoapply &&
    s.pay_button_label === null &&
    s.coupon_param.length === d.coupon_param.length &&
    s.coupon_param.every((k, i) => k === d.coupon_param[i])
  );
}

/** Namez (namez.se) recommended values, shown in the card's help text. */
export const NAMEZ_RECOMMENDED: Readonly<CheckoutSettings> = Object.freeze({
  after_add_to_cart: 'checkout',
  phone_required: false,
  pay_button_label: { sv: 'Betala med kort' },
  coupon_param: ['coupon', 'coupon1'],
  coupon_autoapply: true,
});
