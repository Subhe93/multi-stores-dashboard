// M173: the "Letter case" select of a personalization text field keeps the
// new 'capitalize' value (it used to map everything except 'uppercase' to
// "as typed"), and its three option labels exist in all six locales.
// Run: node --experimental-strip-types --test src/lib/textTransform.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEXT_TRANSFORMS, transformFromSelect, transformSelectValue } from './textTransform.ts';

const UI_LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

test('stored value -> select value', () => {
  assert.equal(transformSelectValue('uppercase'), 'uppercase');
  assert.equal(transformSelectValue('capitalize'), 'capitalize');
  for (const v of [undefined, null, 'none', '', 'title', 1]) assert.equal(transformSelectValue(v), 'none');
});

test('select value -> stored value: capitalize is not dropped', () => {
  assert.equal(transformFromSelect('uppercase'), 'uppercase');
  assert.equal(transformFromSelect('capitalize'), 'capitalize');
  for (const v of ['none', '', undefined, 'title']) assert.equal(transformFromSelect(v), undefined);
});

test('opening and saving a field keeps its transform', () => {
  for (const stored of TEXT_TRANSFORMS) assert.equal(transformFromSelect(transformSelectValue(stored)), stored);
  assert.equal(transformFromSelect(transformSelectValue(undefined)), undefined);
});

test('the editor offers every transform and uses the helpers', () => {
  const src = read('../components/apps/personalization/FieldDisplayEditor.tsx');
  for (const v of ['none', ...TEXT_TRANSFORMS]) assert.ok(src.includes(`{ value: '${v}', label: t('transform`), v);
  assert.ok(src.includes('transformFromSelect(v)'));
  assert.ok(src.includes('transformSelectValue(ui?.transform)'));
});

test('option labels exist, differ and are translated in all six locales', () => {
  const en = JSON.parse(read('../i18n/messages/en.json')).customField.display;
  for (const locale of UI_LOCALES) {
    const d = JSON.parse(read(`../i18n/messages/${locale}.json`)).customField.display;
    const labels = ['transformNone', 'transformUppercase', 'transformCapitalize'].map((k) => d[k]);
    for (const label of labels) assert.ok(typeof label === 'string' && label.trim() !== '', locale);
    assert.equal(new Set(labels).size, 3, locale);
    if (locale !== 'en') assert.notEqual(d.transformCapitalize, en.transformCapitalize, locale);
  }
});
