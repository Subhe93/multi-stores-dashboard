// Per-product order confirmation email note (ProductTranslation.email_note,
// headless booking P4 E2.3): plain text per content locale, max 500
// characters (mirrors the API DTO). Shown under the product's line in the
// order confirmation email only; never on the storefront.
export const EMAIL_NOTE_MAX = 500;

/**
 * Form text of a loaded translation row: undefined when the API did not
 * return the key (an older API, or a locale never loaded), else the stored
 * note or ''.
 */
export function emailNoteText(row: object): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(row, 'email_note')) return undefined;
  const v = (row as { email_note?: unknown }).email_note;
  return typeof v === 'string' ? v : '';
}

/**
 * Translation body part of a product save. The key is sent only when it
 * matters, so a product that never had a note saves exactly as before:
 * - a note is set: `{ email_note: <trimmed> }`;
 * - empty while a note is stored for this locale: `{ email_note: null }`
 *   (clears it);
 * - otherwise nothing (the API keeps the stored value, which is none).
 */
export function emailNotePayload(
  value: string | undefined,
  storedText: string | undefined,
): { email_note?: string | null } {
  if (value === undefined) return {};
  const v = value.trim();
  if (v) return { email_note: v.slice(0, EMAIL_NOTE_MAX) };
  if ((storedText ?? '').trim()) return { email_note: null };
  return {};
}
