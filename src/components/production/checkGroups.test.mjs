// Unit test of the production checklist grouping (one frame per "Artikel").
// Run: node --experimental-strip-types --test src/components/production/checkGroups.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldLabelOf, groupChecks } from './checkGroups.ts';

let n = 0;
const check = (over) => ({
  id: `c${++n}`,
  order_item_id: 'i1',
  source: 'FIELD_VALUE',
  source_key: `fv:${n}`,
  label: 'x',
  value: 'v',
  group_index: null,
  file_url: null,
  upload_id: null,
  file_removed: false,
  sort_order: n,
  quantity: 1,
  done: false,
  done_at: null,
  done_by: null,
  done_by_name: null,
  stale: false,
  custom: false,
  hex: null,
  group_label: null,
  ...over,
});

const art = (i, field, value, extra = {}) =>
  check({ label: `Artikel ${i} – ${field}`, value, group_index: i, group_label: `Artikel ${i}`, ...extra });

test('no groups: every check stays a single row in its order', () => {
  const list = [check({ label: 'Färg' }), check({ label: 'Storlek' })];
  assert.deepEqual(
    groupChecks(list).map((b) => [b.kind, b.check.id]),
    list.map((c) => ['single', c.id]),
  );
});

test('the order of the screenshot: one frame per article, fields in one order, counts per frame', () => {
  const qty = check({ label: 'Välj antal', value: '4 produkter' });
  const list = [
    qty,
    art(1, 'Namn', 'Ludwig'),
    art(1, 'Färg', 'Ljusblå', { hex: '#9fd3f0', done: true }),
    art(2, 'Färg', 'Rosa'),
    art(2, 'Namn', 'Alicia'),
    art(3, 'Färg', 'Ljusblå'),
    art(3, 'Namn', 'Lucas'),
  ];
  const blocks = groupChecks(list);
  assert.equal(blocks[0].kind, 'single');
  assert.equal(blocks[0].check.id, qty.id);
  const groups = blocks.slice(1);
  assert.deepEqual(
    groups.map((g) => [g.label, g.checks.map((x) => `${x.fieldLabel}:${x.check.value}`), g.done, g.total]),
    [
      ['Artikel 1', ['Namn:Ludwig', 'Färg:Ljusblå'], 1, 2],
      ['Artikel 2', ['Namn:Alicia', 'Färg:Rosa'], 0, 2],
      ['Artikel 3', ['Namn:Lucas', 'Färg:Ljusblå'], 0, 2],
    ],
  );
});

test('groups follow their number, stale checks go last and do not count', () => {
  const list = [art(2, 'Namn', 'B'), art(1, 'Namn', 'A', { stale: true }), art(1, 'Färg', 'Röd')];
  const blocks = groupChecks(list);
  assert.deepEqual(blocks.map((b) => b.label), ['Artikel 1', 'Artikel 2']);
  assert.deepEqual(blocks[0].checks.map((x) => x.check.value), ['Röd', 'A']);
  assert.equal(blocks[0].total, 1);
});

test('older API without group_label: the label prefix still splits', () => {
  const c = check({ label: '#2 – Namn', group_index: 2, group_label: undefined });
  assert.equal(fieldLabelOf(c), 'Namn');
  assert.equal(groupChecks([c])[0].label, '#2');
});
