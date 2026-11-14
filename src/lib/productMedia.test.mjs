// Unit tests of the product editor media grid helpers (images + videos).
// Run: node --experimental-strip-types --test src/lib/productMedia.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  featuredFirst, featuredVideoMissingPoster, formatVideoDuration, mergeMedia, moveMedia, normalizeMediaOrder, removeImage,
  setFeaturedImage, setFeaturedVideo, shouldSendVideos, splitMedia, toRelativeUploadUrl, unsetFeaturedVideo,
  videoFromServer, videosKey, videosNeedImage, videosPayload,
} from './productMedia.ts';

const img = (id, featured = false) => ({ id, url: `/uploads/products/${id}.webp`, is_featured: featured });
const vid = (id, position, extra = {}) => ({
  id, kind: 'file', url: `/uploads/products/${id}.mp4`, poster_url: null, alt: '',
  duration_s: 12, width: 1080, height: 1920, position, ...extra,
});
const ids = (items) => items.map(it => it.id);

test('featuredFirst moves the featured image to the front and keeps one featured', () => {
  const out = featuredFirst([img('a'), img('b'), img('c', true)]);
  assert.deepEqual(out.map(i => i.id), ['c', 'a', 'b']);
  assert.deepEqual(out.map(i => !!i.is_featured), [true, false, false]);
  // No featured image: the first one becomes featured.
  assert.deepEqual(featuredFirst([img('a'), img('b')]).map(i => !!i.is_featured), [true, false]);
  assert.deepEqual(featuredFirst([]), []);
});

test('mergeMedia inserts videos after `position` images, clamped to 1..images', () => {
  const images = [img('a', true), img('b'), img('c')];
  assert.deepEqual(ids(mergeMedia(images, [vid('v1', 1), vid('v2', 9), vid('v0', 0)])), ['a', 'v1', 'v0', 'b', 'c', 'v2']);
  // Same position: array order.
  assert.deepEqual(ids(mergeMedia(images, [vid('x', 2), vid('y', 2)])), ['a', 'b', 'x', 'y', 'c']);
  // No images: videos only.
  assert.deepEqual(ids(mergeMedia([], [vid('v', 1)])), ['v']);
});

test('position = number of images before the video in featured-first order', () => {
  // A product whose featured image was stored third: the grid shows it first,
  // so a video right after it gets position 1 (matches the storefront).
  const images = featuredFirst([img('a'), img('b'), img('c', true)]);
  const merged = mergeMedia(images, [vid('v', 1)]);
  assert.deepEqual(ids(merged), ['c', 'v', 'a', 'b']);
  const { images: outImages, videos } = splitMedia(merged);
  assert.equal(videos[0].position, 1);
  assert.equal(outImages[0].id, 'c');
  assert.equal(outImages[0].is_featured, true);
});

test('a video dropped at index 0 snaps to index 1; it never becomes featured', () => {
  const merged = mergeMedia([img('a', true), img('b')], [vid('v', 2)]);
  const moved = moveMedia(merged, 'v', 'a');
  assert.deepEqual(ids(moved), ['a', 'v', 'b']);
  const { images, videos } = splitMedia(moved);
  assert.equal(images[0].id, 'a');
  assert.equal(images[0].is_featured, true);
  assert.equal(videos[0].position, 1);
});

test('dragging an image to the front makes it the featured image', () => {
  const merged = mergeMedia([img('a', true), img('b')], [vid('v', 1)]);
  const moved = moveMedia(merged, 'b', 'a');
  const { images, videos } = splitMedia(moved);
  assert.deepEqual(images.map(i => [i.id, !!i.is_featured]), [['b', true], ['a', false]]);
  // b, a, v  -> the video now follows two images.
  assert.deepEqual(ids(moved), ['b', 'a', 'v']);
  assert.equal(videos[0].position, 2);
});

test('setFeaturedImage moves the starred image to the front', () => {
  const out = setFeaturedImage([img('a', true), img('b'), img('c')], 'c');
  assert.deepEqual(out.map(i => [i.id, !!i.is_featured]), [['c', true], ['a', false], ['b', false]]);
});

test('removeImage re-clamps video positions and keeps a featured image', () => {
  const { images, videos } = removeImage([img('a', true), img('b')], [vid('v', 2)], 'a');
  assert.deepEqual(images.map(i => [i.id, !!i.is_featured]), [['b', true]]);
  assert.equal(videos[0].position, 1);
  // Last image removed: videos stay (position 1), the save is then blocked.
  const none = removeImage([img('a', true)], [vid('v', 1)], 'a');
  assert.equal(none.images.length, 0);
  assert.equal(none.videos[0].position, 1);
  assert.equal(videosNeedImage(none.images.length, none.videos.length), true);
  assert.equal(videosNeedImage(0, 0), false);
  assert.equal(videosNeedImage(1, 3), false);
});

test('videosPayload: grid order, id only for stored rows, alt trimmed to null', () => {
  const stored = videoFromServer({
    id: '7f1c2a7e-0000-4000-8000-000000000001', kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    poster_url: '/uploads/products/p.webp', duration_s: null, width: null, height: null, position: 2, alt: 'Demo',
    created_at: '2026-11-13T10:00:00.000Z',
  });
  const fresh = vid('vid-local', 1, { alt: '  ' });
  const out = videosPayload([fresh, stored]);
  assert.deepEqual(out[0], {
    kind: 'file', url: '/uploads/products/vid-local.mp4', poster_url: null, alt: null,
    duration_s: 12, width: 1080, height: 1920, position: 1,
  });
  assert.equal(out[1].id, '7f1c2a7e-0000-4000-8000-000000000001');
  assert.equal(out[1].alt, 'Demo');
  assert.equal(out[1].position, 2);
  assert.equal('created_at' in out[1], false);
});

test('shouldSendVideos: an edit sends videos only when they changed', () => {
  assert.equal(shouldSendVideos({ mode: 'edit', serverHasVideos: true, videoCount: 1, changed: false }), false);
  assert.equal(shouldSendVideos({ mode: 'edit', serverHasVideos: true, videoCount: 0, changed: true }), true);
  assert.equal(shouldSendVideos({ mode: 'edit', serverHasVideos: false, videoCount: 1, changed: true }), false);
});

test('videosKey ignores stored row ids and sees every saved field', () => {
  const a = [videoFromServer({ ...vid('a', 1), id: 'row-1' })];
  const b = a.map(v => ({ ...v, serverId: undefined }));
  assert.equal(videosKey(a), videosKey(b));
  assert.notEqual(videosKey(a), videosKey([{ ...a[0], position: 2 }]));
  assert.notEqual(videosKey(a), videosKey([{ ...a[0], poster_url: '/uploads/video-posters/p.webp' }]));
  assert.equal(videosKey([]), '[]');
});

test('shouldSendVideos follows the contract (edit: GET had videos; create: videos added)', () => {
  assert.equal(shouldSendVideos({ mode: 'edit', serverHasVideos: true, videoCount: 0 }), true);
  assert.equal(shouldSendVideos({ mode: 'edit', serverHasVideos: false, videoCount: 0 }), false);
  assert.equal(shouldSendVideos({ mode: 'edit', serverHasVideos: false, videoCount: 2 }), false);
  assert.equal(shouldSendVideos({ mode: 'create', serverHasVideos: false, videoCount: 0 }), false);
  assert.equal(shouldSendVideos({ mode: 'create', serverHasVideos: false, videoCount: 1 }), true);
});

test('toRelativeUploadUrl strips only our API origin', () => {
  assert.equal(toRelativeUploadUrl('https://api.example.com/uploads/products/a.webp', 'https://api.example.com'), '/uploads/products/a.webp');
  assert.equal(toRelativeUploadUrl('/uploads/products/a.webp', 'https://api.example.com'), '/uploads/products/a.webp');
  assert.equal(toRelativeUploadUrl('https://evil.com/uploads/a.webp', 'https://api.example.com'), 'https://evil.com/uploads/a.webp');
});

test('formatVideoDuration', () => {
  assert.equal(formatVideoDuration(5), '0:05');
  assert.equal(formatVideoDuration(60), '1:00');
  assert.equal(formatVideoDuration(null), '');
});

test('i18n: video keys exist in all 6 locales with matching image/errors key sets', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'messages');
  const locales = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
  const files = Object.fromEntries(locales.map(l => [l, JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'))]));
  const required = {
    image: ['addMedia', 'uploadVideo', 'addVideoLink', 'videoLinkLabel', 'videoLinkPlaceholder', 'videoLinkInvalid',
      'videoLinkCheck', 'videoUploadHint', 'videoTooLong', 'videoTooLarge', 'videoUnsupportedFormat', 'uploadingProgress',
      'generatingPoster', 'posterFailed', 'changePoster', 'videoAlt', 'videoCannotBeFeatured', 'videoRequiresImage',
      'videoLimitReached', 'videoPlay', 'removeVideo', 'videoRateLimited'],
    errors: ['PRODUCT_VIDEO_UPLOADS_DISABLED', 'UPLOAD_FOLDER_FORBIDDEN', 'UPLOAD_NO_FILE', 'UPLOAD_VIDEO_TOO_LARGE',
      'UPLOAD_VIDEO_TYPE', 'UPLOAD_VIDEO_UNREADABLE', 'UPLOAD_VIDEO_CODEC', 'UPLOAD_VIDEO_TOO_LONG',
      'UPLOAD_VIDEO_BITRATE_TOO_HIGH', 'UPLOAD_VIDEO_NOT_FASTSTART', 'UPLOAD_VIDEO_DISK_LOW',
      'UPLOAD_VIDEO_QUOTA_EXCEEDED', 'VIDEO_URL_NOT_ALLOWED', 'VIDEO_LIMIT_EXCEEDED', 'VIDEO_FILE_INVALID', 'VIDEO_UPLOAD_EXPIRED',
      'VIDEO_POSTER_INVALID', 'VIDEO_REQUIRES_IMAGE', 'UPLOAD_TYPE_MISMATCH'],
  };
  for (const l of locales) {
    for (const [ns, keys] of Object.entries(required)) {
      for (const k of keys) assert.equal(typeof files[l][ns][k], 'string', `${l}: ${ns}.${k}`);
    }
    assert.deepEqual(Object.keys(files[l].image).sort(), Object.keys(files.en.image).sort(), `${l}: image keys`);
    // ICU placeholders match English.
    for (const k of ['videoTooLong', 'videoTooLarge', 'videoLimitReached']) assert.match(files[l].image[k], /\{max\}/, `${l}: ${k}`);
    assert.match(files[l].image.uploadingProgress, /\{percent\}/, `${l}: uploadingProgress`);
    assert.doesNotMatch(files[l].image.uploadHint, /10/, `${l}: uploadHint still says 10 MB`);
  }
});

// ── Featured video + autoplay (plans/product-video/CONTRACT-AUTOPLAY.md 4.2) ──

const F = { allowFeaturedVideo: true };
const withPoster = (id, position, extra = {}) => vid(id, position, { poster_url: `/uploads/video-posters/${id}.webp`, ...extra });

test('videoFromServer keeps position 0 and maps autoplay/loop (missing: false / 1)', () => {
  const base = { id: 'r', kind: 'file', url: '/u.mp4', poster_url: '/p.webp', duration_s: null, width: null, height: null, alt: null };
  const featured = videoFromServer({ ...base, position: 0, autoplay: true, loop: true });
  assert.equal(featured.position, 0);
  assert.equal(featured.autoplay, true);
  assert.equal(featured.loop, true);
  const old = videoFromServer({ ...base, position: undefined });
  assert.equal(old.position, 1);
  assert.equal(old.autoplay, false);
  assert.equal(old.loop, false);
});

test('mergeMedia: position 0 leads only with allowFeaturedVideo', () => {
  const images = [img('a', true), img('b')];
  assert.deepEqual(ids(mergeMedia(images, [withPoster('v', 0)], F)), ['v', 'a', 'b']);
  assert.deepEqual(ids(mergeMedia(images, [withPoster('v', 0)])), ['a', 'v', 'b']);
});

test('normalizeMediaOrder keeps one leading video with a poster; others move after the first image', () => {
  const items = mergeMedia([img('a', true), img('b')], [], F);
  const lead = [
    { type: 'video', id: 'v1', video: withPoster('v1', 1) },
    { type: 'video', id: 'v2', video: withPoster('v2', 1) },
    ...items,
  ];
  assert.deepEqual(ids(normalizeMediaOrder(lead, F)), ['v1', 'a', 'v2', 'b']);
  // Without the flag: the old rule.
  assert.deepEqual(ids(normalizeMediaOrder(lead)), ['a', 'v1', 'v2', 'b']);
  // A poster-less leading video snaps to index 1.
  const bare = [{ type: 'video', id: 'n', video: vid('n', 1) }, ...items];
  assert.deepEqual(ids(normalizeMediaOrder(bare, F)), ['a', 'n', 'b']);
});

test('splitMedia gives the kept leading video position 0, others >= 1', () => {
  const merged = mergeMedia([img('a', true), img('b')], [withPoster('v', 0), vid('w', 2)], F);
  const { images, videos } = splitMedia(merged, F);
  assert.deepEqual(videos.map(v => [v.id, v.position]), [['v', 0], ['w', 2]]);
  assert.equal(images[0].id, 'a');
  assert.equal(images[0].is_featured, true);
  // Without the flag the same order is clamped to 1.
  assert.equal(splitMedia(merged).videos[0].position, 1);
  // No images: nothing can be featured.
  assert.equal(splitMedia(mergeMedia([], [withPoster('v', 0)], F), F).videos[0].position, 1);
});

test('a video with a poster dropped at index 0 becomes featured; the old one moves after the first image', () => {
  const merged = mergeMedia([img('a', true), img('b')], [withPoster('old', 0), withPoster('new', 2)], F);
  assert.deepEqual(ids(merged), ['old', 'a', 'b', 'new']);
  const moved = moveMedia(merged, 'new', 'old', F);
  assert.deepEqual(ids(moved), ['new', 'a', 'old', 'b']);
  const { videos } = splitMedia(moved, F);
  assert.deepEqual(videos.map(v => [v.id, v.position]), [['new', 0], ['old', 1]]);
});

test('a poster-less video dropped at index 0 keeps the featured video in front', () => {
  const merged = mergeMedia([img('a', true), img('b')], [withPoster('feat', 0), vid('bare', 2)], F);
  const moved = moveMedia(merged, 'bare', 'feat', F);
  assert.deepEqual(ids(moved), ['feat', 'a', 'bare', 'b']);
  const plain = mergeMedia([img('a', true)], [vid('bare', 1)], F);
  assert.deepEqual(ids(moveMedia(plain, 'bare', 'a', F)), ['a', 'bare']);
});

test('setFeaturedVideo / unsetFeaturedVideo', () => {
  const merged = mergeMedia([img('a', true), img('b')], [withPoster('v', 2), vid('n', 1)], F);
  const set = setFeaturedVideo(merged, 'v');
  assert.deepEqual(ids(set), ['v', 'a', 'n', 'b']);
  assert.deepEqual(splitMedia(set, F).videos.map(v => [v.id, v.position]), [['v', 0], ['n', 1]]);
  // Poster-less: cannot lead.
  assert.deepEqual(ids(setFeaturedVideo(merged, 'n')), ['a', 'n', 'b', 'v']);
  const unset = unsetFeaturedVideo(set, 'v');
  assert.deepEqual(ids(unset), ['a', 'v', 'n', 'b']);
  assert.deepEqual(splitMedia(unset, F).videos.map(v => [v.id, v.position]), [['v', 1], ['n', 1]]);
});

test('starring an image never displaces the featured video', () => {
  const images = setFeaturedImage([img('a', true), img('b')], 'b');
  const merged = mergeMedia(images, [withPoster('v', 0)], F);
  assert.deepEqual(ids(merged), ['v', 'b', 'a']);
  assert.equal(merged[1].image.is_featured, true);
});

test('removing the only image drops the featured state', () => {
  const { videos } = removeImage([img('a', true)], [withPoster('v', 0)], 'a', F);
  assert.equal(videos[0].position, 1);
});

test('featuredVideoMissingPoster only under the flag', () => {
  assert.equal(featuredVideoMissingPoster([vid('v', 0)], F), true);
  assert.equal(featuredVideoMissingPoster([withPoster('v', 0)], F), false);
  assert.equal(featuredVideoMissingPoster([vid('v', 0)]), false);
});

test('videosPayload sends position 0 / autoplay / loop only under the flags', () => {
  const v = withPoster('v', 0, { autoplay: true, loop: true });
  const off = videosPayload([v])[0];
  assert.equal(off.position, 1);
  assert.equal('autoplay' in off, false);
  assert.equal('loop' in off, false);
  const on = videosPayload([v], { allowFeaturedVideo: true, allowAutoplay: true })[0];
  assert.equal(on.position, 0);
  assert.equal(on.autoplay, true);
  assert.equal(on.loop, true);
  // Loop without autoplay is sent as false.
  const loopOnly = videosPayload([withPoster('w', 1, { autoplay: false, loop: true })], { allowAutoplay: true })[0];
  assert.deepEqual([loopOnly.autoplay, loopOnly.loop], [false, false]);
});

test('videosKey sees an autoplay-only change (so the save sends videos)', () => {
  const flags = { allowFeaturedVideo: true, allowAutoplay: true };
  const loaded = [withPoster('v', 1, { autoplay: false, loop: false })];
  const edited = [{ ...loaded[0], autoplay: true }];
  assert.notEqual(videosKey(loaded, flags), videosKey(edited, flags));
  assert.equal(
    shouldSendVideos({ mode: 'edit', serverHasVideos: true, videoCount: 1, changed: videosKey(edited, flags) !== videosKey(loaded, flags) }),
    true,
  );
  // Without the flags the key (and payload) are exactly as before.
  assert.equal(videosKey(loaded), videosKey(edited));
});

test('i18n: featured video / autoplay keys exist in all 6 locales', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'messages');
  const locales = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
  const files = Object.fromEntries(locales.map(l => [l, JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'))]));
  const required = {
    image: ['setFeaturedVideo', 'unsetFeaturedVideo', 'featuredVideo', 'featuredVideoHint', 'featuredVideoNeedsPoster',
      'videoAutoplay', 'videoLoop', 'videoAutoplayHelp'],
    story: ['autoplay', 'loop', 'autoplayHelp', 'autoplayBadge'],
    errors: ['VIDEO_FEATURED_MULTIPLE', 'VIDEO_FEATURED_REQUIRES_POSTER'],
  };
  for (const l of locales) {
    for (const [ns, keys] of Object.entries(required)) {
      for (const k of keys) assert.equal(typeof files[l][ns][k], 'string', `${l}: ${ns}.${k}`);
    }
    assert.equal(files[l].story.autoplayHelp, files[l].image.videoAutoplayHelp, `${l}: autoplayHelp text`);
    assert.deepEqual(Object.keys(files[l].story).sort(), Object.keys(files.en.story).sort(), `${l}: story keys`);
  }
});
