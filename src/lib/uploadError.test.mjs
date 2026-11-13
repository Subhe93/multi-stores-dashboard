// Unit test of the upload failure -> error-code mapping.
// Run: node --experimental-strip-types --test src/lib/uploadError.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkVideoFile, checkVideoMetadata, mapUploadFailure, mapVideoUploadFailure, posterSeekTime,
} from './uploadError.ts';

const MAX = 50 * 1024 * 1024;

test('413 with the coded API body: code + cap from max_bytes', () => {
  const f = mapUploadFailure(413, {
    code: 'UPLOAD_FILE_TOO_LARGE',
    message: 'File too large (max 50 MB)',
    max_bytes: MAX,
  });
  assert.equal(f.code, 'UPLOAD_FILE_TOO_LARGE');
  assert.equal(f.maxMb, 50);
  assert.equal(f.message, 'File too large (max 50 MB)');
});

test('413 without JSON (nginx HTML page): still the translated code, cap from the default', () => {
  assert.deepEqual(mapUploadFailure(413, null, MAX), {
    status: 413,
    code: 'UPLOAD_FILE_TOO_LARGE',
    message: undefined,
    maxMb: 50,
  });
  assert.equal(mapUploadFailure(413, null).maxMb, undefined);
});

test('other coded errors keep their code; uncoded ones keep the message', () => {
  assert.equal(
    mapUploadFailure(403, { code: 'UPLOAD_FOLDER_FORBIDDEN', message: 'no' }).code,
    'UPLOAD_FOLDER_FORBIDDEN',
  );
  const v = mapUploadFailure(400, { message: ['a', 'b'] });
  assert.equal(v.code, undefined);
  assert.equal(v.message, 'a · b');
});

// ── Product videos ──────────────────────────────────────────────────────────
const LIMITS = { max_bytes: 50 * 1024 * 1024, max_duration_s: 60 };

test('checkVideoFile: .mp4 only, MP4 type, size cap', () => {
  assert.equal(checkVideoFile({ name: 'clip.mp4', size: 1000, type: 'video/mp4' }, LIMITS), null);
  assert.equal(checkVideoFile({ name: 'CLIP.MP4', size: 1000, type: '' }, LIMITS), null);
  assert.equal(checkVideoFile({ name: 'clip.mov', size: 1000, type: 'video/quicktime' }, LIMITS).key, 'image.videoUnsupportedFormat');
  assert.equal(checkVideoFile({ name: 'clip.webm', size: 1000, type: 'video/webm' }, LIMITS).key, 'image.videoUnsupportedFormat');
  assert.equal(checkVideoFile({ name: 'clip.mp4', size: 1000, type: 'video/quicktime' }, LIMITS).key, 'image.videoUnsupportedFormat');
  assert.deepEqual(checkVideoFile({ name: 'big.mp4', size: LIMITS.max_bytes + 1, type: 'video/mp4' }, LIMITS), {
    key: 'image.videoTooLarge', values: { max: 50 },
  });
  assert.equal(checkVideoFile({ name: 'edge.mp4', size: LIMITS.max_bytes, type: 'video/mp4' }, LIMITS), null);
});

test('checkVideoMetadata: duration cap with 0.5 s tolerance, undecodable picture', () => {
  assert.equal(checkVideoMetadata({ duration: 60.4, videoWidth: 1080 }, LIMITS), null);
  assert.deepEqual(checkVideoMetadata({ duration: 61, videoWidth: 1080 }, LIMITS), {
    key: 'image.videoTooLong', values: { max: 60 },
  });
  // HEVC on a browser without HEVC decode: metadata loads but no picture.
  assert.equal(checkVideoMetadata({ duration: 10, videoWidth: 0 }, LIMITS).key, 'image.videoUnsupportedFormat');
  assert.equal(checkVideoMetadata({ duration: NaN, videoWidth: 1080 }, LIMITS).key, 'image.videoUnsupportedFormat');
});

test('posterSeekTime: min(1 s, 10 % of the duration)', () => {
  assert.equal(posterSeekTime(30), 1);
  assert.equal(posterSeekTime(5), 0.5);
  assert.equal(posterSeekTime(0), 0);
});

test('mapVideoUploadFailure: every coded API refusal maps to a translation key', () => {
  // nginx 413 (no JSON) and the API 413 with maxBytes.
  assert.deepEqual(mapVideoUploadFailure(413, null, LIMITS), { key: 'image.videoTooLarge', values: { max: 50 }, status: 413 });
  assert.deepEqual(
    mapVideoUploadFailure(413, { code: 'UPLOAD_VIDEO_TOO_LARGE', maxBytes: 20 * 1024 * 1024 }, LIMITS).values,
    { max: 20 },
  );
  assert.deepEqual(
    mapVideoUploadFailure(400, { code: 'UPLOAD_VIDEO_TOO_LONG', maxSeconds: 60, durationS: 75 }, LIMITS),
    { key: 'image.videoTooLong', values: { max: 60 }, status: 400 },
  );
  assert.deepEqual(mapVideoUploadFailure(400, { code: 'VIDEO_LIMIT_EXCEEDED', max: 3 }).values, { max: 3 });
  assert.equal(mapVideoUploadFailure(400, { code: 'VIDEO_REQUIRES_IMAGE' }).key, 'image.videoRequiresImage');
  for (const [status, code] of [
    [503, 'PRODUCT_VIDEO_UPLOADS_DISABLED'], [403, 'UPLOAD_FOLDER_FORBIDDEN'], [400, 'UPLOAD_NO_FILE'],
    [400, 'UPLOAD_VIDEO_TYPE'], [400, 'UPLOAD_VIDEO_UNREADABLE'], [400, 'UPLOAD_VIDEO_CODEC'],
    [400, 'UPLOAD_VIDEO_BITRATE_TOO_HIGH'], [400, 'UPLOAD_VIDEO_NOT_FASTSTART'], [507, 'UPLOAD_VIDEO_DISK_LOW'],
    [403, 'UPLOAD_VIDEO_QUOTA_EXCEEDED'], [400, 'VIDEO_URL_NOT_ALLOWED'], [400, 'VIDEO_FILE_INVALID'],
    [400, 'VIDEO_POSTER_INVALID'],
  ]) {
    assert.equal(mapVideoUploadFailure(status, { code, message: 'x' }).key, `errors.${code}`, code);
  }
  // Throttler (no code) and an uncoded failure.
  assert.equal(mapVideoUploadFailure(429, { statusCode: 429, message: 'ThrottlerException' }).key, 'image.videoRateLimited');
  const other = mapVideoUploadFailure(500, { message: 'boom' });
  assert.equal(other.key, 'errors.generic');
  assert.equal(other.message, 'boom');
});
