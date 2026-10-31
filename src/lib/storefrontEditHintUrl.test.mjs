// Unit test of the storefront edit-hint hand-off URL helpers.
// Run: node --experimental-strip-types --test src/lib/storefrontEditHintUrl.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOwnStorefrontUrl, withEditHint } from './storefrontEditHintUrl.ts';

const WEB = 'https://iwings-digital.com';
const namez = { slug: 'namez-se', custom_domain: 'namez.se' };

test('withEditHint: adds (or replaces) the fragment, keeps path + query', () => {
  assert.equal(withEditHint('https://namez.se/products/x?a=1', 'T.T.T'), 'https://namez.se/products/x?a=1#ms_edit=T.T.T');
  assert.equal(withEditHint('https://namez.se/#top', 'T.T.T'), 'https://namez.se/#ms_edit=T.T.T');
});

test('isOwnStorefrontUrl: custom domain (with or without www)', () => {
  assert.equal(isOwnStorefrontUrl('https://namez.se/products/x', namez, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://www.namez.se/', namez, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://NAMEZ.se/', { slug: 'namez-se', custom_domain: 'www.namez.se' }, WEB), true);
});

test('isOwnStorefrontUrl: platform subdomain and /store/<slug> path', () => {
  assert.equal(isOwnStorefrontUrl('https://namez-se.iwings-digital.com/', namez, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://iwings-digital.com/store/namez-se', namez, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://iwings-digital.com/store/namez-se/om-oss', namez, WEB), true);
});

test('isOwnStorefrontUrl: anything else is not the own storefront', () => {
  assert.equal(isOwnStorefrontUrl('https://iwings-digital.com/store/namez-se-2/x', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://other-store.iwings-digital.com/', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://evil.namez.se.example.com/', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://ms-dash.iwings-digital.com/creator', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('not a url', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://x.iwings-digital.com/', { slug: 'x', custom_domain: null }, WEB), true);
});
