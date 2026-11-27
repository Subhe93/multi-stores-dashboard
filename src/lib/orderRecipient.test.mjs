// Unit tests of the recipient-vs-buyer comparison.
// Run: node --experimental-strip-types --test src/lib/orderRecipient.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careOfValue, isRecipientDifferent, sameName } from './orderRecipient.ts';

const base = { needsShipping: true, buyerFirstName: 'Anna', buyerLastName: 'Lind' };

test('same name in any order, case, spacing and diacritics is the same person', () => {
  assert.equal(sameName('Lind Anna', 'Anna Lind'), true);
  assert.equal(sameName('  anna   LIND ', 'Anna Lind'), true);
  assert.equal(sameName('Åsa Öberg', 'Asa Oberg'), true);
  assert.equal(sameName('Anna Lind', 'Anna Lindh'), false);
});

test('different recipient is flagged', () => {
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Karl Berg' }), true);
});

test('equal recipient is not flagged', () => {
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'lind, anna' }), false);
});

test('not flagged without shipping or with an empty name', () => {
  assert.equal(isRecipientDifferent({ ...base, needsShipping: false, recipientName: 'Karl Berg' }), false);
  assert.equal(isRecipientDifferent({ ...base, recipientName: '  ' }), false);
  assert.equal(isRecipientDifferent({ ...base, recipientName: null }), false);
  assert.equal(isRecipientDifferent({ needsShipping: true, recipientName: 'Karl', buyerFirstName: '', buyerLastName: null }), false);
});

test('company order with recipient equal to the company name is not flagged', () => {
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Acme AB', companyName: 'acme ab' }), false);
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Karl Berg', companyName: 'Acme AB' }), true);
});

test('a missing or extra name part is the same person', () => {
  assert.equal(sameName('Anna Lind', 'Anna Maria Lind'), true);
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Anna Maria Lind' }), false);
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Sara Lind' }), true);
});

test('the placeholder profile (email local part, no last name) is never flagged', () => {
  const placeholder = { needsShipping: true, buyerFirstName: 'alaa90', buyerLastName: '', buyerEmail: 'Alaa90@gmail.com' };
  assert.equal(isRecipientDifferent({ ...placeholder, recipientName: 'Alaa Subhi' }), false);
  // A real first name without a last name still counts.
  assert.equal(isRecipientDifferent({ ...placeholder, buyerFirstName: 'Karl', recipientName: 'Alaa Subhi' }), true);
});

test('the buyer name stored on the order wins over the account profile', () => {
  // Returning account "Sara Berg"; this order was bought by and sent to Erik Berg.
  const order = { needsShipping: true, buyerFirstName: 'Sara', buyerLastName: 'Berg', recipientName: 'Erik Berg' };
  assert.equal(isRecipientDifferent(order), true);
  assert.equal(isRecipientDifferent({ ...order, buyerName: 'Erik Berg' }), false);
  // The profile equals the recipient, but another person paid.
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Anna Lind', buyerName: 'Karl Berg' }), true);
  // A blank stored name falls back to the profile.
  assert.equal(isRecipientDifferent({ ...base, recipientName: 'Anna Lind', buyerName: '  ' }), false);
});

test('careOfValue strips a prefix the shopper typed', () => {
  assert.equal(careOfValue('c/o Anna Berg'), 'Anna Berg');
  assert.equal(careOfValue('  C / O: Anna Berg '), 'Anna Berg');
  assert.equal(careOfValue('Familjen Lind'), 'Familjen Lind');
  assert.equal(careOfValue('c/o'), '');
  assert.equal(careOfValue('  '), '');
  assert.equal(careOfValue(null), '');
  // Not a prefix: the word continues.
  assert.equal(careOfValue('C/Olsson'), 'C/Olsson');
});
