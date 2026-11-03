// Unit test of the custom-domain removal helpers.
// Run: node --experimental-strip-types --test src/lib/customDomain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainRemovalFallbackHost, isPlatformSubdomainHost, platformSubdomainHost } from './customDomain.ts';

const WEB = 'https://iwings-digital.com';

test('platform subdomain keeps the origin port', () => {
  assert.equal(platformSubdomainHost('namez', 'http://localhost:3003'), 'namez.localhost:3003');
  assert.equal(platformSubdomainHost('namez', WEB), 'namez.iwings-digital.com');
});

test('no public host: falls back to the platform subdomain', () => {
  assert.equal(
    domainRemovalFallbackHost({ slug: 'namez', custom_domain: 'resumely.net', public_host: null }, WEB),
    'namez.iwings-digital.com',
  );
});

test('public host equal to the removed domain is not a fallback', () => {
  assert.equal(
    domainRemovalFallbackHost({ slug: 'namez', custom_domain: 'Resumely.net', public_host: 'resumely.net' }, WEB),
    'namez.iwings-digital.com',
  );
});

test('a different Markets public host wins', () => {
  assert.equal(
    domainRemovalFallbackHost({ slug: 'namez', custom_domain: 'resumely.net', public_host: 'namez.se' }, WEB),
    'namez.se',
  );
});

test('domain move: a public host that is the platform subdomain under ANY listed host follows the primary origin', () => {
  const hosts = ['shopsdoor.com', 'iwings-digital.com'];
  assert.equal(isPlatformSubdomainHost('namez.iwings-digital.com', 'namez', hosts), true);
  assert.equal(isPlatformSubdomainHost('namez.se', 'namez', hosts), false);
  assert.equal(
    domainRemovalFallbackHost(
      { slug: 'namez', custom_domain: 'resumely.net', public_host: 'namez.iwings-digital.com' },
      'https://shopsdoor.com',
      hosts,
    ),
    'namez.shopsdoor.com',
  );
  assert.equal(
    domainRemovalFallbackHost({ slug: 'namez', custom_domain: 'resumely.net', public_host: 'namez.se' }, 'https://shopsdoor.com', hosts),
    'namez.se',
  );
});
