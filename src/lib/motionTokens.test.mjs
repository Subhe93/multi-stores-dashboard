// Unit test of the store-wide motion profile edited in the theme customizer
// (store.theme_customizations.motion): scroll animations (reveal) and image
// zoom on hover (zoom). The standard behaviour is never stored; the value
// names are the contract shared with the storefront
// (multi-stores-web/src/themes/tokens.ts, motionAttrs).
// Run: node --experimental-strip-types --test src/lib/motionTokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MOTION_REVEAL_VALUES, MOTION_ZOOM_VALUES, motionValue, withMotion } from './themeTokens.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const MOTION_KEYS = [
  'title', 'reveal', 'revealDefault', 'revealCalm', 'revealOff',
  'zoom', 'zoomDefault', 'zoomSubtle', 'zoomOff', 'reducedMotionNote',
];

// A store that customized other tokens, without a motion profile.
const full = () => ({
  preset_id: 'editorial-serif',
  colors: { primary: '#111111', accent: '#b45309' },
  typography: { fontFamily: { heading: 'Playfair Display', body: 'Inter' } },
  spacing: { radius: { button: '4px' } },
  product: { swatchShape: 'square' },
  customCss: '.store-root h1 { letter-spacing: 0.02em; }',
});

test('the stored values are calm / off and subtle / off', () => {
  assert.deepEqual([...MOTION_REVEAL_VALUES], ['calm', 'off']);
  assert.deepEqual([...MOTION_ZOOM_VALUES], ['subtle', 'off']);
});

test('motionValue reads only the two values of each key', () => {
  assert.equal(motionValue({ motion: { reveal: 'calm' } }, 'reveal'), 'calm');
  assert.equal(motionValue({ motion: { reveal: 'off' } }, 'reveal'), 'off');
  assert.equal(motionValue({ motion: { zoom: 'subtle' } }, 'zoom'), 'subtle');
  assert.equal(motionValue({ motion: { zoom: 'off' } }, 'zoom'), 'off');
  // Each key has its own list.
  assert.equal(motionValue({ motion: { reveal: 'subtle' } }, 'reveal'), '');
  assert.equal(motionValue({ motion: { zoom: 'calm' } }, 'zoom'), '');
});

test('unset, default, a wrong type and an unknown value all read as unset', () => {
  for (const tokens of [
    undefined,
    null,
    {},
    full(),
    { motion: null },
    { motion: 'calm' },
    { motion: ['calm'] },
    { motion: {} },
    { motion: { reveal: 'default', zoom: 'default' } },
    { motion: { reveal: '', zoom: '' } },
    { motion: { reveal: 'fast', zoom: 'big' } },
    { motion: { reveal: 1, zoom: true } },
    { motion: { reveal: ' calm ', zoom: 'SUBTLE' } },
  ]) {
    assert.equal(motionValue(tokens, 'reveal'), '', JSON.stringify(tokens));
    assert.equal(motionValue(tokens, 'zoom'), '', JSON.stringify(tokens));
  }
});

test('withMotion sets a value and keeps every other key', () => {
  const before = full();
  const next = withMotion(before, 'reveal', 'calm');
  assert.deepEqual(next, { ...full(), motion: { reveal: 'calm' } });
  const both = withMotion(next, 'zoom', 'subtle');
  assert.deepEqual(both, { ...full(), motion: { reveal: 'calm', zoom: 'subtle' } });
  // The input objects are not mutated.
  assert.deepEqual(before, full());
  assert.deepEqual(next, { ...full(), motion: { reveal: 'calm' } });
});

test('withMotion replaces a stored value', () => {
  const next = withMotion({ ...full(), motion: { reveal: 'calm', zoom: 'subtle' } }, 'reveal', 'off');
  assert.deepEqual(next.motion, { reveal: 'off', zoom: 'subtle' });
});

test('Standard removes the key, and motion once it is empty', () => {
  const stored = { ...full(), motion: { reveal: 'calm', zoom: 'off' } };
  const frozen = JSON.stringify(stored);

  const oneLeft = withMotion(stored, 'reveal', '');
  assert.deepEqual(oneLeft, { ...full(), motion: { zoom: 'off' } });

  const none = withMotion(oneLeft, 'zoom', '');
  assert.deepEqual(none, full());
  assert.equal('motion' in none, false);

  assert.equal(JSON.stringify(stored), frozen, 'input not mutated');
});

test("'default' and unknown values are never stored", () => {
  for (const value of ['default', 'fast', 'subtle', ' calm', 'CALM']) {
    assert.deepEqual(withMotion(full(), 'reveal', value), full(), value);
    // A stored value is removed, not kept, when the new one is not valid.
    assert.deepEqual(withMotion({ ...full(), motion: { reveal: 'calm' } }, 'reveal', value), full(), value);
  }
  assert.deepEqual(withMotion(full(), 'zoom', 'default'), full());
  assert.deepEqual(withMotion(full(), 'zoom', 'calm'), full());
});

test('removing a key that is not stored changes nothing', () => {
  assert.deepEqual(withMotion(full(), 'reveal', ''), full());
  assert.deepEqual(withMotion({}, 'zoom', ''), {});
  // A junk `motion` value is left as it is when there is nothing to remove…
  assert.deepEqual(withMotion({ motion: 'junk' }, 'reveal', ''), { motion: 'junk' });
  // …and replaced by a clean object when a value is set.
  assert.deepEqual(withMotion({ motion: 'junk' }, 'reveal', 'off'), { motion: { reveal: 'off' } });
  // Unknown keys inside motion survive a set and a removal.
  assert.deepEqual(withMotion({ motion: { future: 1 } }, 'zoom', 'off'), { motion: { future: 1, zoom: 'off' } });
  assert.deepEqual(withMotion({ motion: { future: 1, zoom: 'off' } }, 'zoom', ''), { motion: { future: 1 } });
});

test('builder.motion carries the ten texts in six locales', () => {
  for (const loc of LOCALES) {
    const file = fileURLToPath(new URL(`../i18n/messages/${loc}.json`, import.meta.url));
    const motion = JSON.parse(readFileSync(file, 'utf8')).builder.motion;
    assert.ok(motion && typeof motion === 'object', `${loc}: builder.motion missing`);
    assert.deepEqual(Object.keys(motion), MOTION_KEYS, `${loc}: keys`);
    for (const key of MOTION_KEYS) {
      assert.ok(typeof motion[key] === 'string' && motion[key].trim(), `${loc}: motion.${key} empty`);
    }
  }
  const en = JSON.parse(
    readFileSync(fileURLToPath(new URL('../i18n/messages/en.json', import.meta.url)), 'utf8'),
  ).builder.motion;
  assert.deepEqual(en, {
    title: 'Motion',
    reveal: 'Scroll animations',
    revealDefault: 'Standard',
    revealCalm: 'Calm',
    revealOff: 'Off',
    zoom: 'Image zoom on hover',
    zoomDefault: 'Standard',
    zoomSubtle: 'Subtle',
    zoomOff: 'Off',
    reducedMotionNote: 'Visitors who ask their device for reduced motion never see movement.',
  });
});
