// Unit test of the upload failure -> error-code mapping.
// Run: node --experimental-strip-types --test src/lib/uploadError.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapUploadFailure } from './uploadError.ts';

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
