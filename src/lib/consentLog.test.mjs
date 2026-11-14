// Unit test of the consent log card logic (consent v2, CONTRACT §6) and the
// category overview of the tracking card (§2.2).
// Run: node --experimental-strip-types --test src/lib/consentLog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consentLogActionKey,
  consentLogExportPath,
  consentLogListPath,
  consentLogShares,
  consentLogSummaryPath,
  consentSetup,
  defaultExportRange,
  exportConsentLog,
  exportRangeError,
  loadConsentLogPage,
  marketingVendorLabels,
  mergeConsentLogPage,
  normalizeConsentId,
  shortConsentId,
} from './consentLog.ts';

const row = (id, extra = {}) => ({
  id,
  created_at: '2026-11-10T10:00:00.000Z',
  consent_id: '3f2a9c1e-1111-4222-8333-444455556666',
  action: 'accept_all',
  source: 'banner',
  analytics: true,
  marketing: true,
  external_media: true,
  consent_version: '1',
  vendors: ['ga4', 'meta'],
  locale: 'sv',
  text_hash: 'a'.repeat(64),
  ...extra,
});

function params(path) {
  return new URL(path, 'http://x').searchParams;
}

test('summary: shares of the banner/dialog decisions, total as reported', () => {
  const s = consentLogShares({
    days: 30,
    total: 210,
    accept_all: 120,
    reject_all: 60,
    save: 20,
    analytics_granted: 130,
    marketing_granted: 125,
    external_media_granted: 140,
  });
  assert.deepEqual(s, { total: 210, acceptPct: 60, rejectPct: 30, customPct: 10 });
  assert.deepEqual(consentLogShares(null), { total: 0, acceptPct: 0, rejectPct: 0, customPct: 0 });
  assert.deepEqual(consentLogShares({ days: 30, total: 3, accept_all: 0, reject_all: 0, save: 0 }), {
    total: 3,
    acceptPct: 0,
    rejectPct: 0,
    customPct: 0,
  });
  const p = params(consentLogSummaryPath());
  assert.equal(p.get('days'), '30');
  assert.ok(consentLogSummaryPath().startsWith('/stores/my/consent-log/summary?'));
});

test('paging: the first load replaces, "Load more" sends next_before and appends', async () => {
  const calls = [];
  const pages = [
    { items: [row('a'), row('b')], next_before: '2026-11-09T08:00:00.000Z' },
    { items: [row('b'), row('c')], next_before: null },
  ];
  const get = async (path) => {
    calls.push(path);
    return pages[calls.length - 1];
  };
  const first = await loadConsentLogPage(get, [row('old')], {});
  assert.deepEqual(first.items.map((r) => r.id), ['a', 'b']);
  assert.equal(first.nextBefore, '2026-11-09T08:00:00.000Z');
  assert.equal(params(calls[0]).get('before'), null);
  assert.equal(params(calls[0]).get('limit'), '50');

  const more = await loadConsentLogPage(get, first.items, { before: first.nextBefore });
  assert.equal(params(calls[1]).get('before'), '2026-11-09T08:00:00.000Z');
  // Duplicate on the cursor edge is dropped.
  assert.deepEqual(more.items.map((r) => r.id), ['a', 'b', 'c']);
  assert.equal(more.nextBefore, null);
});

test('mergeConsentLogPage tolerates a missing cursor', () => {
  const out = mergeConsentLogPage([], { items: [row('x')] }, false);
  assert.equal(out.nextBefore, null);
  assert.equal(out.items.length, 1);
});

test('search: a full consent id is sent as consent_id, partial input is rejected', async () => {
  assert.equal(normalizeConsentId(' 3F2A9C1E-1111-4222-8333-444455556666 '), '3f2a9c1e-1111-4222-8333-444455556666');
  assert.equal(normalizeConsentId('3f2a9c1e'), null);
  assert.equal(normalizeConsentId(''), null);
  let seen = '';
  await loadConsentLogPage(
    async (path) => {
      seen = path;
      return { items: [], next_before: null };
    },
    [],
    { consentId: '3f2a9c1e-1111-4222-8333-444455556666' },
  );
  assert.equal(params(seen).get('consent_id'), '3f2a9c1e-1111-4222-8333-444455556666');
  assert.equal(params(consentLogListPath()).get('consent_id'), null);
});

test('export: calls the export URL with from/to, refuses an invalid range', async () => {
  const calls = [];
  const download = async (path, name) => {
    calls.push({ path, name });
  };
  assert.equal(await exportConsentLog(download, '2026-08-16', '2026-11-14'), null);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].path.startsWith('/stores/my/consent-log/export?'));
  assert.equal(params(calls[0].path).get('from'), '2026-08-16');
  assert.equal(params(calls[0].path).get('to'), '2026-11-14');
  assert.equal(calls[0].name, 'consent-log-2026-08-16-2026-11-14.csv');

  assert.equal(await exportConsentLog(download, '2026-11-14', '2026-08-16'), 'order');
  assert.equal(await exportConsentLog(download, '', '2026-08-16'), 'required');
  assert.equal(await exportConsentLog(download, '2025-01-01', '2026-11-14'), 'tooLong');
  assert.equal(calls.length, 1);
  assert.equal(consentLogExportPath('a', 'b'), '/stores/my/consent-log/export?from=a&to=b');
});

test('export range: default is the last 90 days, max 366 days apart', () => {
  assert.deepEqual(defaultExportRange(new Date('2026-11-14T12:00:00Z')), { from: '2026-08-16', to: '2026-11-14' });
  assert.equal(exportRangeError('2025-11-13', '2026-11-14'), null);
  assert.equal(exportRangeError('2025-11-12', '2026-11-14'), 'tooLong');
});

test('action keys and short id', () => {
  assert.equal(consentLogActionKey('accept_all'), 'acceptAll');
  assert.equal(consentLogActionKey('reject_all'), 'rejectAll');
  assert.equal(consentLogActionKey('save'), 'custom');
  assert.equal(consentLogActionKey('external_media_grant'), 'externalGranted');
  assert.equal(consentLogActionKey('external_media_revoke'), 'externalRevoked');
  assert.equal(consentLogActionKey('migrated'), 'migrated');
  assert.equal(consentLogActionKey('whatever'), 'other');
  assert.equal(shortConsentId('3f2a9c1e-1111-4222-8333-444455556666'), '3f2a9c1e');
});

test('category overview mirrors the storefront vendor mapping', () => {
  const all = { ga4_measurement_id: 'G-X', meta_pixel_id: '123', tiktok_pixel_id: 'C1', clarity_project_id: 'abcdefgh' };
  assert.deepEqual(consentSetup({ ...all, consent_required: true }), {
    analytics: ['ga4', 'clarity'],
    marketing: ['meta', 'tiktok'],
    ungated: [],
    banner: true,
  });
  // Consent off: GA4/Meta/TikTok load for everyone, Clarity stays gated.
  assert.deepEqual(consentSetup({ ...all, consent_required: false }), {
    analytics: ['clarity'],
    marketing: [],
    ungated: ['ga4', 'meta', 'tiktok'],
    banner: true,
  });
  assert.deepEqual(consentSetup({ ga4_measurement_id: 'G-X', consent_required: false }), {
    analytics: [],
    marketing: [],
    ungated: ['ga4'],
    banner: false,
  });
  assert.deepEqual(consentSetup({ ga4_measurement_id: '  ', meta_pixel_id: null }), {
    analytics: [],
    marketing: [],
    ungated: [],
    banner: false,
  });
});

test('Marketing names Google (ad signals) only when GA4 is gated and marketing is offered', () => {
  const all = { ga4_measurement_id: 'G-X', meta_pixel_id: '123', clarity_project_id: 'abcdefgh' };
  assert.deepEqual(marketingVendorLabels(consentSetup({ ...all, consent_required: true })), ['Meta Pixel', 'Google Ads']);
  assert.deepEqual(marketingVendorLabels(consentSetup({ meta_pixel_id: '123' })), ['Meta Pixel']);
  assert.deepEqual(marketingVendorLabels(consentSetup({ ga4_measurement_id: 'G-X' })), []);
  assert.deepEqual(marketingVendorLabels(consentSetup({ ...all, consent_required: false })), []);
});
