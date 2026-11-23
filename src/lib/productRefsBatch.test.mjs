// M165 batched product lookup by id (link field and menu chips) and the
// menu "Change product" helper.
// Run: node --experimental-strip-types --test src/lib/productRefsBatch.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProductRefsBatcher, PRODUCT_REFS_MAX_IDS, productRefSlug, productRefTitle } from './productRefsBatch.ts';
import { menuItemWithProduct } from './menuProductLink.ts';

const id = (n) => `${String(n).padStart(8, '0')}-1a2b-4c3d-8e9f-a0b1c2d3e4f5`;

test('ids asked in one tick go out as one request', async () => {
  const calls = [];
  const b = createProductRefsBatcher({
    fetchIds: async (ids) => {
      calls.push(ids);
      return ids.filter((x) => x !== id(2)).map((x) => ({ id: x }));
    },
  });
  const [a, c, d] = await Promise.all([b.get(id(1)), b.get(id(2)), b.get(id(1).toUpperCase())]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [id(1), id(2)]);
  assert.equal(a.state, 'ok');
  assert.equal(c.state, 'missing');
  assert.equal(d.state, 'ok');
  // Cached: no second request.
  await b.get(id(1));
  assert.equal(calls.length, 1);
  assert.equal(b.peek(id(2)).state, 'missing');
});

test('at most 50 ids per request', async () => {
  const calls = [];
  const b = createProductRefsBatcher({
    fetchIds: async (ids) => {
      calls.push(ids.length);
      return [];
    },
  });
  await Promise.all(Array.from({ length: 120 }, (_, i) => b.get(id(i))));
  assert.equal(PRODUCT_REFS_MAX_IDS, 50);
  assert.deepEqual(calls, [50, 50, 20]);
});

test('a network error is not "missing" and is retried', async () => {
  let fail = true;
  const b = createProductRefsBatcher({
    fetchIds: async (ids) => {
      if (fail) throw new Error('offline');
      return ids.map((x) => ({ id: x }));
    },
  });
  assert.equal((await b.get(id(1))).state, 'error');
  assert.equal(b.peek(id(1)), undefined);
  fail = false;
  assert.equal((await b.get(id(1))).state, 'ok');
});

test('seed and invalidate', async () => {
  let calls = 0;
  const b = createProductRefsBatcher({
    fetchIds: async (ids) => {
      calls++;
      return ids.map((x) => ({ id: x }));
    },
  });
  b.seed({ id: id(7).toUpperCase(), status: 'DRAFT' });
  assert.equal((await b.get(id(7))).state, 'ok');
  assert.equal(calls, 0);
  b.invalidate(id(7));
  await b.get(id(7));
  assert.equal(calls, 1);
});

test('title and slug helpers', () => {
  const p = {
    id: id(1),
    slug: 'first',
    translations: [
      { locale: 'sv', title: 'Skylt', slug: 'skylt' },
      { locale: 'en', title: '', slug: 'sign' },
    ],
  };
  assert.equal(productRefTitle(p, 'en', 'sv'), 'Skylt');
  assert.equal(productRefTitle(p, 'sv'), 'Skylt');
  assert.equal(productRefSlug(p, 'en'), 'sign');
  assert.equal(productRefSlug(p, 'de'), 'first');
});

test('menu Change product: label follows only when it was the old title', () => {
  const prev = { id: id(1), translations: [{ locale: 'sv', title: 'Old', slug: 'old' }] };
  const next = { id: id(2), slug: 'new', translations: [{ locale: 'sv', title: 'New', slug: 'new' }] };
  const node = { label: 'Old', url: '/products/old', kind: 'PRODUCT', resource_id: id(1), cid: 'x' };
  const out = menuItemWithProduct(node, next, prev, 'sv');
  assert.deepEqual(out, { ...node, label: 'New', url: '/products/new', resource_id: id(2) });
  const custom = menuItemWithProduct({ ...node, label: 'Shop now' }, next, prev, 'sv');
  assert.equal(custom.label, 'Shop now');
  // Previous product unknown (deleted): an owner label is kept.
  assert.equal(menuItemWithProduct(node, next, null, 'sv').label, 'Old');
});
