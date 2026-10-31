// Unit test of the magic-link login helpers.
// Run: node --experimental-strip-types --test src/lib/magicLogin.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMagicError, hasMagicToken, readMagicToken, roleHomePath, stripMagicToken } from './magicLogin.ts';

const TOKEN = 'q3Zt8v_Xw-1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345';

test('roleHomePath: dashboard roles map to their area, others to null', () => {
  assert.equal(roleHomePath('ADMIN'), '/admin');
  assert.equal(roleHomePath('PROVIDER'), '/provider');
  assert.equal(roleHomePath('CREATOR'), '/creator');
  assert.equal(roleHomePath('CUSTOMER'), null);
  assert.equal(roleHomePath('SOMETHING'), null);
  assert.equal(roleHomePath(undefined), null);
  assert.equal(roleHomePath(''), null);
  // Prototype keys must not leak through the lookup.
  assert.equal(roleHomePath('toString'), null);
});

test('readMagicToken: accepts base64url tokens only', () => {
  assert.equal(readMagicToken(`?token=${TOKEN}`), TOKEN);
  assert.equal(readMagicToken(`?a=1&token=${TOKEN}&b=2`), TOKEN);
  assert.equal(readMagicToken(''), null);
  assert.equal(readMagicToken('?token='), null);
  assert.equal(readMagicToken('?token=short'), null);
  assert.equal(readMagicToken('?token=has%20space%20inside%20this%20value'), null);
  assert.equal(readMagicToken(`?token=${TOKEN}%3Cscript%3E`), null);
  assert.equal(readMagicToken(`?token=${'a'.repeat(201)}`), null);
});

test('stripMagicToken: removes only the token parameter', () => {
  assert.equal(stripMagicToken('/auth/magic', `?token=${TOKEN}`), '/auth/magic');
  assert.equal(stripMagicToken('/auth/magic', `?token=${TOKEN}&next=x`), '/auth/magic?next=x');
  assert.equal(stripMagicToken('/auth/magic', `?a=1&token=${TOKEN}`, '#top'), '/auth/magic?a=1#top');
  assert.equal(stripMagicToken('/auth/magic', ''), '/auth/magic');
});

test('classifyMagicError: invalid / network / generic', () => {
  assert.equal(classifyMagicError({ status: 401, code: 'MAGIC_LINK_INVALID' }), 'invalid');
  assert.equal(classifyMagicError({ status: 401 }), 'invalid');
  assert.equal(classifyMagicError({ status: 400 }), 'invalid');
  assert.equal(classifyMagicError(new TypeError('Failed to fetch')), 'network');
  assert.equal(classifyMagicError({ status: 429 }), 'error');
  assert.equal(classifyMagicError({ status: 500 }), 'error');
  assert.equal(classifyMagicError(null), 'error');
});

test('readMagicToken / hasMagicToken: the fragment (current emails) wins over the query', () => {
  assert.equal(readMagicToken('', `#token=${TOKEN}`), TOKEN);
  assert.equal(readMagicToken('?token=old-but-long-enough-token-value', `#token=${TOKEN}`), TOKEN);
  assert.equal(readMagicToken('', '#token=short'), null);
  assert.equal(hasMagicToken('', `#token=${TOKEN}`), true);
  assert.equal(hasMagicToken(`?token=${TOKEN}`, ''), true);
  assert.equal(hasMagicToken('?a=1', '#top'), false);
});

test('stripMagicToken: removes the token from the fragment too', () => {
  assert.equal(stripMagicToken('/auth/magic', '', `#token=${TOKEN}`), '/auth/magic');
  assert.equal(stripMagicToken('/auth/magic', '?a=1', `#token=${TOKEN}&x=2`), '/auth/magic?a=1#x=2');
});
