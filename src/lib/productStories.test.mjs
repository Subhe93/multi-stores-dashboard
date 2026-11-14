// Unit tests of the customer stories editor helpers, their i18n keys and the
// product-stories builder schema.
// Run: node --experimental-strip-types --test src/lib/productStories.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_STORIES_PER_PRODUCT, STORY_ERROR_CODES, adoptStoryIds, describeStoryError, emptyStory, firstInvalidStory,
  isStoryErrorCode, looksLikeVideoLink, moveStory, shouldSendStories, storiesKey, storiesPayload, storyDialogCloseAction,
  storyFromServer,
  storyText,
} from './productStories.ts';
import { SECTION_SCHEMAS, findSectionSchema } from './section-schemas.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

const row = (id, extra = {}) => ({
  id,
  kind: 'image',
  url: `/uploads/products/${id}.webp`,
  poster_url: null,
  duration_s: null,
  width: 800,
  height: 1200,
  name: `Person ${id}`,
  rating: 5,
  verified: true,
  translations: [
    { locale: 'en', quote: 'Great', subtitle: 'Stockholm' },
    { locale: 'sv', quote: 'Toppen', subtitle: null },
  ],
  ...extra,
});

test('storyFromServer keeps every locale, maps null rating to 0 and drops an image poster', () => {
  const s = storyFromServer(row('a', { rating: null, poster_url: '/uploads/video-posters/x.jpg', translations: [
    { locale: 'en', quote: 'Hi', subtitle: null },
    { locale: 'de', quote: 'Hallo', subtitle: 'Berlin' },
  ] }));
  assert.equal(s.id, 'a');
  assert.equal(s.rating, 0);
  assert.equal(s.poster_url, null);
  assert.deepEqual(s.translations, { en: { quote: 'Hi', subtitle: '' }, de: { quote: 'Hallo', subtitle: 'Berlin' } });
  assert.equal(storyFromServer(row('b', { rating: 9 })).rating, 0);
});

test('storiesPayload sends the contract shape in display order', () => {
  const file = storyFromServer(row('v', {
    kind: 'file', url: '/uploads/products/v.mp4', poster_url: '/uploads/video-posters/v.jpg', duration_s: 12.4,
    rating: null, verified: false,
  }));
  const fresh = { ...emptyStory(['en', 'sv']), url: '/uploads/products/n.webp', name: '  Ann  ', rating: 3 };
  fresh.translations.en = { quote: ' Love it ', subtitle: '' };
  const out = storiesPayload([file, fresh]);
  assert.deepEqual(out[0], {
    id: 'v', kind: 'file', url: '/uploads/products/v.mp4', poster_url: '/uploads/video-posters/v.jpg',
    duration_s: 12, width: 800, height: 1200, name: 'Person v', rating: null, verified: false,
    translations: [
      { locale: 'en', quote: 'Great', subtitle: 'Stockholm' },
      { locale: 'sv', quote: 'Toppen', subtitle: null },
    ],
  });
  // New story: no id key, trimmed name, empty locales left out, image has no poster/duration.
  assert.equal('id' in out[1], false);
  assert.equal(out[1].name, 'Ann');
  assert.equal(out[1].rating, 3);
  assert.equal(out[1].poster_url, null);
  assert.equal(out[1].duration_s, null);
  assert.deepEqual(out[1].translations, [{ locale: 'en', quote: 'Love it', subtitle: null }]);
});

test('translations of locales the store no longer uses are sent back unchanged', () => {
  const s = storyFromServer(row('a', { translations: [{ locale: 'fr', quote: 'Super', subtitle: 'Paris' }] }));
  assert.deepEqual(storiesPayload([s])[0].translations, [{ locale: 'fr', quote: 'Super', subtitle: 'Paris' }]);
});

test('shouldSendStories: edit only on a story-aware API, create only with stories', () => {
  assert.equal(shouldSendStories({ mode: 'edit', serverHasStories: true, storyCount: 0 }), true);
  assert.equal(shouldSendStories({ mode: 'edit', serverHasStories: false, storyCount: 2 }), false);
  assert.equal(shouldSendStories({ mode: 'create', serverHasStories: false, storyCount: 0 }), false);
  assert.equal(shouldSendStories({ mode: 'create', serverHasStories: false, storyCount: 1 }), true);
});

test('shouldSendStories: an edit save skips unchanged stories', () => {
  assert.equal(shouldSendStories({ mode: 'edit', serverHasStories: true, storyCount: 3, changed: false }), false);
  assert.equal(shouldSendStories({ mode: 'edit', serverHasStories: true, storyCount: 3, changed: true }), true);
  // Removing the last story is a change and must be sent (empty list).
  assert.equal(shouldSendStories({ mode: 'edit', serverHasStories: true, storyCount: 0, changed: true }), true);
  // Create ignores `changed`.
  assert.equal(shouldSendStories({ mode: 'create', serverHasStories: false, storyCount: 1, changed: false }), true);
});

test('storyDialogCloseAction: busy blocks, an edited draft asks, else closes', () => {
  const opened = storyFromServer(row('a'));
  const initialKey = JSON.stringify(opened);
  assert.equal(storyDialogCloseAction({ busy: true, draft: opened, initialKey }), 'blocked');
  assert.equal(storyDialogCloseAction({ busy: false, draft: opened, initialKey }), 'close');
  assert.equal(storyDialogCloseAction({ busy: false, draft: { ...opened, name: 'Changed' }, initialKey }), 'confirm');
  // Busy wins over a dirty draft (the upload must finish first).
  assert.equal(storyDialogCloseAction({ busy: true, draft: { ...opened, name: 'Changed' }, initialKey }), 'blocked');
  assert.equal(storyDialogCloseAction({ busy: false, draft: null, initialKey: 'null' }), 'close');
});

test('storiesKey ignores ids, so adopting stored ids keeps the saved key', () => {
  const a = storyFromServer(row('a'));
  assert.equal(storiesKey([{ ...a, id: undefined }]), storiesKey([a]));
});

test('firstInvalidStory blocks a story without media, then without name', () => {
  const ok = storyFromServer(row('a'));
  const noMedia = { ...emptyStory(['en']), name: 'Bo' };
  const noName = { ...emptyStory(['en']), url: '/uploads/products/x.webp', name: '   ' };
  assert.equal(firstInvalidStory([ok]), null);
  assert.deepEqual(firstInvalidStory([ok, noMedia, noName]), { index: 1, problem: 'mediaRequired' });
  assert.deepEqual(firstInvalidStory([ok, noName]), { index: 1, problem: 'nameRequired' });
});

test('moveStory moves and clamps; out-of-range is a no-op copy', () => {
  assert.deepEqual(moveStory(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveStory(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(moveStory(['a', 'b', 'c'], 1, 9), ['a', 'c', 'b']);
  assert.deepEqual(moveStory(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveStory(['a', 'b'], 5, 0), ['a', 'b']);
});

test('storiesKey ignores ids and local keys but sees order and text changes', () => {
  const a = storyFromServer(row('a'));
  const b = storyFromServer(row('b'));
  const aNoId = { ...a, id: undefined, key: 'other' };
  assert.equal(storiesKey([a, b]), storiesKey([aNoId, b]));
  assert.notEqual(storiesKey([a, b]), storiesKey([b, a]));
  const edited = { ...a, translations: { ...a.translations, en: { quote: 'Changed', subtitle: '' } } };
  assert.notEqual(storiesKey([a]), storiesKey([edited]));
});

test('storyText falls back to the primary locale, then the first filled one', () => {
  const s = storyFromServer(row('a'));
  assert.equal(storyText(s, 'sv', 'en').quote, 'Toppen');
  assert.equal(storyText(s, 'de', 'en').subtitle, 'Stockholm');
  assert.equal(storyText(s, 'de', 'ar').quote, 'Great');
  assert.deepEqual(storyText({ ...s, translations: {} }, 'en', 'en'), { quote: '', subtitle: '' });
});

test('describeStoryError: every code is known, index opens the named story', () => {
  for (const code of STORY_ERROR_CODES) assert.ok(isStoryErrorCode(code), code);
  assert.equal(isStoryErrorCode('VIDEO_LIMIT_EXCEEDED'), false);
  assert.equal(isStoryErrorCode(undefined), false);

  assert.deepEqual(describeStoryError('STORY_FILE_INVALID', { index: 2 }, 3), {
    key: 'errors.STORY_FILE_INVALID', values: {}, index: 2,
  });
  // Out-of-range or missing index: no story is opened.
  assert.equal(describeStoryError('STORY_IMAGE_INVALID', { index: 3 }, 3).index, null);
  assert.equal(describeStoryError('STORY_IMAGE_INVALID', {}, 3).index, null);
  assert.deepEqual(describeStoryError('STORY_LOCALE_DUPLICATE', { index: 0, locale: 'sv' }, 1), {
    key: 'errors.STORY_LOCALE_DUPLICATE', values: { locale: 'sv' }, index: 0,
  });
  // The limit names no story; max falls back to the client constant.
  assert.deepEqual(describeStoryError('STORY_LIMIT_EXCEEDED', { max: 30 }, 31), {
    key: 'errors.STORY_LIMIT_EXCEEDED', values: { max: 30 }, index: null,
  });
  assert.equal(describeStoryError('STORY_LIMIT_EXCEEDED', null, 31).values.max, MAX_STORIES_PER_PRODUCT);
  assert.equal(MAX_STORIES_PER_PRODUCT, 30);
});

test('adoptStoryIds gives new stories their stored id when the order matches', () => {
  const old = storyFromServer(row('a'));
  const fresh = { ...emptyStory(['en']), url: '/uploads/products/n.webp', name: 'N' };
  const sent = storiesPayload([old, fresh]);
  const out = adoptStoryIds([old, fresh], sent, [{ id: 'a', url: old.url }, { id: 'new-id', url: fresh.url }]);
  assert.equal(out[0].id, 'a');
  assert.equal(out[1].id, 'new-id');
  // A different stored length or URL keeps the story without an id.
  assert.equal(adoptStoryIds([fresh], storiesPayload([fresh]), []).at(0).id, undefined);
  assert.equal(adoptStoryIds([fresh], storiesPayload([fresh]), [{ id: 'x', url: '/other' }])[0].id, undefined);
});

test('looksLikeVideoLink accepts YouTube / Vimeo only', () => {
  assert.ok(looksLikeVideoLink('https://www.youtube.com/watch?v=abc'));
  assert.ok(looksLikeVideoLink('youtu.be/abc'));
  assert.ok(looksLikeVideoLink('https://vimeo.com/123'));
  assert.equal(looksLikeVideoLink('https://evil.com/youtube.com/x'), false);
  assert.equal(looksLikeVideoLink(''), false);
});

// ── i18n ───────────────────────────────────────────────────────────────
const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(here, '..', 'i18n', 'messages', `${l}.json`), 'utf8'))]),
);
const STORY_KEYS = [
  'title', 'hint', 'empty', 'add', 'edit', 'remove', 'moveUp', 'moveDown', 'dragHandle', 'untitled', 'media',
  'mediaRequired', 'uploadImage', 'uploadVideo', 'addVideoLink', 'changeMedia', 'changePoster', 'name',
  'namePlaceholder', 'nameRequired', 'subtitle', 'subtitlePlaceholder', 'quote', 'quotePlaceholder', 'rating',
  'ratingNone', 'ratingValue', 'verified', 'verifiedHelp', 'limitReached', 'autoTranslateFrom', 'autoTranslate',
  'translating', 'save', 'busyClose', 'discardTitle', 'discard', 'keepEditing',
];
// Top-level ICU argument names of a message ("{max}", "{rating, plural, ...}").
const argsOf = (msg) => [...new Set([...msg.matchAll(/\{\s*([a-zA-Z_]+)\s*[,}]/g)].map((m) => m[1]))].sort();

test('story.* keys exist in all 6 locales with the same ICU arguments', () => {
  for (const l of LOCALES) {
    assert.deepEqual(Object.keys(messages[l].story).sort(), [...STORY_KEYS].sort(), l);
    for (const key of STORY_KEYS) {
      const msg = messages[l].story[key];
      assert.equal(typeof msg, 'string', `${l} story.${key}`);
      assert.ok(msg.trim(), `${l} story.${key} empty`);
      assert.deepEqual(argsOf(msg), argsOf(messages.en.story[key]), `${l} story.${key} args`);
    }
  }
});

test('errors.STORY_* exist in all 6 locales for every API code', () => {
  for (const l of LOCALES) {
    for (const code of STORY_ERROR_CODES) {
      const msg = messages[l].errors[code];
      assert.equal(typeof msg, 'string', `${l} errors.${code}`);
      assert.deepEqual(argsOf(msg), argsOf(messages.en.errors[code]), `${l} errors.${code} args`);
    }
  }
  assert.deepEqual(argsOf(messages.en.errors.STORY_LIMIT_EXCEEDED), ['max']);
  assert.deepEqual(argsOf(messages.en.errors.STORY_LOCALE_DUPLICATE), ['locale']);
});

// ── Builder schema (contract 7.2) ─────────────────────────────────────
test('product-stories schema matches the contract and is registered after product-faq', () => {
  const s = findSectionSchema('product-stories');
  assert.ok(s, 'registered');
  assert.equal(s.id, 'product-stories');
  assert.equal(s.category, 'product');
  assert.deepEqual(s.pageTypes, ['PRODUCT_TEMPLATE']);
  assert.equal(s.gate, 'layout-containers');
  assert.deepEqual(s.translatable, ['heading', 'subheading']);
  assert.deepEqual(s.defaultSettings, {
    show_heading: true, heading: '', subheading: '', layout: 'slider', card_aspect: 'portrait',
    columns: 4, columns_tablet: 3, columns_mobile: 1, text_position: 'below',
    show_rating: true, show_subtitle: true, show_verified: true,
  });
  const field = (k) => s.schema.find((f) => f.key === k);
  // heading_level / subheading_tag are the shared SEO tag selects (withHeadingLevel).
  const own = s.schema.filter((f) => f.key !== 'heading_level' && f.key !== 'subheading_tag');
  assert.deepEqual(own.map((f) => f.key).sort(), Object.keys(s.defaultSettings).sort());
  for (const f of own) assert.equal(f.defaultValue, s.defaultSettings[f.key], f.key);
  const keys = s.schema.map((f) => f.key);
  assert.equal(keys[keys.indexOf('heading') + 1], 'heading_level');
  assert.equal(field('heading_level').defaultValue, 'h2');
  assert.equal(keys[keys.indexOf('subheading') + 1], 'subheading_tag');
  assert.equal(field('subheading_tag').defaultValue, 'p');
  assert.deepEqual(field('layout').options.map((o) => o.value), ['slider', 'grid', 'overlay']);
  assert.deepEqual(field('card_aspect').options.map((o) => o.value), ['portrait', 'square', 'landscape']);
  assert.deepEqual(field('text_position').options.map((o) => o.value), ['below', 'overlay']);
  assert.deepEqual([field('columns').min, field('columns').max], [1, 6]);
  assert.deepEqual([field('columns_tablet').min, field('columns_tablet').max], [1, 4]);
  assert.deepEqual([field('columns_mobile').min, field('columns_mobile').max], [1, 2]);
  assert.equal(s.schema.some((f) => /autoplay/.test(f.key)), false);
  // Registered together with the web renderer (contract 7.6), right after product-faq.
  const ids = SECTION_SCHEMAS.map((x) => x.id);
  assert.equal(ids.indexOf('product-stories'), ids.indexOf('product-faq') + 1);
  for (const f of s.schema) assert.ok(f.label.en && f.label.ar, `${f.key} label en/ar`);
  assert.ok(s.label.en && s.label.ar && s.description.en && s.description.ar);
});
