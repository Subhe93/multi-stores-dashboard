// API calls of the Customers pages. Creators manage their own store's
// customers under `/stores/my/customers`; the admin reads every store's
// customers under `/admin/customers` (status changes go through
// `/admin/users/:userId/status`).

import { api } from '@/lib/api';
import { downloadAuthed } from '@/lib/http';
import type { CustomerList, CustomerStatus, CustomerType } from '@/lib/customers';

export type CustomerScope = 'creator' | 'admin';

export const CUSTOMER_BASE: Record<CustomerScope, string> = {
  creator: '/stores/my/customers',
  admin: '/admin/customers',
};

export type CustomerBulkAction = 'block' | 'unblock' | 'send-login-link';

export interface CreateCustomerInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  send_credentials: boolean;
  locale?: string;
  /** Admin only: the store the customer belongs to. */
  store_id?: string;
}

export interface UpdateCustomerInput {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  customer_type?: CustomerType | null;
  company_name?: string | null;
  org_number?: string | null;
  vat_number?: string | null;
}

/** The status a "block" sets (an existing UserStatus value). */
export const BLOCKED_STATUS: CustomerStatus = 'SUSPENDED';

const id = (value: string) => encodeURIComponent(value);

export function listCustomers(token: string, scope: CustomerScope, query: string): Promise<CustomerList> {
  return api<CustomerList>(`${CUSTOMER_BASE[scope]}${query}`, { token });
}

/** Raw detail payload; pass it through `normalizeCustomerDetail`. */
export function getCustomer(token: string, scope: CustomerScope, customerId: string): Promise<unknown> {
  return api<unknown>(`${CUSTOMER_BASE[scope]}/${id(customerId)}`, { token });
}

export function createCustomer(token: string, scope: CustomerScope, input: CreateCustomerInput): Promise<{ id?: string } | null> {
  return api<{ id?: string } | null>(CUSTOMER_BASE[scope], {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function updateCustomer(token: string, customerId: string, input: UpdateCustomerInput): Promise<unknown> {
  return api(`${CUSTOMER_BASE.creator}/${id(customerId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  });
}

/**
 * Block or unblock. Creators use their customers endpoint (keyed by customer
 * id); the admin uses the users endpoint (keyed by user id).
 */
export function setCustomerStatus(
  token: string,
  scope: CustomerScope,
  target: { id: string; user_id: string },
  status: CustomerStatus,
): Promise<unknown> {
  if (scope === 'admin') {
    return api(`/admin/users/${id(target.user_id)}/status`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ status }),
    });
  }
  return api(`${CUSTOMER_BASE.creator}/${id(target.id)}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}

export function sendLoginLink(token: string, customerId: string): Promise<unknown> {
  return api(`${CUSTOMER_BASE.creator}/${id(customerId)}/send-login-link`, { method: 'POST', token, body: '{}' });
}

export function sendPasswordReset(token: string, customerId: string): Promise<unknown> {
  return api(`${CUSTOMER_BASE.creator}/${id(customerId)}/send-password-reset`, { method: 'POST', token, body: '{}' });
}

export function bulkCustomers(token: string, ids: string[], action: CustomerBulkAction): Promise<unknown> {
  return api(`${CUSTOMER_BASE.creator}/bulk`, {
    method: 'POST',
    token,
    body: JSON.stringify({ ids, action }),
  });
}

/** Downloads the server-built CSV (same filters as the list, no paging). */
export function exportCustomersCsv(token: string, query: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return downloadAuthed(`${CUSTOMER_BASE.creator}/export.csv${query}`, token, `customers-${date}.csv`);
}
