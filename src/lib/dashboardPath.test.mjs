// Unit tests of the same-origin dashboard path check.
// Run: node --experimental-strip-types --test src/lib/dashboardPath.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDashboardPath } from './dashboardPath.ts';

test('accepts same-origin dashboard paths', () => {
  assert.equal(isDashboardPath('/creator/settings?tab=payments#own-stripe-key'), true);
  assert.equal(isDashboardPath('/'), true);
});

test('rejects absolute, protocol-relative and non-string values', () => {
  for (const v of ['https://evil.com', '//evil.com', 'evil.com', 'javascript:alert(1)', '', null, undefined, 42, {}]) {
    assert.equal(isDashboardPath(v), false, String(v));
  }
});

test('rejects backslashes and control characters', () => {
  for (const v of ['/\\evil.com', '/\\/evil.com', '\\\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\r//evil.com', '/a\x00b', '/a\x7fb', '/\x1f']) {
    assert.equal(isDashboardPath(v), false, JSON.stringify(v));
  }
});
