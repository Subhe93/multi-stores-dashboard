// Unit test of the WordPress-style slug helpers and slug-input state machine.
// Run: node --experimental-strip-types --test src/lib/slug.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asciiHandle,
  asciiHandleTyping,
  initialSlugState,
  resolveSlugForSubmit,
  slugFromText,
  slugHref,
  slugPreviewPath,
  slugProblem,
  slugStateOnBlur,
  slugStateOnInput,
  slugStateOnTitle,
  slugWasAdjusted,
} from './slug.ts';

test('slugFromText: WordPress rules (Swedish folds, Arabic kept)', () => {
  assert.equal(slugFromText('Present till svärfar', 'sv'), 'present-till-svarfar');
  assert.equal(slugFromText('Kläder', 'sv'), 'klader');
  assert.equal(slugFromText('هدية لأمي', 'ar'), 'هدية-لأمي');
  assert.equal(slugFromText('ملابس، أحذية؟ وإكسسوارات!', 'ar'), 'ملابس،-أحذية؟-وإكسسوارات');
  assert.equal(slugFromText('Hello World!', 'en'), 'hello-world');
  assert.equal(slugFromText('3d_presenter', 'sv'), '3d_presenter');
  assert.equal(slugFromText('!!!', 'en'), '');
  assert.equal(slugFromText(null, 'en'), '');
});

test('slugFromText: the store locale picks the accent map (German ä -> ae)', () => {
  assert.equal(slugFromText('Kläder', 'de'), 'klaeder');
  assert.equal(slugFromText('Kläder', 'de-DE'), 'klaeder');
  assert.equal(slugFromText('Kläder', 'en'), 'klader');
});

test('asciiHandle: store slug / market key / menu key stay ASCII', () => {
  assert.equal(asciiHandle('Min Butik Åsa'), 'min-butik-asa');
  assert.equal(asciiHandle('متجر Shop'), 'shop');
  assert.equal(asciiHandle('متجر'), '');
  assert.equal(asciiHandle('a_b c'), 'ab-c');
  assert.equal(asciiHandle('abcdefghijklmnopqrstuvwxyz', 16), 'abcdefghijklmnop');
  assert.equal(asciiHandleTyping('My Store-'), 'my-store-');
  assert.equal(asciiHandleTyping('Åsa'), 'sa');
});

test('state: a new slug follows the title until the user types', () => {
  let s = initialSlugState();
  assert.equal(s.auto, true);
  s = slugStateOnTitle(s, 'Present till svärfar', 'sv');
  assert.equal(s.value, 'present-till-svarfar');
  s = slugStateOnInput(s, 'Min Egen Ä');
  assert.deepEqual(s, { value: 'Min Egen Ä', auto: false, typed: true });
  // Title changes no longer touch an edited slug.
  assert.equal(slugStateOnTitle(s, 'Something else', 'sv'), s);
  s = slugStateOnBlur(s, 'Something else', 'sv');
  assert.deepEqual(s, { value: 'min-egen-a', auto: false, typed: false });
});

test('state: an existing slug never follows the title', () => {
  const s = initialSlugState('old-handle');
  assert.equal(s.auto, false);
  assert.equal(slugStateOnTitle(s, 'New title', 'en'), s);
});

test('state: blur keeps an untouched stored slug as is (no re-sanitize)', () => {
  const s = initialSlugState('straße');
  assert.equal(slugStateOnBlur(s, 'x', 'de'), s);
  assert.equal(resolveSlugForSubmit({ slug: 'straße', title: 'x', locale: 'de' }), 'straße');
});

test('state: an emptied slug goes back to the title on blur', () => {
  let s = slugStateOnInput(initialSlugState('old'), '   ');
  s = slugStateOnBlur(s, 'هدية لأمي', 'ar');
  assert.deepEqual(s, { value: 'هدية-لأمي', auto: true, typed: false });
});

test('state: typed Arabic is kept, typed punctuation is cleaned', () => {
  const s = slugStateOnBlur(slugStateOnInput(initialSlugState(), ' هدية  لأمي!! '), '', 'ar');
  assert.equal(s.value, 'هدية-لأمي');
});

test('slugProblem: required vs unusable', () => {
  assert.equal(slugProblem(initialSlugState(), '', 'en'), 'required');
  assert.equal(slugProblem(initialSlugState(), 'Title', 'en'), null);
  assert.equal(slugProblem(slugStateOnInput(initialSlugState(), '!!!'), '', 'en'), 'unusable');
  assert.equal(slugProblem(slugStateOnInput(initialSlugState(), 'ok'), '', 'en'), null);
});

test('resolveSlugForSubmit: typed, derived from title, fallback', () => {
  assert.equal(resolveSlugForSubmit({ slug: 'Svärfar Gåva', typed: true, title: '', locale: 'sv' }), 'svarfar-gava');
  assert.equal(resolveSlugForSubmit({ slug: '', title: 'هدية لأمي', locale: 'sv' }), 'هدية-لأمي');
  assert.equal(resolveSlugForSubmit({ slug: '', title: '!!!', locale: 'en', fallback: 'primary' }), 'primary');
  assert.equal(resolveSlugForSubmit({ slug: '???', typed: true, title: 'Gift', locale: 'en' }), 'gift');
});

test('slugWasAdjusted: suffix counts, encoding/case does not', () => {
  assert.equal(slugWasAdjusted('gift', 'gift-2'), true);
  assert.equal(slugWasAdjusted('gift', 'gift'), false);
  assert.equal(slugWasAdjusted('هدية', '%D9%87%D8%AF%D9%8A%D8%A9'), false);
  assert.equal(slugWasAdjusted('', 'gift'), false);
});

test('preview path is readable, href is encoded per segment', () => {
  assert.equal(slugPreviewPath('/collections', 'parent', 'هدية'), '/collections/parent/هدية');
  assert.equal(slugPreviewPath('/products/', ''), '/products/…');
  assert.equal(slugHref('https://s.example/collections', 'parent', 'kläder'), 'https://s.example/collections/parent/kl%c3%a4der');
});
