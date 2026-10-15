// API calls of the b2b app's reverse-charge features (M2.5): customer tax
// exemptions (`/b2b/my/tax-exemptions`) and the EC sales list
// (`/taxes/my/reports/ec-sales`). Shapes follow M2.5-DESIGN §3.8 / §3.9 / §7.

import { api } from '@/lib/api';
import type { CreateTaxExemptionInput, TaxExemptionView } from '@/lib/b2b';

const EXEMPTIONS = '/b2b/my/tax-exemptions';

export function listTaxExemptions(token: string, includeRevoked = false): Promise<TaxExemptionView[]> {
  return api<TaxExemptionView[]>(`${EXEMPTIONS}${includeRevoked ? '?include_revoked=true' : ''}`, { token });
}

// Active exemption of one customer, or null.
export function getCustomerTaxExemption(token: string, customerId: string): Promise<TaxExemptionView | null> {
  return api<TaxExemptionView | null>(`${EXEMPTIONS}/by-customer/${encodeURIComponent(customerId)}`, { token });
}

export function createTaxExemption(token: string, input: CreateTaxExemptionInput): Promise<TaxExemptionView> {
  return api<TaxExemptionView>(EXEMPTIONS, { method: 'POST', token, body: JSON.stringify(input) });
}

// Soft revoke (the row keeps `revoked_at` for the audit trail).
export function revokeTaxExemption(token: string, id: string): Promise<TaxExemptionView> {
  return api<TaxExemptionView>(`${EXEMPTIONS}/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

// ── EC sales list (periodisk sammanställning) ──────────────────────────

export type EcSalesPeriod = 'month' | 'quarter';
export type EcSalesSource = 'invoices' | 'orders';

export interface EcSalesRow {
  // '2026-10' (month) or '2026-Q4' (quarter).
  period: string;
  buyer_country: string;
  buyer_vat_number: string;
  buyer_name: string | null;
  goods_amount: number;
  currency: string;
  goods_amount_store_currency: number;
  store_currency: string;
  document_count: number;
}

export interface EcSalesReport {
  source: EcSalesSource;
  // False for the orders source: partial refunds are not netted.
  partial_refunds_included?: boolean;
  rows: EcSalesRow[];
}

export const EC_SALES_ENDPOINT = '/taxes/my/reports/ec-sales';

export function ecSalesQuery(from: string, to: string, period: EcSalesPeriod, format: 'json' | 'csv'): string {
  const params = new URLSearchParams({ from, to, period });
  if (format === 'csv') params.set('format', 'csv');
  return `${EC_SALES_ENDPOINT}?${params.toString()}`;
}

export async function getEcSalesReport(
  token: string,
  from: string,
  to: string,
  period: EcSalesPeriod,
): Promise<EcSalesReport> {
  const data = await api<EcSalesReport>(ecSalesQuery(from, to, period, 'json'), { token });
  return {
    source: data?.source === 'invoices' ? 'invoices' : 'orders',
    partial_refunds_included: data?.partial_refunds_included,
    rows: Array.isArray(data?.rows) ? data.rows : [],
  };
}
