// M165 link field modes and the rollout flag.
// Run: node --experimental-strip-types --test src/lib/linkFieldMode.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  customPrefillFromProduct,
  linkFieldMode,
  pickedProductValue,
  productLinkEnabled,
  productRefId,
  valueOnSwitchToProduct,
} from './linkFieldMode.ts';
import { productLinkPickerFlag } from './productLinkPickerFlag.ts';

const ID = '0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';

test('value to mode', () => {
  assert.equal(linkFieldMode('', undefined), 'custom');
  assert.equal(linkFieldMode(undefined, undefined), 'custom');
  assert.equal(linkFieldMode('/products/a', undefined), 'custom');
  assert.equal(linkFieldMode(`product:${ID}`, undefined), 'product');
  assert.equal(linkFieldMode(`product:${ID.toUpperCase()}`, undefined), 'product');
  assert.equal(linkFieldMode(`product:${ID}#reviews`, undefined), 'product');
  // Reserved kinds are not product references.
  assert.equal(linkFieldMode(`collection:${ID}`, undefined), 'custom');
  assert.equal(linkFieldMode('product:abc', undefined), 'custom');
});

test('productLink off and prefer', () => {
  assert.equal(productLinkEnabled('off'), false);
  assert.equal(productLinkEnabled(undefined), true);
  assert.equal(productLinkEnabled('prefer'), true);
  assert.equal(linkFieldMode(`product:${ID}`, 'off'), 'custom');
  assert.equal(linkFieldMode('', 'prefer'), 'product');
  assert.equal(linkFieldMode('  ', 'prefer'), 'product');
  assert.equal(linkFieldMode('/products/typed', 'prefer'), 'custom');
});

test('picking writes the canonical reference', () => {
  assert.equal(pickedProductValue(ID.toUpperCase()), `product:${ID}`);
  assert.equal(productRefId(pickedProductValue(ID)), ID);
  assert.equal(productRefId('/products/a'), null);
});

test('product to custom pre-fills the address; custom to product keeps the typed value', () => {
  assert.equal(customPrefillFromProduct({ slug: 'skylt' }), '/products/skylt');
  assert.equal(customPrefillFromProduct({ slug: '' }), '');
  assert.equal(customPrefillFromProduct(null), '');
  assert.equal(valueOnSwitchToProduct('/products/typed'), '/products/typed');
  assert.equal(valueOnSwitchToProduct(undefined), '');
});

test('rollout flag: explicit value wins, else on outside production', () => {
  assert.equal(productLinkPickerFlag(undefined, 'development'), true);
  assert.equal(productLinkPickerFlag(undefined, 'production'), false);
  assert.equal(productLinkPickerFlag('1', 'production'), true);
  assert.equal(productLinkPickerFlag('true', 'production'), true);
  assert.equal(productLinkPickerFlag('0', 'development'), false);
  assert.equal(productLinkPickerFlag('', 'production'), false);
});
