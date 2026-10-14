// Client-side helpers for the Invoices app (M3). The API is authoritative for
// every rule here (settings validator, IBAN/bankgiro/BIC checks, numbering);
// these mirrors only give inline feedback before a round trip.

import type { LegalProfileInput, NumberingSeriesInput } from '@/lib/invoices.api';

// ─── App settings (StoreApp.settings for "invoices", D9) ─────────────────────

export type CodIssueOn = 'delivered' | 'created';
export const COD_ISSUE_ON: readonly CodIssueOn[] = ['delivered', 'created'] as const;

export interface InvoiceSettings {
  // Issue automatically when the order is paid (Stripe/Kustom) or per COD rule.
  auto_issue: boolean;
  // When cash-on-delivery orders are invoiced.
  cod_issue_on: CodIssueOn;
  // Attach the PDF to order emails (confirmation/delivered/refunded/cancelled).
  attach_pdf_to_email: boolean;
  // Issue a full credit note when an invoiced order is cancelled.
  credit_on_cancel: boolean;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  auto_issue: true,
  cod_issue_on: 'delivered',
  attach_pdf_to_email: true,
  credit_on_cancel: true,
};

// Lenient read: never throws, unknown/invalid fields fall back to the default.
export function normalizeInvoiceSettings(raw: unknown): InvoiceSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (key: keyof InvoiceSettings) =>
    typeof src[key] === 'boolean' ? (src[key] as boolean) : (DEFAULT_INVOICE_SETTINGS[key] as boolean);
  return {
    auto_issue: bool('auto_issue'),
    cod_issue_on: src.cod_issue_on === 'created' || src.cod_issue_on === 'delivered' ? src.cod_issue_on : DEFAULT_INVOICE_SETTINGS.cod_issue_on,
    attach_pdf_to_email: bool('attach_pdf_to_email'),
    credit_on_cancel: bool('credit_on_cancel'),
  };
}

export function sameInvoiceSettings(a: InvoiceSettings, b: InvoiceSettings): boolean {
  return (
    a.auto_issue === b.auto_issue &&
    a.cod_issue_on === b.cod_issue_on &&
    a.attach_pdf_to_email === b.attach_pdf_to_email &&
    a.credit_on_cancel === b.credit_on_cancel
  );
}

// ─── Legal profile ───────────────────────────────────────────────────────────

export const EMPTY_LEGAL_PROFILE: LegalProfileInput = {
  legal_name: null,
  brand_name: null,
  org_number: null,
  vat_number: null,
  address_line1: null,
  address_line2: null,
  postal_code: null,
  city: null,
  country_code: null,
  registered_office: null,
  email: null,
  phone: null,
  website: null,
  bankgiro: null,
  plusgiro: null,
  iban: null,
  bic: null,
  bank_name: null,
  logo_url: null,
  f_tax_approved: false,
  due_days: 30,
  footer_note: null,
  timezone: 'Europe/Stockholm',
};

// Field names the form knows (used to label `missing[]` entries).
export const LEGAL_PROFILE_FIELDS = Object.keys(EMPTY_LEGAL_PROFILE) as (keyof LegalProfileInput)[];

// Mirror of multi-stores-api/src/modules/invoices/legal-profile.util.ts.
// Upper-cases and strips spaces / dashes ("se45 5000 ..." → "SE455000...").
export function normalizeIban(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

// ISO 13616 lengths of the countries most likely to appear (same table as the API).
const IBAN_LENGTHS: Record<string, number> = {
  SE: 24, DE: 22, FI: 18, DK: 18, NO: 15, GB: 22, FR: 27, NL: 18,
  AT: 20, BE: 16, IT: 27, ES: 24, IE: 22, PL: 28, TR: 26, CH: 21,
};

// Structure + country length (when known) + ISO 7064 mod-97 check.
export function validateIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

// Luhn (mod-10) over a digit string, check digit last.
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// Swedish bankgiro: 7 or 8 digits (hyphen optional) with a mod-10 check digit.
export function validateBankgiro(value: string): boolean {
  const compact = value.replace(/[\s-]/g, '');
  return /^\d{7,8}$/.test(compact) && luhnValid(compact);
}

// BIC/SWIFT: 8 or 11 characters.
export function validateBic(value: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.toUpperCase().replace(/\s/g, ''));
}

// IANA zones this runtime knows (null when Intl.supportedValuesOf is missing).
function supportedTimezones(): string[] | null {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : null;
  } catch {
    return null;
  }
}

export function validateTimezone(value: string): boolean {
  const zones = supportedTimezones();
  if (zones) return zones.includes(value) || value === 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Max lengths of UpdateLegalProfileDto, used as input maxLength attributes.
export const LEGAL_PROFILE_MAX_LENGTH: Partial<Record<keyof LegalProfileInput, number>> = {
  legal_name: 200,
  brand_name: 200,
  org_number: 32,
  vat_number: 32,
  address_line1: 200,
  address_line2: 200,
  postal_code: 16,
  city: 120,
  registered_office: 120,
  email: 200,
  phone: 40,
  website: 200,
  bankgiro: 16,
  plusgiro: 16,
  iban: 42,
  bic: 11,
  bank_name: 120,
  footer_note: 1000,
  timezone: 64,
};

// Supported IANA time zones for the select (falls back to a short list on
// runtimes without Intl.supportedValuesOf).
export function timezoneOptions(current?: string | null): { value: string; label: string }[] {
  let zones = supportedTimezones() ?? [];
  if (zones.length === 0) {
    zones = ['Europe/Stockholm', 'Europe/Berlin', 'Europe/Paris', 'Europe/Istanbul', 'Europe/London', 'Asia/Riyadh', 'Asia/Dubai', 'UTC'];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones.map((z) => ({ value: z, label: z }));
}

// ─── Numbering ───────────────────────────────────────────────────────────────

// Mirror of NumberingDto: empty or ends in a non-digit, max 12 chars.
export const PREFIX_RE = /^([A-Za-z0-9._/-]{0,11}[A-Za-z._/-])?$/;
export const MAX_NEXT_NUMBER = 999_999_999;
export const MAX_PADDING = 10;

export function formatInvoiceNumberPreview(prefix: string, next: number, padding: number): string {
  const n = Number.isFinite(next) && next > 0 ? Math.floor(next) : 1;
  const pad = Number.isFinite(padding) ? Math.min(Math.max(Math.floor(padding), 0), MAX_PADDING) : 0;
  return `${prefix}${String(n).padStart(pad, '0')}`;
}

export type NumberingFieldError = 'prefix' | 'next_number' | 'padding';

export function validateNumberingSeries(series: NumberingSeriesInput): NumberingFieldError[] {
  const errors: NumberingFieldError[] = [];
  if (!PREFIX_RE.test(series.prefix)) errors.push('prefix');
  if (!Number.isInteger(series.next_number) || series.next_number < 1 || series.next_number > MAX_NEXT_NUMBER) {
    errors.push('next_number');
  }
  if (!Number.isInteger(series.padding) || series.padding < 0 || series.padding > MAX_PADDING) errors.push('padding');
  return errors;
}

// ─── Display ─────────────────────────────────────────────────────────────────

// Signed amount in the document currency, Latin digits in every locale (L6).
export function formatInvoiceAmount(amount: number | string | null | undefined, currency: string, locale: string): string {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(`${locale}-u-nu-latn`, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

// YYYY-MM-DD (date-only column) → localised date without a timezone shift.
export function formatInvoiceDate(isoDate: string | null | undefined, locale: string): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  try {
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
  } catch {
    return isoDate.slice(0, 10);
  }
}

// "INVOICE" errors with `missing: [...]` carry field names; returns them as a
// string array (alternatives keep their "a|b" form).
export function missingFieldsFromPayload(payload: Record<string, unknown> | undefined): string[] {
  const missing = payload?.missing;
  return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
}

// Minimal translator shape (next-intl `t` bound to a namespace).
interface FieldTranslator {
  (key: string): string;
  has(key: string): boolean;
}

// Labels a missing-field entry through `fields.<name>` of the profile
// namespace; "iban|bankgiro" becomes "IBAN / Bankgiro".
export function missingFieldLabel(entry: string, t: FieldTranslator): string {
  // The API reports "no bank account" as "iban|bankgiro", but a plusgiro
  // number satisfies it too, so it is named as well.
  const names = entry === 'iban|bankgiro' ? ['iban', 'bankgiro', 'plusgiro'] : entry.split('|');
  return names.map((name) => (t.has(`fields.${name}`) ? t(`fields.${name}`) : name)).join(' / ');
}

// Only the VAT number is missing: softer wording (it is required only when
// the store charges VAT).
export function onlyVatMissing(missing: string[]): boolean {
  return missing.length === 1 && missing[0] === 'vat_number';
}

export function invoiceCsvFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `invoices-${y}${m}${d}.csv`;
}
