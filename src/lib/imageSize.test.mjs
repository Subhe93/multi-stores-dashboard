// Image sizing: dashboard schema matches plans/image-sizing/SPEC.md, the
// editor model (seeding, visibility, compaction) and parity with the web
// helper multi-stores-web/src/themes/imageSizing.ts.
// Run: node --experimental-strip-types --test src/lib/imageSize.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IMAGE_SIZE_FIELD, findSectionSchema } from './section-schemas.ts';
import {
  IMAGE_ALIGNS,
  IMAGE_FITS,
  IMAGE_HEIGHT_MODES,
  IMAGE_POSITIONS,
  IMAGE_RATIOS,
  IMAGE_SIZE_DEFAULTS,
  IMAGE_SIZE_FLAT_KEYS,
  IMAGE_SIZE_LIMITS,
  IMAGE_SIZE_PER_BP_KEYS,
  IMAGE_WIDTH_MODES,
  clampImageSizeNumber,
  compactImageSize,
  hasImageSize,
  imageSizeControlsAt,
  imageSizeEditorValue,
  imageSizeFromLegacy,
  isRtlContentLocale,
} from './imageSize.ts';
import { inheritedSource, resolveResponsive, setResponsive } from './responsive.ts';

const keys = (fields) => fields.map((f) => f.key);

function imageBlockFields() {
  const lc = findSectionSchema('layout-columns');
  const cells = lc.schema.find((f) => f.key === 'cells');
  const blocks = cells.fields.find((f) => f.key === 'blocks');
  return blocks.fields;
}

// ── Schema (SPEC section 1 / 4) ─────────────────────────────────────────

test('IMAGE_SIZE_FIELD is the spec field: key image_size, type imageSize, en + ar label', () => {
  assert.equal(IMAGE_SIZE_FIELD.key, 'image_size');
  assert.equal(IMAGE_SIZE_FIELD.type, 'imageSize');
  assert.equal(IMAGE_SIZE_FIELD.label.en, 'Image size');
  assert.equal(IMAGE_SIZE_FIELD.label.ar, 'حجم الصورة');
  for (const loc of ['en', 'ar', 'tr', 'de', 'fr', 'sv']) assert.ok(IMAGE_SIZE_FIELD.label[loc], loc);
});

test('single-image: image_size replaces aspect / fit; rounded, link_url, alt stay', () => {
  const schema = findSectionSchema('single-image');
  const k = keys(schema.schema);
  const f = schema.schema.find((x) => x.key === 'image_size');
  assert.deepEqual(f, IMAGE_SIZE_FIELD);
  assert.ok(!k.includes('aspect'));
  assert.ok(!k.includes('fit'));
  for (const kept of ['image', 'rounded', 'link_url', 'alt']) assert.ok(k.includes(kept), kept);
  assert.ok(!schema.translatable.includes('image_size'));
});

test('layout-columns image block: image_size (showIf image) replaces width_px / aspect', () => {
  const fields = imageBlockFields();
  const k = keys(fields);
  const f = fields.find((x) => x.key === 'image_size');
  assert.deepEqual(f, { ...IMAGE_SIZE_FIELD, showIf: { key: 'type', in: ['image'] } });
  assert.ok(!k.includes('width_px'));
  assert.ok(!k.includes('aspect'));
  for (const kept of ['image', 'alt', 'link', 'rounded']) assert.ok(k.includes(kept), kept);
  // Other block types keep their own size keys.
  assert.ok(k.includes('item_height_px'));
  assert.ok(k.includes('height_px'));
});

test('image-with-text is unchanged (keeps its aspect select)', () => {
  const k = keys(findSectionSchema('image-with-text').schema);
  assert.ok(k.includes('aspect'));
  assert.ok(!k.includes('image_size'));
});

// ── Value model (SPEC section 2) ────────────────────────────────────────

test('enums, limits and defaults follow the spec', () => {
  assert.deepEqual([...IMAGE_WIDTH_MODES], ['auto', 'full', 'px', 'percent']);
  assert.deepEqual([...IMAGE_HEIGHT_MODES], ['auto', 'px', 'ratio']);
  assert.deepEqual([...IMAGE_RATIOS], ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9', '21:9']);
  assert.deepEqual([...IMAGE_ALIGNS], ['start', 'center', 'end']);
  assert.deepEqual([...IMAGE_FITS], ['cover', 'contain']);
  assert.deepEqual([...IMAGE_POSITIONS], ['center', 'top', 'bottom', 'left', 'right']);
  assert.deepEqual(IMAGE_SIZE_LIMITS, {
    width_px: { min: 16, max: 2400 },
    width_percent: { min: 1, max: 100 },
    height_px: { min: 16, max: 2400 },
    max_width_px: { min: 16, max: 4000 },
  });
  assert.deepEqual(IMAGE_SIZE_DEFAULTS, {
    width_mode: 'full', width_px: 400, width_percent: 100,
    height_mode: 'auto', height_px: 400, ratio: '1:1',
    align: 'start', fit: 'cover', position: 'center',
  });
  assert.deepEqual([...IMAGE_SIZE_PER_BP_KEYS], ['width_mode', 'width_px', 'width_percent', 'height_mode', 'height_px', 'ratio', 'align']);
  assert.deepEqual([...IMAGE_SIZE_FLAT_KEYS], ['max_width_px', 'fit', 'position']);
});

test('hasImageSize: empty shapes are legacy', () => {
  for (const v of [undefined, null, {}, [], 'x', { width_mode: '' }, { align: { tablet: null, mobile: '' } }]) {
    assert.equal(hasImageSize(v), false, JSON.stringify(v));
  }
  assert.equal(hasImageSize({ width_mode: 'px' }), true);
  assert.equal(hasImageSize({ align: { mobile: 'center' } }), true);
  assert.equal(hasImageSize({ max_width_px: 300 }), true);
});

test('legacy mapping (SPEC table)', () => {
  assert.deepEqual(imageSizeFromLegacy({}), { width_mode: 'full', height_mode: 'auto', fit: 'cover', align: 'start' });
  assert.deepEqual(imageSizeFromLegacy({ width_px: 240, aspect: 'square' }), {
    width_mode: 'px', width_px: 240, height_mode: 'ratio', ratio: '1:1', fit: 'cover', align: 'start',
  });
  assert.equal(imageSizeFromLegacy({ aspect: 'portrait' }).ratio, '3:4');
  assert.equal(imageSizeFromLegacy({ aspect: 'landscape' }).ratio, '4:3');
  assert.equal(imageSizeFromLegacy({ aspect: 'wide' }).ratio, '16:9');
  assert.equal(imageSizeFromLegacy({ aspect: 'auto' }).height_mode, 'auto');
  assert.equal(imageSizeFromLegacy({ fit: 'contain' }).fit, 'contain');
  assert.equal(imageSizeFromLegacy({ width_px: 0 }).width_mode, 'full');
  assert.equal(imageSizeFromLegacy({ width_px: '5000' }).width_px, 2400);
});

test('editor seeds from legacy keys only while image_size is empty', () => {
  const seeded = imageSizeEditorValue(undefined, { aspect: 'wide', fit: 'contain' });
  assert.equal(seeded.seeded, true);
  assert.equal(seeded.value.ratio, '16:9');
  const own = imageSizeEditorValue({ width_mode: 'auto' }, { aspect: 'wide' });
  assert.equal(own.seeded, false);
  assert.deepEqual(own.value, { width_mode: 'auto' });
});

test('first edit on a seeded value writes the full seeded object', () => {
  const { value } = imageSizeEditorValue({}, { width_px: 120 });
  const next = compactImageSize({ ...value, align: setResponsive(value.align, 'desktop', 'center') });
  assert.deepEqual(next, { width_mode: 'px', width_px: 120, height_mode: 'auto', fit: 'cover', align: 'center' });
});

test('controls: px / % inputs only for their width mode, px input or ratio for height', () => {
  assert.equal(imageSizeControlsAt({}, 'desktop').widthPx, false);
  assert.equal(imageSizeControlsAt({ width_mode: 'px' }, 'desktop').widthPx, true);
  assert.equal(imageSizeControlsAt({ width_mode: 'px' }, 'mobile').widthPx, true, 'mobile inherits desktop');
  const mixed = { width_mode: { desktop: 'px', mobile: 'percent' } };
  assert.equal(imageSizeControlsAt(mixed, 'tablet').widthPx, true);
  assert.equal(imageSizeControlsAt(mixed, 'mobile').widthPercent, true);
  assert.equal(imageSizeControlsAt(mixed, 'mobile').widthPx, false);
  assert.equal(imageSizeControlsAt({ height_mode: 'px' }, 'desktop').heightPx, true);
  assert.equal(imageSizeControlsAt({ height_mode: 'ratio' }, 'desktop').ratio, true);
  assert.equal(imageSizeControlsAt({ height_mode: 'ratio' }, 'desktop').heightPx, false);
  assert.equal(imageSizeControlsAt({ width_mode: 'auto', height_mode: 'ratio' }, 'desktop').autoBecomesFull, true);
  assert.equal(imageSizeControlsAt({ width_mode: 'auto', height_mode: 'px' }, 'desktop').autoBecomesFull, false);
  assert.equal(imageSizeControlsAt({ width_mode: 'bogus' }, 'desktop').widthMode, 'full');
});

test('controls: fit only with a fixed height somewhere; position only with cover', () => {
  assert.equal(imageSizeControlsAt({}, 'desktop').fit, false);
  assert.equal(imageSizeControlsAt({}, 'desktop').position, false);
  const mobileRatio = { height_mode: { mobile: 'ratio' } };
  assert.equal(imageSizeControlsAt(mobileRatio, 'desktop').fit, true, 'flat fit shows on every tab');
  assert.equal(imageSizeControlsAt(mobileRatio, 'desktop').position, true);
  assert.equal(imageSizeControlsAt({ height_mode: 'px', fit: 'contain' }, 'desktop').fit, true);
  assert.equal(imageSizeControlsAt({ height_mode: 'px', fit: 'contain' }, 'desktop').position, false);
});

test('compactImageSize drops empties and collapses desktop-only objects', () => {
  assert.equal(compactImageSize(undefined), undefined);
  assert.equal(compactImageSize({ width_mode: undefined, align: {} }), undefined);
  assert.deepEqual(compactImageSize({ width_mode: { desktop: 'px' }, width_px: { desktop: 300, mobile: '' }, fit: '' }), {
    width_mode: 'px', width_px: 300,
  });
  assert.deepEqual(compactImageSize({ align: { desktop: 'start', mobile: 'center' } }), {
    align: { desktop: 'start', mobile: 'center' },
  });
});

test('responsive helpers: set / clear per breakpoint with inheritance', () => {
  let f = setResponsive(undefined, 'desktop', 'px');
  assert.equal(f, 'px');
  f = setResponsive(f, 'mobile', 'full');
  assert.deepEqual(f, { desktop: 'px', mobile: 'full' });
  assert.equal(resolveResponsive(f, 'tablet'), 'px');
  assert.equal(inheritedSource(f, 'tablet'), 'desktop');
  assert.equal(inheritedSource(f, 'mobile'), null);
  f = setResponsive(f, 'mobile', undefined);
  assert.equal(f, 'px');
});

// ── Parity with the web helper ──────────────────────────────────────────

const WEB_ROOT = fileURLToPath(new URL('../../../multi-stores-web/src/themes/', import.meta.url));
const WEB_HELPER = join(WEB_ROOT, 'imageSizing.ts');

const LEGACY_SAMPLES = [
  undefined, {}, { width_px: 0 }, { width_px: 8 }, { width_px: 240 }, { width_px: '300' }, { width_px: 99999 },
  { aspect: 'auto' }, { aspect: 'square' }, { aspect: 'portrait' }, { aspect: 'landscape' }, { aspect: 'wide' },
  { aspect: 'bogus' }, { fit: 'contain' }, { fit: 'cover' }, { width_px: 120, aspect: 'wide', fit: 'contain' },
];

test('constants and legacy mapping equal the web helper', { skip: !existsSync(WEB_HELPER) && 'web repo not found' }, async () => {
  const web = await import(pathToFileURL(WEB_HELPER).href);
  assert.deepEqual([...IMAGE_RATIOS], [...web.IMAGE_RATIOS]);
  assert.deepEqual(IMAGE_SIZE_LIMITS, web.IMAGE_SIZE_LIMITS);
  assert.deepEqual(IMAGE_SIZE_DEFAULTS, web.IMAGE_SIZE_DEFAULTS);
  for (const s of LEGACY_SAMPLES) {
    assert.deepEqual(imageSizeFromLegacy(s), web.imageSizeFromLegacy(s), JSON.stringify(s));
  }
  for (const v of [undefined, {}, { width_mode: '' }, { align: { mobile: 'center' } }, { fit: 'contain' }, { ratio: { tablet: null } }]) {
    assert.equal(hasImageSize(v), web.hasImageSize(v), JSON.stringify(v));
  }
  // Editor visibility agrees with what the storefront renders.
  const cases = [{}, { width_mode: 'px' }, { width_mode: { desktop: 'percent', mobile: 'auto' } }, { height_mode: { tablet: 'px' } }];
  for (const v of cases) {
    for (const bp of ['desktop', 'tablet', 'mobile']) {
      const r = web.resolveImageSizeAt(v, bp);
      const c = imageSizeControlsAt(v, bp);
      assert.equal(c.heightMode, r.height.mode, `${JSON.stringify(v)} ${bp}`);
      if (!c.autoBecomesFull) assert.equal(c.widthMode, r.width.mode, `${JSON.stringify(v)} ${bp}`);
    }
  }
});

// The web registry declares its schemas inside the section components (TSX),
// so parity is checked on the source text. Skipped until the web side has
// adopted the field (the web workflow owns those files).
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\./.test(name)) out.push(p);
  }
  return out;
}
const webSources = existsSync(WEB_ROOT) ? walk(join(WEB_ROOT, 'minimal')).map((p) => readFileSync(p, 'utf8')) : [];
const sectionSource = (id) => webSources.find((src) => src.includes(`id: '${id}'`));
const webAdopted = webSources.some((src) => /type:\s*'imageSize'/.test(src));

test('web registry declares the same image_size field', { skip: !webAdopted && 'web registry has no imageSize field yet' }, () => {
  const types = readFileSync(join(WEB_ROOT, 'types.ts'), 'utf8');
  assert.match(types, /'imageSize'/, 'web FieldType includes imageSize');
  const all = webSources.join('\n');
  assert.match(all, /key:\s*'image_size'/);
  for (const id of ['single-image', 'layout-columns']) {
    const src = sectionSource(id);
    assert.ok(src, `web section ${id} found`);
    assert.match(src, /image_size|IMAGE_SIZE_FIELD/, `${id} uses image_size`);
  }
  const single = sectionSource('single-image');
  assert.doesNotMatch(single, /key:\s*'aspect'/, 'single-image form has no aspect');
  assert.doesNotMatch(single, /key:\s*'fit'/, 'single-image form has no fit');
  const lc = sectionSource('layout-columns');
  assert.doesNotMatch(lc, /key:\s*'width_px'/, 'layout-columns form has no width_px');
  assert.doesNotMatch(lc, /key:\s*'aspect'/, 'layout-columns form has no aspect');
});

// ── Editor clamps + align icon direction ────────────────────────────────

test('clampImageSizeNumber clamps max_width_px like the storefront', () => {
  assert.equal(clampImageSizeNumber('max_width_px', 5), 16);
  assert.equal(clampImageSizeNumber('max_width_px', 99999), 4000);
  assert.equal(clampImageSizeNumber('max_width_px', '640.4'), 640);
  assert.equal(clampImageSizeNumber('max_width_px', ''), undefined);
  assert.equal(clampImageSizeNumber('max_width_px', 0), undefined);
  assert.equal(clampImageSizeNumber('max_width_px', -3), undefined);
  assert.equal(clampImageSizeNumber('width_percent', 150), 100);
  assert.equal(clampImageSizeNumber('width_px', 3000), 2400);
  assert.equal(clampImageSizeNumber('height_px', 8), 16);
});

test('align icons follow the content locale direction, not the UI', () => {
  assert.equal(isRtlContentLocale('ar'), true);
  assert.equal(isRtlContentLocale('ar-SA'), true);
  assert.equal(isRtlContentLocale('en'), false);
  assert.equal(isRtlContentLocale('sv'), false);
  assert.equal(isRtlContentLocale(undefined), false);
  assert.equal(isRtlContentLocale(''), false);
});
