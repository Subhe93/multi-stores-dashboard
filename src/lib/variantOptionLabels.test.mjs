// Unit test of the option label form helpers (M159).
// Run: node --experimental-strip-types --test src/lib/variantOptionLabels.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanLabels,
  isLabelsDirty,
  isPrimaryLabelLocale,
  labelsFromRow,
  labelsPayload,
  optionLabelsErrorLocale,
  optionListFor,
  withNameLabel,
  withValueLabel,
} from './variantOptionLabels.ts';

const OPTIONS = [{ name: 'Färg', values: ['Svart', 'Vit'] }];
const VARIANTS = [{ options: { Färg: 'Svart' } }, { options: { Färg: 'Röd', Storlek: 'M' } }];

test('optionListFor: config order, then values and names only on variants', () => {
  assert.deepEqual(optionListFor(OPTIONS, VARIANTS), [
    { name: 'Färg', values: ['Svart', 'Vit', 'Röd'] },
    { name: 'Storlek', values: ['M'] },
  ]);
  assert.deepEqual(optionListFor([], []), []);
});

test('labelsFromRow: undefined without the key, else the parsed maps', () => {
  assert.equal(labelsFromRow({ locale: 'de' }), undefined);
  assert.deepEqual(labelsFromRow({ locale: 'de', variant_option_labels: null }), { names: {}, values: {} });
  assert.deepEqual(
    labelsFromRow({ variant_option_labels: { names: { Färg: 'Farbe', x: 1 }, values: { Färg: { Svart: 'Schwarz', Vit: '' } } } }),
    { names: { Färg: 'Farbe' }, values: { Färg: { Svart: 'Schwarz' } } },
  );
});

test('cleanLabels: trims, drops empty / canonical / unknown keys', () => {
  const list = optionListFor(OPTIONS, []);
  let l = withNameLabel(undefined, 'Färg', '  Farbe ');
  l = withValueLabel(l, 'Färg', 'Svart', 'Schwarz');
  l = withValueLabel(l, 'Färg', 'Vit', 'Vit');
  l = withValueLabel(l, 'Färg', 'Lila', 'Lila!');
  l = withNameLabel(l, 'Gone', 'Weg');
  assert.deepEqual(cleanLabels(l, list), { names: { Färg: 'Farbe' }, values: { Färg: { Svart: 'Schwarz' } } });
  assert.equal(cleanLabels({ names: { Färg: ' ' }, values: {} }, list), null);
});

test('labelsPayload: absent vs object vs null; never for the primary language', () => {
  const list = optionListFor(OPTIONS, []);
  const set = { names: { Färg: 'Farbe' }, values: {} };
  const empty = { names: {}, values: {} };
  assert.deepEqual(labelsPayload(undefined, set, list, false), {});
  assert.deepEqual(labelsPayload(set, undefined, list, false), { variant_option_labels: { names: { Färg: 'Farbe' } } });
  assert.deepEqual(labelsPayload(empty, set, list, false), { variant_option_labels: null });
  assert.deepEqual(labelsPayload(empty, empty, list, false), {});
  assert.deepEqual(labelsPayload(set, set, list, true), {});
});

test('isLabelsDirty: compares cleaned labels', () => {
  const list = optionListFor(OPTIONS, []);
  const a = { names: { Färg: 'Farbe' }, values: {} };
  assert.equal(isLabelsDirty({ names: { Färg: ' Farbe ' }, values: {} }, a, list), false);
  assert.equal(isLabelsDirty({ names: { Färg: 'Farbton' }, values: {} }, a, list), true);
  assert.equal(isLabelsDirty(undefined, { names: {}, values: {} }, list), false);
});

test('optionLabelsErrorLocale: the language of the first issue', () => {
  assert.equal(
    optionLabelsErrorLocale({ code: 'PRODUCT_OPTION_LABELS_UNKNOWN_OPTION', issues: [{ locale: 'de', path: 'names.X' }] }),
    'de',
  );
  assert.equal(optionLabelsErrorLocale({ code: 'OTHER', issues: [{ locale: 'de' }] }), null);
  assert.equal(optionLabelsErrorLocale(null), null);
});

test('isPrimaryLabelLocale: same base language as the API rule', () => {
  assert.equal(isPrimaryLabelLocale('sv', 'sv'), true);
  assert.equal(isPrimaryLabelLocale('sv-FI', 'sv'), true);
  assert.equal(isPrimaryLabelLocale('sv', 'sv-SE'), true);
  assert.equal(isPrimaryLabelLocale('de', 'sv'), false);
  assert.equal(isPrimaryLabelLocale('de-AT', 'sv'), false);
});
