// Order trash (soft delete) helpers shared by the creator and admin order
// pages: the client-side pre-check of the "may be deleted" rule (the API's
// `assertDeletable` is the authority; this only drives a disabled hint), the
// mapping of the API's 409 codes to `orders.trash.*` message keys and the
// summary line of a bulk delete / restore result.

/** Order fields the deletable pre-check reads (all optional on list rows). */
export interface DeletableOrderFields {
  is_test?: boolean | null;
  payment_status?: string | null;
  paid_at?: string | null;
  stripe_charge_id?: string | null;
  kustom_capture_id?: string | null;
  payouts?: unknown[] | null;
  /** Detail payload (CREATOR / ADMIN): related invoice and payout counts. */
  _count?: { invoices?: number | null; payouts?: number | null } | null;
  deleted_at?: string | null;
}

/** Why an order fails the deletable pre-check (mirrors the API's `reason`). */
export type NotDeletableReason = 'paid' | 'invoiced' | 'paid_out';

/** Payment statuses that mean "never paid" (money never moved). */
const UNPAID_STATUSES = new Set(['pending', 'awaiting_payment', 'failed', 'cancelled']);

/**
 * Mirrors the API rule: a test order is always deletable; a real order only
 * while it was never paid and has no money movement. Missing fields count as
 * "no movement" so list rows (which carry fewer columns) still pre-check.
 */
export function isOrderDeletable(order: DeletableOrderFields | null | undefined): boolean {
  return !!order && deletableBlocker(order) === null;
}

/**
 * The reason the order can't be deleted, or null when it can. Invoices and
 * payouts come from `_count` on the detail payload; the `payouts` array is
 * the fallback for payloads without counts.
 */
export function deletableBlocker(order: DeletableOrderFields): NotDeletableReason | null {
  if (order.is_test === true) return null;
  if ((order._count?.invoices ?? 0) > 0) return 'invoiced';
  if ((order._count?.payouts ?? 0) > 0) return 'paid_out';
  if (Array.isArray(order.payouts) && order.payouts.length > 0) return 'paid_out';
  const status = order.payment_status ?? null;
  if (status !== null && status !== '' && !UNPAID_STATUSES.has(status)) return 'paid';
  if (order.paid_at) return 'paid';
  if (order.stripe_charge_id) return 'paid';
  if (order.kustom_capture_id) return 'paid';
  return null;
}

/** `orders.trash.*` keys of the friendly messages for the API's 409 codes. */
export type TrashErrorKey =
  | 'errNotDeletablePaid'
  | 'errNotDeletableInvoiced'
  | 'errNotDeletablePaidOut'
  | 'errAlreadyDeleted'
  | 'errNotDeleted'
  | 'errOrderDeleted';

/** `orders.testFlag.*` keys of the friendly messages for the test-flag 409 codes. */
export type TestFlagErrorKey = 'errOrderDeleted' | 'errOrderInvoiced';

interface CodedError {
  code?: string;
  payload?: { reason?: unknown } | null;
}

/** Reason of an ORDER_NOT_DELETABLE error (`paid` | `invoiced` | `paid_out`), when present. */
export function notDeletableReason(err: unknown): string | null {
  const e = err as CodedError | null | undefined;
  const reason = e?.payload?.reason;
  return typeof reason === 'string' ? reason : null;
}

/** Message key for a delete / restore error, or null when the code is not a trash code. */
export function trashErrorKey(err: unknown): TrashErrorKey | null {
  const e = err as CodedError | null | undefined;
  switch (e?.code) {
    case 'ORDER_NOT_DELETABLE':
      return reasonKey(notDeletableReason(err));
    case 'ORDER_ALREADY_DELETED':
      return 'errAlreadyDeleted';
    case 'ORDER_NOT_DELETED':
      return 'errNotDeleted';
    case 'ORDER_DELETED':
      return 'errOrderDeleted';
    default:
      return null;
  }
}

function reasonKey(reason: string | null): TrashErrorKey {
  switch (reason) {
    case 'invoiced':
      return 'errNotDeletableInvoiced';
    case 'paid_out':
      return 'errNotDeletablePaidOut';
    default:
      return 'errNotDeletablePaid';
  }
}

/** Message key for a test-flag error, or null when the code is not one of its codes. */
export function testFlagErrorKey(err: unknown): TestFlagErrorKey | null {
  const e = err as CodedError | null | undefined;
  switch (e?.code) {
    case 'ORDER_DELETED':
      return 'errOrderDeleted';
    case 'ORDER_INVOICED':
      return 'errOrderInvoiced';
    default:
      return null;
  }
}

/** One skipped id of a bulk delete / restore response. */
export interface BulkTrashSkipped {
  id: string;
  code: string;
  reason?: string | null;
}

/** POST /orders/bulk/delete response. */
export interface BulkDeleteResult {
  deleted: string[];
  skipped: BulkTrashSkipped[];
}

/** POST /orders/bulk/restore response. */
export interface BulkRestoreResult {
  restored: string[];
  skipped: BulkTrashSkipped[];
}

/** Largest id batch the bulk endpoints accept. */
export const BULK_TRASH_CHUNK = 100;

/** Splits ids into batches the bulk endpoints accept. */
export function chunkIds(ids: string[], size = BULK_TRASH_CHUNK): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

/**
 * Distinct skip reasons of a bulk run in a stable order ("paid / invoiced"),
 * for the result notice. Skips without a reason fall back to their code.
 */
export function skippedReasons(skipped: BulkTrashSkipped[]): string[] {
  const order = ['paid', 'invoiced', 'paid_out'];
  const seen = new Set<string>();
  for (const s of skipped) seen.add(s.reason || s.code);
  return [...seen].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib) || a.localeCompare(b);
  });
}
