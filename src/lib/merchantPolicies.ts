// Form helpers of the merchant policies card (M170 C): handling time and
// return policies of a store, published as structured data on product pages.
// Mirrors the API rules (multi-stores-api, modules/stores/merchant-policies.ts)
// and reports problems under the same field paths (`handling.max_days`,
// `returns.0.days`, ...), so a server answer maps onto the same inline
// messages. Pure module: no React, no fetch.

export type ReturnCategory = 'finite' | 'unlimited' | 'none';
export type ReturnMethod = 'mail' | 'store' | 'kiosk';
export type ReturnFees = 'free' | 'customer' | 'fixed';

export const RETURN_CATEGORIES: readonly ReturnCategory[] = ['finite', 'unlimited', 'none'];
export const RETURN_METHODS: readonly ReturnMethod[] = ['mail', 'store', 'kiosk'];
export const RETURN_FEES: readonly ReturnFees[] = ['free', 'customer', 'fixed'];

export const HANDLING_MAX_DAYS = 30;
export const RETURN_POLICIES_MAX = 10;
export const RETURN_COUNTRIES_MAX = 50;
export const RETURN_DAYS_MAX = 365;
export const RETURN_FEE_MAX = 1_000_000;

/** One return policy as the dialog edits it (numbers as typed text). */
export interface ReturnPolicyForm {
  countries: string[];
  category: ReturnCategory;
  days: string;
  methods: ReturnMethod[];
  /** '' = not stated. */
  fees: ReturnFees | '';
  fee_amount: string;
}

export interface MerchantPoliciesForm {
  handling_min: string;
  handling_max: string;
  returns: ReturnPolicyForm[];
  /**
   * M172: products the customer personalises (a name, a text, an image) are
   * published as not returnable. Only sent next to at least one return policy.
   */
  personalized_no_returns: boolean;
}

/** Message keys under `shipping.policies.errors`. */
export type PolicyErrorKey =
  | 'handlingRange'
  | 'handlingBoth'
  | 'countriesRequired'
  | 'countriesTooMany'
  | 'countryDuplicate'
  | 'daysRequired'
  | 'daysRange'
  | 'methodsNotAllowed'
  | 'feeAmountRequired'
  | 'tooMany';

/** Field path (as the API reports it) to message key. */
export type PolicyErrors = Record<string, PolicyErrorKey>;

export const EMPTY_POLICIES_FORM: MerchantPoliciesForm = {
  handling_min: '',
  handling_max: '',
  returns: [],
  personalized_no_returns: false,
};

export function emptyReturnPolicy(): ReturnPolicyForm {
  return { countries: [], category: 'finite', days: '', methods: [], fees: '', fee_amount: '' };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const numText = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/** Stored `merchant_policies` (or null / garbage) to the form. */
export function toPoliciesForm(raw: unknown): MerchantPoliciesForm {
  if (!isRecord(raw)) return { ...EMPTY_POLICIES_FORM, returns: [] };
  const handling = isRecord(raw.handling) ? raw.handling : {};
  const returns: ReturnPolicyForm[] = [];
  for (const p of Array.isArray(raw.returns) ? raw.returns : []) {
    if (!isRecord(p)) continue;
    const category = RETURN_CATEGORIES.includes(p.category as ReturnCategory) ? (p.category as ReturnCategory) : 'finite';
    returns.push({
      countries: Array.isArray(p.countries)
        ? p.countries.filter((c): c is string => typeof c === 'string').map((c) => c.toUpperCase())
        : [],
      category,
      days: numText(p.days),
      methods: Array.isArray(p.methods) ? RETURN_METHODS.filter((m) => (p.methods as unknown[]).includes(m)) : [],
      fees: RETURN_FEES.includes(p.fees as ReturnFees) ? (p.fees as ReturnFees) : '',
      fee_amount: numText(p.fee_amount),
    });
  }
  return {
    handling_min: numText(handling.min_days),
    handling_max: numText(handling.max_days),
    returns,
    // Strictly `true`, and only with a return policy (as the API stores it).
    personalized_no_returns: raw.personalized_no_returns === true && returns.length > 0,
  };
}

const INT = /^\d{1,4}$/;
const MONEY = /^\d{1,7}(?:[.,]\d{1,2})?$/;

function parseInt10(text: string): number | null {
  const t = text.trim();
  return INT.test(t) ? Number(t) : null;
}

function parseMoney(text: string): number | null {
  const t = text.trim();
  return MONEY.test(t) ? Number(t.replace(',', '.')) : null;
}

/** Fields of a policy that its type does not use are dropped, as the API wants. */
function policyBody(p: ReturnPolicyForm): Record<string, unknown> {
  const none = p.category === 'none';
  const fees = none ? '' : p.fees;
  return {
    countries: [...p.countries],
    category: p.category,
    ...(p.category === 'finite' ? { days: parseInt10(p.days) ?? p.days.trim() } : {}),
    ...(!none && p.methods.length ? { methods: RETURN_METHODS.filter((m) => p.methods.includes(m)) } : {}),
    ...(fees ? { fees } : {}),
    ...(fees === 'fixed' ? { fee_amount: parseMoney(p.fee_amount) ?? p.fee_amount.trim() } : {}),
  };
}

/**
 * The PUT /stores/my/merchant-policies body. An empty form gives `{}`, which
 * the API stores as "not configured" (nothing is published).
 */
export function toPoliciesBody(form: MerchantPoliciesForm): Record<string, unknown> {
  const min = form.handling_min.trim();
  const max = form.handling_max.trim();
  return {
    ...(min || max
      ? {
          handling: {
            ...(min ? { min_days: parseInt10(min) ?? min } : {}),
            ...(max ? { max_days: parseInt10(max) ?? max } : {}),
          },
        }
      : {}),
    ...(form.returns.length ? { returns: form.returns.map(policyBody) } : {}),
    // M172: the exception says nothing without a return policy, so it is
    // left out with an empty list (and when it is off).
    ...(form.personalized_no_returns && form.returns.length ? { personalized_no_returns: true } : {}),
  };
}

export function isPoliciesFormEmpty(form: MerchantPoliciesForm): boolean {
  return !form.handling_min.trim() && !form.handling_max.trim() && form.returns.length === 0;
}

/** Same content once normalised (dirty check). */
export function samePoliciesForm(a: MerchantPoliciesForm, b: MerchantPoliciesForm): boolean {
  return JSON.stringify(toPoliciesBody(a)) === JSON.stringify(toPoliciesBody(b));
}

/** Countries already used by the other policies (one policy per country). */
export function takenCountries(returns: readonly ReturnPolicyForm[], exceptIndex: number): string[] {
  const taken = new Set<string>();
  returns.forEach((p, i) => {
    if (i !== exceptIndex) for (const c of p.countries) taken.add(c);
  });
  return [...taken];
}

/** Problems of the form, keyed by the API's field paths. Empty = valid. */
export function policiesFormErrors(form: MerchantPoliciesForm): PolicyErrors {
  const errors: PolicyErrors = {};

  const minText = form.handling_min.trim();
  const maxText = form.handling_max.trim();
  if (minText || maxText) {
    const min = parseInt10(minText);
    const max = parseInt10(maxText);
    if (!minText) errors['handling.min_days'] = 'handlingBoth';
    else if (min === null || min > HANDLING_MAX_DAYS) errors['handling.min_days'] = 'handlingRange';
    if (!maxText) errors['handling.max_days'] = 'handlingBoth';
    else if (max === null || max > HANDLING_MAX_DAYS) errors['handling.max_days'] = 'handlingRange';
    else if (min !== null && min <= HANDLING_MAX_DAYS && min > max) errors['handling.max_days'] = 'handlingRange';
  }

  if (form.returns.length > RETURN_POLICIES_MAX) errors.returns = 'tooMany';

  const seen = new Set<string>();
  form.returns.forEach((p, i) => {
    const at = (key: string) => `returns.${i}.${key}`;
    if (p.countries.length === 0) errors[at('countries')] = 'countriesRequired';
    else if (p.countries.length > RETURN_COUNTRIES_MAX) errors[at('countries')] = 'countriesTooMany';
    else if (new Set(p.countries).size !== p.countries.length || p.countries.some((c) => seen.has(c))) {
      errors[at('countries')] = 'countryDuplicate';
    }
    for (const c of p.countries) seen.add(c);

    if (p.category === 'finite') {
      const days = parseInt10(p.days);
      if (!p.days.trim()) errors[at('days')] = 'daysRequired';
      else if (days === null || days < 1 || days > RETURN_DAYS_MAX) errors[at('days')] = 'daysRange';
    }
    if (p.category !== 'none' && p.fees === 'fixed') {
      const amount = parseMoney(p.fee_amount);
      if (amount === null || amount <= 0 || amount > RETURN_FEE_MAX) errors[at('fee_amount')] = 'feeAmountRequired';
    }
  });
  return errors;
}

// Message of a server-reported path the local rules did not flag.
const SERVER_DEFAULTS: Record<string, PolicyErrorKey> = {
  min_days: 'handlingRange',
  max_days: 'handlingRange',
  countries: 'countriesRequired',
  days: 'daysRange',
  methods: 'methodsNotAllowed',
  fee_amount: 'feeAmountRequired',
  returns: 'tooMany',
};

/**
 * Maps the `fields` of a 400 MERCHANT_POLICIES_INVALID answer onto the same
 * inline messages as the local rules. A path without an inline message
 * (`returns.0.category`, `body`, anything unknown) is left out: the caller
 * shows the general message for it, never the server text.
 */
export function serverPolicyErrors(fields: unknown, form: MerchantPoliciesForm): PolicyErrors {
  const local = policiesFormErrors(form);
  const errors: PolicyErrors = {};
  for (const path of Array.isArray(fields) ? fields : []) {
    if (typeof path !== 'string') continue;
    if (!/^(handling\.(min|max)_days|returns|returns\.\d+\.[a-z_]+)$/.test(path)) continue;
    const leaf = path.split('.').pop() as string;
    const key = local[path] ?? (Object.hasOwn(SERVER_DEFAULTS, leaf) ? SERVER_DEFAULTS[leaf] : undefined);
    if (key) errors[path] = key;
  }
  return errors;
}

/** Index of the first return policy with a problem, or null. */
export function firstInvalidPolicy(errors: PolicyErrors): number | null {
  let first: number | null = null;
  for (const path of Object.keys(errors)) {
    const m = /^returns\.(\d+)\./.exec(path);
    if (m && (first === null || Number(m[1]) < first)) first = Number(m[1]);
  }
  return first;
}

/** The problems of one policy, keyed by its own field (`countries`, `days`, ...). */
export function policyErrorsAt(errors: PolicyErrors, index: number): Partial<Record<string, PolicyErrorKey>> {
  const prefix = `returns.${index}.`;
  const out: Partial<Record<string, PolicyErrorKey>> = {};
  for (const [path, key] of Object.entries(errors)) {
    if (path.startsWith(prefix)) out[path.slice(prefix.length)] = key;
  }
  return out;
}
