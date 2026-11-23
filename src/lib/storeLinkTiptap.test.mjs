// M165: the rich-text Link extension keeps product references.
// Run: node --experimental-strip-types --test src/lib/storeLinkTiptap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeLinkIsAllowedUri } from './storeLinkTiptap.ts';

const ctx = { defaultValidate: (url) => /^(https?:|mailto:|tel:|\/)/i.test(url) };

test('accepts product:<uuid>, rejects malformed product: values', () => {
  assert.equal(storeLinkIsAllowedUri('product:0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5', ctx), true);
  assert.equal(storeLinkIsAllowedUri('product:0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5#reviews', ctx), true);
  assert.equal(storeLinkIsAllowedUri('product:x', ctx), false);
  assert.equal(storeLinkIsAllowedUri('product:javascript:alert(1)', ctx), false);
});

test('other links keep the default rules', () => {
  assert.equal(storeLinkIsAllowedUri('https://x.se', ctx), true);
  assert.equal(storeLinkIsAllowedUri('/products/a', ctx), true);
  assert.equal(storeLinkIsAllowedUri('javascript:alert(1)', ctx), false);
});
