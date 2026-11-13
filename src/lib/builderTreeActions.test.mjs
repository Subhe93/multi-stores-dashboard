// Unit tests of the builder tree-action helpers.
// Run: node --experimental-strip-types --test src/lib/builderTreeActions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  usesSectionTree,
  parentIdOf,
  siblingsOf,
  siblingMoveTarget,
  missingInCreateOrder,
  remapSectionId,
  survivorsInsideDropped,
  topMostDropped,
  newSubtreeRootId,
} from './builderTreeActions.ts';

const s = (id, sort_order, parent_id = null, section_key = 'rich-text') => ({ id, section_key, sort_order, parent_id });

// row > [colA > [g, t], colB > [p]], tabs at root
const tree = () => [
  s('row', 0, null, 'layout-row'),
  s('colA', 0, 'row', 'layout-column'),
  s('g', 0, 'colA', 'product-gallery'),
  s('t', 1, 'colA', 'product-title'),
  s('colB', 1, 'row', 'layout-column'),
  s('p', 0, 'colB', 'product-price'),
  s('tabs', 1, null, 'product-tabs'),
];

test('usesSectionTree: flat page vs nested page', () => {
  assert.equal(usesSectionTree([s('a', 0), s('b', 1)]), false);
  assert.equal(usesSectionTree([s('a', 0), s('row', 1, null, 'layout-row')]), true);
  assert.equal(usesSectionTree([s('a', 0, 'x')]), true);
  assert.equal(usesSectionTree([{ id: 'a', section_key: 'x', sort_order: 0 }]), false);
});

test('parentIdOf and siblingsOf', () => {
  const list = tree();
  assert.equal(parentIdOf(list, 't'), 'colA');
  assert.equal(parentIdOf(list, 'row'), null);
  assert.equal(parentIdOf(list, 'nope'), null);
  assert.deepEqual(siblingsOf(list, 'row').map((x) => x.id), ['colA', 'colB']);
  assert.deepEqual(siblingsOf(list, null).map((x) => x.id), ['row', 'tabs']);
});

test('siblingMoveTarget stays among siblings', () => {
  const list = tree();
  assert.deepEqual(siblingMoveTarget(list, 't', -1), { parentId: 'colA', index: 0 });
  assert.equal(siblingMoveTarget(list, 't', 1), null);
  assert.equal(siblingMoveTarget(list, 'g', -1), null);
  assert.deepEqual(siblingMoveTarget(list, 'row', 1), { parentId: null, index: 1 });
  assert.equal(siblingMoveTarget(list, 'p', 1), null);
  assert.equal(siblingMoveTarget(list, 'missing', 1), null);
});

test('siblingMoveTarget on a flat page matches the old swap', () => {
  const list = [s('a', 0), s('b', 1), s('c', 2)];
  assert.deepEqual(siblingMoveTarget(list, 'b', 1), { parentId: null, index: 2 });
  assert.deepEqual(siblingMoveTarget(list, 'b', -1), { parentId: null, index: 0 });
});

test('missingInCreateOrder puts parents before children', () => {
  const list = tree();
  const order = missingInCreateOrder(list, new Set(['tabs']));
  const ids = order.map((x) => x.id);
  assert.ok(ids.indexOf('row') < ids.indexOf('colA'));
  assert.ok(ids.indexOf('colA') < ids.indexOf('g'));
  assert.ok(ids.indexOf('colB') < ids.indexOf('p'));
  assert.equal(ids.includes('tabs'), false);
  // Only what is missing.
  assert.deepEqual(missingInCreateOrder(list, new Set(list.map((x) => x.id))), []);
});

test('remapSectionId rewrites the id and children parent_id', () => {
  const list = tree();
  remapSectionId(list, 'colA', 'NEW');
  assert.ok(list.some((x) => x.id === 'NEW'));
  assert.equal(list.find((x) => x.id === 'g').parent_id, 'NEW');
  assert.equal(list.find((x) => x.id === 't').parent_id, 'NEW');
  assert.equal(list.find((x) => x.id === 'p').parent_id, 'colB');
});

test('survivorsInsideDropped finds kept sections under dropped containers', () => {
  const list = tree();
  // Target drops the row and colA but keeps g (e.g. g was at root in the snapshot).
  const targetIds = new Set(['g', 'colB', 'p', 'tabs', 't']);
  const out = survivorsInsideDropped(list, targetIds);
  assert.deepEqual([...out].sort(), ['colB', 'g', 'p', 't']);
  assert.equal(survivorsInsideDropped(list, new Set(list.map((x) => x.id))).size, 0);
});

test('topMostDropped only lists the highest dropped sections', () => {
  const list = tree();
  const targetIds = new Set(['tabs']);
  assert.deepEqual(topMostDropped(list, targetIds), ['row']);
  assert.deepEqual(topMostDropped(list, new Set(['row', 'colA', 'colB', 'p', 'tabs'])), ['g', 't']);
});

test('newSubtreeRootId finds the duplicated root', () => {
  const before = tree();
  const after = [...tree(), s('colA2', 1, 'row', 'layout-column'), s('g2', 0, 'colA2'), s('t2', 1, 'colA2')];
  assert.equal(newSubtreeRootId(before, after), 'colA2');
  assert.equal(newSubtreeRootId(before, before), null);
});
