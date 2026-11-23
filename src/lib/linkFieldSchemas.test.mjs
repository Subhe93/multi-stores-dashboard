// M165: every link field of the section schemas offers the Product mode,
// except the explicit media URLs; the three picked-product fields prefer it.
// Fails when a new media URL field is added without productLink: 'off'.
// Run: node --experimental-strip-types --test src/lib/linkFieldSchemas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SCHEMAS } from './section-schemas.ts';

function walk(fields, path, out = []) {
  for (const f of fields ?? []) {
    out.push([`${path}.${f.key}`, f]);
    if (f.fields) walk(f.fields, `${path}.${f.key}`, out);
  }
  return out;
}

const all = SECTION_SCHEMAS.flatMap((s) => walk(s.schema ?? s.fields ?? [], s.id));
const urlFields = all.filter(([, f]) => f.type === 'url');

test('there are link fields', () => {
  assert.ok(urlFields.length > 40, `found ${urlFields.length}`);
});

test('media URL fields are off, nothing else is', () => {
  const off = urlFields.filter(([, f]) => f.productLink === 'off').map(([p]) => p).sort();
  assert.deepEqual(off, ['hero-video.video_url', 'video.video_url']);
  for (const [p, f] of urlFields) {
    if (/(video|image|poster|embed|src|media|audio)/i.test(f.key)) assert.equal(f.productLink, 'off', `${p} looks like a media URL`);
  }
});

test('picked-product fields prefer the Product mode', () => {
  const prefer = urlFields.filter(([, f]) => f.productLink === 'prefer').map(([p]) => p).sort();
  assert.deepEqual(prefer, ['cover-hero.detail_url', 'look-spread.items.url', 'object-study.product_url']);
});
