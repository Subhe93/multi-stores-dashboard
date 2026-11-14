// Builder chrome labels resolve in the dashboard UI locale, not the store
// content locale (a Swedish store edited from an English dashboard must show
// English section/field labels).
// Run: node --experimental-strip-types --test src/lib/labelOf.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS, labelOf } from './section-schemas.ts';

test('picks the requested UI locale when present', () => {
  const loc = { en: 'Heading', ar: 'العنوان', sv: 'Rubrik' };
  assert.equal(labelOf(loc, 'en'), 'Heading');
  assert.equal(labelOf(loc, 'ar'), 'العنوان');
  assert.equal(labelOf(loc, 'sv'), 'Rubrik');
});

test('falls back to English, then to the first value', () => {
  assert.equal(labelOf({ en: 'Heading', ar: 'العنوان' }, 'de'), 'Heading');
  assert.equal(labelOf({ sv: 'Rubrik' }, 'en'), 'Rubrik');
  assert.equal(labelOf({}, 'en'), '');
});

test('an English UI never shows Swedish schema labels', () => {
  // Every schema label/description/option with an English value resolves to
  // it under an English UI, whatever other locales the schema carries.
  const check = (loc) => {
    if (loc && loc.en) assert.equal(labelOf(loc, 'en'), loc.en);
  };
  const walk = (fields) => {
    for (const f of fields || []) {
      check(f.label);
      check(f.description);
      for (const o of f.options || []) check(o.label);
      walk(f.fields);
    }
  };
  for (const s of SECTION_SCHEMAS) {
    check(s.label);
    check(s.description);
    walk(s.schema);
  }
});
