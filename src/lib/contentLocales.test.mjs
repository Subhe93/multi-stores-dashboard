// Unit tests of the store content locales and the "in review" locales
// (Kurdish Kurmanji, 'ku': enabled per store as a secondary language, hidden
// from the storefront switcher until a native speaker has reviewed it).
// Run: node --experimental-strip-types --test src/lib/contentLocales.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CONTENT_LOCALES,
  CONTENT_LOCALE_CODES,
  REVIEW_LOCALES,
  isReviewLocale,
} from './contentLocales.ts';

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

const messages = (locale) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url)), 'utf8'));

test('content locales: the six platform locales keep their order, ku is appended', () => {
  assert.deepEqual(CONTENT_LOCALE_CODES, ['en', 'ar', 'tr', 'de', 'fr', 'sv', 'ku']);
  assert.equal(CONTENT_LOCALES.find((l) => l.value === 'ku')?.label, 'Kurdî');
});

test('review locales: ku is in review, the six platform locales are not', () => {
  assert.deepEqual([...REVIEW_LOCALES], ['ku']);
  assert.equal(isReviewLocale('ku'), true);
  for (const code of UI_LOCALES) assert.equal(isReviewLocale(code), false, code);
  assert.equal(isReviewLocale(null), false);
  assert.equal(isReviewLocale(undefined), false);
  assert.equal(isReviewLocale(''), false);
});

test('review locales are content locales (the owner can enable and edit them)', () => {
  for (const code of REVIEW_LOCALES) assert.ok(CONTENT_LOCALE_CODES.includes(code), code);
});

test('primary / fallback options: filtering out review locales leaves exactly the six platform locales', () => {
  assert.deepEqual(
    CONTENT_LOCALE_CODES.filter((l) => !isReviewLocale(l)),
    UI_LOCALES,
  );
});

test('the dashboard UI itself is not translated into ku (no ku message file)', () => {
  assert.throws(() => messages('ku'));
});

test('review badge, hint and API error text exist in all six dashboard locales', () => {
  for (const locale of UI_LOCALES) {
    const m = messages(locale);
    const review = m.creator.languageReview;
    assert.ok(typeof review.badge === 'string' && review.badge.trim(), `${locale} badge`);
    assert.ok(typeof review.hint === 'string' && review.hint.trim(), `${locale} hint`);
    // The hint interpolates the language name and its URL prefix.
    assert.ok(review.hint.includes('{language}') && review.hint.includes('{path}'), `${locale} hint placeholders`);
    const err = m.errors.STORE_LANGUAGE_IN_REVIEW;
    assert.ok(typeof err === 'string' && err.trim(), `${locale} error`);
  }
});
