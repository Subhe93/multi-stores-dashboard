// Motion style, store level: the switch of the theme customizer
// (store.theme_customizations.motion.creative). Unset values are never
// stored, so a store that does not opt in keeps its data as it is. The
// value names are the contract shared with the storefront
// (multi-stores-web/src/themes/creative/creativeAttrs.ts). Also the
// per-section override of the style panel (settings._style.motion).
// Run: node --experimental-strip-types --test src/lib/creativeTokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creativeValue, withCreative, withMotion } from './themeTokens.ts';
import { SECTION_MOTION_CHOICES, sectionMotionValue, withSectionMotion } from './sectionMotion.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const OFF = { enabled: false, smooth: true, magnetic: true, curtain: false, progress: false, cursor: false };
const ON = { ...OFF, enabled: true };

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
    { motion: { creative: { progress: 'bar', cursor: 'dot' } } },
    { motion: { creative: { enabled: false, progress: 'bar', cursor: 'dot' } } },
  ]) {
    assert.deepEqual(creativeValue(tokens), OFF, JSON.stringify(tokens));
  }
});

test('enabled: smooth and magnetic are on unless stored off, curtain is off unless stored', () => {
  assert.deepEqual(creativeValue({ motion: { creative: { enabled: true } } }), ON);
  assert.deepEqual(
    creativeValue({ motion: { creative: { enabled: true, smooth: 'off', magnetic: 'off', transition: 'curtain' } } }),
    { ...ON, smooth: false, magnetic: false, curtain: true },
  );
  // Unknown stored values fall back to the default of each option.
  assert.deepEqual(
    creativeValue({ motion: { creative: { enabled: true, smooth: 'no', magnetic: false, transition: 'fade' } } }),
    ON,
  );
});

test('enabled: the progress bar and the cursor dot are off unless stored as bar / dot', () => {
  assert.deepEqual(
    creativeValue({ motion: { creative: { enabled: true, progress: 'bar', cursor: 'dot' } } }),
    { ...ON, progress: true, cursor: true },
  );
  assert.deepEqual(creativeValue({ motion: { creative: { enabled: true, progress: 'bar' } } }), { ...ON, progress: true });
  assert.deepEqual(creativeValue({ motion: { creative: { enabled: true, cursor: 'dot' } } }), { ...ON, cursor: true });
  // Only the exact contract strings switch them on.
  for (const junk of [true, 1, 'on', 'line', 'Bar', 'DOT', '', null, {}]) {
    assert.deepEqual(creativeValue({ motion: { creative: { enabled: true, progress: junk, cursor: junk } } }), ON, String(junk));
  }
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

test('progress bar and cursor dot: stored only when on, removed when switched back off', () => {
  let tokens = withCreative(full(), { enabled: true });
  tokens = withCreative(tokens, { progress: true });
  assert.deepEqual(tokens.motion, { creative: { enabled: true, progress: 'bar' } });
  tokens = withCreative(tokens, { cursor: true });
  assert.deepEqual(tokens.motion, { creative: { enabled: true, progress: 'bar', cursor: 'dot' } });
  // The other options keep their stored values next to them.
  tokens = withCreative(tokens, { smooth: false, curtain: true });
  assert.deepEqual(tokens.motion, {
    creative: { enabled: true, smooth: 'off', transition: 'curtain', progress: 'bar', cursor: 'dot' },
  });
  tokens = withCreative(tokens, { progress: false });
  assert.deepEqual(tokens.motion, { creative: { enabled: true, smooth: 'off', transition: 'curtain', cursor: 'dot' } });
  tokens = withCreative(tokens, { cursor: false, smooth: true, curtain: false });
  assert.deepEqual(tokens, { ...full(), motion: { creative: { enabled: true } } });
  // Never stored as false / off / none.
  assert.equal(/false|"off"|"none"/.test(JSON.stringify(tokens)), false);
});

test('progress bar and cursor dot: nothing is stored while the master is off, and off clears them', () => {
  assert.deepEqual(withCreative(full(), { progress: true }), full());
  assert.deepEqual(withCreative(full(), { cursor: true, progress: true }), full());
  const on = withCreative(full(), { enabled: true, progress: true, cursor: true });
  assert.deepEqual(on.motion, { creative: { enabled: true, progress: 'bar', cursor: 'dot' } });
  assert.deepEqual(withCreative(on, { enabled: false }), full());
  // Switching on again starts without them.
  assert.deepEqual(withCreative(withCreative(on, { enabled: false }), { enabled: true }).motion, { creative: { enabled: true } });
  // Junk stored values are dropped by the next change.
  assert.deepEqual(
    withCreative({ motion: { creative: { enabled: true, progress: 'line', cursor: true } } }, { magnetic: false }),
    { motion: { creative: { enabled: true, magnetic: 'off' } } },
  );
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

// ── Per-section override (settings._style.motion) ───────────────────────

test('section override: only the exact string none reads as None', () => {
  assert.deepEqual([...SECTION_MOTION_CHOICES], ['auto', 'none']);
  assert.equal(sectionMotionValue({ motion: 'none' }), 'none');
  for (const style of [undefined, null, {}, { motion: undefined }, { motion: '' }, { motion: 'auto' }, { motion: 'None' }, { motion: true }, { motion: 0 }, { animate: 'none' }]) {
    assert.equal(sectionMotionValue(style), 'auto', JSON.stringify(style));
  }
});

test('section override: None stores motion: none, Automatic removes the key', () => {
  const style = () => ({ padding: { base: { top: 'lg' } }, animate: 'fade-up', hide_on: ['mobile'] });
  const before = style();
  const none = withSectionMotion(before, 'none');
  assert.deepEqual(none, { ...style(), motion: 'none' });
  assert.deepEqual(before, style(), 'input not mutated');
  const auto = withSectionMotion(none, 'auto');
  assert.deepEqual(auto, style());
  assert.equal('motion' in auto, false);
  // Never stored as 'auto', undefined or null.
  assert.equal(JSON.stringify(auto).includes('motion'), false);
  // An untouched section keeps its style object deep-equal.
  assert.deepEqual(withSectionMotion(style(), 'auto'), style());
  assert.deepEqual(withSectionMotion(undefined, 'auto'), {});
  assert.deepEqual(withSectionMotion(null, 'none'), { motion: 'none' });
  // Anything but 'none' is Automatic; junk already stored is cleaned.
  assert.deepEqual(withSectionMotion({ motion: 'junk', animate: 'fade-in' }, 'fast'), { animate: 'fade-in' });
});

test('section override: the style panel offers the row and its three texts exist in six locales', () => {
  const panel = readFileSync(fileURLToPath(new URL('../components/builder/StylePanel.tsx', import.meta.url)), 'utf8');
  assert.ok(panel.includes('withSectionMotion(v, choice)'), 'the panel writes through withSectionMotion');
  assert.ok(panel.includes('sectionMotionValue(v)'), 'the panel reads through sectionMotionValue');
  for (const loc of LOCALES) {
    const builder = builderTexts(loc);
    for (const key of ['styleMotion', 'styleMotionAuto', 'styleMotionHint', 'styleNone']) {
      assert.ok(typeof builder[key] === 'string' && builder[key].trim(), `${loc}: ${key}`);
    }
    // The hint names the None choice and the store switch by their labels.
    assert.ok(builder.styleMotionHint.includes(builder.styleNone), `${loc}: hint names "${builder.styleNone}"`);
    assert.ok(builder.styleMotionHint.includes(builder.creative.enabled), `${loc}: hint names "${builder.creative.enabled}"`);
    assert.equal(builder.styleMotion, builder.creative.enabled, `${loc}: one name for the feature`);
  }
  assert.equal(builderTexts('en').styleMotionAuto, 'Automatic');
});

// ── UI texts ────────────────────────────────────────────────────────────

const CREATIVE_TEXT_KEYS = ['enabled', 'enabledHint', 'smooth', 'magnetic', 'curtain', 'progress', 'cursor', 'optionsHint', 'calmNote'];

const builderTexts = (loc) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../i18n/messages/${loc}.json`, import.meta.url)), 'utf8')).builder;

test('builder.creative carries the nine texts in six locales', () => {
  for (const loc of LOCALES) {
    const creative = builderTexts(loc).creative;
    assert.ok(creative && typeof creative === 'object', `${loc}: builder.creative missing`);
    assert.deepEqual(Object.keys(creative), CREATIVE_TEXT_KEYS, `${loc}: keys`);
    for (const key of CREATIVE_TEXT_KEYS) assert.ok(typeof creative[key] === 'string' && creative[key].trim(), `${loc}: ${key}`);
  }
  const en = builderTexts('en').creative;
  assert.equal(en.enabled, 'Motion style');
  assert.equal(en.smooth, 'Smooth scrolling');
  assert.equal(en.magnetic, 'Magnetic buttons');
  assert.equal(en.curtain, 'Page transition');
  assert.equal(en.progress, 'Scroll progress bar');
  assert.equal(en.cursor, 'Cursor dot');
  // The hint says it covers every page, with light motion on the buying pages.
  assert.match(en.enabledHint, /every page/);
  assert.match(en.enabledHint, /Product, cart and checkout pages get light, fast motion only/);
});

test('the old name of the switch is gone in every locale', () => {
  const OLD = { en: 'Creative motion', ar: 'الحركة الإبداعية', tr: 'Yaratıcı hareket', de: 'Kreative Bewegung', fr: 'Mouvement créatif', sv: 'Kreativ rörelse' };
  for (const loc of LOCALES) {
    assert.equal(JSON.stringify(builderTexts(loc)).includes(OLD[loc]), false, loc);
  }
});

test('the customizer offers the five options through the pure helpers', () => {
  const src = readFileSync(fileURLToPath(new URL('../components/builder/ThemeCustomizer.tsx', import.meta.url)), 'utf8');
  for (const key of ['smooth', 'magnetic', 'curtain', 'progress', 'cursor']) {
    assert.ok(src.includes(`t('creative.${key}')`), `label ${key}`);
    assert.ok(src.includes(`setCreative({ ${key} })`), `setter ${key}`);
  }
});

test('the calm note names the motion setting and its two values by their labels', () => {
  for (const loc of LOCALES) {
    const builder = builderTexts(loc);
    for (const key of ['reveal', 'revealCalm', 'revealOff']) {
      assert.ok(builder.creative.calmNote.includes(builder.motion[key]), `${loc}: calmNote names "${builder.motion[key]}"`);
    }
  }
});
