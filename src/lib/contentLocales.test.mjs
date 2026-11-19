// Unit tests of the store content locales and the "in review" locales
// (Kurdish Kurmanji, 'ku': enabled per store as a secondary language, hidden
// from the storefront switcher while in review; the review list is empty now).
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

test('ku left review: the list is empty and ku is a normal content locale', () => {
  assert.deepEqual([...REVIEW_LOCALES], []);
  for (const code of CONTENT_LOCALE_CODES) assert.equal(isReviewLocale(code), false, code);
  assert.equal(isReviewLocale(null), false);
  assert.equal(isReviewLocale(undefined), false);
  assert.equal(isReviewLocale(''), false);
  // With nothing in review, primary / fallback options offer every content locale.
  assert.deepEqual(
    CONTENT_LOCALE_CODES.filter((l) => !isReviewLocale(l)),
    [...UI_LOCALES, 'ku'],
  );
});

test('review mechanism still works with an injected review locale', () => {
  REVIEW_LOCALES.push('ku');
  try {
    assert.equal(isReviewLocale('ku'), true);
    for (const code of UI_LOCALES) assert.equal(isReviewLocale(code), false, code);
    for (const code of REVIEW_LOCALES) assert.ok(CONTENT_LOCALE_CODES.includes(code), code);
    assert.deepEqual(
      CONTENT_LOCALE_CODES.filter((l) => !isReviewLocale(l)),
      UI_LOCALES,
    );
  } finally {
    REVIEW_LOCALES.length = 0;
  }
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
