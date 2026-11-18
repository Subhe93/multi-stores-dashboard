// Unit test of the product form quantity when the product has variants.
// Run: node --experimental-strip-types --test src/lib/variantStock.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productStockPayload, stockIsPerVariant, variantStockSummary } from './variantStock.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

test('no active variant: the product-level number counts', () => {
  for (const variants of [undefined, null, [], [{ stock_quantity: 5, is_active: false }]]) {
    assert.deepEqual(variantStockSummary(variants), { kind: 'product' });
    assert.equal(stockIsPerVariant(variants), false);
  }
});

test('every active variant has a number: the sum', () => {
  // The hoodie of the stock test: the product row said 40, the variants 38.
  assert.deepEqual(variantStockSummary([{ stock_quantity: 18, is_active: true }, { stock_quantity: 20, is_active: true }]), {
    kind: 'sum',
    total: 38,
  });
  // Inactive variants are ignored; a negative counts as 0; is_active absent = active.
  assert.deepEqual(
    variantStockSummary([
      { stock_quantity: 3 },
      { stock_quantity: -2, is_active: true },
      { stock_quantity: 100, is_active: false },
      { stock_quantity: null, is_active: false },
    ]),
    { kind: 'sum', total: 3 },
  );
  assert.deepEqual(variantStockSummary([{ stock_quantity: 0, is_active: true }]), { kind: 'sum', total: 0 });
});

test('an untracked active variant: per variant, no total', () => {
  for (const untracked of [null, undefined, Number.NaN]) {
    const variants = [{ stock_quantity: 4, is_active: true }, { stock_quantity: untracked, is_active: true }];
    assert.deepEqual(variantStockSummary(variants), { kind: 'perVariant' });
    assert.equal(stockIsPerVariant(variants), true);
  }
});

test('the product-level number is sent only when no active variant owns the stock', () => {
  assert.equal(productStockPayload('40', []), 40);
  assert.equal(productStockPayload('', []), undefined);
  assert.equal(productStockPayload('40', [{ stock_quantity: 9, is_active: false }]), 40);
  assert.equal(productStockPayload('40', [{ stock_quantity: 18, is_active: true }]), undefined);
  assert.equal(productStockPayload('40', [{ stock_quantity: null, is_active: true }]), undefined);
});

test('the product form uses the helpers and the texts exist in the six locales', () => {
  const source = readFileSync(fileURLToPath(new URL('../components/product/ProductForm.tsx', import.meta.url)), 'utf8');
  assert.ok(source.includes('stock_quantity: productStockPayload(stockQty, variants)'));
  assert.ok(source.includes('variantStockSummary(variants)'));
  for (const locale of LOCALES) {
    const file = fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url));
    const product = JSON.parse(readFileSync(file, 'utf8')).product;
    for (const key of ['quantityPerVariant', 'quantityFromVariantsHelp', 'quantityPerVariantHelp']) {
      assert.ok(typeof product[key] === 'string' && product[key].trim(), `${locale} ${key}`);
      assert.ok(!/[{}]/.test(product[key]), `${locale} ${key}`);
    }
  }
});
