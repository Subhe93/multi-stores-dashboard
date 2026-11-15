// Unit test of the product confirmation email note form helpers (P4 E2.3).
// Run: node --experimental-strip-types --test src/lib/emailNote.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_NOTE_MAX, emailNotePayload, emailNoteText } from './emailNote.ts';

test('emailNoteText: undefined without the key, else the note or empty', () => {
  assert.equal(emailNoteText({ locale: 'sv' }), undefined);
  assert.equal(emailNoteText({ locale: 'sv', email_note: null }), '');
  assert.equal(emailNoteText({ locale: 'sv', email_note: 'Ta med glasögon' }), 'Ta med glasögon');
});

test('emailNotePayload: no key for untouched or empty locales without a stored note', () => {
  assert.deepEqual(emailNotePayload(undefined, undefined), {});
  assert.deepEqual(emailNotePayload(undefined, 'Old'), {});
  assert.deepEqual(emailNotePayload('', ''), {});
  assert.deepEqual(emailNotePayload('   ', undefined), {});
});

test('emailNotePayload: a note is sent trimmed', () => {
  assert.deepEqual(emailNotePayload('  Ta med glasögon  ', ''), { email_note: 'Ta med glasögon' });
  assert.deepEqual(emailNotePayload('Rad 1\nRad 2', 'Rad 1'), { email_note: 'Rad 1\nRad 2' });
});

test('emailNotePayload: emptying a stored note clears it to null', () => {
  assert.deepEqual(emailNotePayload('', 'Old'), { email_note: null });
  assert.deepEqual(emailNotePayload('  ', 'Old'), { email_note: null });
});

test('emailNotePayload: never more than the API cap', () => {
  assert.equal(EMAIL_NOTE_MAX, 500);
  const out = emailNotePayload('x'.repeat(600), '');
  assert.equal(out.email_note.length, 500);
});
