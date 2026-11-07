// Payment / stock rows the API writes to an order's timeline (own Stripe
// key flow). Labelled from the shared `orderTimeline` namespace on the
// creator, admin and provider order pages.
export const PAYMENT_TIMELINE_STATUSES = [
  'STOCK_SHORTFALL',
  'PAYMENT_STALE_INTENT',
  'REFUND_FAILED',
  'REFUND_REVERTED',
  'PAYMENT_PROCESSING',
  'PAYMENT_DISPUTE',
] as const;

export type PaymentTimelineStatus = (typeof PAYMENT_TIMELINE_STATUSES)[number];

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
