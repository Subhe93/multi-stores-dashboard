// Timeline rows the API writes next to the order-status rows (payments,
// stock, production, invoices). Labelled from the shared `orderTimeline`
// namespace on the creator, admin and provider order pages, so a payment row
// ("Payment received") reads in the same translated format as a status row
// ("Pending") instead of showing the raw enum ("PAID").
export const PAYMENT_TIMELINE_STATUSES = [
  'STOCK_SHORTFALL',
  'PAYMENT_STALE_INTENT',
  'REFUND_FAILED',
  'REFUND_REVERTED',
  'PAYMENT_PROCESSING',
  'PAYMENT_DISPUTE',
  'PAID',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'PARTIALLY_REFUNDED',
  'PAYMENT_MISMATCH',
  'CAPTURED',
  'PRODUCTION_COMPLETED',
  'INVOICE_ISSUED',
  'CREDIT_NOTE_ISSUED',
  // Order trash (M69): soft delete, restore and the admin test flag.
  'DELETED',
  'RESTORED',
  'TEST_FLAG',
] as const;

export type PaymentTimelineStatus = (typeof PAYMENT_TIMELINE_STATUSES)[number];

/** Every key of the `orderTimeline` namespace this module reads. */
export type OrderTimelineKey = PaymentTimelineStatus | 'ORDER_PLACED' | 'noteChangedByAdmin';

const STATUS_SET: ReadonlySet<string> = new Set(PAYMENT_TIMELINE_STATUSES);

export function isPaymentTimelineStatus(status: string): status is PaymentTimelineStatus {
  return STATUS_SET.has(status);
}

/**
 * Label of a payment timeline row, or null for any other status (the page
 * then uses its own order-status labels). `t` is scoped to `orderTimeline`.
 */
export function paymentTimelineLabel(t: (key: PaymentTimelineStatus) => string, status: string): string | null {
  return isPaymentTimelineStatus(status) ? t(status) : null;
}

/** "QUALITY_CHECK" -> "Quality check": last resort for a status no page knows. */
export function humanizeStatus(status: string): string {
  const words = (status || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '—';
}

// System notes the API writes in English; known ones are replaced by a
// translated label (or dropped when the label already says it).
const ORDER_CREATED_NOTE = 'Order created';
const ADMIN_STATUS_NOTE = /^Status changed to [A-Z_]+ by admin$/;

export interface TimelineEntryText {
  label: string;
  note: string | null;
}

/**
 * Label + note of one timeline row. `statusLabel` is the page's own
 * order-status translator; it may return the raw status for unknown values,
 * which then falls back to a humanized form so no uppercase enum is shown.
 */
export function timelineEntryText(
  t: (key: OrderTimelineKey) => string,
  status: string,
  note: string | null | undefined,
  statusLabel: (status: string) => string | null | undefined,
): TimelineEntryText {
  const cleanNote = note?.trim() || null;
  // The creation row ("PENDING — Order created") reads as one event.
  if (status === 'PENDING' && cleanNote === ORDER_CREATED_NOTE) {
    return { label: t('ORDER_PLACED'), note: null };
  }
  const own = isPaymentTimelineStatus(status) ? t(status) : null;
  const fromPage = own ?? statusLabel(status);
  const label = fromPage && fromPage !== status ? fromPage : humanizeStatus(status);
  const text = cleanNote && ADMIN_STATUS_NOTE.test(cleanNote) ? t('noteChangedByAdmin') : cleanNote;
  return { label, note: text };
}
