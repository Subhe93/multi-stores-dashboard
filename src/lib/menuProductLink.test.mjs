// "Change product" of a PRODUCT menu item (M165).
// Run: node --experimental-strip-types --test src/lib/menuProductLink.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuItemWithProduct } from './menuProductLink.ts';

const OLD = { id: 'a', slug: 'old', translations: [{ locale: 'sv', title: 'Gammal', slug: 'gammal' }] };
const NEXT = { id: 'b', slug: 'new', translations: [{ locale: 'sv', title: 'Ny', slug: 'ny' }] };
const node = (label) => ({ label, url: '/products/gammal', kind: 'PRODUCT', resource_id: 'a' });

test('label follows the product when it still equals the old title', () => {
  const out = menuItemWithProduct(node('Gammal'), NEXT, OLD, 'sv');
  assert.deepEqual(out, { label: 'Ny', url: '/products/ny', kind: 'PRODUCT', resource_id: 'b' });
});

test('an owner-written label is kept', () => {
  assert.equal(menuItemWithProduct(node('Erbjudande'), NEXT, OLD, 'sv').label, 'Erbjudande');
});

test('an empty label takes the new title; unknown old product keeps a written label', () => {
  assert.equal(menuItemWithProduct(node(' '), NEXT, null, 'sv').label, 'Ny');
  assert.equal(menuItemWithProduct(node('Gammal'), NEXT, null, 'sv').label, 'Gammal');
});

test('no slug keeps the stored url', () => {
  const bare = { id: 'c', translations: [{ locale: 'sv', title: 'X' }] };
  assert.equal(menuItemWithProduct(node('Gammal'), bare, OLD, 'sv').url, '/products/gammal');
});
