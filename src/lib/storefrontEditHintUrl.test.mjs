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

test('isOwnStorefrontUrl: market hosts from storefront_hosts / public_host', () => {
  // Legacy custom_domain is a retired host; the store is served on its market domains.
  const market = {
    slug: 'namez-se',
    custom_domain: 'resumely.net',
    public_host: 'namez.se',
    storefront_hosts: ['namez.se', 'www.namez.se', 'namez.shop', 'resumely.net'],
  };
  assert.equal(isOwnStorefrontUrl('https://namez.se/products/x', market, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://www.namez.shop/', market, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://NAMEZ.SHOP/en/', market, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://resumely.net/', market, WEB), true);
  assert.equal(isOwnStorefrontUrl('https://namez.de/', market, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://shop.namez.se/', market, WEB), false);
  // public_host alone (no storefront_hosts) is honoured too.
  assert.equal(isOwnStorefrontUrl('https://namez.se/', { slug: 'namez-se', public_host: 'namez.se' }, WEB), true);
});

test('isOwnStorefrontUrl: anything else is not the own storefront', () => {
  assert.equal(isOwnStorefrontUrl('https://iwings-digital.com/store/namez-se-2/x', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://other-store.iwings-digital.com/', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://evil.namez.se.example.com/', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://ms-dash.iwings-digital.com/creator', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('not a url', namez, WEB), false);
  assert.equal(isOwnStorefrontUrl('https://x.iwings-digital.com/', { slug: 'x', custom_domain: null }, WEB), true);
});

test('isOwnStorefrontUrl: domain-move overlap — every listed platform host counts', () => {
  const hosts = ['shopsdoor.com', 'www.shopsdoor.com', 'iwings-digital.com', 'www.iwings-digital.com'];
  const web = 'https://shopsdoor.com';
  const muba = { slug: 'muba', custom_domain: null };
  assert.equal(isOwnStorefrontUrl('https://muba.shopsdoor.com/products/x', muba, web, hosts), true);
  assert.equal(isOwnStorefrontUrl('https://muba.iwings-digital.com/', muba, web, hosts), true);
  assert.equal(isOwnStorefrontUrl('https://iwings-digital.com/store/muba/om-oss', muba, web, hosts), true);
  assert.equal(isOwnStorefrontUrl('https://www.shopsdoor.com/store/muba', muba, web, hosts), true);
  assert.equal(isOwnStorefrontUrl('https://other.iwings-digital.com/', muba, web, hosts), false);
  assert.equal(isOwnStorefrontUrl('https://app.shopsdoor.com/creator', muba, web, hosts), false);
  assert.equal(isOwnStorefrontUrl('https://muba.example.com/', muba, web, hosts), false);
  // Without the list only the primary origin is known (today's behaviour).
  assert.equal(isOwnStorefrontUrl('https://muba.iwings-digital.com/', muba, web), false);
  // Dev: the primary origin keeps its port.
  assert.equal(isOwnStorefrontUrl('http://muba.localhost:3003/', muba, 'http://localhost:3003', ['localhost']), true);
});
