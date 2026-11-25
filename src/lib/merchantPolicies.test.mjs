// Unit test of the merchant policies form helpers (M170 C) and parity test
// of their strings in the six dashboard locales.
// Run: node --experimental-strip-types --test src/lib/merchantPolicies.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_POLICIES_FORM,
  emptyReturnPolicy,
  firstInvalidPolicy,
  isPoliciesFormEmpty,
  policiesFormErrors,
  policyErrorsAt,
  samePoliciesForm,
  serverPolicyErrors,
  takenCountries,
  toPoliciesBody,
  toPoliciesForm,
} from './merchantPolicies.ts';

const policy = (more = {}) => ({ ...emptyReturnPolicy(), countries: ['SE'], days: '14', ...more });
const form = (more = {}) => ({ handling_min: '', handling_max: '', returns: [], ...more });

test('toPoliciesForm: null / garbage is the empty form; a stored value is read back', () => {
  for (const raw of [null, undefined, 'x', 5, [], {}]) assert.deepEqual(toPoliciesForm(raw), EMPTY_POLICIES_FORM);
  assert.deepEqual(
    toPoliciesForm({
      handling: { min_days: 0, max_days: 2 },
      returns: [
        { countries: ['SE', 'no'], category: 'finite', days: 14, methods: ['store', 'mail'], fees: 'fixed', fee_amount: 49.5 },
        { countries: ['DE'], category: 'none' },
        'broken',
      ],
    }),
    {
      handling_min: '0',
      handling_max: '2',
      returns: [
        { countries: ['SE', 'NO'], category: 'finite', days: '14', methods: ['mail', 'store'], fees: 'fixed', fee_amount: '49.5' },
        { countries: ['DE'], category: 'none', days: '', methods: [], fees: '', fee_amount: '' },
      ],
    },
  );
});

test('toPoliciesForm never shares the empty list', () => {
  const a = toPoliciesForm(null);
  a.returns.push(policy());
  assert.equal(EMPTY_POLICIES_FORM.returns.length, 0);
  assert.equal(toPoliciesForm(null).returns.length, 0);
});

test('toPoliciesBody: an empty form is {} (stored as "not configured")', () => {
  assert.deepEqual(toPoliciesBody(form()), {});
  assert.deepEqual(toPoliciesBody(form({ handling_min: ' ', handling_max: '' })), {});
  assert.equal(isPoliciesFormEmpty(form()), true);
  assert.equal(isPoliciesFormEmpty(form({ handling_min: '1' })), false);
  assert.equal(isPoliciesFormEmpty(form({ returns: [policy()] })), false);
});

test('toPoliciesBody: numbers are numbers, methods in the canonical order, a comma is a decimal point', () => {
  assert.deepEqual(
    toPoliciesBody(
      form({
        handling_min: '1',
        handling_max: ' 2 ',
        returns: [policy({ countries: ['SE', 'NO'], methods: ['kiosk', 'mail'], fees: 'fixed', fee_amount: '49,50' })],
      }),
    ),
    {
      handling: { min_days: 1, max_days: 2 },
      returns: [
        { countries: ['SE', 'NO'], category: 'finite', days: 14, methods: ['mail', 'kiosk'], fees: 'fixed', fee_amount: 49.5 },
      ],
    },
  );
});

test('toPoliciesBody: fields the policy type does not use are never sent', () => {
  const stale = { days: '14', methods: ['mail'], fees: 'fixed', fee_amount: '49' };
  assert.deepEqual(toPoliciesBody(form({ returns: [policy({ ...stale, category: 'none' })] })).returns, [
    { countries: ['SE'], category: 'none' },
  ]);
  assert.deepEqual(toPoliciesBody(form({ returns: [policy({ ...stale, category: 'unlimited' })] })).returns, [
    { countries: ['SE'], category: 'unlimited', methods: ['mail'], fees: 'fixed', fee_amount: 49 },
  ]);
  assert.deepEqual(toPoliciesBody(form({ returns: [policy({ fees: 'free', fee_amount: '49' })] })).returns, [
    { countries: ['SE'], category: 'finite', days: 14, fees: 'free' },
  ]);
  // Nothing stated stays unstated.
  assert.deepEqual(toPoliciesBody(form({ returns: [policy()] })).returns, [
    { countries: ['SE'], category: 'finite', days: 14 },
  ]);
});

test('samePoliciesForm compares the normalised content (dirty check)', () => {
  const a = form({ handling_min: '1', handling_max: '2', returns: [policy()] });
  assert.equal(samePoliciesForm(a, toPoliciesForm(toPoliciesBody(a))), true);
  assert.equal(samePoliciesForm(a, { ...a, handling_max: '3' }), false);
  assert.equal(samePoliciesForm(a, { ...a, returns: [policy({ days: '30' })] }), false);
  // A stale field of an unused type is not a change.
  assert.equal(
    samePoliciesForm(form({ returns: [policy({ category: 'none' })] }), form({ returns: [policy({ category: 'none', days: '' })] })),
    true,
  );
});

test('takenCountries: the countries of the other policies', () => {
  const returns = [policy({ countries: ['SE', 'NO'] }), policy({ countries: ['DE'] }), policy({ countries: ['AT', 'SE'] })];
  assert.deepEqual(takenCountries(returns, 0).sort(), ['AT', 'DE', 'SE']);
  assert.deepEqual(takenCountries(returns, 1).sort(), ['AT', 'NO', 'SE']);
  // A new policy (index -1) sees every used country.
  assert.deepEqual(takenCountries(returns, -1).sort(), ['AT', 'DE', 'NO', 'SE']);
});

test('policiesFormErrors: a valid form has none', () => {
  assert.deepEqual(policiesFormErrors(form()), {});
  assert.deepEqual(
    policiesFormErrors(
      form({
        handling_min: '0',
        handling_max: '30',
        returns: [
          policy({ fees: 'fixed', fee_amount: '49.50', methods: ['mail'] }),
          policy({ countries: ['DE'], category: 'unlimited', days: '' }),
          policy({ countries: ['US'], category: 'none', days: '', fees: 'fixed', fee_amount: '' }),
        ],
      }),
    ),
    {},
  );
});

test('policiesFormErrors: handling time, same paths as the API', () => {
  assert.deepEqual(policiesFormErrors(form({ handling_min: '1' })), { 'handling.max_days': 'handlingBoth' });
  assert.deepEqual(policiesFormErrors(form({ handling_max: '1' })), { 'handling.min_days': 'handlingBoth' });
  assert.deepEqual(policiesFormErrors(form({ handling_min: '3', handling_max: '2' })), { 'handling.max_days': 'handlingRange' });
  assert.deepEqual(policiesFormErrors(form({ handling_min: '1', handling_max: '31' })), { 'handling.max_days': 'handlingRange' });
  for (const bad of ['-1', '1.5', 'x', '1e1']) {
    assert.deepEqual(policiesFormErrors(form({ handling_min: bad, handling_max: '2' })), { 'handling.min_days': 'handlingRange' }, bad);
  }
});

test('policiesFormErrors: return policies, same paths as the API', () => {
  assert.deepEqual(policiesFormErrors(form({ returns: [policy({ countries: [] })] })), {
    'returns.0.countries': 'countriesRequired',
  });
  const fiftyOne = Array.from({ length: 51 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 26), 65 + (i % 26)));
  assert.deepEqual(policiesFormErrors(form({ returns: [policy({ countries: fiftyOne })] })), {
    'returns.0.countries': 'countriesTooMany',
  });
  // A country in two policies: the later one is named.
  assert.deepEqual(policiesFormErrors(form({ returns: [policy(), policy({ countries: ['NO', 'SE'] })] })), {
    'returns.1.countries': 'countryDuplicate',
  });
  assert.deepEqual(policiesFormErrors(form({ returns: [policy({ countries: ['SE', 'SE'] })] })), {
    'returns.0.countries': 'countryDuplicate',
  });
  assert.deepEqual(policiesFormErrors(form({ returns: [policy({ days: '' })] })), { 'returns.0.days': 'daysRequired' });
  for (const days of ['0', '366', '1.5', 'x']) {
    assert.deepEqual(policiesFormErrors(form({ returns: [policy({ days })] })), { 'returns.0.days': 'daysRange' }, days);
  }
  for (const fee_amount of ['', '0', '-1', '4.999', 'x', '1000001']) {
    assert.deepEqual(
      policiesFormErrors(form({ returns: [policy({ fees: 'fixed', fee_amount })] })),
      { 'returns.0.fee_amount': 'feeAmountRequired' },
      fee_amount,
    );
  }
  const eleven = Array.from({ length: 11 }, (_, i) => policy({ countries: [`A${String.fromCharCode(65 + i)}`] }));
  assert.deepEqual(policiesFormErrors(form({ returns: eleven })), { returns: 'tooMany' });
});

test('firstInvalidPolicy / policyErrorsAt', () => {
  const errors = policiesFormErrors(
    form({ handling_min: '1', returns: [policy(), policy({ countries: [], days: '' }), policy({ countries: ['DE'], days: '0' })] }),
  );
  assert.equal(firstInvalidPolicy(errors), 1);
  assert.deepEqual(policyErrorsAt(errors, 1), { countries: 'countriesRequired', days: 'daysRequired' });
  assert.deepEqual(policyErrorsAt(errors, 2), { days: 'daysRange' });
  assert.deepEqual(policyErrorsAt(errors, 0), {});
  assert.equal(firstInvalidPolicy({ 'handling.max_days': 'handlingBoth', returns: 'tooMany' }), null);
  // Index 10 is not read as index 1.
  assert.deepEqual(policyErrorsAt({ 'returns.10.days': 'daysRange' }, 1), {});
});

test('serverPolicyErrors: server fields map onto the same inline messages, never onto server text', () => {
  const valid = form({ handling_min: '1', handling_max: '2', returns: [policy(), policy({ countries: ['DE'] })] });
  assert.deepEqual(
    serverPolicyErrors(
      ['handling.max_days', 'returns', 'returns.0.countries', 'returns.1.days', 'returns.1.methods', 'returns.1.fee_amount'],
      valid,
    ),
    {
      'handling.max_days': 'handlingRange',
      returns: 'tooMany',
      'returns.0.countries': 'countriesRequired',
      'returns.1.days': 'daysRange',
      'returns.1.methods': 'methodsNotAllowed',
      'returns.1.fee_amount': 'feeAmountRequired',
    },
  );
  // The local rule wins when it knows the exact problem.
  assert.deepEqual(serverPolicyErrors(['returns.1.countries'], form({ returns: [policy(), policy()] })), {
    'returns.1.countries': 'countryDuplicate',
  });
  // Paths without an inline message, and anything that is not a known path.
  assert.deepEqual(serverPolicyErrors(['body', 'returns.0.category', 'returns.0.fees', '__proto__', 5, 'returns.x.days'], valid), {});
  assert.deepEqual(serverPolicyErrors(undefined, valid), {});
  assert.deepEqual(serverPolicyErrors('returns', valid), {});
});

// ── Message parity (six locales) ──

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));

const KEYS = [
  'title', 'description', 'notConfigured', 'handlingTitle', 'handlingHint', 'handlingMin', 'handlingMax', 'returnsTitle',
  'returnsEmpty', 'addReturn', 'editReturn', 'removeReturn', 'removeAll', 'removeAllConfirm', 'countries', 'countriesTaken',
  'category', 'categoryFinite', 'categoryUnlimited', 'categoryNone', 'days', 'methods', 'methodMail', 'methodStore',
  'methodKiosk', 'fees', 'feesUnset', 'feesFree', 'feesCustomer', 'feesFixed', 'feeAmount', 'summaryFinite',
  'summaryUnlimited', 'summaryNone', 'save', 'saved',
  'errors.handlingRange', 'errors.handlingBoth', 'errors.countriesRequired', 'errors.countriesTooMany',
  'errors.countryDuplicate', 'errors.daysRequired', 'errors.daysRange', 'errors.methodsNotAllowed',
  'errors.feeAmountRequired', 'errors.tooMany',
];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const leaves = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

test('every shipping.policies key exists, non-empty, in all six locales (and nothing extra)', () => {
  for (const locale of UI_LOCALES) {
    const block = messages(locale).shipping?.policies;
    assert.ok(block, `${locale}: shipping.policies missing`);
    assert.deepEqual(leaves(block).sort(), [...KEYS].sort(), locale);
    for (const key of KEYS) assert.ok(nonEmpty(get(block, key)), `${locale}.${key}`);
  }
});

test('every message key the helpers can return is translated', () => {
  const produced = new Set([
    ...Object.values(policiesFormErrors(form({ handling_min: '1' }))),
    ...Object.values(policiesFormErrors(form({ handling_min: '9', handling_max: '1' }))),
    ...Object.values(policiesFormErrors(form({ returns: [policy({ countries: [], days: '' })] }))),
    ...Object.values(serverPolicyErrors(['returns', 'returns.0.methods', 'returns.0.days', 'returns.0.fee_amount'], form())),
    'countriesTooMany',
    'countryDuplicate',
  ]);
  const en = messages('en').shipping.policies.errors;
  for (const key of produced) assert.ok(nonEmpty(en[key]), key);
});

test('errors.MERCHANT_POLICIES_INVALID is translated in all six locales, right after the M170 A code', () => {
  for (const locale of UI_LOCALES) {
    const errors = messages(locale).errors;
    assert.ok(nonEmpty(errors.MERCHANT_POLICIES_INVALID), locale);
    const keys = Object.keys(errors);
    assert.equal(keys.indexOf('MERCHANT_POLICIES_INVALID'), keys.indexOf('PRODUCT_IMAGE_ALT_INVALID') + 1, locale);
  }
});

test('ICU placeholders match English in every locale', () => {
  const en = messages('en').shipping.policies;
  for (const locale of UI_LOCALES) {
    const block = messages(locale).shipping.policies;
    for (const key of KEYS) assert.deepEqual(placeholders(get(block, key)), placeholders(get(en, key)), `${locale}.${key}`);
  }
  assert.deepEqual(placeholders(en.summaryFinite), ['countries', 'days']);
  assert.deepEqual(placeholders(en.summaryUnlimited), ['countries']);
  assert.deepEqual(placeholders(en.summaryNone), ['countries']);
});
