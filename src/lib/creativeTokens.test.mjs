// Motion style, store level: the switch of the theme customizer
// (store.theme_customizations.motion.creative). Unset values are never
// stored, so a store that does not opt in keeps its data as it is. The
// value names are the contract shared with the storefront
// (multi-stores-web/src/themes/creative/creativeAttrs.ts).
// Run: node --experimental-strip-types --test src/lib/creativeTokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creativeValue, withCreative, withMotion } from './themeTokens.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const OFF = { enabled: false, smooth: true, magnetic: true, curtain: false };

// A store that customized other tokens, without a creative switch.
const full = () => ({
  preset_id: 'editorial-serif',
  colors: { primary: '#111111', accent: '#b45309' },
  typography: { fontFamily: { heading: 'Playfair Display', body: 'Inter' } },
  spacing: { radius: { button: '4px' } },
  customCss: '.store-root h1 { letter-spacing: 0.02em; }',
});

// ── creativeValue ───────────────────────────────────────────────────────

test('unset, junk and anything but enabled === true read as off', () => {
  for (const tokens of [
    undefined,
    null,
    {},
    full(),
    { motion: null },
    { motion: 'creative' },
    { motion: {} },
    { motion: { reveal: 'calm' } },
    { motion: { creative: null } },
    { motion: { creative: true } },
    { motion: { creative: [] } },
    { motion: { creative: {} } },
    { motion: { creative: { enabled: false } } },
    { motion: { creative: { enabled: 'true' } } },
    { motion: { creative: { enabled: 1, transition: 'curtain' } } },
    { motion: { creative: { smooth: 'off', magnetic: 'off', transition: 'curtain' } } },
  ]) {
    assert.deepEqual(creativeValue(tokens), OFF, JSON.stringify(tokens));
  }
});

test('enabled: smooth and magnetic are on unless stored off, curtain is off unless stored', () => {
  assert.deepEqual(creativeValue({ motion: { creative: { enabled: true } } }), {
    enabled: true, smooth: true, magnetic: true, curtain: false,
  });
  assert.deepEqual(
    creativeValue({ motion: { creative: { enabled: true, smooth: 'off', magnetic: 'off', transition: 'curtain' } } }),
    { enabled: true, smooth: false, magnetic: false, curtain: true },
  );
  // Unknown stored values fall back to the default of each option.
  assert.deepEqual(
    creativeValue({ motion: { creative: { enabled: true, smooth: 'no', magnetic: false, transition: 'fade' } } }),
    { enabled: true, smooth: true, magnetic: true, curtain: false },
  );
});

// ── withCreative ────────────────────────────────────────────────────────

test('switching on stores enabled: true and nothing else', () => {
  const before = full();
  const next = withCreative(before, { enabled: true });
  assert.deepEqual(next, { ...full(), motion: { creative: { enabled: true } } });
  assert.deepEqual(before, full(), 'input not mutated');
});

test('only options that differ from their default are stored', () => {
  let tokens = withCreative(full(), { enabled: true });
  tokens = withCreative(tokens, { smooth: false });
  assert.deepEqual(tokens.motion, { creative: { enabled: true, smooth: 'off' } });
  tokens = withCreative(tokens, { magnetic: false });
  assert.deepEqual(tokens.motion, { creative: { enabled: true, smooth: 'off', magnetic: 'off' } });
  tokens = withCreative(tokens, { curtain: true });
  assert.deepEqual(tokens.motion, { creative: { enabled: true, smooth: 'off', magnetic: 'off', transition: 'curtain' } });
  // Back to the defaults: the keys are removed, never stored as on / off / none.
  tokens = withCreative(tokens, { smooth: true, magnetic: true, curtain: false });
  assert.deepEqual(tokens.motion, { creative: { enabled: true } });
  assert.deepEqual(tokens, { ...full(), motion: { creative: { enabled: true } } });
});

test('switching off removes creative, and motion once it is empty', () => {
  const on = { ...full(), motion: { creative: { enabled: true, smooth: 'off', transition: 'curtain' } } };
  const frozen = JSON.stringify(on);
  const off = withCreative(on, { enabled: false });
  assert.deepEqual(off, full());
  assert.equal('motion' in off, false);
  assert.equal(JSON.stringify(on), frozen, 'input not mutated');
  // `false` is never stored.
  assert.equal(JSON.stringify(off).includes('false'), false);
});

test('the motion profile and the creative switch do not disturb each other', () => {
  const calm = withMotion(full(), 'reveal', 'calm');
  const both = withCreative(calm, { enabled: true, curtain: true });
  assert.deepEqual(both.motion, { reveal: 'calm', creative: { enabled: true, transition: 'curtain' } });
  // Creative off keeps the profile; profile back to standard keeps creative.
  assert.deepEqual(withCreative(both, { enabled: false }).motion, { reveal: 'calm' });
  assert.deepEqual(withMotion(both, 'reveal', '').motion, { creative: { enabled: true, transition: 'curtain' } });
  assert.deepEqual(withMotion(withCreative(both, { enabled: false }), 'reveal', ''), full());
});

test('an unset store stays deep-equal: off and option changes while off store nothing', () => {
  assert.deepEqual(withCreative(full(), { enabled: false }), full());
  assert.deepEqual(withCreative(full(), {}), full());
  assert.deepEqual(withCreative(full(), { smooth: false }), full());
  assert.deepEqual(withCreative(full(), { curtain: true, magnetic: false }), full());
  assert.deepEqual(withCreative({}, { enabled: false }), {});
  const calm = { ...full(), motion: { reveal: 'calm' } };
  assert.deepEqual(withCreative(calm, { enabled: false }), calm);
  assert.deepEqual(withCreative(calm, { smooth: false }), calm);
});

test('switching on again starts from the defaults, not from old options', () => {
  const on = withCreative(full(), { enabled: true, smooth: false, curtain: true });
  const again = withCreative(withCreative(on, { enabled: false }), { enabled: true });
  assert.deepEqual(again.motion, { creative: { enabled: true } });
});

test('junk is replaced by a clean object when switched on, removed when switched off', () => {
  assert.deepEqual(withCreative({ motion: 'junk' }, { enabled: true }), { motion: { creative: { enabled: true } } });
  assert.deepEqual(withCreative({ motion: { creative: 'yes' } }, { enabled: true }), { motion: { creative: { enabled: true } } });
  assert.deepEqual(withCreative({ motion: { creative: 'yes' } }, { enabled: false }), {});
  assert.deepEqual(withCreative({ motion: { creative: { enabled: false } } }, {}), {});
  // A junk `motion` with nothing to remove is left as it is.
  assert.deepEqual(withCreative({ motion: 'junk' }, { enabled: false }), { motion: 'junk' });
  // Unknown keys inside creative survive an option change.
  assert.deepEqual(
    withCreative({ motion: { creative: { enabled: true, future: 1 } } }, { magnetic: false }),
    { motion: { creative: { enabled: true, future: 1, magnetic: 'off' } } },
  );
});

// ── UI texts ────────────────────────────────────────────────────────────

const CREATIVE_TEXT_KEYS = ['enabled', 'enabledHint', 'smooth', 'magnetic', 'curtain', 'optionsHint', 'calmNote'];

const builderTexts = (loc) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${loc}.json`, import.meta.url)), 'utf8')).builder;

test('builder.creative carries the seven texts in six locales', () => {
  for (const loc of LOCALES) {
    const creative = builderTexts(loc).creative;
    assert.ok(creative && typeof creative === 'object', `${loc}: builder.creative missing`);
    assert.deepEqual(Object.keys(creative), CREATIVE_TEXT_KEYS, `${loc}: keys`);
    for (const key of CREATIVE_TEXT_KEYS) assert.ok(typeof creative[key] === 'string' && creative[key].trim(), `${loc}: ${key}`);
  }
  const en = builderTexts('en').creative;
  assert.equal(en.enabled, 'Creative motion');
  assert.equal(en.smooth, 'Smooth scrolling');
  assert.equal(en.magnetic, 'Magnetic buttons');
  assert.equal(en.curtain, 'Page transition');
});

test('the calm note names the motion setting and its two values by their labels', () => {
  for (const loc of LOCALES) {
    const builder = builderTexts(loc);
    for (const key of ['reveal', 'revealCalm', 'revealOff']) {
      assert.ok(builder.creative.calmNote.includes(builder.motion[key]), `${loc}: calmNote names "${builder.motion[key]}"`);
    }
  }
});

test('the colour scene and living background texts are gone', () => {
  for (const loc of LOCALES) {
    const keys = Object.keys(builderTexts(loc)).filter((k) => /^style(Scene|Backdrop)/.test(k));
    assert.deepEqual(keys, [], loc);
  }
});
