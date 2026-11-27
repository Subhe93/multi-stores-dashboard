// Pure helpers that decide whether a parcel is addressed to someone other
// than the buyer. The result is computed on the fly, never stored.

// Trim, strip diacritics, lower-case, split into words (punctuation ignored).
export function nameWords(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Two names are the same person when every word of the shorter one is in the
// longer one, in any order: "Lind Anna" equals "Anna Lind", and "Anna Lind"
// equals the legal name "Anna Maria Lind". A missing middle name must not
// flag a parcel that goes to the buyer.
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const wa = new Set(nameWords(a));
  const wb = new Set(nameWords(b));
  if (wa.size === 0 || wb.size === 0) return false;
  const [small, large] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  for (const w of small) if (!large.has(w)) return false;
  return true;
}

// The value of a "c/o" line without a prefix the shopper typed, so the
// translated "c/o {name}" never prints it twice. Empty when nothing is left.
export function careOfValue(careOf: string | null | undefined): string {
  if (typeof careOf !== 'string') return '';
  return careOf
    .trim()
    .replace(/^c\s*\/\s*o\b[\s:.]*/i, '')
    .trim();
}

export interface RecipientCheckInput {
  needsShipping: boolean;
  recipientName?: string | null;
  // Order.buyer_name: who bought THIS order (the Kustom billing name). When
  // present it is the only buyer name compared.
  buyerName?: string | null;
  // The account profile: the fallback for orders without a stored buyer name.
  buyerFirstName?: string | null;
  buyerLastName?: string | null;
  // Account email: a profile-less account gets its local part as first name.
  buyerEmail?: string | null;
  // Company orders: a recipient equal to the company name is not "another person".
  companyName?: string | null;
}

// True for the placeholder profile of an account created without a name:
// first name = local part of the email, no last name.
function isPlaceholderProfile(input: RecipientCheckInput): boolean {
  const first = (input.buyerFirstName ?? '').trim().toLowerCase();
  const last = (input.buyerLastName ?? '').trim();
  if (!first || last) return false;
  const local = (input.buyerEmail ?? '').split('@')[0].trim().toLowerCase();
  return !!local && first === local;
}

export function isRecipientDifferent(input: RecipientCheckInput): boolean {
  if (!input.needsShipping) return false;
  if (nameWords(input.recipientName).length === 0) return false;
  let buyer = input.buyerName ?? '';
  if (nameWords(buyer).length === 0) {
    if (isPlaceholderProfile(input)) return false;
    buyer = `${input.buyerFirstName ?? ''} ${input.buyerLastName ?? ''}`;
  }
  if (nameWords(buyer).length === 0) return false;
  if (sameName(input.recipientName, buyer)) return false;
  if (input.companyName && sameName(input.recipientName, input.companyName)) return false;
  return true;
}
