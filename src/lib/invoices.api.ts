// Typed client for the Invoices app endpoints (M3). View shapes mirror the
// shared `InvoiceSummary` / `LegalProfileView` contracts; see
// plans/namez-store-apps/M3-DESIGN.md §3.6 and §9. Keep in sync with
// multi-stores-shared/src/types/invoice.ts.

import { api, API_URL, ApiError } from '@/lib/api';
import { parseContentDispositionFilename } from '@/lib/backups';

export type InvoiceKind = 'INVOICE' | 'CREDIT_NOTE';
export type InvoiceTrigger = 'PAYMENT' | 'COD_CREATED' | 'COD_DELIVERED' | 'MANUAL' | 'REFUND' | 'CANCELLATION';
export type InvoiceBuyerType = 'PERSON' | 'COMPANY';

// List / detail row. Amounts are signed major units (credit notes negative).
export interface InvoiceSummary {
  id: string;
  kind: InvoiceKind;
  number: string;
  issue_date: string; // YYYY-MM-DD
  due_date: string | null;
  order_id: string;
  order_number: string;
  currency: string;
  net_total: number;
  vat_total: number;
  gross_total: number;
  paid: boolean;
  buyer_name: string;
  buyer_type: InvoiceBuyerType | null;
  credited_invoice: { id: string; number: string } | null;
  trigger: InvoiceTrigger;
  reason: string | null;
  pdf_available: boolean;
  // INVOICE only: gross amount that can still be credited.
  remaining_creditable?: number | null;
}

// VAT summary row of the snapshot (§3.2).
export interface InvoiceVatSummaryRow {
  label?: string | null;
  rate_bp: number;
  net: number;
  vat: number;
  gross: number;
}

// GET /invoices/my/:id → summary + immutable snapshot. Only the parts the
// dashboard renders are typed; everything else stays opaque.
export interface InvoiceDetail extends InvoiceSummary {
  snapshot?: {
    buyer?: {
      name?: string | null;
      org_number?: string | null;
      vat_number?: string | null;
      reference?: string | null;
      email?: string | null;
    } | null;
    vat_summary?: InvoiceVatSummaryRow[] | null;
    payment?: { label?: string | null; status?: string | null } | null;
    [key: string]: unknown;
  } | null;
}

export interface InvoiceListResponse {
  items: InvoiceSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface InvoiceListQuery {
  kind?: InvoiceKind;
  from?: string; // YYYY-MM-DD
  to?: string;
  q?: string;
  paid?: boolean;
  page?: number;
  limit?: number;
}

export interface BacklogOrder {
  id: string;
  order_number: string;
  created_at: string;
  total: number | string;
  currency: string;
  payment_method: string | null;
}

export interface BacklogResponse {
  count: number;
  orders: BacklogOrder[];
}

// POST /invoices/my/backlog/issue (L13 "Issue all").
export interface BacklogIssueResult {
  issued: number;
  skipped: number;
  errors: { order_id?: string; order_number?: string; code?: string; message?: string }[];
}

export interface NumberingSeriesView {
  prefix: string;
  padding: number;
  next_number: number;
  issued_count: number;
  // True once a document was issued in this series: next_number is frozen.
  locked: boolean;
}

export interface NumberingSeriesInput {
  prefix: string;
  next_number: number;
  padding: number;
}

// PUT body: next_number is omitted when the series is locked or unchanged
// (the API locks only next_number once documents exist).
export interface NumberingInput {
  invoice?: Omit<NumberingSeriesInput, 'next_number'> & { next_number?: number };
  credit_note?: Omit<NumberingSeriesInput, 'next_number'> & { next_number?: number };
}

// Editable legal-profile fields (PUT body). Every field is optional on the API.
export interface LegalProfileInput {
  legal_name: string | null;
  brand_name: string | null;
  org_number: string | null;
  vat_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  registered_office: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bankgiro: string | null;
  plusgiro: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  logo_url: string | null;
  f_tax_approved: boolean;
  due_days: number;
  footer_note: string | null;
  timezone: string;
}

export interface LegalProfileView extends LegalProfileInput {
  complete: boolean;
  // Field names (alternatives joined with "|", e.g. "iban|bankgiro").
  missing: string[];
  numbering: { invoice: NumberingSeriesView; credit_note: NumberingSeriesView } | null;
}

export interface CreditNoteInput {
  // Omitted = credit the full remaining amount.
  amount?: number;
  reason?: string;
}

// ─── Creator endpoints (/invoices/my) ────────────────────────────────────────

function listQueryString(query: InvoiceListQuery, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (query.kind) params.set('kind', query.kind);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (typeof query.paid === 'boolean') params.set('paid', String(query.paid));
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function getLegalProfile(token: string): Promise<LegalProfileView> {
  return api<LegalProfileView>('/invoices/my/legal-profile', { token });
}

export function saveLegalProfile(token: string, input: Partial<LegalProfileInput>): Promise<LegalProfileView> {
  return api<LegalProfileView>('/invoices/my/legal-profile', {
    method: 'PUT',
    token,
    body: JSON.stringify(input),
  });
}

export function saveNumbering(token: string, input: NumberingInput): Promise<LegalProfileView> {
  return api<LegalProfileView>('/invoices/my/numbering', {
    method: 'PUT',
    token,
    body: JSON.stringify(input),
  });
}

export function listInvoices(token: string, query: InvoiceListQuery): Promise<InvoiceListResponse> {
  return api<InvoiceListResponse>(`/invoices/my${listQueryString(query)}`, { token });
}

export function getInvoice(token: string, id: string): Promise<InvoiceDetail> {
  return api<InvoiceDetail>(`/invoices/my/${encodeURIComponent(id)}`, { token });
}

export function getBacklog(token: string, limit = 100): Promise<BacklogResponse> {
  return api<BacklogResponse>(`/invoices/my/backlog?limit=${limit}`, { token });
}

export function issueBacklog(token: string): Promise<BacklogIssueResult> {
  return api<BacklogIssueResult>('/invoices/my/backlog/issue', { method: 'POST', token });
}

export function issueInvoice(token: string, orderId: string): Promise<InvoiceSummary> {
  return api<InvoiceSummary>(`/invoices/my/orders/${encodeURIComponent(orderId)}/issue`, { method: 'POST', token });
}

export function createCreditNote(token: string, invoiceId: string, input: CreditNoteInput): Promise<InvoiceSummary> {
  return api<InvoiceSummary>(`/invoices/my/${encodeURIComponent(invoiceId)}/credit-note`, {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

// CSV export of the current filters (BOM + numeric cells; see §3.6).
export function downloadInvoicesCsv(token: string, query: InvoiceListQuery, filename: string): Promise<void> {
  // Pagination is irrelevant for the export; only the filters are sent.
  const filters: InvoiceListQuery = { kind: query.kind, from: query.from, to: query.to, q: query.q, paid: query.paid };
  return downloadAuthed(`/invoices/my${listQueryString(filters, { format: 'csv' })}`, token, filename);
}

// ─── Documents endpoints (any role, ownership checked server-side) ──────────

export function listOrderInvoices(token: string, orderId: string): Promise<InvoiceSummary[]> {
  return api<InvoiceSummary[]>(`/invoices/documents/orders/${encodeURIComponent(orderId)}`, { token });
}

// Authenticated file download: fetch with Bearer → blob → save. Throws
// ApiError (with `code`, e.g. INVOICE_PDF_UNAVAILABLE on 503) so callers
// translate it like any JSON error.
async function downloadAuthed(endpoint: string, token: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new ApiError('Download failed');
    err.status = res.status;
    try {
      const json = await res.json();
      if (json?.message) err.message = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
      if (typeof json?.code === 'string') err.code = json.code;
      if (json && typeof json === 'object') err.payload = json;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw err;
  }
  const filename = parseContentDispositionFilename(res.headers.get('content-disposition')) || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadInvoicePdf(token: string, invoice: Pick<InvoiceSummary, 'id' | 'number'>): Promise<void> {
  return downloadAuthed(`/invoices/documents/${encodeURIComponent(invoice.id)}/pdf`, token, `${invoice.number}.pdf`);
}
