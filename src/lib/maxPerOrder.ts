// "Max per order" of a product (Product.max_per_order, P1 B2): an optional
// integer 1..9999; empty means unlimited (null). Mirrors the API DTO bounds.
export const MAX_PER_ORDER_MIN = 1;
export const MAX_PER_ORDER_MAX = 9999;

/** Parsed form input: a number, null (empty = unlimited) or 'invalid'. */
export type MaxPerOrderInput = number | null | 'invalid';

export function parseMaxPerOrder(raw: string): MaxPerOrderInput {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return 'invalid';
  const n = Number(s);
  return n >= MAX_PER_ORDER_MIN && n <= MAX_PER_ORDER_MAX ? n : 'invalid';
}

/** Form text of a stored value (null / missing = empty). */
export function maxPerOrderText(value: unknown): string {
  return typeof value === 'number' && Number.isInteger(value) ? String(value) : '';
}

/**
 * Body part of a product save. The key is sent only when it matters, so a
 * product that never had a limit saves exactly as before:
 * - a value is set: `{ max_per_order: n }`;
 * - empty on an edit of a product whose API returned the key (`serverHasKey`):
 *   `{ max_per_order: null }` (clears a stored limit);
 * - otherwise nothing (create without a value, or an API without the column).
 */
export function maxPerOrderPayload(
  raw: string,
  opts: { mode: 'create' | 'edit'; serverHasKey: boolean; savedText: string },
): { max_per_order?: number | null } {
  const parsed = parseMaxPerOrder(raw);
  if (typeof parsed === 'number') return { max_per_order: parsed };
  if (parsed === null && opts.mode === 'edit' && opts.serverHasKey && opts.savedText !== '') {
    return { max_per_order: null };
  }
  return {};
}
