// Unit test of the store-wide custom CSS helpers used by the theme customizer.
// Run: node --experimental-strip-types --test src/lib/customCss.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_CSS_MAX_LENGTH, customCssOf, isCustomCssTooLong, withCustomCss } from './customCss.ts';

test('the cap is 20000 characters', () => {
  assert.equal(CUSTOM_CSS_MAX_LENGTH, 20000);
  assert.equal(isCustomCssTooLong('a'.repeat(20000)), false);
  assert.equal(isCustomCssTooLong('a'.repeat(20001)), true);
});

test('customCssOf reads a string and nothing else', () => {
  assert.equal(customCssOf({ customCss: 'a{}' }), 'a{}');
  assert.equal(customCssOf({ customCss: 5 }), '');
  assert.equal(customCssOf({}), '');
  assert.equal(customCssOf(null), '');
  assert.equal(customCssOf(undefined), '');
});

test('withCustomCss sets the key and keeps the other customizations', () => {
  const before = { colors: { primary: '#000' }, product: { swatchShape: 'square' } };
  const after = withCustomCss(before, 'a { color: red }');
  assert.deepEqual(after, { ...before, customCss: 'a { color: red }' });
  // The input object is not mutated.
  assert.equal('customCss' in before, false);
});

test('a blank value deletes the key', () => {
  const before = { colors: { primary: '#000' }, customCss: 'a{}' };
  for (const blank of ['', '   ', '\n\t ']) {
    const after = withCustomCss(before, blank);
    assert.equal('customCss' in after, false);
    assert.deepEqual(after, { colors: { primary: '#000' } });
  }
  assert.equal(before.customCss, 'a{}');
});
