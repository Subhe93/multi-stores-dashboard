// ── Store checkout settings (M5 W2-A, M5-PLAN §4 M5.1) ───────────────────────
// Dashboard mirror of `multi-stores-api/src/modules/stores/checkout-settings.ts`
// (the API validates; this file only shapes the form and the PUT body).
// `null` on the store means "platform defaults" = today's behaviour.

export const AFTER_ADD_TO_CART = ['stay', 'cart', 'checkout'] as const;
export type AfterAddToCart = (typeof AFTER_ADD_TO_CART)[number];

export const RETURN_MODES = ['button', 'auto'] as const;
export type ReturnMode = (typeof RETURN_MODES)[number];

export interface CheckoutSettings {
  after_add_to_cart: AfterAddToCart;
  phone_required: boolean;
  pay_button_label: Record<string, string> | null;
  coupon_param: string[];
  coupon_autoapply: boolean;
  // External site return (headless booking P3). Sent only when the store has
  // (or had) an external site, so other stores keep the exact former body.
  external_site_url?: string | null;
  return_url?: string | null;
  return_mode?: ReturnMode;
  back_label?: Record<string, string> | null;
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
  /** The store's own website ('' = none). */
  external_site_url: string;
  /** After-payment target on that site ('' = the site URL); may hold {order_number}. */
  return_url: string;
  return_mode: ReturnMode;
  /** "Back to site" label per store locale. */
  back_label: Record<string, string>;
}

const COUPON_PARAM_RE = /^[A-Za-z0-9_-]{1,32}$/;
export const MAX_PAY_BUTTON_LABEL = 60;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The form state for a stored value (null / malformed → defaults). */
function labelMap(raw: unknown): Record<string, string> {
  const labels: Record<string, string> = {};
  if (isPlainObject(raw)) {
    for (const [locale, label] of Object.entries(raw)) {
      if (typeof label === 'string') labels[locale] = label;
    }
  }
  return labels;
}

export function toCheckoutForm(raw: unknown): CheckoutSettingsForm {
  const s = isPlainObject(raw) ? raw : {};
  const labels = labelMap(s.pay_button_label);
  const site = typeof s.external_site_url === 'string' ? s.external_site_url : '';
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
    external_site_url: site,
    return_url: site && typeof s.return_url === 'string' ? s.return_url : '',
    return_mode: site && s.return_mode === 'auto' ? 'auto' : 'button',
    back_label: site ? labelMap(s.back_label) : {},
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

export interface CheckoutFormErrors {
  coupon_param?: string;
  pay_button_label?: string;
  /** Reason code (same names as the API `reason`), see externalUrlProblem. */
  external_site_url?: ExternalUrlReason;
  return_url?: ExternalUrlReason;
  back_label?: string;
}

/** Keys of the form that are not valid; empty when the form can be saved. */
export function checkoutFormErrors(form: CheckoutSettingsForm): CheckoutFormErrors {
  const errors: CheckoutFormErrors = {};
  const bad = parseCouponParams(form.coupon_param_text).filter((k) => !COUPON_PARAM_RE.test(k));
  if (bad.length) errors.coupon_param = bad[0];
  const long = Object.entries(form.pay_button_label).find(([, label]) => label.trim().length > MAX_PAY_BUTTON_LABEL);
  if (long) errors.pay_button_label = long[0];
  const site = form.external_site_url.trim();
  const ret = form.return_url.trim();
  if (site) {
    const siteProblem = externalUrlProblem(site, false);
    if (siteProblem) errors.external_site_url = siteProblem;
    if (ret) {
      const retProblem = externalUrlProblem(ret, true);
      if (retProblem) errors.return_url = retProblem;
      else if (!siteProblem && !sameSiteHost(ret, site)) errors.return_url = 'host_not_allowed';
    }
    const longBack = Object.entries(form.back_label).find(([, label]) => label.trim().length > MAX_PAY_BUTTON_LABEL);
    if (longBack) errors.back_label = longBack[0];
  } else if (ret) {
    errors.return_url = 'external_site_url_required';
  }
  return errors;
}

// ── External site URLs (headless booking P3) ──────────────────────────────
// Light mirror of the API rules (`external-site-hosts.ts`) so the merchant
// sees the problem before saving; the API stays the authority.

export const EXTERNAL_URL_REASONS = [
  'invalid_url',
  'too_long',
  'https_required',
  'userinfo_not_allowed',
  'port_not_allowed',
  'host_not_allowed',
  'placeholder_not_allowed',
  'external_site_url_required',
] as const;
export type ExternalUrlReason = (typeof EXTERNAL_URL_REASONS)[number];

export const ORDER_NUMBER_PLACEHOLDER = '{order_number}';
const MAX_EXTERNAL_URL_LENGTH = 500;
const PLACEHOLDER_SENTINEL = 'zzorderxnumberzz';
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isDnsHostName(hostname: string): boolean {
  if (!hostname || hostname.length > 253 || hostname.startsWith('[')) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
  const labels = hostname.split('.');
  if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1] || '')) return false;
  return labels.every((l) => HOST_LABEL_RE.test(l));
}

/** Why an external URL would be refused, or null when it looks valid. */
export function externalUrlProblem(raw: string, allowPlaceholder: boolean): ExternalUrlReason | null {
  const value = raw.trim();
  if (!value) return 'invalid_url';
  if (value.length > MAX_EXTERNAL_URL_LENGTH) return 'too_long';
  if (/[\s\\]/.test(value)) return 'invalid_url';
  if (!/^https:\/\//i.test(value)) return 'https_required';
  const authority = value.slice('https://'.length).split(/[/?#]/, 1)[0] || '';
  if (/[{}]/.test(authority)) return 'placeholder_not_allowed';
  for (const token of value.match(/\{[^{}]*\}/g) ?? []) {
    if (!allowPlaceholder || token !== ORDER_NUMBER_PLACEHOLDER) return 'placeholder_not_allowed';
  }
  const swapped = value.split(ORDER_NUMBER_PLACEHOLDER).join(PLACEHOLDER_SENTINEL);
  if (/[{}]/.test(swapped)) return 'placeholder_not_allowed';
  let url: URL;
  try {
    url = new URL(swapped);
  } catch {
    return 'invalid_url';
  }
  if (url.username || url.password || authority.includes('@')) return 'userinfo_not_allowed';
  if (url.port) return 'port_not_allowed';
  if (!isDnsHostName(url.hostname)) return 'host_not_allowed';
  return null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url.trim().split(ORDER_NUMBER_PLACEHOLDER).join(PLACEHOLDER_SENTINEL)).hostname;
  } catch {
    return null;
  }
}

/** True when `url` uses the site host or its `www.` twin (exact, no suffix match). */
export function sameSiteHost(url: string, site: string): boolean {
  const host = hostOf(url);
  const siteHost = hostOf(site);
  if (!host || !siteHost) return false;
  const twin = siteHost.startsWith('www.') ? siteHost.slice(4) : `www.${siteHost}`;
  return host === siteHost || host === twin;
}

/** Comparable form of a site URL (what the API stores), '' for none. */
function normalizedSite(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  try {
    return new URL(value).href;
  } catch {
    return value;
  }
}

/**
 * Whether saving `form` sets or replaces the external site URL, which the
 * API only accepts with the password (+ 2FA code). Clearing it does not.
 */
export function externalSiteNeedsReauth(form: CheckoutSettingsForm, saved: CheckoutSettingsForm): boolean {
  const next = normalizedSite(form.external_site_url);
  return next !== '' && next !== normalizedSite(saved.external_site_url);
}

/** The `field` / `reason` of a CHECKOUT_EXTERNAL_URL_NOT_ALLOWED API error. */
export function externalUrlRejection(
  err: unknown,
): { field: 'external_site_url' | 'return_url'; reason: ExternalUrlReason } | null {
  const e = err as { code?: unknown; payload?: Record<string, unknown> } | null;
  if (e?.code !== 'CHECKOUT_EXTERNAL_URL_NOT_ALLOWED') return null;
  const field = e.payload?.field === 'return_url' ? 'return_url' : 'external_site_url';
  const raw = e.payload?.reason;
  const reason = (EXTERNAL_URL_REASONS as readonly unknown[]).includes(raw) ? (raw as ExternalUrlReason) : 'invalid_url';
  return { field, reason };
}

/**
 * The PUT /stores/my/store body for the form: the full settings object, or
 * `null` when every value is the default so the store is stored as "no
 * overrides" (and its storefront payload stays byte-identical).
 */
function trimmedLabels(map: Record<string, string>): Record<string, string> | null {
  const labels: Record<string, string> = {};
  for (const [locale, label] of Object.entries(map)) {
    const trimmed = label.trim();
    if (trimmed) labels[locale] = trimmed;
  }
  return Object.keys(labels).length ? labels : null;
}

/**
 * `hadExternalSite`: the stored settings carry an external site. Clearing it
 * then sends `external_site_url: null` explicitly (the API keeps stored
 * external keys when a body omits them all). Stores that never had one get
 * exactly the former body.
 */
export function toCheckoutBody(form: CheckoutSettingsForm, hadExternalSite = false): CheckoutSettings | null {
  const params = parseCouponParams(form.coupon_param_text);
  const settings: CheckoutSettings = {
    after_add_to_cart: form.after_add_to_cart,
    phone_required: form.phone_required,
    pay_button_label: trimmedLabels(form.pay_button_label),
    coupon_param: params.length ? params : [...DEFAULT_CHECKOUT_SETTINGS.coupon_param],
    coupon_autoapply: form.coupon_autoapply,
  };
  const site = form.external_site_url.trim();
  if (site) {
    settings.external_site_url = site;
    settings.return_url = form.return_url.trim() || null;
    settings.return_mode = form.return_mode;
    settings.back_label = trimmedLabels(form.back_label);
  } else if (hadExternalSite) {
    settings.external_site_url = null;
    settings.return_url = null;
  }
  return isDefaultCheckoutSettings(settings) ? null : settings;
}

export function isDefaultCheckoutSettings(s: CheckoutSettings): boolean {
  const d = DEFAULT_CHECKOUT_SETTINGS;
  return (
    s.after_add_to_cart === d.after_add_to_cart &&
    s.phone_required === d.phone_required &&
    s.coupon_autoapply === d.coupon_autoapply &&
    s.pay_button_label === null &&
    !s.external_site_url &&
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
