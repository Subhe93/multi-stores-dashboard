// Shared helpers for two-factor authentication and re-authentication.
// Error codes come from the API contract (plans/security-hardening/API-CONTRACT.md).

import type { ApiError } from './api';

/** Credentials sent with a payment-key change (re-authentication). */
export interface ReauthCredentials {
  current_password: string;
  totp_code?: string;
}

/** Error codes the re-auth dialog can recover from (the user retries in place). */
export const REAUTH_ERROR_CODES = new Set([
  'REAUTH_REQUIRED',
  'REAUTH_PASSWORD_INVALID',
  'REAUTH_2FA_REQUIRED',
  'TWO_FACTOR_CODE_INVALID',
  'TWO_FACTOR_LOCKED',
]);

export function errorCode(err: unknown): string | undefined {
  const code = (err as ApiError | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

export function isReauthError(err: unknown): boolean {
  const code = errorCode(err);
  return !!code && REAUTH_ERROR_CODES.has(code);
}

/**
 * Minutes left on a TWO_FACTOR_LOCKED error (rounded up, at least 1), or null
 * for any other error. The API sends `retry_after_seconds` in the error body.
 */
export function lockedMinutes(err: unknown): number | null {
  if (errorCode(err) !== 'TWO_FACTOR_LOCKED') return null;
  const payload = (err as ApiError).payload as
    | { retry_after_seconds?: unknown; data?: { retry_after_seconds?: unknown } }
    | undefined;
  const raw = Number(payload?.retry_after_seconds ?? payload?.data?.retry_after_seconds);
  if (!Number.isFinite(raw) || raw <= 0) return 15;
  return Math.max(1, Math.ceil(raw / 60));
}

/** Keeps only digits, max 6 — for the authenticator code input. */
export function sanitizeTotp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

/** Input that may be an app code (digits) or a recovery code (XXXXX-XXXXX). */
export function sanitizeCodeOrRecovery(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11);
}

/** A 6-digit app code or a 10-character recovery code (dash optional). */
export function isCodeOrRecovery(value: string): boolean {
  const v = value.replace(/-/g, '');
  return /^\d{6}$/.test(v) || /^[A-Z0-9]{10}$/.test(v);
}

/** Plain-text file content for downloading recovery codes. */
export function recoveryCodesText(codes: string[], heading: string): string {
  return `${heading}\n\n${codes.join('\n')}\n`;
}

/** Triggers a browser download of a small text file. */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
