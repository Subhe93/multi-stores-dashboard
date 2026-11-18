// Badge of one payout row (OrderPayout.status, a free string in the API).
//   'paid'     - the transfer was sent
//   'reversed' - the transfer was sent and later taken back in full, after a
//                refund of the order
//   anything else reads as a failed transfer, as it always did.
// Pure (no imports) so the node test runner can load it.

export type PayoutBadgeKind = 'paid' | 'reversed' | 'failed';

export function payoutBadgeKind(status: string | null | undefined): PayoutBadgeKind {
  if (status === 'paid') return 'paid';
  if (status === 'reversed') return 'reversed';
  return 'failed';
}

/** Badge colours per kind; `paid` and `failed` are the ones used before. */
export const PAYOUT_BADGE_CLASS: Record<PayoutBadgeKind, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reversed: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

/** Key of the `payments` namespace for each kind. */
export const PAYOUT_BADGE_LABEL_KEY = {
  paid: 'statusPaid',
  reversed: 'statusReversed',
  failed: 'statusFailed',
} as const satisfies Record<PayoutBadgeKind, string>;
