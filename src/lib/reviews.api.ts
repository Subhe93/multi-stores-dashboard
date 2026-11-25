// API calls of the Reviews page and the order "Review links" card (M171).
// Every route is `/stores/my/reviews/...`: the store always comes from the
// creator's session, never from a parameter.
//
// Moderation only. There is deliberately no call that creates a review or
// edits its rating, title, text or display name (pinned by reviews.test.mjs).

import { api } from '@/lib/api';
import {
  normalizeOwnerReview,
  normalizePendingCount,
  normalizeReviewLinks,
  normalizeReviewsPage,
  type OwnerReview,
  type ReviewLink,
  type ReviewsPage,
} from '@/lib/reviews';

const BASE = '/stores/my/reviews';
const id = (value: string) => encodeURIComponent(value);

/** A moderation answer that is not a review row is treated as a failed request. */
function ownerReview(raw: unknown): OwnerReview {
  const review = normalizeOwnerReview(raw);
  if (!review) throw new Error('Unexpected response');
  return review;
}

/** `query` comes from `reviewListQuery` (leading `?` included). */
export async function listReviews(token: string, query: string): Promise<ReviewsPage> {
  return normalizeReviewsPage(await api<unknown>(`${BASE}${query}`, { token }));
}

export async function getPendingReviewCount(token: string): Promise<number> {
  return normalizePendingCount(await api<unknown>(`${BASE}/pending-count`, { token }));
}

/**
 * `seen` is the `updated_at` of the row the owner is looking at. The API
 * refuses the decision (409 REVIEW_CHANGED) when the customer changed the
 * review since, so a text the owner did not read is never approved.
 */
export async function setReviewStatus(
  token: string,
  reviewId: string,
  status: 'APPROVED' | 'REJECTED',
  seen: string,
): Promise<OwnerReview> {
  return ownerReview(
    await api<unknown>(`${BASE}/${id(reviewId)}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status, expected_updated_at: seen }),
    }),
  );
}

/** `seen`: see setReviewStatus (a reply is never attached to a text it did not answer). */
export async function saveReviewReply(token: string, reviewId: string, body: string, seen: string): Promise<OwnerReview> {
  return ownerReview(
    await api<unknown>(`${BASE}/${id(reviewId)}/reply`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ body, expected_updated_at: seen }),
    }),
  );
}

export async function removeReviewReply(token: string, reviewId: string): Promise<OwnerReview> {
  return ownerReview(await api<unknown>(`${BASE}/${id(reviewId)}/reply`, { method: 'DELETE', token }));
}

export async function deleteReview(token: string, reviewId: string): Promise<void> {
  await api<unknown>(`${BASE}/${id(reviewId)}`, { method: 'DELETE', token });
}

/**
 * Buyer review links of one order (one per distinct product). The links are
 * write credentials of the buyer: keep them in memory only, never log them.
 */
export async function createReviewLinks(token: string, orderId: string): Promise<ReviewLink[]> {
  return normalizeReviewLinks(
    await api<unknown>(`${BASE}/links`, { method: 'POST', token, body: JSON.stringify({ order_id: orderId }) }),
  );
}
