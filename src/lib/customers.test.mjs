// Unit test of the Customers page helpers (URL state, API query, response shaping).
// Run: node --experimental-strip-types --test src/lib/customers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkDoneCount,
  bulkFailedCount,
  customerListQuery,
  customerName,
  isBlockedStatus,
  isBannedStatus,
  ownerCanChangeStatus,
  bulkSkipReasons,
  isCustomerListFiltered,
  isValidEmail,
  normalizeCustomerDetail,
  parseCustomerListState,
  patchListParams,
  relativeTimeParts,
  serializeCustomerListState,
} from './customers.ts';

const parse = (qs) => parseCustomerListState(new URLSearchParams(qs));

test('parseCustomerListState: defaults for an empty URL', () => {
  assert.deepEqual(parse(''), {
    q: '',
    hasOrders: '',
    type: '',
    from: '',
    to: '',
    sort: '',
    dir: 'desc',
    page: 1,
    store: '',
  });
});

test('parseCustomerListState: reads valid values', () => {
  const s = parse('q=%20anna%20&has_orders=yes&type=company&from=2026-01-01&to=2026-10-31&sort=total_spent&dir=asc&page=3&store=abc-123');
  assert.equal(s.q, 'anna');
  assert.equal(s.hasOrders, 'yes');
  assert.equal(s.type, 'company');
  assert.equal(s.from, '2026-01-01');
  assert.equal(s.to, '2026-10-31');
  assert.equal(s.sort, 'total_spent');
  assert.equal(s.dir, 'asc');
  assert.equal(s.page, 3);
  assert.equal(s.store, 'abc-123');
});

test('parseCustomerListState: drops unknown or malformed values', () => {
  const s = parse('has_orders=maybe&type=robot&from=01/02/2026&to=2026-13-45x&sort=password_hash&dir=asc&page=-4&store=a%20b');
  assert.equal(s.hasOrders, '');
  assert.equal(s.type, '');
  assert.equal(s.from, '');
  assert.equal(s.to, '');
  assert.equal(s.sort, '');
  // No sort key: the direction falls back to the default.
  assert.equal(s.dir, 'desc');
  assert.equal(s.page, 1);
  assert.equal(s.store, '');
  assert.equal(parse('page=abc').page, 1);
});

test('serializeCustomerListState round-trips through parse', () => {
  const qs = 'q=bob&has_orders=no&type=person&from=2026-02-01&to=2026-03-01&store=s1&sort=name&dir=asc&page=2';
  const state = parse(qs);
  assert.equal(serializeCustomerListState(state), qs);
  assert.deepEqual(parse(serializeCustomerListState(state)), state);
});

test('serializeCustomerListState leaves defaults out', () => {
  assert.equal(serializeCustomerListState(parse('')), '');
  // desc is the default direction, page 1 the default page.
  assert.equal(serializeCustomerListState({ ...parse(''), sort: 'created_at', dir: 'desc', page: 1 }), 'sort=created_at');
});

test('patchListParams: filter changes reset the page, page changes keep filters', () => {
  assert.equal(patchListParams('q=a&page=4', { has_orders: 'yes' }), 'q=a&has_orders=yes');
  assert.equal(patchListParams('q=a&page=4', { page: '5' }), 'q=a&page=5');
  assert.equal(patchListParams('q=a&type=company', { type: '' }), 'q=a');
  assert.equal(patchListParams('', { q: 'x y' }), 'q=x+y');
});

test('isCustomerListFiltered ignores sort and page', () => {
  assert.equal(isCustomerListFiltered(parse('sort=name&page=2')), false);
  assert.equal(isCustomerListFiltered(parse('q=x')), true);
  assert.equal(isCustomerListFiltered(parse('from=2026-01-01')), true);
  assert.equal(isCustomerListFiltered(parse('store=s1')), true);
});

test('customerListQuery maps the URL state to the API filters', () => {
  const state = parse('q=anna&has_orders=yes&type=company&from=2026-01-01&to=2026-02-01&sort=orders_count&page=2&store=s1');
  const q = new URLSearchParams(customerListQuery(state).slice(1));
  assert.equal(q.get('page'), '2');
  assert.equal(q.get('limit'), '20');
  assert.equal(q.get('search'), 'anna');
  assert.equal(q.get('has_orders'), 'true');
  assert.equal(q.get('customer_type'), 'COMPANY');
  assert.equal(q.get('from'), '2026-01-01');
  assert.equal(q.get('to'), '2026-02-01');
  assert.equal(q.get('sort'), 'orders_count');
  assert.equal(q.get('dir'), 'desc');
  // The store filter is admin-only.
  assert.equal(q.get('store_id'), null);
  const admin = new URLSearchParams(customerListQuery(state, { withStore: true }).slice(1));
  assert.equal(admin.get('store_id'), 's1');
});

test('customerListQuery: no-orders, person, export (unpaged) and empty state', () => {
  const q = new URLSearchParams(customerListQuery(parse('has_orders=no&type=person'), { paged: false }).slice(1));
  assert.equal(q.get('has_orders'), 'false');
  assert.equal(q.get('customer_type'), 'PERSON');
  assert.equal(q.get('page'), null);
  assert.equal(q.get('limit'), null);
  assert.equal(customerListQuery(parse(''), { paged: false }), '');
  assert.equal(customerListQuery(parse(''), { limit: 50 }), '?page=1&limit=50');
});

test('customerName and isBlockedStatus', () => {
  assert.equal(customerName({ first_name: 'Anna', last_name: 'Berg', email: 'a@x.se' }), 'Anna Berg');
  assert.equal(customerName({ first_name: '', last_name: null, email: 'a@x.se' }), 'a@x.se');
  assert.equal(isBlockedStatus('SUSPENDED'), true);
  assert.equal(isBlockedStatus('BANNED'), true);
  assert.equal(isBlockedStatus('ACTIVE'), false);
  assert.equal(isBlockedStatus(undefined), false);
});

test('relativeTimeParts picks the largest whole unit', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  assert.deepEqual(relativeTimeParts('2026-10-29T12:00:00Z', now), { value: -3, unit: 'day' });
  assert.deepEqual(relativeTimeParts('2026-11-01T09:00:00Z', now), { value: -3, unit: 'hour' });
  assert.deepEqual(relativeTimeParts('2026-11-01T11:59:30Z', now), { value: 0, unit: 'minute' });
  assert.deepEqual(relativeTimeParts('2025-10-01T12:00:00Z', now), { value: -1, unit: 'year' });
  assert.equal(relativeTimeParts(null, now), null);
  assert.equal(relativeTimeParts('not a date', now), null);
});

test('bulkDoneCount / bulkFailedCount read common response shapes', () => {
  assert.equal(bulkDoneCount({ updated: 3 }, 9), 3);
  assert.equal(bulkDoneCount({ ok: ['a', 'b'] }, 9), 2);
  assert.equal(bulkDoneCount({ count: 0 }, 9), 0);
  assert.equal(bulkDoneCount(null, 4), 4);
  assert.equal(bulkDoneCount({ other: 1 }, 4), 4);
  assert.equal(bulkFailedCount({ failed: [{ id: 'x' }] }), 1);
  assert.equal(bulkFailedCount({ failed: 2 }), 2);
  assert.equal(bulkFailedCount(undefined), 0);
  // Shape of POST /stores/my/customers/bulk.
  const api = { action: 'block', requested: 3, succeeded: ['a', 'b'], skipped: [{ id: 'c', reason: 'not_found' }] };
  assert.equal(bulkDoneCount(api, 3), 2);
  assert.equal(bulkFailedCount(api), 1);
});

test('normalizeCustomerDetail: nested stats, recent_orders and derived average', () => {
  const d = normalizeCustomerDetail({
    id: 'c1',
    user_id: 'u1',
    first_name: 'Anna',
    last_name: 'Berg',
    email: 'a@x.se',
    status: 'SUSPENDED',
    customer_type: 'COMPANY',
    company_name: 'AB',
    stats: { orders_count: 4, total_spent: '200.00', last_order_at: '2026-10-01T00:00:00Z', currency: 'SEK' },
    recent_orders: [{ id: 'o1', order_number: 'N-1', status: 'DELIVERED', total: 50, currency: 'SEK', created_at: '2026-10-01' }],
    tax_exemption: { id: 'e1', kind: 'FULL', vat_number: null, created_at: '2026-09-01', revoked_at: null },
  });
  assert.equal(d.stats.orders_count, 4);
  assert.equal(d.stats.total_spent, 200);
  assert.equal(d.stats.average_order, 50);
  // all_orders_count is absent: never below the counted orders.
  assert.equal(d.stats.all_orders_count, 4);
  assert.equal(d.stats.currency, 'SEK');
  assert.equal(d.orders.length, 1);
  assert.equal(d.customer_type, 'COMPANY');
  assert.equal(d.tax_exemption?.id, 'e1');
  assert.deepEqual(d.addresses, []);
});

test('normalizeCustomerDetail: flat stats, user fields and a revoked exemption', () => {
  const d = normalizeCustomerDetail({
    id: 'c2',
    first_name: 'Bo',
    last_name: '',
    user: { id: 'u2', email: 'bo@x.se', status: 'ACTIVE', created_at: '2026-01-01' },
    orders_count: 0,
    total_spent: 0,
    average_order: null,
    customer_type: 'ROBOT',
    tax_exemption: { id: 'e2', kind: 'FULL', vat_number: null, created_at: '2026-09-01', revoked_at: '2026-10-01' },
  });
  assert.equal(d.user_id, 'u2');
  assert.equal(d.email, 'bo@x.se');
  assert.equal(d.status, 'ACTIVE');
  assert.equal(d.created_at, '2026-01-01');
  assert.equal(d.stats.average_order, 0);
  assert.equal(d.customer_type, null);
  assert.equal(d.tax_exemption, null);
  assert.equal(normalizeCustomerDetail(null).id, '');
});

test('isValidEmail', () => {
  assert.equal(isValidEmail(' anna@example.se '), true);
  assert.equal(isValidEmail('anna@example'), false);
  assert.equal(isValidEmail('anna example.se'), false);
  assert.equal(isValidEmail(''), false);
});

test('BANNED belongs to the admin: the owner cannot change it', () => {
  assert.equal(isBannedStatus('BANNED'), true);
  assert.equal(isBannedStatus('SUSPENDED'), false);
  assert.equal(ownerCanChangeStatus('BANNED'), false);
  assert.equal(ownerCanChangeStatus('SUSPENDED'), true);
  assert.equal(ownerCanChangeStatus('ACTIVE'), true);
});

test('bulkSkipReasons groups skipped rows by reason', () => {
  assert.deepEqual(
    bulkSkipReasons({
      succeeded: ['a'],
      skipped: [
        { id: 'b', reason: 'daily_limit' },
        { id: 'c', reason: 'daily_limit' },
        { id: 'd', reason: 'banned' },
        { id: 'e' },
      ],
    }),
    { daily_limit: 2, banned: 1, other: 1 },
  );
  assert.deepEqual(bulkSkipReasons(null), {});
  assert.deepEqual(bulkSkipReasons({ skipped: 3 }), {});
});
