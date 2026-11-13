// Unit tests of the nested-section tree helpers (layout containers).
// Run: node --experimental-strip-types --test src/lib/sectionTree.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTAINER_KEYS,
  MAX_SECTION_DEPTH,
  isContainerKey,
  buildTree,
  flattenTree,
  collectSubtreeIds,
  removeSubtree,
  subtreeHeight,
  canDropInto,
  validateMove,
  moveSection,
  toTreeReorderPayload,
  removeChildrenOf,
  getProjection,
  getChildLayoutValue,
  setChildLayoutValue,
} from './sectionTree.ts';
import { SECTION_SCHEMAS, CHILD_LAYOUT_FIELDS, findSectionSchema } from './section-schemas.ts';
import { isAvailableForPageType } from './sectionAvailability.ts';

const s = (id, section_key, sort_order, parent_id) =>
  parent_id === undefined ? { id, section_key, sort_order } : { id, section_key, sort_order, parent_id };

// Classic product layout:
// row(r) [ col(c1)[gallery] | col(c2)[title, price] ] , tabs
const classic = () => [
  s('tabs', 'product-tabs', 1),
  s('r', 'layout-row', 0, null),
  s('price', 'product-price', 1, 'c2'),
  s('c1', 'layout-column', 0, 'r'),
  s('c2', 'layout-column', 1, 'r'),
  s('gallery', 'product-gallery', 0, 'c1'),
  s('title', 'product-title', 0, 'c2'),
];

const order = (list) => flattenTree(list).map((f) => `${'-'.repeat(f.depth - 1)}${f.id}`);
const sortOf = (list, id) => list.find((x) => x.id === id).sort_order;
const parentOf = (list, id) => list.find((x) => x.id === id).parent_id ?? null;

test('isContainerKey knows exactly the three containers', () => {
  assert.deepEqual([...CONTAINER_KEYS], ['layout-row', 'layout-column', 'layout-grid']);
  for (const k of CONTAINER_KEYS) assert.equal(isContainerKey(k), true);
  for (const k of ['layout-columns', 'product-page', 'hero-banner', '', null, undefined]) {
    assert.equal(isContainerKey(k), false, String(k));
  }
});

test('buildTree nests by parent_id and orders siblings by sort_order', () => {
  const roots = buildTree(classic());
  assert.deepEqual(roots.map((n) => n.section.id), ['r', 'tabs']);
  const row = roots[0];
  assert.equal(row.depth, 1);
  assert.equal(row.parentId, null);
  assert.deepEqual(row.children.map((n) => n.section.id), ['c1', 'c2']);
  assert.deepEqual(row.children[1].children.map((n) => n.section.id), ['title', 'price']);
  assert.equal(row.children[1].children[0].depth, 3);
  assert.equal(row.children[1].children[0].parentId, 'c2');
});

test('a flat legacy list (no parent_id) stays a flat list in the same order', () => {
  const list = [s('b', 'rich-text', 1), s('a', 'hero-banner', 0), s('c', 'faq', 2)];
  const flat = flattenTree(list);
  assert.deepEqual(flat.map((f) => f.id), ['a', 'b', 'c']);
  assert.ok(flat.every((f) => f.depth === 1 && f.parentId === null));
  assert.deepEqual(flat.map((f) => f.index), [0, 1, 2]);
});

test('sort_order ties keep the list order', () => {
  const list = [s('x', 'faq', 0), s('y', 'faq', 0), s('z', 'faq', 0)];
  assert.deepEqual(flattenTree(list).map((f) => f.id), ['x', 'y', 'z']);
});

test('orphans, non-container parents, self-parents and cycles are promoted to the root', () => {
  const list = [
    s('a', 'faq', 0),
    s('orphan', 'faq', 1, 'missing'),
    s('leafchild', 'faq', 2, 'a'), // parent is not a container
    s('self', 'layout-row', 3, 'self'),
    s('cy1', 'layout-row', 4, 'cy2'),
    s('cy2', 'layout-column', 5, 'cy1'),
  ];
  const flat = flattenTree(list);
  assert.equal(flat.length, list.length, 'nothing disappears');
  for (const id of ['a', 'orphan', 'leafchild', 'self']) {
    const f = flat.find((x) => x.id === id);
    assert.equal(f.depth, 1, id);
    assert.equal(f.parentId, null, id);
  }
  // One cycle member is promoted, the other hangs below it.
  const cy = flat.filter((f) => f.id.startsWith('cy'));
  assert.equal(cy.length, 2);
  assert.equal(cy[0].depth, 1);
  assert.equal(cy[1].depth, 2);
});

test('flattenTree is pre-order with depth, parentId, index and childCount', () => {
  const flat = flattenTree(classic());
  assert.deepEqual(order(classic()), ['r', '-c1', '--gallery', '-c2', '--title', '--price', 'tabs']);
  const byId = Object.fromEntries(flat.map((f) => [f.id, f]));
  assert.equal(byId.r.childCount, 2);
  assert.equal(byId.r.isContainer, true);
  assert.equal(byId.price.index, 1);
  assert.equal(byId.price.parentId, 'c2');
  assert.equal(byId.tabs.index, 1);
  assert.equal(byId.gallery.isContainer, false);
});

test('flattenTree hides the descendants of collapsed containers', () => {
  assert.deepEqual(flattenTree(classic(), new Set(['c2'])).map((f) => f.id), ['r', 'c1', 'gallery', 'c2', 'tabs']);
  const collapsedRow = flattenTree(classic(), ['r']);
  assert.deepEqual(collapsedRow.map((f) => f.id), ['r', 'tabs']);
  assert.equal(collapsedRow[0].childCount, 2, 'count stays visible when collapsed');
});

test('collectSubtreeIds and removeSubtree', () => {
  assert.deepEqual(collectSubtreeIds(classic(), 'r'), ['r', 'c1', 'gallery', 'c2', 'title', 'price']);
  assert.deepEqual(collectSubtreeIds(classic(), 'c2').sort(), ['c2', 'price', 'title']);
  assert.deepEqual(collectSubtreeIds(classic(), 'title'), ['title']);
  assert.deepEqual(collectSubtreeIds(classic(), 'nope'), []);
  const cyc = [s('a', 'layout-row', 0, 'b'), s('b', 'layout-column', 0, 'a')];
  assert.deepEqual(collectSubtreeIds(cyc, 'a').sort(), ['a', 'b'], 'cycle-safe');

  const left = removeSubtree(classic(), 'c2');
  assert.deepEqual(left.map((x) => x.id).sort(), ['c1', 'gallery', 'r', 'tabs']);
  assert.equal(removeSubtree(classic(), 'r').length, 1);
  assert.equal(removeSubtree(classic(), 'nope').length, 7);
});

test('subtreeHeight', () => {
  assert.equal(subtreeHeight(classic(), 'r'), 3);
  assert.equal(subtreeHeight(classic(), 'c1'), 2);
  assert.equal(subtreeHeight(classic(), 'gallery'), 1);
  assert.equal(subtreeHeight([s('g', 'layout-grid', 0)], 'g'), 1, 'empty container');
});

test('canDropInto follows the contract', () => {
  const row = { section_key: 'layout-row' };
  const col = { section_key: 'layout-column' };
  const leafParent = { section_key: 'rich-text' };
  // Root.
  assert.equal(canDropInto('faq', null, 1), true);
  assert.equal(canDropInto('layout-row', null, 1), true);
  assert.equal(canDropInto('faq', null, 2), false);
  // Only containers are parents.
  assert.equal(canDropInto('faq', leafParent, 2), false);
  assert.equal(canDropInto('faq', row, 2), true);
  assert.equal(canDropInto('faq', col, 3), true);
  // Depth limits.
  assert.equal(MAX_SECTION_DEPTH, 3);
  assert.equal(canDropInto('faq', col, 4), false);
  assert.equal(canDropInto('layout-column', row, 2), true);
  assert.equal(canDropInto('layout-column', row, 3), false, 'containers only at depth 1-2');
  // Height of the moved subtree counts.
  assert.equal(canDropInto('layout-column', row, 2, 2), true);
  assert.equal(canDropInto('layout-row', row, 2, 3), false);
  assert.equal(canDropInto('layout-row', null, 1, 3), true);
  // Bad input.
  assert.equal(canDropInto('faq', null, 0), false);
  assert.equal(canDropInto('faq', row, 1), false);
  assert.equal(canDropInto('faq', null, 1.5), false);
});

test('validateMove rejects cycles, non-containers and too-deep moves', () => {
  const list = classic();
  assert.deepEqual(validateMove(list, 'tabs', { parentId: 'c1' }), { ok: true });
  assert.deepEqual(validateMove(list, 'nope', { parentId: null }), { ok: false, reason: 'not-found' });
  assert.deepEqual(validateMove(list, 'tabs', { parentId: 'nope' }), { ok: false, reason: 'parent-not-found' });
  assert.deepEqual(validateMove(list, 'tabs', { parentId: 'title' }), { ok: false, reason: 'parent-not-container' });
  assert.deepEqual(validateMove(list, 'r', { parentId: 'c1' }), { ok: false, reason: 'cycle' });
  assert.deepEqual(validateMove(list, 'r', { parentId: 'r' }), { ok: false, reason: 'cycle' });
  // c2 (height 2) into c1 would put title/price at depth 4.
  assert.deepEqual(validateMove(list, 'c2', { parentId: 'c1' }), { ok: false, reason: 'too-deep' });
  // Row (height 3) cannot go under anything.
  const withGrid = [...list, s('g', 'layout-grid', 2)];
  assert.deepEqual(validateMove(withGrid, 'r', { parentId: 'g' }), { ok: false, reason: 'too-deep' });
  // An empty column can go into a grid.
  const empty = [...withGrid, s('ec', 'layout-column', 3)];
  assert.deepEqual(validateMove(empty, 'ec', { parentId: 'g' }), { ok: true });
});

test('moveSection moves into a container and re-numbers both sibling groups', () => {
  const next = moveSection(classic(), 'tabs', { parentId: 'c2', index: 1 });
  assert.deepEqual(order(next), ['r', '-c1', '--gallery', '-c2', '--title', '--tabs', '--price']);
  assert.equal(parentOf(next, 'tabs'), 'c2');
  assert.equal(sortOf(next, 'title'), 0);
  assert.equal(sortOf(next, 'tabs'), 1);
  assert.equal(sortOf(next, 'price'), 2);
  assert.equal(sortOf(next, 'r'), 0);
  // The returned list is in pre-order.
  assert.deepEqual(next.map((x) => x.id), ['r', 'c1', 'gallery', 'c2', 'title', 'tabs', 'price']);
});

test('moveSection moves out of a container to the root', () => {
  const next = moveSection(classic(), 'price', { parentId: null, index: 0 });
  assert.deepEqual(order(next), ['price', 'r', '-c1', '--gallery', '-c2', '--title', 'tabs']);
  assert.equal(parentOf(next, 'price'), null);
  assert.deepEqual(['price', 'r', 'tabs'].map((id) => sortOf(next, id)), [0, 1, 2]);
  assert.equal(sortOf(next, 'title'), 0);
});

test('moveSection moves a whole subtree and keeps its inner order', () => {
  const next = moveSection(classic(), 'c2', { parentId: 'r', index: 0 });
  assert.deepEqual(order(next), ['r', '-c2', '--title', '--price', '-c1', '--gallery', 'tabs']);
  assert.equal(sortOf(next, 'c2'), 0);
  assert.equal(sortOf(next, 'c1'), 1);
});

test('moveSection reorders within siblings and clamps the index', () => {
  const flat = [s('a', 'faq', 0), s('b', 'faq', 1), s('c', 'faq', 2)];
  assert.deepEqual(moveSection(flat, 'a', { parentId: null, index: 99 }).map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(moveSection(flat, 'c', { parentId: null, index: -5 }).map((x) => x.id), ['c', 'a', 'b']);
  const same = moveSection(flat, 'b', { parentId: null, index: 1 });
  assert.deepEqual(same.map((x) => x.sort_order), [0, 1, 2]);
  assert.equal(same[0], flat[0], 'unchanged sections keep their identity');
});

test('moveSection returns the input list on an invalid move', () => {
  const list = classic();
  assert.equal(moveSection(list, 'r', { parentId: 'c1', index: 0 }), list);
  assert.equal(moveSection(list, 'tabs', { parentId: 'title', index: 0 }), list);
  assert.equal(moveSection(list, 'c2', { parentId: 'c1', index: 0 }), list);
  assert.equal(moveSection(list, 'ghost', { parentId: null, index: 0 }), list);
});

test('moveSection does not mutate its input', () => {
  const list = classic();
  const snapshot = JSON.stringify(list);
  moveSection(list, 'tabs', { parentId: 'c1', index: 0 });
  assert.equal(JSON.stringify(list), snapshot);
});

test('toTreeReorderPayload sends the full list with sibling-scoped order', () => {
  const list = [
    s('r', 'layout-row', 5, null),
    s('a', 'faq', 9, 'r'),
    s('b', 'faq', 3, 'r'),
    s('t', 'product-tabs', 7),
    s('o', 'faq', 8, 'missing'),
  ];
  const { items } = toTreeReorderPayload(list);
  assert.equal(items.length, list.length);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.deepEqual(byId.r, { id: 'r', parent_id: null, sort_order: 0 });
  assert.deepEqual(byId.b, { id: 'b', parent_id: 'r', sort_order: 0 });
  assert.deepEqual(byId.a, { id: 'a', parent_id: 'r', sort_order: 1 });
  assert.deepEqual(byId.t, { id: 't', parent_id: null, sort_order: 1 });
  assert.deepEqual(byId.o, { id: 'o', parent_id: null, sort_order: 2 }, 'orphan sent as root');
});

test('removeChildrenOf drops all descendants of the dragged item', () => {
  const flat = flattenTree(classic());
  assert.deepEqual(removeChildrenOf(flat, ['r']).map((f) => f.id), ['r', 'tabs']);
  assert.deepEqual(removeChildrenOf(flat, ['c2']).map((f) => f.id), ['r', 'c1', 'gallery', 'c2', 'tabs']);
  assert.deepEqual(removeChildrenOf(flat, ['title']).length, flat.length);
});

const W = 24; // indentation width

test('getProjection: no horizontal offset keeps a reorder among root siblings', () => {
  const items = flattenTree([s('a', 'faq', 0), s('b', 'faq', 1), s('c', 'faq', 2)]);
  const p = getProjection(items, 'a', 'c', 0, W);
  assert.equal(p.depth, 1);
  assert.equal(p.parentId, null);
  assert.equal(p.index, 2);
  assert.equal(p.allowed, true);
});

test('getProjection: dragging right under a container nests into it', () => {
  // row(empty), faq  -> drag faq right while over itself (below the row).
  const list = [s('row', 'layout-row', 0), s('f', 'faq', 1)];
  const items = flattenTree(list);
  const p = getProjection(items, 'f', 'f', W, W);
  assert.equal(p.depth, 2);
  assert.equal(p.parentId, 'row');
  assert.equal(p.index, 0);
  assert.equal(p.allowed, true);
  const moved = moveSection(list, 'f', { parentId: p.parentId, index: p.index });
  assert.equal(parentOf(moved, 'f'), 'row');
});

test('getProjection: cannot nest under a leaf', () => {
  const items = flattenTree([s('a', 'faq', 0), s('b', 'faq', 1)]);
  const p = getProjection(items, 'b', 'b', W * 3, W);
  assert.equal(p.depth, 1);
  assert.equal(p.parentId, null);
});

test('getProjection: dragging left moves out of a container', () => {
  const list = classic();
  // Drag "price" (last child of c2, at depth 3) two steps left: it lands on the root after r.
  const items = flattenTree(list);
  const p = getProjection(items, 'price', 'price', -2 * W, W);
  assert.equal(p.depth, 1);
  assert.equal(p.parentId, null);
  assert.equal(p.index, 1);
  const moved = moveSection(list, 'price', { parentId: p.parentId, index: p.index });
  assert.deepEqual(order(moved), ['r', '-c1', '--gallery', '-c2', '--title', 'price', 'tabs']);
});

test('getProjection: one step left lands in the parent container', () => {
  const items = flattenTree(classic());
  const p = getProjection(items, 'price', 'price', -W, W);
  assert.equal(p.depth, 2);
  assert.equal(p.parentId, 'r');
  assert.equal(p.index, 2);
});

test('getProjection: next item keeps its parent (min depth)', () => {
  const items = flattenTree(classic());
  // Drag tabs up over "gallery" with a big left offset: it lands before gallery,
  // which must stay in c1, so tabs goes into c1 too (depth 3, index 0).
  const p = getProjection(removeChildrenOf(items, ['tabs']), 'tabs', 'gallery', -10 * W, W);
  assert.equal(p.minDepth, 3);
  assert.equal(p.depth, 3);
  assert.equal(p.parentId, 'c1');
  assert.equal(p.index, 0);
  // Dragging down over "c2" from inside c1: the next item is title (depth 3).
  const q = getProjection(items, 'gallery', 'c2', -10 * W, W);
  assert.equal(q.minDepth, 3);
  assert.equal(q.parentId, 'c2');
  assert.equal(q.index, 0);
});

test('getProjection: depth limit for leaves and containers', () => {
  // row > col, drag a leaf right under the column: max depth 3.
  const list = [s('r', 'layout-row', 0), s('c', 'layout-column', 0, 'r'), s('f', 'faq', 1)];
  const items = flattenTree(list);
  const leaf = getProjection(items, 'f', 'f', 10 * W, W);
  assert.equal(leaf.depth, 3);
  assert.equal(leaf.parentId, 'c');
  assert.equal(leaf.allowed, true);

  // A container cannot go to depth 3.
  const list2 = [s('r', 'layout-row', 0), s('c', 'layout-column', 0, 'r'), s('g', 'layout-grid', 1)];
  const cont = getProjection(flattenTree(list2), 'g', 'g', 10 * W, W);
  assert.equal(cont.depth, 2);
  assert.equal(cont.parentId, 'r');

  // A container with children (height 2) cannot nest at all below a row's column.
  const list3 = [...list2, s('x', 'faq', 0, 'g')];
  const items3 = removeChildrenOf(flattenTree(list3), ['g']);
  const tall = getProjection(items3, 'g', 'g', 10 * W, W, subtreeHeight(list3, 'g'));
  assert.equal(tall.depth, 2);
  assert.equal(tall.parentId, 'r');
});

test('getProjection: not allowed when the next item forces a depth beyond the limit', () => {
  // r > c > [a, b]; drag a container (height 2) between a and b: min depth 3 > container max 2.
  const list = [
    s('r', 'layout-row', 0),
    s('c', 'layout-column', 0, 'r'),
    s('a', 'faq', 0, 'c'),
    s('b', 'faq', 1, 'c'),
    s('g', 'layout-grid', 1),
    s('x', 'faq', 0, 'g'),
  ];
  const items = removeChildrenOf(flattenTree(list), ['g']);
  const p = getProjection(items, 'g', 'a', 0, W, subtreeHeight(list, 'g'));
  assert.equal(p.allowed, false);
});

test('getProjection returns null for unknown ids', () => {
  const items = flattenTree(classic());
  assert.equal(getProjection(items, 'nope', 'r', 0, W), null);
  assert.equal(getProjection(items, 'r', 'nope', 0, W), null);
});

test('child layout values live in settings._layout', () => {
  assert.equal(getChildLayoutValue({}, 'span.desktop'), undefined);
  assert.equal(getChildLayoutValue(undefined, 'sticky'), undefined);
  let st = setChildLayoutValue({ heading: 'x' }, 'span.desktop', 2);
  assert.deepEqual(st, { heading: 'x', _layout: { span: { desktop: 2 } } });
  assert.equal(getChildLayoutValue(st, 'span.desktop'), 2);
  st = setChildLayoutValue(st, 'align_self', 'center');
  st = setChildLayoutValue(st, 'order.mobile', -1);
  assert.deepEqual(st._layout, { span: { desktop: 2 }, align_self: 'center', order: { mobile: -1 } });
  // Clearing prunes empty groups, and the whole _layout when nothing is left.
  st = setChildLayoutValue(st, 'span.desktop', '');
  st = setChildLayoutValue(st, 'order.mobile', null);
  st = setChildLayoutValue(st, 'align_self', undefined);
  assert.deepEqual(st, { heading: 'x' });
  // Input is not mutated.
  const input = { _layout: { sticky: true } };
  setChildLayoutValue(input, 'sticky', false);
  assert.deepEqual(input, { _layout: { sticky: true } });
});

test('container schemas: keys, product template only, settings', () => {
  const expected = {
    'layout-row': ['gap_px', 'gap_tablet_px', 'gap_mobile_px', 'align', 'child_width', 'justify', 'wrap', 'stack_on', 'reverse_on_mobile'],
    'layout-column': ['gap_px', 'align', 'sticky_desktop', 'sticky_top_px', 'sticky_from'],
    'layout-grid': ['columns_desktop', 'columns_tablet', 'columns_mobile', 'gap_px', 'row_gap_px', 'align'],
  };
  // Per-breakpoint overrides: empty = inherit the wider screen, so no default.
  const optionalKeys = new Set(['gap_tablet_px', 'gap_mobile_px']);
  for (const [id, keys] of Object.entries(expected)) {
    const schema = findSectionSchema(id);
    assert.ok(schema, id);
    assert.equal(schema.category, 'layout');
    assert.deepEqual(schema.pageTypes, ['PRODUCT_TEMPLATE']);
    assert.deepEqual(schema.schema.map((f) => f.key), keys, id);
    assert.ok(schema.label.en && schema.label.ar, `${id} label`);
    assert.ok(schema.description.en && schema.description.ar, `${id} description`);
    for (const f of schema.schema) assert.ok(f.label.en && f.label.ar, `${id}.${f.key} label`);
    // Every setting has a default.
    for (const k of keys) {
      if (optionalKeys.has(k)) assert.ok(!(k in schema.defaultSettings), `${id}.${k} inherits`);
      else assert.ok(k in schema.defaultSettings, `${id}.${k} default`);
    }
    // Gated: hidden from the palette until the builder enables layout containers.
    assert.equal(schema.gate, 'layout-containers');
    assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE'), false, `${id} hidden by default`);
    const on = { layoutContainers: true };
    assert.equal(isAvailableForPageType(schema, 'PRODUCT_TEMPLATE', on), true);
    for (const t of ['HOME', 'STATIC', 'LANDING', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'HEADER', 'FOOTER']) {
      assert.equal(isAvailableForPageType(schema, t, on), false, `${id} on ${t}`);
    }
  }
  // Only the three container schemas use the layout-* container keys.
  // The gate hides nothing else: ungated sections ignore the option.
  for (const x of SECTION_SCHEMAS.filter((y) => !y.gate)) {
    assert.equal(
      isAvailableForPageType(x, 'PRODUCT_TEMPLATE', { layoutContainers: true }),
      isAvailableForPageType(x, 'PRODUCT_TEMPLATE'),
      x.id,
    );
  }
  const containerSchemas = SECTION_SCHEMAS.filter((x) => isContainerKey(x.id)).map((x) => x.id).sort();
  assert.deepEqual(containerSchemas, ['layout-column', 'layout-grid', 'layout-row']);
});

// Must match the web renderer (multi-stores-web/src/themes/minimal/sections/layout/
// LayoutRow/LayoutColumn/LayoutGrid + containerCss.ts readers) value for value.
test('container schemas mirror the web renderer defaults, ranges and options', () => {
  const field = (id, key) => findSectionSchema(id).schema.find((f) => f.key === key);
  const range = (id, key) => {
    const f = field(id, key);
    return [f.min, f.max, f.defaultValue];
  };
  const optionValues = (id, key) => field(id, key).options.map((o) => o.value);
  const ALIGN = ['stretch', 'start', 'center', 'end'];

  assert.deepEqual(findSectionSchema('layout-row').defaultSettings, {
    gap_px: 32,
    align: 'stretch',
    child_width: 'fill',
    justify: 'start',
    wrap: false,
    stack_on: 'tablet',
    reverse_on_mobile: false,
  });
  assert.deepEqual(range('layout-row', 'gap_px'), [0, 200, 32]);
  assert.deepEqual(optionValues('layout-row', 'align'), ALIGN);
  assert.deepEqual(optionValues('layout-row', 'child_width'), ['fill', 'auto']);
  assert.deepEqual(optionValues('layout-row', 'justify'), ['start', 'center', 'end', 'between']);
  assert.deepEqual(optionValues('layout-row', 'stack_on'), ['tablet', 'mobile', 'never']);
  assert.deepEqual(range('layout-row', 'gap_tablet_px'), [0, 200, undefined]);
  assert.deepEqual(range('layout-row', 'gap_mobile_px'), [0, 200, undefined]);

  assert.deepEqual(findSectionSchema('layout-column').defaultSettings, {
    gap_px: 16,
    align: 'stretch',
    sticky_desktop: false,
    sticky_top_px: 24,
    sticky_from: 'desktop',
  });
  assert.deepEqual(optionValues('layout-column', 'sticky_from'), ['desktop', 'tablet']);
  assert.deepEqual(range('layout-column', 'gap_px'), [0, 200, 16]);
  assert.deepEqual(range('layout-column', 'sticky_top_px'), [0, 400, 24]);
  assert.deepEqual(optionValues('layout-column', 'align'), ALIGN);

  assert.deepEqual(findSectionSchema('layout-grid').defaultSettings, {
    columns_desktop: 2,
    columns_tablet: 2,
    columns_mobile: 1,
    gap_px: 24,
    row_gap_px: 24,
    align: 'stretch',
  });
  assert.deepEqual(range('layout-grid', 'columns_desktop'), [1, 12, 2]);
  assert.deepEqual(range('layout-grid', 'columns_tablet'), [1, 12, 2]);
  assert.deepEqual(range('layout-grid', 'columns_mobile'), [1, 12, 1]);
  assert.deepEqual(range('layout-grid', 'gap_px'), [0, 200, 24]);
  assert.deepEqual(range('layout-grid', 'row_gap_px'), [0, 200, 24]);
  assert.deepEqual(optionValues('layout-grid', 'align'), ALIGN);

  // Every schema default equals the defaultSettings value.
  for (const id of ['layout-row', 'layout-column', 'layout-grid']) {
    const schema = findSectionSchema(id);
    for (const f of schema.schema) assert.deepEqual(schema.defaultSettings[f.key], f.defaultValue, `${id}.${f.key}`);
  }
});

test('CHILD_LAYOUT_FIELDS cover span/order per breakpoint, align_self and sticky', () => {
  assert.deepEqual(CHILD_LAYOUT_FIELDS.map((f) => f.key), [
    'span.desktop',
    'span.tablet',
    'span.mobile',
    'order.desktop',
    'order.tablet',
    'order.mobile',
    'align_self',
    'sticky',
  ]);
  const align = CHILD_LAYOUT_FIELDS.find((f) => f.key === 'align_self');
  assert.deepEqual(align.options.map((o) => o.value), ['', 'stretch', 'start', 'center', 'end']);
  for (const f of CHILD_LAYOUT_FIELDS) assert.ok(f.label.en && f.label.ar, f.key);
});
