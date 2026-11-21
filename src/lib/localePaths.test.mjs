// Unit tests of the M156 language-country URL paths (dashboard mirror of the
// API rules and the shared activity rule).
// Run: node --experimental-strip-types --test src/lib/localePaths.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PATH_LANGUAGES,
  buildLocalePath,
  countriesWithoutPath,
  defaultHreflang,
  derivePath,
  hasPlainCode,
  isKnownLanguage,
  languageName,
  legacyRedirects,
  localePathStatus,
  primaryLocalePath,
  sameLocalePaths,
  toLocalePathInput,
  validateLocalePaths,
} from './localePaths.ts';

const EU_COUNTRIES = ['DE', 'FI', 'AT', 'NL', 'BE', 'FR', 'ES', 'IT', 'IE', 'PT'];
const EU = { defaultLocale: 'en', countries: EU_COUNTRIES };
const EU_LOCALES = ['de', 'fr', 'ar'];

// Target config of the Namez `eu` market (design §2.3), used as a fixture only.
const NAMEZ = [
  { path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE', 'de'] },
  { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
  { path: 'fr-fr', locale: 'fr', country: 'FR', hreflang: ['fr-FR', 'fr'] },
  { path: 'fr-be', locale: 'fr', country: 'BE', hreflang: ['fr-BE'] },
  { path: 'nl-nl', locale: 'nl', country: 'NL', hreflang: ['nl-NL', 'nl'] },
  { path: 'nl-be', locale: 'nl', country: 'BE', hreflang: ['nl-BE'] },
  { path: 'ar', locale: 'ar', country: null, hreflang: ['ar'] },
];

const codesOf = (errs) => errs.map((e) => `${e.index}:${e.code}`);

test('derivePath and defaultHreflang build the only allowed shapes', () => {
  assert.equal(derivePath('de', 'AT'), 'de-at');
  assert.equal(derivePath('ar', null), 'ar');
  assert.deepEqual(defaultHreflang('de', 'DE', true), ['de-DE', 'de']);
  assert.deepEqual(defaultHreflang('de', 'AT', false), ['de-AT']);
  assert.deepEqual(defaultHreflang('ar', null, false), ['ar']);
  assert.deepEqual(defaultHreflang('ar', null, true), ['ar']);
  assert.deepEqual(buildLocalePath('fr', 'be', false), { path: 'fr-be', locale: 'fr', country: 'BE', hreflang: ['fr-BE'] });
  assert.equal(hasPlainCode(NAMEZ[0]), true);
  assert.equal(hasPlainCode(NAMEZ[1]), false);
});

test('the Namez eu config is valid (nl rows are storable before Dutch exists)', () => {
  assert.deepEqual(validateLocalePaths(NAMEZ, EU), []);
  assert.deepEqual(validateLocalePaths([], EU), []);
});

test('activity rule: reasons in order, nl unsupported, ar active', () => {
  const market = { locales: EU_LOCALES, countries: EU_COUNTRIES };
  const statuses = NAMEZ.map((r) => localePathStatus(r, market).inactive_reason);
  assert.deepEqual(statuses, [null, null, null, null, 'locale_unsupported', 'locale_unsupported', null]);
  assert.deepEqual(localePathStatus(NAMEZ[0], market), { active: true, inactive_reason: null });
  // ar dropped from the market: the language-only row goes inactive.
  assert.equal(localePathStatus(NAMEZ[6], { locales: ['de', 'fr'], countries: EU_COUNTRIES }).inactive_reason, 'locale_not_enabled');
  // A country removed later: inactive, never an error.
  assert.equal(
    localePathStatus(NAMEZ[1], { locales: EU_LOCALES, countries: ['DE'] }).inactive_reason,
    'country_not_in_market',
  );
  // First failing rule wins: unsupported before not-enabled and country.
  assert.equal(localePathStatus({ locale: 'nl', country: 'XX' }, { locales: [], countries: [] }).inactive_reason, 'locale_unsupported');
  assert.equal(localePathStatus({ locale: 'de', country: 'XX' }, { locales: [], countries: [] }).inactive_reason, 'locale_not_enabled');
  // Once nl is a storefront locale and enabled, the nl rows turn active with no edit.
  const withNl = { locales: [...EU_LOCALES, 'nl'], countries: EU_COUNTRIES };
  assert.equal(localePathStatus(NAMEZ[4], withNl, ['en', 'de', 'fr', 'ar', 'nl']).active, true);
});

test('rule 1: malformed shapes are MARKET_LOCALE_PATH_INVALID', () => {
  const bad = [
    { path: 'DE-AT', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
    { path: 'de-at', locale: 'deu', country: 'AT', hreflang: ['de-AT'] },
    { path: 'de-at', locale: 'de', country: 'at', hreflang: ['de-AT'] },
    { path: 'de-at', locale: 'de', country: 'AT', hreflang: [] },
    { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de_AT'] },
    { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT', 'de', 'de-AT', 'de', 'de'] },
  ];
  bad.forEach((row) => assert.deepEqual(codesOf(validateLocalePaths([row], EU)), ['0:MARKET_LOCALE_PATH_INVALID'], JSON.stringify(row)));
  assert.deepEqual(codesOf(validateLocalePaths([null], EU)), ['0:MARKET_LOCALE_PATH_INVALID']);
});

test('rule 2: unknown language', () => {
  assert.equal(isKnownLanguage('nl'), true);
  assert.equal(isKnownLanguage('zz'), false);
  assert.deepEqual(codesOf(validateLocalePaths([{ path: 'zz', locale: 'zz', country: null, hreflang: ['zz'] }], EU)), [
    '0:MARKET_LOCALE_PATH_LANGUAGE_UNKNOWN',
  ]);
});

test('rule 3: the default language has no path', () => {
  assert.deepEqual(codesOf(validateLocalePaths([{ path: 'en-ie', locale: 'en', country: 'IE', hreflang: ['en-IE'] }], EU)), [
    '0:MARKET_LOCALE_PATH_DEFAULT_LOCALE',
  ]);
});

test('rule 4: the path must match language + country', () => {
  const rows = [
    { path: 'de', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
    { path: 'de-de', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
    { path: 'fr', locale: 'ar', country: null, hreflang: ['ar'] },
  ];
  assert.deepEqual(codesOf(validateLocalePaths(rows, EU)), [
    '0:MARKET_LOCALE_PATH_MISMATCH',
    '1:MARKET_LOCALE_PATH_MISMATCH',
    '2:MARKET_LOCALE_PATH_MISMATCH',
  ]);
});

test('rule 5: the country must be one of the market countries', () => {
  assert.deepEqual(codesOf(validateLocalePaths([{ path: 'de-ch', locale: 'de', country: 'CH', hreflang: ['de-CH'] }], EU)), [
    '0:MARKET_LOCALE_PATH_COUNTRY',
  ]);
  // A market without countries can only have language-only rows.
  assert.deepEqual(
    codesOf(validateLocalePaths([{ path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE'] }], { defaultLocale: 'sv', countries: [] })),
    ['0:MARKET_LOCALE_PATH_COUNTRY'],
  );
  assert.deepEqual(validateLocalePaths([{ path: 'ar', locale: 'ar', country: null, hreflang: ['ar'] }], { defaultLocale: 'sv', countries: [] }), []);
});

test('rule 6: duplicates are reported on the later row', () => {
  const rows = [NAMEZ[1], { ...NAMEZ[1] }, NAMEZ[6], { ...NAMEZ[6] }];
  assert.deepEqual(codesOf(validateLocalePaths(rows, EU)), ['1:MARKET_LOCALE_PATH_DUPLICATE', '3:MARKET_LOCALE_PATH_DUPLICATE']);
});

test('rules 7 and 8: hreflang codes match the row and point at one URL', () => {
  const cases = [
    { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-DE'] },
    { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['fr-AT'] },
    { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de', 'de-AT'] },
    { path: 'ar', locale: 'ar', country: null, hreflang: ['ar-SA'] },
  ];
  cases.forEach((row) => assert.deepEqual(codesOf(validateLocalePaths([row], EU)), ['0:MARKET_LOCALE_PATH_HREFLANG'], JSON.stringify(row)));
  const twice = [NAMEZ[0], { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT', 'de'] }];
  assert.deepEqual(codesOf(validateLocalePaths(twice, EU)), ['1:MARKET_LOCALE_PATH_HREFLANG']);
  // A repeated code inside one row is not a conflict (the API de-duplicates it).
  assert.deepEqual(validateLocalePaths([{ path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE', 'de', 'de'] }], EU), []);
});

test('primary path, redirect summary and countries without a path', () => {
  const market = { locales: EU_LOCALES, countries: EU_COUNTRIES };
  const active = NAMEZ.filter((r) => localePathStatus(r, market).active);
  assert.equal(primaryLocalePath(active, 'de')?.path, 'de-de');
  assert.equal(primaryLocalePath(active, 'fr')?.path, 'fr-fr');
  assert.equal(primaryLocalePath(active, 'ar')?.path, 'ar');
  assert.equal(primaryLocalePath(active, 'sv'), null);
  // No plain-code row: the first in stored order.
  assert.equal(primaryLocalePath([NAMEZ[3], NAMEZ[2]].map((r) => ({ ...r, hreflang: [r.hreflang[0]] })), 'fr')?.path, 'fr-be');
  assert.deepEqual(legacyRedirects(active), [
    { from: 'de', to: 'de-de' },
    { from: 'fr', to: 'fr-fr' },
  ]);
  assert.deepEqual(countriesWithoutPath(active, EU_COUNTRIES), ['FI', 'NL', 'ES', 'IT', 'IE', 'PT']);
});

test('sameLocalePaths and toLocalePathInput drop view-only fields', () => {
  const views = NAMEZ.map((r) => ({ ...r, active: true, inactive_reason: null }));
  const input = toLocalePathInput(views);
  assert.deepEqual(input, NAMEZ);
  assert.equal(sameLocalePaths(input, NAMEZ), true);
  assert.equal(sameLocalePaths(input, NAMEZ.slice(1)), false);
  assert.equal(sameLocalePaths([NAMEZ[0]], [{ ...NAMEZ[0], hreflang: ['de-DE'] }]), false);
  assert.deepEqual(toLocalePathInput(undefined), []);
  assert.deepEqual(toLocalePathInput(null), []);
});

test('editor language list and names', () => {
  assert.deepEqual(PATH_LANGUAGES.slice(0, 7), ['en', 'ar', 'tr', 'de', 'fr', 'sv', 'ku']);
  assert.ok(PATH_LANGUAGES.includes('nl'));
  assert.equal(new Set(PATH_LANGUAGES).size, PATH_LANGUAGES.length);
  assert.equal(languageName('de', 'en'), 'German');
  assert.equal(languageName('zz', 'en'), 'ZZ');
});
