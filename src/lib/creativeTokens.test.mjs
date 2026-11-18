// Creative engine, store level: the creative motion switch of the theme
// customizer (store.theme_customizations.motion.creative) and the scene /
// living-background keys of a section's `_style`. Unset values are never
// stored, so a store or section that does not opt in keeps its data as it is.
// The value names are the contract shared with the storefront
// (multi-stores-web/src/themes/creative/creativeAttrs.ts, decor/sectionDecor.tsx).
// Run: node --experimental-strip-types --test src/lib/creativeTokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creativeValue, withCreative, withMotion } from './themeTokens.ts';
import {
  BACKDROP_KEYS,
  SCENE_KEYS,
  backdropOf,
  contrastRatio,
  sceneContrastIssues,
  sceneOf,
  withBackdrop,
  withScene,
  withStyleKey,
} from './sceneStyle.ts';

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

// ── Scene and living background of a section (_style) ───────────────────

const styled = () => ({ padding: { desktop: { top: 'lg' } }, animate: 'fade-up', hide_on: ['mobile'] });

test('the key lists are the storefront contract', () => {
  assert.deepEqual([...SCENE_KEYS], ['scene', 'scene_bg', 'scene_text', 'scene_accent']);
  assert.deepEqual([...BACKDROP_KEYS], [
    'backdrop', 'backdrop_color_1', 'backdrop_color_2', 'backdrop_intensity', 'backdrop_motion', 'backdrop_particle',
  ]);
});

test('sceneOf / backdropOf read only their three values', () => {
  for (const value of ['dark', 'light', 'accent']) assert.equal(sceneOf({ scene: value }), value);
  for (const value of ['dots', 'particles', 'glow']) assert.equal(backdropOf({ backdrop: value }), value);
  for (const style of [undefined, null, {}, { scene: 'none' }, { scene: 'DARK' }, { scene: 1 }, { backdrop: 'stars' }]) {
    assert.equal(sceneOf(style), '');
    assert.equal(backdropOf(style), '');
  }
});

test('withScene sets the scene and keeps every other key', () => {
  const next = withScene(styled(), 'dark');
  assert.deepEqual(next, { ...styled(), scene: 'dark' });
  assert.deepEqual(withScene({ ...next, scene_bg: '#111111' }, 'accent'), { ...styled(), scene: 'accent', scene_bg: '#111111' });
});

test('scene none removes the scene and its three overrides, nothing else', () => {
  const stored = { ...styled(), scene: 'dark', scene_bg: '#111111', scene_text: '#ffffff', scene_accent: '#a38250', backdrop: 'dots' };
  assert.deepEqual(withScene(stored, 'none'), { ...styled(), backdrop: 'dots' });
  assert.deepEqual(withScene(stored, ''), { ...styled(), backdrop: 'dots' });
  // Overrides alone would still render a light scene on the storefront.
  assert.deepEqual(withScene({ scene_bg: '#111111' }, 'none'), {});
  // An unset section stays deep-equal.
  assert.deepEqual(withScene(styled(), 'none'), styled());
});

test('withBackdrop: none removes all six keys; the particle shape belongs to particles', () => {
  const stored = {
    ...styled(), scene: 'light', backdrop: 'particles', backdrop_color_1: '#a38250', backdrop_color_2: '#b60018',
    backdrop_intensity: 'medium', backdrop_motion: 'still', backdrop_particle: 'ring',
  };
  assert.deepEqual(withBackdrop(stored, 'none'), { ...styled(), scene: 'light' });
  assert.deepEqual(withBackdrop(styled(), 'none'), styled());
  const glow = withBackdrop(stored, 'glow');
  assert.equal(glow.backdrop, 'glow');
  assert.equal('backdrop_particle' in glow, false);
  assert.equal(glow.backdrop_intensity, 'medium');
  assert.deepEqual(withBackdrop(styled(), 'dots'), { ...styled(), backdrop: 'dots' });
});

test('withStyleKey: empty and the unset behaviour remove the key', () => {
  assert.deepEqual(withStyleKey(styled(), 'scene_bg', '#111111'), { ...styled(), scene_bg: '#111111' });
  assert.deepEqual(withStyleKey({ ...styled(), scene_bg: '#111111' }, 'scene_bg', ''), styled());
  assert.deepEqual(withStyleKey({ ...styled(), scene_bg: '#111111' }, 'scene_bg', undefined), styled());
  assert.deepEqual(withStyleKey(styled(), 'scene_text', '  #ffffff '), { ...styled(), scene_text: '#ffffff' });
  // soft / slow / dot are what the storefront does without the key.
  assert.deepEqual(withStyleKey({ backdrop_intensity: 'medium' }, 'backdrop_intensity', 'soft'), {});
  assert.deepEqual(withStyleKey({ backdrop_motion: 'still' }, 'backdrop_motion', 'slow'), {});
  assert.deepEqual(withStyleKey({ backdrop_particle: 'ring' }, 'backdrop_particle', 'dot'), {});
  assert.deepEqual(withStyleKey({}, 'backdrop_intensity', 'medium'), { backdrop_intensity: 'medium' });
  assert.deepEqual(withStyleKey({}, 'backdrop_motion', 'still'), { backdrop_motion: 'still' });
  // No key is ever stored as undefined.
  const cleared = withStyleKey({ scene_accent: '#a38250' }, 'scene_accent', '');
  assert.equal('scene_accent' in cleared, false);
});

test('contrastRatio follows WCAG; non-hex input gives null', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#fff', '#ffffff'), 1);
  assert.equal(contrastRatio('#000', '#FFF'), contrastRatio('#ffffff', '#000000'));
  for (const bad of ['', 'red', '#12', '#12345', 'rgb(0,0,0)', undefined, null, 12]) {
    assert.equal(contrastRatio(bad, '#ffffff'), null, String(bad));
    assert.equal(contrastRatio('#ffffff', bad), null, String(bad));
  }
});

test('contrast warning: only for a pair of overrides under 4.5', () => {
  // White on a saturated red passes; a muted gold on cream does not.
  assert.deepEqual(sceneContrastIssues({ scene: 'accent', scene_bg: '#B60018', scene_text: '#FFFFFF' }), {});
  const gold = sceneContrastIssues({ scene: 'light', scene_bg: '#F7F4EF', scene_text: '#111111', scene_accent: '#A38250' });
  assert.equal(gold.text, undefined);
  assert.ok(gold.accent > 3 && gold.accent < 4.5, String(gold.accent));
  const grey = sceneContrastIssues({ scene_bg: '#ffffff', scene_text: '#999999' });
  assert.ok(grey.text < 4.5);
  // Rounded down, so a failing ratio never reads as 4.5.
  assert.ok(sceneContrastIssues({ scene_bg: '#ffffff', scene_text: '#777777' }).text <= 4.4);
  // One colour of the pair missing (the theme supplies it) or not a hex: no warning.
  assert.deepEqual(sceneContrastIssues({ scene_text: '#999999' }), {});
  assert.deepEqual(sceneContrastIssues({ scene_bg: '#ffffff' }), {});
  assert.deepEqual(sceneContrastIssues({ scene_bg: '#fff', scene_text: '#9' }), {});
  assert.deepEqual(sceneContrastIssues(undefined), {});
});

// ── UI texts ────────────────────────────────────────────────────────────

const CREATIVE_TEXT_KEYS = ['enabled', 'enabledHint', 'smooth', 'magnetic', 'curtain', 'optionsHint', 'calmNote'];
const STYLE_TEXT_KEYS = [
  'styleScene', 'styleSceneHint', 'styleSceneDark', 'styleSceneLight', 'styleSceneAccent',
  'styleSceneBg', 'styleSceneText', 'styleSceneAccentColor', 'styleSceneEmptyHint',
  'styleSceneContrastText', 'styleSceneContrastAccent',
  'styleBackdrop', 'styleBackdropHint', 'styleBackdropKind', 'styleBackdropDots', 'styleBackdropParticles',
  'styleBackdropGlow', 'styleBackdropColor1', 'styleBackdropColor2', 'styleBackdropColorHint',
  'styleBackdropIntensity', 'styleBackdropSoft', 'styleBackdropMedium',
  'styleBackdropMotion', 'styleBackdropSlow', 'styleBackdropStill',
  'styleBackdropParticle', 'styleBackdropDot', 'styleBackdropRing',
];

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

test('the scene and living-background texts exist in six locales', () => {
  for (const loc of LOCALES) {
    const builder = builderTexts(loc);
    for (const key of STYLE_TEXT_KEYS) assert.ok(typeof builder[key] === 'string' && builder[key].trim(), `${loc}: ${key}`);
    // The two warnings show the measured ratio and the 4.5 target.
    for (const key of ['styleSceneContrastText', 'styleSceneContrastAccent']) {
      assert.ok(builder[key].includes('{ratio}'), `${loc}: ${key} ratio`);
      assert.match(builder[key], /4[.,]5/, `${loc}: ${key} target`);
    }
  }
});
