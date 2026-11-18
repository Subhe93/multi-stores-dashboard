// Country flags in the dashboard: a flag that carries writing is never an
// emoji; the ones the dashboard can list are bundled as the unmodified
// Wikimedia Commons artwork (public/flags/, hashes in SOURCES.txt).
// Run: node --experimental-strip-types --test src/lib/countryFlags.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  BUNDLED_FLAGS,
  FLAGS_WITH_WRITING,
  bundledFlagSrc,
  flagEmoji,
  flagSortKey,
} from './countryFlags.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(here, '..');
const FLAGS_DIR = join(SRC, '..', 'public', 'flags');
const read = (...parts) => readFileSync(join(SRC, ...parts), 'utf8');

// sha256 of each bundled file as downloaded from Wikimedia Commons on
// 2026-11-18 (the same values are listed in public/flags/SOURCES.txt).
const RECORDED_SHA256 = {
  SA: 'b0b36326e3e5b74624ee8b5de8273ea00f7bbe9b5ba0da6250cbe7b3c637505e',
  IR: 'c1d6eb64f7060fb362ad8efd0205cdd37c7443fa1f009b9882feede56022009c',
  IQ: '2a3ac265b9efcfb0b8761b753b8dba85b63af329deed39dc7a363e61dad70667',
  EG: '031b7bebb493d69f092a6c9a4aed4b66d8ce13e72ab8dd99f1f8a040f4447e53',
  BR: '041479c6a955990d32c8e45b7283afcd62eacc3592eba9bbf0162299ad77ff01',
  ES: 'af0b860424a9bd6af63dce070d7f7cb4c7b490c6269fc1cd4f35c45679a20500',
  MT: 'a5c2eee915ed72695afcc7898018bf57c41e62c9b7b964e8de8bbbec9e895d2d',
};

/** The emoji every label started with before this module existed. */
function oldCountryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    0x1f1e6 + (code.toUpperCase().charCodeAt(0) - 65),
    0x1f1e6 + (code.toUpperCase().charCodeAt(1) - 65),
  );
}

// ── The real taxCountries.ts, loaded without the client component ──────────
// taxCountries.ts takes COUNTRIES from CountryMultiSelect.tsx (JSX, '@/'
// alias), which node cannot import. A copy with only its two import lines
// re-pointed is written to a temp folder: COUNTRIES comes from the array
// literal of the real component source, the flag helpers from the real module.

const componentSource = read('components', 'common', 'CountryMultiSelect.tsx');
const countriesLiteral = componentSource.match(/export const COUNTRIES: Country\[\] = (\[[\s\S]*?\n\]);/);
assert.ok(countriesLiteral, 'COUNTRIES array literal found in CountryMultiSelect.tsx');

const tmp = mkdtempSync(join(tmpdir(), 'country-flags-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

writeFileSync(join(tmp, 'countries.mjs'), `export const COUNTRIES = ${countriesLiteral[1]};\n`);
const taxSource = read('lib', 'taxCountries.ts');
const IMPORT_COUNTRIES = "import { COUNTRIES } from '@/components/common/CountryMultiSelect';";
const IMPORT_FLAGS = "import { flagEmoji, flagSortKey } from '@/lib/countryFlags';";
assert.ok(taxSource.includes(IMPORT_COUNTRIES), 'taxCountries.ts imports COUNTRIES');
assert.ok(taxSource.includes(IMPORT_FLAGS), 'taxCountries.ts imports the flag helpers');
writeFileSync(
  join(tmp, 'taxCountries.ts'),
  taxSource
    .replace(IMPORT_COUNTRIES, `import { COUNTRIES } from ${JSON.stringify(pathToFileURL(join(tmp, 'countries.mjs')).href)};`)
    .replace(IMPORT_FLAGS, `import { flagEmoji, flagSortKey } from ${JSON.stringify(pathToFileURL(join(here, 'countryFlags.ts')).href)};`),
);
const { COUNTRIES } = await import(pathToFileURL(join(tmp, 'countries.mjs')).href);
const { SEEDED_TAX_COUNTRY_CODES, countryLabel, countryName, taxCountryOptions } = await import(
  pathToFileURL(join(tmp, 'taxCountries.ts')).href
);

const LISTED_CODES = [...new Set([...COUNTRIES.map((c) => c.code), ...SEEDED_TAX_COUNTRY_CODES])];

// ── flagEmoji / flagSortKey / bundledFlagSrc ───────────────────────────────

test('a flag without writing is the regional-indicator pair, as before', () => {
  assert.equal(flagEmoji('SE'), '🇸🇪');
  assert.equal(flagEmoji('se'), '🇸🇪');
  assert.equal(flagEmoji('GB'), '🇬🇧');
  for (const code of LISTED_CODES) {
    if (!FLAGS_WITH_WRITING.has(code)) assert.equal(flagEmoji(code), oldCountryFlag(code), code);
  }
});

test('an invalid code is the globe, as before', () => {
  for (const code of ['', 'S', 'SWE', undefined, null]) assert.equal(flagEmoji(code), '🌐');
});

test('a flag that carries writing is never an emoji', () => {
  assert.ok(FLAGS_WITH_WRITING.has('SA') && FLAGS_WITH_WRITING.has('IR'));
  for (const code of FLAGS_WITH_WRITING) {
    assert.match(code, /^[A-Z]{2}$/);
    assert.equal(flagEmoji(code), '', code);
    assert.equal(flagEmoji(code.toLowerCase()), '', code);
  }
});

test('the sort key is the raw pair for every code, also for flags with writing', () => {
  assert.equal(flagSortKey('SA'), '🇸🇦');
  assert.equal(flagSortKey('SE'), '🇸🇪');
  for (const code of [...LISTED_CODES, ...FLAGS_WITH_WRITING, '', 'SWE']) {
    assert.equal(flagSortKey(code), oldCountryFlag(code), code);
  }
});

test('bundledFlagSrc points at the same-origin file, only for bundled flags', () => {
  assert.equal(bundledFlagSrc('SA'), '/flags/sa.svg');
  assert.equal(bundledFlagSrc('sa'), '/flags/sa.svg');
  assert.equal(bundledFlagSrc('IR'), '/flags/ir.svg');
  for (const code of ['SE', 'AF', '', 'SWE', 'constructor', 'toString', undefined, null]) {
    assert.equal(bundledFlagSrc(code), null, String(code));
  }
});

test('territory and emoji-only region codes with a motto or letters are covered', () => {
  // None is in the country picker or the seeded tax list: such a code can
  // only come from stored data, and must still never be drawn as an emoji.
  for (const code of ['SX', 'TF', 'YT', 'BL', 'TA', 'AC', 'IC', 'EA', 'DG']) {
    assert.ok(FLAGS_WITH_WRITING.has(code), code);
    assert.ok(!LISTED_CODES.includes(code), `${code} is not a listed country`);
    assert.equal(flagEmoji(code), '', code);
    assert.equal(bundledFlagSrc(code), null, code);
  }
});

// ── The bundled files ──────────────────────────────────────────────────────

test('every bundled flag carries writing and ships as the recorded, unmodified file', () => {
  assert.deepEqual(Object.keys(BUNDLED_FLAGS).sort(), Object.keys(RECORDED_SHA256).sort());
  const sources = readFileSync(join(FLAGS_DIR, 'SOURCES.txt'), 'utf8');
  for (const code of Object.keys(BUNDLED_FLAGS)) {
    assert.ok(FLAGS_WITH_WRITING.has(code), `${code} is a flag with writing`);
    const bytes = readFileSync(join(FLAGS_DIR, `${code.toLowerCase()}.svg`));
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, RECORDED_SHA256[code], `${code}: file differs from the recorded download`);
    assert.ok(sources.includes(`${code.toLowerCase()}.svg`) && sources.includes(sha), `${code} listed in SOURCES.txt`);
  }
});

test('public/flags holds exactly the bundled files and their source list', () => {
  const files = readdirSync(FLAGS_DIR).filter((f) => statSync(join(FLAGS_DIR, f)).isFile()).sort();
  assert.deepEqual(
    files,
    ['SOURCES.txt', ...Object.keys(BUNDLED_FLAGS).map((c) => `${c.toLowerCase()}.svg`)].sort(),
  );
});

test('the recorded size of each bundled flag is the one its file declares', () => {
  for (const [code, size] of Object.entries(BUNDLED_FLAGS)) {
    const svg = readFileSync(join(FLAGS_DIR, `${code.toLowerCase()}.svg`), 'utf8');
    const root = svg.match(/<svg\b[^>]*>/)[0];
    assert.equal(Number(root.match(/\swidth="(\d+)"/)[1]), size.width, `${code} width`);
    assert.equal(Number(root.match(/\sheight="(\d+)"/)[1]), size.height, `${code} height`);
  }
});

test('every flag with writing the dashboard can list is bundled', () => {
  // The whole shipping list was read from the component source.
  const listed = (componentSource.match(/\{ code: '[A-Z]{2}',/g) || []).length;
  assert.ok(listed >= 70 && COUNTRIES.length === listed, `${COUNTRIES.length} of ${listed} countries read`);
  assert.ok(LISTED_CODES.includes('SA') && LISTED_CODES.includes('IR'));
  const written = LISTED_CODES.filter((c) => FLAGS_WITH_WRITING.has(c)).sort();
  assert.deepEqual(written, Object.keys(BUNDLED_FLAGS).sort());
});

// ── Text labels (lib/taxCountries.ts) ──────────────────────────────────────

test('countryLabel: the name alone for a flag with writing, unchanged otherwise', () => {
  assert.equal(countryLabel('SA', 'en'), 'Saudi Arabia');
  assert.equal(countryLabel('EG', 'en'), 'Egypt');
  assert.equal(countryLabel('IR', 'en'), 'Iran');
  assert.equal(countryLabel('SE', 'en'), '🇸🇪 Sweden');
  for (const locale of ['en', 'ar', 'tr', 'de', 'fr', 'sv']) {
    for (const code of LISTED_CODES) {
      const name = countryName(code, locale);
      const want = FLAGS_WITH_WRITING.has(code) ? name : `${oldCountryFlag(code)} ${name}`;
      assert.equal(countryLabel(code, locale), want, `${code} ${locale}`);
    }
  }
});

test('taxCountryOptions keeps the order it had under the old sort key', () => {
  for (const locale of ['en', 'ar', 'tr', 'de', 'fr', 'sv']) {
    for (const extra of [[], ['af', 'XK', 'toolong']]) {
      const options = taxCountryOptions(locale, extra);
      const codes = [...new Set([...LISTED_CODES, ...extra.map((c) => c.toUpperCase()).filter((c) => c.length === 2)])];
      const oldOrder = codes
        .map((code) => ({ code, label: `${oldCountryFlag(code)} ${countryName(code, locale)}` }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((o) => o.code);
      assert.deepEqual(options.map((o) => o.value), oldOrder, locale);
      for (const o of options) {
        assert.equal(o.label, countryLabel(o.value, locale));
        assert.equal(o.description, o.value);
        assert.deepEqual(Object.keys(o), ['value', 'label', 'description']);
      }
    }
  }
});

// ── JSX sites ──────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

test('no component draws a flag emoji in JSX: the five sites use <CountryFlag />', () => {
  const users = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/\{\s*countryFlag\(/.test(source), `${file} still renders countryFlag() in JSX`);
    const uses = (source.match(/<CountryFlag code=/g) || []).length;
    if (uses) users.push([file.slice(SRC.length + 1).replaceAll('\\', '/'), uses]);
  }
  assert.deepEqual(users.sort(), [
    ['app/creator/markets/page.tsx', 1],
    ['app/creator/shipping/page.tsx', 1],
    ['app/provider/orders/[id]/page.tsx', 1],
    ['app/provider/shipping/page.tsx', 1],
    ['components/common/CountryMultiSelect.tsx', 2],
  ]);
});

test('the flag image is whole, in its own proportions, never cropped or mirrored', () => {
  const source = read('components', 'common', 'CountryFlag.tsx');
  const className = source.match(/className="([^"]*)"/)[1].split(/\s+/);
  assert.deepEqual(className, ['inline-block', 'max-w-none', 'shrink-0', 'align-[-0.125em]']);
  assert.ok(source.includes("style={{ height: '1em', width: 'auto' }}"));
  for (const token of className) {
    assert.ok(!/^(rtl:|ltr:)|scale-x|object-cover|^rounded/.test(token), token);
  }
  // Nothing in the file (comments aside) flips, crops or rounds the image.
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/rtl:|scale-x|object-cover|rounded|transform/.test(code));
});
