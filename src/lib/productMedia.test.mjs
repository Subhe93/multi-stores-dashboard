// Unit tests of the product editor media grid helpers (images + videos).
// Run: node --experimental-strip-types --test src/lib/productMedia.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  featuredFirst, formatVideoDuration, mergeMedia, moveMedia, removeImage, setFeaturedImage,
  shouldSendVideos, splitMedia, toRelativeUploadUrl, videoFromServer, videosKey, videosNeedImage, videosPayload,
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
