// Unit test of the store brand name helpers (M166 F).
// Run: node --experimental-strip-types --test src/lib/storeBrandName.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_NAME_MAX, automaticBrandName, buildSeoConfig, cleanBrandName } from './storeBrandName.ts';

test('automaticBrandName: the storefront cut rule', () => {
  assert.equal(automaticBrandName('Namez – Personliga presenter & profilprodukter'), 'Namez');
  assert.equal(automaticBrandName('Shop | Tagline'), 'Shop');
  assert.equal(automaticBrandName('Anna-Design'), 'Anna-Design');
  assert.equal(automaticBrandName(' – only tail'), '– only tail');
  assert.equal(automaticBrandName(null), '');
});

test('cleanBrandName: trims, collapses and caps', () => {
  assert.equal(cleanBrandName('  Namez \n AB '), 'Namez AB');
  assert.equal(cleanBrandName('x'.repeat(200)).length, BRAND_NAME_MAX);
  assert.equal(cleanBrandName(undefined), '');
});

test('buildSeoConfig: keeps unknown keys, writes the brand name, empty removes it', () => {
  const prev = { metaTitle: 'old', other: { a: 1 }, brandName: 'Old' };
  assert.deepEqual(buildSeoConfig(prev, { metaTitle: 'T', metaDescription: 'D', brandName: ' Namez ' }), {
    metaTitle: 'T',
    metaDescription: 'D',
    other: { a: 1 },
    brandName: 'Namez',
  });
  assert.deepEqual(buildSeoConfig(prev, { metaTitle: 'T', metaDescription: 'D', brandName: '   ' }), {
    metaTitle: 'T',
    metaDescription: 'D',
    other: { a: 1 },
  });
  assert.deepEqual(buildSeoConfig(undefined, { metaTitle: '', metaDescription: '', brandName: '' }), {
    metaTitle: '',
    metaDescription: '',
  });
  // The previous object is never mutated.
  assert.equal(prev.brandName, 'Old');
});
