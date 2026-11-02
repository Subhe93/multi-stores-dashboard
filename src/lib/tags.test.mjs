// Unit tests of the tags picker / product list filter helpers.
// Run: node --experimental-strip-types --test src/lib/tags.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canOfferCreate,
  collectionFilterSelection,
  decideTagEnter,
  findTagByName,
  normalizeTagName,
  splitCollectionFilterOptions,
} from './tags.ts';

const TAGS = [
  { id: 't1', name: 'Gift' },
  { id: 't2', name: 'Summer sale' },
];

test('normalizeTagName trims and collapses whitespace', () => {
  assert.equal(normalizeTagName('  Summer   sale '), 'Summer sale');
  assert.equal(normalizeTagName('   '), '');
});

test('findTagByName ignores case and spaces', () => {
  assert.equal(findTagByName(' gift ', TAGS)?.id, 't1');
  assert.equal(findTagByName('SUMMER  SALE', TAGS)?.id, 't2');
  assert.equal(findTagByName('', TAGS), undefined);
  assert.equal(findTagByName('winter', TAGS), undefined);
});

test('decideTagEnter: empty query does nothing', () => {
  assert.deepEqual(decideTagEnter('   ', TAGS, []), { kind: 'none' });
});

test('decideTagEnter: exact name selects the existing tag', () => {
  assert.deepEqual(decideTagEnter('gift', TAGS, []), { kind: 'select', id: 't1', name: 'Gift' });
});

test('decideTagEnter: an already selected match is a no-op', () => {
  assert.deepEqual(decideTagEnter('Gift', TAGS, ['t1']), { kind: 'none' });
});

test('decideTagEnter: unknown name creates with the normalised name', () => {
  assert.deepEqual(decideTagEnter('  New  tag ', TAGS, []), { kind: 'create', name: 'New tag' });
});

test('canOfferCreate only for a non-empty query that matches nothing', () => {
  assert.equal(canOfferCreate('', TAGS), false);
  assert.equal(canOfferCreate('gift', TAGS), false);
  assert.equal(canOfferCreate('Gif', TAGS), true);
});

const TREE = [
  {
    id: 'c1',
    visibility: 'PUBLIC',
    translations: [{ locale: 'en', name: 'Apparel' }, { locale: 'sv', name: 'Kläder' }],
    children: [
      { id: 'c2', translations: [{ locale: 'sv', name: 'Hoodies' }] },
      { id: 't9', visibility: 'INTERNAL', translations: [{ locale: 'sv', name: 'Rea' }] },
    ],
  },
  { id: 't1', visibility: 'INTERNAL', translations: [{ locale: 'sv', name: 'Present' }] },
  { id: 't2', visibility: 'INTERNAL', translations: [] },
];

test('splitCollectionFilterOptions: PUBLIC paths in the primary locale, tags flat and sorted', () => {
  const { collections, tags } = splitCollectionFilterOptions(TREE, 'sv');
  assert.deepEqual(collections, [
    { value: 'c1', label: 'Kläder' },
    { value: 'c2', label: 'Kläder › Hoodies' },
  ]);
  assert.deepEqual(tags, [
    { value: 't2', label: '—' },
    { value: 't1', label: 'Present' },
    { value: 't9', label: 'Rea' },
  ]);
});

test('splitCollectionFilterOptions falls back to the first translation', () => {
  const { collections } = splitCollectionFilterOptions(TREE, 'de');
  assert.equal(collections[0].label, 'Apparel');
});

test('collectionFilterSelection routes the shared param to the right select', () => {
  const tags = [{ value: 't1', label: 'Present' }];
  assert.deepEqual(collectionFilterSelection('', tags), { collection: '', tag: '' });
  assert.deepEqual(collectionFilterSelection('none', tags), { collection: 'none', tag: '' });
  assert.deepEqual(collectionFilterSelection('c1', tags), { collection: 'c1', tag: '' });
  assert.deepEqual(collectionFilterSelection('t1', tags), { collection: '', tag: 't1' });
});
