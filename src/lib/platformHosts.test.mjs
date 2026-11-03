// Unit test of the platform host list (domain-move overlap).
// Run: node --experimental-strip-types --test src/lib/platformHosts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostnameOf, isPlatformSubdomainHost, platformHostsFrom } from './platformHosts.ts';

test('hostnameOf: URL or bare host, lower-case, no port', () => {
  assert.equal(hostnameOf('https://App.ShopsDoor.com:8443/x'), 'app.shopsdoor.com');
  assert.equal(hostnameOf(' shopsdoor.com '), 'shopsdoor.com');
  assert.equal(hostnameOf('localhost:3003'), 'localhost');
  assert.equal(hostnameOf(''), null);
  assert.equal(hostnameOf(undefined), null);
});

test('platformHostsFrom: web URL host first (bare + www), then the list, deduplicated', () => {
  assert.deepEqual(
    platformHostsFrom('shopsdoor.com, www.shopsdoor.com,iwings-digital.com,www.iwings-digital.com', 'https://shopsdoor.com'),
    ['shopsdoor.com', 'www.shopsdoor.com', 'iwings-digital.com', 'www.iwings-digital.com'],
  );
  assert.deepEqual(platformHostsFrom(undefined, 'https://www.shopsdoor.com'), ['www.shopsdoor.com', 'shopsdoor.com']);
  assert.deepEqual(platformHostsFrom('', 'http://localhost:3003'), ['localhost']);
  assert.deepEqual(platformHostsFrom(undefined, undefined), ['localhost']);
  assert.deepEqual(platformHostsFrom('iwings-digital.com', ''), ['iwings-digital.com']);
});

test('isPlatformSubdomainHost: <slug>.<any listed host>', () => {
  const hosts = platformHostsFrom('iwings-digital.com', 'https://shopsdoor.com');
  assert.equal(isPlatformSubdomainHost('muba.shopsdoor.com', 'muba', hosts), true);
  assert.equal(isPlatformSubdomainHost('MUBA.iwings-digital.com:443', 'muba', hosts), true);
  assert.equal(isPlatformSubdomainHost('muba.example.com', 'muba', hosts), false);
  assert.equal(isPlatformSubdomainHost('other.shopsdoor.com', 'muba', hosts), false);
  assert.equal(isPlatformSubdomainHost('shopsdoor.com', 'muba', hosts), false);
  assert.equal(isPlatformSubdomainHost(null, 'muba', hosts), false);
});
