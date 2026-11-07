// Typed client for the admin store queue (SPEC §3: GET /admin/stores,
// PUT /admin/stores/:id/status).

import { api } from '@/lib/api';
import { qs, type Paged } from '@/lib/http';
import type { GoLiveChecklist, StoreStatus } from '@/lib/storeStatus';
import type { OwnKeyState } from '@/lib/ownStripeKey';

export interface AdminStoreRow {
  id: string;
  slug: string;
  name: string;
  store_type: 'MARKETPLACE' | 'INDEPENDENT';
  status: StoreStatus;
  status_reason: string | null;
  created_at: string;
  golive_requested_at: string | null;
  went_live_at: string | null;
  owner: {
    creator_id: string;
    user_id: string;
    email: string;
    display_name: string;
    email_verified: boolean;
  };
  checklist: GoLiveChecklist;
  /** Own Stripe key summary (INDEPENDENT stores); null when no key is stored. Never secrets. */
  stripe_own_key?: AdminStoreOwnKey | null;
}

export interface AdminStoreOwnKey {
  status: OwnKeyState;
  livemode: boolean;
  last_check_at: string | null;
}

export type AdminSettableStatus = 'LIVE' | 'CHANGES_REQUESTED' | 'SUSPENDED' | 'PAUSED';

export function listAdminStores(
  token: string,
  params: { status?: string; q?: string; page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<Paged<AdminStoreRow>> {
  return api<Paged<AdminStoreRow>>(`/admin/stores${qs(params)}`, { token, signal });
}

/** Number of stores waiting for review (sidebar badge, home card). */
export async function countPendingReviewStores(token: string, signal?: AbortSignal): Promise<number> {
  const res = await listAdminStores(token, { status: 'PENDING_REVIEW', limit: 1 }, signal);
  return res.total;
}

export function setAdminStoreStatus(
  token: string,
  id: string,
  status: AdminSettableStatus,
  reason?: string,
): Promise<{ id: string; status: StoreStatus }> {
  return api(`/admin/stores/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    token,
    body: JSON.stringify(reason ? { status, reason } : { status }),
  });
}
