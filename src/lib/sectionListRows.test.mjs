// Unit tests of the tree section-list row helpers.
// Run: node --experimental-strip-types --test src/lib/sectionListRows.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ancestorIds, buildListRows, normalizeFlatOrder, resolveDropTarget } from './sectionListRows.ts';
import { flattenTree, getProjection, moveSection, removeChildrenOf } from './sectionTree.ts';

const s = (id, section_key, sort_order, parent_id = null) => ({ id, section_key, sort_order, parent_id });

// row[ col1[gallery], col2[title, price] ], tabs
const tree = [
  s('row', 'layout-row', 0),
  s('col1', 'layout-column', 0, 'row'),
  s('gallery', 'product-gallery', 0, 'col1'),
  s('col2', 'layout-column', 1, 'row'),
  s('title', 'product-title', 0, 'col2'),
  s('price', 'product-price', 1, 'col2'),
  s('tabs', 'product-tabs', 1),
];

const describeRows = (rows) =>
  rows.map((r) => (r.kind === 'section' ? r.item.id : `+${r.parentId}@${r.index}/d${r.depth}`));

test('flat page: no add slots, rows mirror the list', () => {
  const flat = [s('a', 'hero', 0), s('b', 'rich-text', 1), s('c', 'faq', 2)];
  assert.deepEqual(describeRows(buildListRows(flattenTree(flat))), ['a', 'b', 'c']);
});

test('add slot after the last descendant of every expanded container, innermost first', () => {
  const rows = buildListRows(flattenTree(tree));
  assert.deepEqual(describeRows(rows), [
    'row',
    'col1',
    'gallery',
    '+col1@1/d3',
    'col2',
    'title',
    'price',
    '+col2@2/d3',
    '+row@2/d2',
    'tabs',
  ]);
});

test('empty container gets a slot at index 0', () => {
  const list = [s('row', 'layout-row', 0), s('x', 'hero', 1)];
  assert.deepEqual(describeRows(buildListRows(flattenTree(list))), ['row', '+row@0/d2', 'x']);
});

test('collapsed containers and the dragged container get no slot', () => {
  const collapsed = new Set(['col2']);
  const rows = buildListRows(flattenTree(tree, collapsed), { collapsed });
  assert.deepEqual(describeRows(rows), ['row', 'col1', 'gallery', '+col1@1/d3', 'col2', '+row@2/d2', 'tabs']);

  const dragging = removeChildrenOf(flattenTree(tree), ['row']);
  assert.deepEqual(describeRows(buildListRows(dragging, { activeId: 'row' })), ['row', 'tabs']);
});

test('container at the end of the list closes its slots', () => {
  const list = [s('a', 'hero', 0), s('col', 'layout-column', 1), s('b', 'faq', 0, 'col')];
  assert.deepEqual(describeRows(buildListRows(flattenTree(list))), ['a', 'col', 'b', '+col@1/d2']);
});

test('normalizeFlatOrder keeps the array order on flat pages only', () => {
  const flat = [s('b', 'hero', 5), s('a', 'faq', 2)];
  const norm = normalizeFlatOrder(flat);
  assert.deepEqual(flattenTree(norm).map((f) => f.id), ['b', 'a']);
  assert.deepEqual(flat.map((x) => x.sort_order), [5, 2], 'input untouched');

  const ordered = [s('a', 'hero', 0), s('b', 'faq', 1)];
  assert.equal(normalizeFlatOrder(ordered), ordered, 'same reference when already in order');
  assert.equal(normalizeFlatOrder(tree), tree, 'tree pages follow sort_order');
});

test('ancestorIds walks up to the root, nearest first, cycle-safe', () => {
  assert.deepEqual(ancestorIds(tree, 'title'), ['col2', 'row']);
  assert.deepEqual(ancestorIds(tree, 'tabs'), []);
  assert.deepEqual(ancestorIds(tree, null), []);
  const cyc = [s('a', 'layout-row', 0, 'b'), s('b', 'layout-column', 0, 'a')];
  assert.deepEqual(ancestorIds(cyc, 'a'), ['b']);
});

test('resolveDropTarget: null when not allowed or unchanged', () => {
  assert.equal(resolveDropTarget(null, { allowed: true, parentId: null, index: 0 }), null);
  assert.equal(resolveDropTarget({ parentId: null, index: 0 }, null), null);
  assert.equal(
    resolveDropTarget({ parentId: null, index: 1 }, { allowed: false, parentId: 'row', index: 0 }),
    null,
  );
  assert.equal(resolveDropTarget({ parentId: 'col2', index: 1 }, { allowed: true, parentId: 'col2', index: 1 }), null);
  assert.deepEqual(
    resolveDropTarget({ parentId: 'col2', index: 1 }, { allowed: true, parentId: 'col1', index: 0 }),
    { parentId: 'col1', index: 0 },
  );
});

test('flat page drag matches the old arrayMove reorder', () => {
  const flat = [s('a', 'hero', 0), s('b', 'rich-text', 1), s('c', 'faq', 2), s('d', 'video', 3)];
  const cases = [
    ['a', 'c'],
    ['d', 'a'],
    ['b', 'd'],
    ['c', 'b'],
  ];
  for (const [activeId, overId] of cases) {
    const items = flattenTree(flat);
    const active = items.find((i) => i.id === activeId);
    const target = resolveDropTarget(active, getProjection(items, activeId, overId, 0, 16));
    assert.ok(target, `${activeId}->${overId}`);
    const moved = moveSection(flat, activeId, target).map((x) => x.id);
    const from = flat.findIndex((x) => x.id === activeId);
    const to = flat.findIndex((x) => x.id === overId);
    const expected = flat.map((x) => x.id);
    const [it] = expected.splice(from, 1);
    expected.splice(to, 0, it);
    assert.deepEqual(moved, expected, `${activeId}->${overId}`);
  }
});

test('flat page with drifted sort_order: reorder ids match arrayMove of the shown order', () => {
  // A0 B1 C2 D3, delete A and B, add E (sort_order = sibling count = 2).
  const sections = [s('c', 'hero', 2), s('d', 'faq', 3), s('e', 'video', 2)];
  // Mirrors SectionList.handleDragEnd on a flat page.
  const ordered = normalizeFlatOrder(sections);
  const items = flattenTree(ordered);
  assert.deepEqual(items.map((i) => i.id), ['c', 'd', 'e'], 'list shows the array order');
  const active = items.find((i) => i.id === 'c');
  const target = resolveDropTarget(active, getProjection(items, 'c', 'd', 0, 16));
  assert.deepEqual(target, { parentId: null, index: 1 });
  const next = moveSection(ordered, 'c', target);
  assert.notEqual(next, ordered);
  const sent = flattenTree(next).map((f) => f.id);
  // arrayMove(['c','d','e'], 0, 1)
  assert.deepEqual(sent, ['d', 'c', 'e']);
  // Applying the same target to the raw (drifted) list would give a different order.
  assert.notDeepEqual(flattenTree(moveSection(sections, 'c', target)).map((f) => f.id), sent);
});

test('dragging a leaf right under a container nests it; a container never goes too deep', () => {
  const list = [s('row', 'layout-row', 0), s('col', 'layout-column', 0, 'row'), s('x', 'hero', 1)];
  const items = flattenTree(list);
  // x dropped on its own place, dragged one indent right: into col (depth 3).
  const p = getProjection(items, 'x', 'x', 32, 16);
  assert.deepEqual(resolveDropTarget(items.find((i) => i.id === 'x'), p), { parentId: 'col', index: 0 });

  // A row holding a column (height 2) dragged far right under a column: the
  // projection caps it at depth 2 (depth 3 would put its child at depth 4).
  const list2 = [
    s('col', 'layout-column', 0),
    s('row', 'layout-row', 1),
    s('inner', 'layout-column', 0, 'row'),
  ];
  const items2 = removeChildrenOf(flattenTree(list2), ['row']);
  const p2 = getProjection(items2, 'row', 'row', 64, 16, 2);
  const t2 = resolveDropTarget(items2.find((i) => i.id === 'row'), p2);
  // Capped to depth 2 inside col: row (height 2) at depth 2 fits exactly.
  assert.deepEqual(t2, { parentId: 'col', index: 0 });
  assert.notEqual(moveSection(list2, 'row', t2), list2);
});
