// WordPress-style URL slugs for the dashboard: thin wrappers around the shared
// `@multi-stores/core/slug` port of WP sanitize_title(), plus the pure state
// transitions of a slug input (auto-generate from the title until the user
// edits the slug, free typing, sanitize on blur / submit). Kept free of React
// so it can be unit-tested with node:test (see slug.test.mjs).
import {
  encodeSlugForUrl,
  normalizeSlugForLookup,
  sanitizeAsciiHandle,
  sanitizeTitle,
} from '@multi-stores/core/slug';

export { encodeSlugForUrl };

/**
 * WP sanitize_title() of a title or a typed slug. `locale` is the store's
 * primary content locale (WP's site locale): only de/da/ca/sr/bs change the
 * accent folding. Returns '' when nothing usable remains.
 */
export function slugFromText(text: string | null | undefined, locale?: string | null): string {
  return sanitizeTitle(String(text ?? ''), { locale: locale ?? undefined });
}

/**
 * ASCII-only handle (store slug, market key, menu key): WP rules, then every
 * character outside [a-z0-9-] is dropped. `maxLength` caps the result.
 */
export function asciiHandle(text: string | null | undefined, maxLength?: number): string {
  return sanitizeAsciiHandle(String(text ?? ''), maxLength ? { maxBytes: maxLength } : {});
}

/**
 * Keystroke filter for ASCII handle inputs: lowercases and drops every
 * character outside [a-z0-9-] but keeps a trailing hyphen so the user can
 * still type `my-store`. The full sanitizer runs on blur / submit.
 */
export function asciiHandleTyping(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-');
}

/**
 * True when the slug the server stored differs from the one the form sent
 * (e.g. a `-2` suffix for a duplicate). Compared in lookup form so a pure
 * encoding / case / normalization difference does not count.
 */
export function slugWasAdjusted(sent: string | null | undefined, stored: string | null | undefined): boolean {
  if (!sent || !stored) return false;
  return normalizeSlugForLookup(sent) !== normalizeSlugForLookup(stored);
}

// ── Slug input state machine ──────────────────────────────────────────────────

export interface SlugFieldState {
  /** What the input shows: a sanitized slug, or raw text while the user types. */
  value: string;
  /** Follows the title (new items, or items whose slug is empty). */
  auto: boolean;
  /** The user typed since the last sanitize: blur / submit must sanitize. */
  typed: boolean;
}

/**
 * Initial state. An existing slug is never auto-generated: renaming an item
 * must not silently change its URL. An empty one follows the title.
 */
export function initialSlugState(existing?: string | null): SlugFieldState {
  const value = existing ?? '';
  return { value, auto: !value, typed: false };
}

/** The title changed: regenerate the slug only while it follows the title. */
export function slugStateOnTitle(state: SlugFieldState, title: string, locale?: string | null): SlugFieldState {
  if (!state.auto) return state;
  const value = slugFromText(title, locale);
  return value === state.value ? state : { ...state, value };
}

/** The user typed in the slug input: keep the raw text, stop following the title. */
export function slugStateOnInput(state: SlugFieldState, raw: string): SlugFieldState {
  return { value: raw, auto: false, typed: true };
}

/**
 * The slug input lost focus (also used before submit). Typed text is
 * sanitized; an emptied field goes back to following the title, as WP
 * regenerates an empty slug from the title on save. A stored slug the user
 * did not touch is returned unchanged (re-sanitizing it could change it).
 */
export function slugStateOnBlur(state: SlugFieldState, title: string, locale?: string | null): SlugFieldState {
  if (!state.value.trim()) {
    return { value: slugFromText(title, locale), auto: true, typed: false };
  }
  if (!state.typed) return state;
  return { value: slugFromText(state.value, locale), auto: false, typed: false };
}

export type SlugProblem = 'required' | 'unusable' | null;

/**
 * Why the slug cannot be saved: 'unusable' when the typed text has no
 * letters or digits left after sanitizing, 'required' when both the slug and
 * the title give nothing. null when it is fine (the server normalizes the rest).
 */
export function slugProblem(state: SlugFieldState, title: string, locale?: string | null): SlugProblem {
  const final = slugStateOnBlur(state, title, locale).value;
  if (final) return null;
  return state.value.trim() ? 'unusable' : 'required';
}

/**
 * The slug to send for a translation row that has its own slug input: the
 * typed slug sanitized when the user changed it, else the stored slug, else
 * one derived from the row's title, else `fallback` (the primary slug).
 */
export function resolveSlugForSubmit(opts: {
  slug: string | null | undefined;
  title: string | null | undefined;
  locale?: string | null;
  /** The user edited this slug in this session (raw text must be sanitized). */
  typed?: boolean;
  fallback?: string;
}): string {
  const raw = (opts.slug ?? '').trim();
  if (raw) {
    const s = opts.typed ? slugFromText(raw, opts.locale) : raw;
    if (s) return s;
  }
  return slugFromText(opts.title, opts.locale) || opts.fallback || '';
}

/**
 * Readable storefront path for a URL preview (`/products/هدية-لأمي`):
 * segments are shown decoded; empty ones become an ellipsis.
 */
export function slugPreviewPath(prefix: string, ...segments: (string | null | undefined)[]): string {
  const base = prefix.replace(/\/+$/, '');
  const parts = segments.map((s) => (s ?? '').trim() || '…');
  return `${base}/${parts.join('/')}`;
}

/** Storefront href: each slug segment percent-encoded (WP permalink form). */
export function slugHref(prefix: string, ...segments: string[]): string {
  const base = prefix.replace(/\/+$/, '');
  return `${base}/${segments.map((s) => encodeSlugForUrl(s)).join('/')}`;
}

// ── Page permalinks (builder) ─────────────────────────────────────────────────

/** Page types served at `/<slug>`; the others (home, header, templates…) have no URL field. */
export function pageTypeHasSlug(type: string | null | undefined): boolean {
  const t = (type ?? '').toUpperCase();
  return t === 'STATIC' || t === 'LANDING';
}

/** True when `next` is a different slug than `stored` (encoding / case differences do not count). */
export function slugChanged(stored: string | null | undefined, next: string | null | undefined): boolean {
  if (!next) return false;
  if (!stored) return true;
  return normalizeSlugForLookup(stored) !== normalizeSlugForLookup(next);
}

/**
 * The 301 a permalink edit leaves behind (WP `_wp_old_slug`): the readable old
 * and new paths when a live (published) page gets a different slug, else null
 * (a draft has no public URL to keep working).
 */
export function pageSlugRedirect(
  stored: string | null | undefined,
  next: string | null | undefined,
  live: boolean,
): { from: string; to: string } | null {
  if (!live || !stored || !next || !slugChanged(stored, next)) return null;
  return { from: `/${stored}`, to: `/${next}` };
}
