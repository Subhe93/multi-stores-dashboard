// Unit test of the dashboard Content-Security-Policy builder (audit M6).
// Run: node --experimental-strip-types --test src/lib/csp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cspContextFrom,
  cspHeaderName,
  cspHeaders,
  cspOrigin,
  cspOriginList,
  dashboardCspDirectives,
  serializeCsp,
  storefrontFrameSources,
} from './csp.ts';

const prod = cspContextFrom({
  NEXT_PUBLIC_API_URL: 'https://api.shopsdoor.com/api',
  CSP_EXTRA_ORIGINS: 'https://media.example.com,bogus',
  NODE_ENV: 'production',
});

test('cspOrigin: scheme + host + port only, rejects injection', () => {
  assert.equal(cspOrigin('https://API.shopsdoor.com/api'), 'https://api.shopsdoor.com');
  assert.equal(cspOrigin('http://localhost:3001/api'), 'http://localhost:3001');
  assert.equal(cspOrigin("https://a.com; script-src *"), null);
  assert.equal(cspOrigin('a.com'), null);
  assert.deepEqual(cspOriginList('https://a.com, https://a.com/x, nope'), ['https://a.com']);
});

test('context: API origin, extras, report URI, enforce flag', () => {
  assert.deepEqual(prod.apiOrigins, ['https://api.shopsdoor.com']);
  assert.deepEqual(prod.extraOrigins, ['https://media.example.com']);
  assert.equal(prod.reportUri, 'https://api.shopsdoor.com/api/csp-report');
  assert.equal(prod.dev, false);
  assert.equal(cspHeaderName(prod), 'Content-Security-Policy-Report-Only');
  assert.equal(cspHeaderName(cspContextFrom({ CSP_ENFORCE: '1' })), 'Content-Security-Policy');
  assert.equal(cspContextFrom({}).reportUri, null);
  assert.equal(cspContextFrom({ CSP_REPORT_URI: 'https://r.example/x' }).reportUri, 'https://r.example/x');
});

test('storefrontFrameSources: web origin + platform hosts with store subdomains', () => {
  assert.deepEqual(
    storefrontFrameSources('https://shopsdoor.com', ['shopsdoor.com', 'www.shopsdoor.com', 'iwings-digital.com']),
    ['https://shopsdoor.com', 'https://*.shopsdoor.com', 'https://iwings-digital.com', 'https://*.iwings-digital.com'],
  );
  assert.deepEqual(storefrontFrameSources('http://localhost:3003', ['localhost']), ['http://localhost:3003']);
});

test('dashboard policy: strict-ish, API-only connect, not framable', () => {
  const d = dashboardCspDirectives(prod, { frameSources: ['https://shopsdoor.com'] });
  assert.deepEqual(d['script-src'], ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(d['connect-src'], [
    "'self'",
    'https://api.shopsdoor.com',
    'https://media.example.com',
    'data:',
    'blob:',
  ]);
  assert.deepEqual(d['frame-ancestors'], ["'none'"]);
  assert.deepEqual(d['object-src'], ["'none'"]);
  assert.deepEqual(d['frame-src'], ["'self'", 'https://shopsdoor.com']);
  assert.ok(d['worker-src'].includes('blob:'));
  assert.ok(d['img-src'].includes('blob:') && d['img-src'].includes('data:'));
  assert.deepEqual(d['report-to'], ['csp-endpoint']);
});

test('dev adds eval and HMR websockets', () => {
  const d = dashboardCspDirectives(cspContextFrom({ NEXT_PUBLIC_API_URL: 'http://localhost:3001/api' }));
  assert.ok(d['script-src'].includes("'unsafe-eval'"));
  assert.ok(d['connect-src'].includes('ws:'));
});

test('headers: Report-Only + Reporting-Endpoints; serialization dedupes', () => {
  const h = cspHeaders(prod, dashboardCspDirectives(prod));
  assert.equal(h[0].key, 'Content-Security-Policy-Report-Only');
  assert.match(h[0].value, /frame-ancestors 'none'/);
  assert.match(h[0].value, /report-uri https:\/\/api\.shopsdoor\.com\/api\/csp-report/);
  assert.deepEqual(h[1], { key: 'Reporting-Endpoints', value: 'csp-endpoint="https://api.shopsdoor.com/api/csp-report"' });
  assert.equal(serializeCsp({ a: ['x', 'x'], b: [] }), 'a x; b');
});
