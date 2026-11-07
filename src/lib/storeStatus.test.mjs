// Unit tests of the store lifecycle helpers (setup checklist, survey, grace period).
// Run: node --experimental-strip-types --test src/lib/storeStatus.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockingHref,
  blockingToStep,
  canRequestGoLive,
  canToggleActive,
  computeSetupChecklist,
  countryFromLocale,
  isReservedStoreSlug,
  isUnverifiedCode,
  needsEmailVerification,
  parseSurvey,
  setupStepHref,
  setupStepOrder,
  storeStatusTone,
  suggestedStoreType,
  verificationDaysLeft,
} from './storeStatus.ts';

const fullChecklist = {
  email_verified: true,
  trader_details_complete: true,
  has_published_product: true,
  has_published_theme: true,
  payments_ready: true,
  legal_pages_published: true,
  ready: true,
  blocking: [],
};

test('computeSetupChecklist: a fresh draft store has only "create store" done', () => {
  const steps = computeSetupChecklist({ status: 'DRAFT', checklist: null, setup: null });
  assert.equal(steps.length, 9);
  assert.deepEqual(
    steps.map((s) => s.key),
    ['verify_email', 'create_store', 'first_product', 'theme', 'shipping', 'payments', 'trader_details', 'preview', 'request_golive'],
  );
  assert.deepEqual(steps.filter((s) => s.done).map((s) => s.key), ['create_store']);
  // The API's blocking items and go-live are required; the rest advisory.
  assert.deepEqual(
    steps.filter((s) => s.required).map((s) => s.key),
    ['verify_email', 'create_store', 'first_product', 'trader_details', 'request_golive'],
  );
});

test('computeSetupChecklist: reads the API checklist and the overview setup', () => {
  const steps = computeSetupChecklist({
    status: 'DRAFT',
    checklist: { ...fullChecklist, payments_ready: false },
    setup: { has_shipping: true, has_payment: true },
    previewed: true,
  });
  const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
  assert.equal(done.verify_email, true);
  assert.equal(done.first_product, true);
  assert.equal(done.theme, true);
  assert.equal(done.shipping, true);
  // Either signal marks payments done.
  assert.equal(done.payments, true);
  assert.equal(done.trader_details, true);
  assert.equal(done.preview, true);
  assert.equal(done.request_golive, false);
});

test('computeSetupChecklist: go-live and preview count as done once requested or live', () => {
  for (const status of ['PENDING_REVIEW', 'LIVE', 'PAUSED']) {
    const steps = computeSetupChecklist({ status, checklist: fullChecklist, setup: { has_shipping: true } });
    assert.ok(steps.every((s) => s.done), status);
  }
  const changes = computeSetupChecklist({ status: 'CHANGES_REQUESTED', checklist: fullChecklist });
  assert.equal(changes.find((s) => s.key === 'request_golive').done, false);
});

test('computeSetupChecklist: INDEPENDENT stores get a required legal pages step', () => {
  const steps = computeSetupChecklist({ status: 'DRAFT', checklist: { ...fullChecklist, legal_pages_published: false }, independent: true });
  assert.equal(steps.length, 10);
  const legal = steps.find((s) => s.key === 'legal_pages');
  assert.deepEqual(legal, { key: 'legal_pages', done: false, required: true });
  // Right after the trader details in the default order.
  assert.equal(steps[steps.findIndex((s) => s.key === 'trader_details') + 1].key, 'legal_pages');
  const published = computeSetupChecklist({ status: 'DRAFT', checklist: fullChecklist, independent: true });
  assert.equal(published.find((s) => s.key === 'legal_pages').done, true);
  // MARKETPLACE stores use the platform texts: no step at all.
  const marketplace = computeSetupChecklist({ status: 'DRAFT', checklist: fullChecklist, independent: false });
  assert.equal(marketplace.some((s) => s.key === 'legal_pages'), false);
  assert.equal(setupStepHref('legal_pages', true), '/creator/legal');
});

test('setupStepOrder: established sellers get legal details and shipping earlier', () => {
  assert.equal(setupStepOrder({ stage: 'physical_shop' })[3], 'trader_details');
  assert.equal(setupStepOrder({ stage: 'selling_online' })[4], 'legal_pages');
  assert.equal(setupStepOrder({ stage: 'selling_online' })[5], 'shipping');
  assert.equal(setupStepOrder({ stage: 'starting' })[3], 'theme');
  assert.equal(setupStepOrder(null)[3], 'theme');
  // Same steps in every order.
  assert.deepEqual([...setupStepOrder({ stage: 'agency' })].sort(), [...setupStepOrder({ stage: 'physical_shop' })].sort());
});

test('parseSurvey: keeps known values only, upper-cases the country', () => {
  assert.deepEqual(parseSurvey({ stage: 'agency', sells: 'both', country: 'se' }), { stage: 'agency', sells: 'both', country: 'SE' });
  assert.deepEqual(parseSurvey({ stage: 'nope', sells: 42, country: 'Sweden' }), {});
  assert.deepEqual(parseSurvey(null), {});
  assert.deepEqual(parseSurvey('x'), {});
});

test('suggestedStoreType: sign-up card wins, then the survey, else independent', () => {
  assert.equal(suggestedStoreType('marketplace', { sells: 'own' }), 'MARKETPLACE');
  assert.equal(suggestedStoreType('independent', { sells: 'both' }), 'INDEPENDENT');
  assert.equal(suggestedStoreType(null, { sells: 'suppliers' }), 'MARKETPLACE');
  assert.equal(suggestedStoreType(undefined, { sells: 'own' }), 'INDEPENDENT');
  assert.equal(suggestedStoreType(undefined, null), 'INDEPENDENT');
});

test('countryFromLocale: region of the browser locale, Sweden by default', () => {
  assert.equal(countryFromLocale('sv-SE'), 'SE');
  assert.equal(countryFromLocale('en_GB'), 'GB');
  assert.equal(countryFromLocale('ar'), 'SE');
  assert.equal(countryFromLocale(undefined), 'SE');
});

test('verificationDaysLeft: whole days, never negative, null without a deadline', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  assert.equal(verificationDaysLeft('2026-11-09T10:00:00Z', now), 7);
  assert.equal(verificationDaysLeft('2026-11-02T11:00:00Z', now), 1);
  assert.equal(verificationDaysLeft('2026-11-01T10:00:00Z', now), 0);
  assert.equal(verificationDaysLeft(null, now), null);
  assert.equal(verificationDaysLeft('garbage', now), null);
});

test('needsEmailVerification: staff with a deadline and no verified_at only', () => {
  assert.equal(needsEmailVerification({ role: 'CREATOR', email_verified_at: null, verification_deadline: '2026-11-09T00:00:00Z' }), true);
  assert.equal(needsEmailVerification({ role: 'PROVIDER', email_verified_at: null, verification_deadline: '2026-11-09T00:00:00Z' }), true);
  assert.equal(needsEmailVerification({ role: 'CREATOR', email_verified_at: '2026-10-01T00:00:00Z', verification_deadline: null }), false);
  // Legacy accounts (no deadline) are treated as verified.
  assert.equal(needsEmailVerification({ role: 'CREATOR', email_verified_at: null, verification_deadline: null }), false);
  assert.equal(needsEmailVerification({ role: 'ADMIN', email_verified_at: null, verification_deadline: '2026-11-09T00:00:00Z' }), false);
  assert.equal(needsEmailVerification(null), false);
});

test('status helpers', () => {
  assert.equal(storeStatusTone('LIVE'), 'success');
  assert.equal(storeStatusTone('PENDING_REVIEW'), 'info');
  assert.equal(storeStatusTone('CHANGES_REQUESTED'), 'warning');
  assert.equal(storeStatusTone('SUSPENDED'), 'danger');
  assert.equal(storeStatusTone('DRAFT'), 'neutral');
  assert.equal(canToggleActive('LIVE'), true);
  assert.equal(canToggleActive('PAUSED'), true);
  assert.equal(canToggleActive('DRAFT'), false);
  assert.equal(canRequestGoLive('DRAFT'), true);
  assert.equal(canRequestGoLive('CHANGES_REQUESTED'), true);
  assert.equal(canRequestGoLive('PENDING_REVIEW'), false);
  assert.equal(blockingToStep('trader_details_complete'), 'trader_details');
  assert.equal(blockingToStep('unknown'), null);
  assert.equal(blockingHref('legal_pages_published', true), '/creator/legal');
  assert.equal(blockingHref('legal_pages_published', false), null);
  assert.equal(blockingHref('payments_ready', true), '/creator/settings?tab=payments#own-stripe-key');
  assert.equal(blockingHref('payments_ready', false), '/creator/settings?tab=payments');
  assert.equal(isUnverifiedCode('ACCOUNT_EMAIL_UNVERIFIED_EXPIRED'), true);
  assert.equal(isUnverifiedCode('STORE_NOT_LIVE'), false);
  assert.equal(isReservedStoreSlug('Admin'), true);
  assert.equal(isReservedStoreSlug('my-shop'), false);
});
