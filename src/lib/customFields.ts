/**
 * Personalization field helpers for the dashboard (M4.0 WP-D).
 *
 * Part 1 — RULES MIRROR. The functions between the "BEGIN/END MIRROR" markers
 * are copied byte-for-byte from the single source of truth
 *   multi-stores-shared/src/personalization/rules.ts
 * (same mirror rule as multi-stores-api/src/common/personalization/rules.ts and
 * multi-stores-web/src/lib/personalization/rules.ts; M4.0 K6, W23).
 * PARITY NOTE: the dashboard only needs the save-time checks used by the
 * custom-field editor (`isValidPattern`, `isValidAllowedChars`,
 * `readLinkedValidation`, `readValidationRules`, `charCount`), so only that
 * subset is mirrored. When rules.ts changes, diff this block against it; do not
 * edit the mirrored code here first.
 *
 * Part 2 — dashboard-only helpers: the order snapshot reader `snapshotLabel`
 * (copy of api `src/common/personalization/snapshot-label.ts`, C18) and the
 * order value row type used by the creator/admin/provider order pages.
 */

// ===========================================================================
// BEGIN MIRROR (multi-stores-shared/src/personalization/rules.ts, subset)
// ===========================================================================

export const FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'IMAGE',
  'FILE',
  'SELECT',
  'COLOR',
  'FONT',
  'DATE',
  'MULTI_IMAGE',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Field types whose value is a file reference (stored as `file_url`). */
export const FILE_FIELD_TYPES: readonly FieldType[] = ['IMAGE', 'FILE', 'MULTI_IMAGE'];

/** Issues a customer value can produce (cart, quote, order). */
export const CUSTOM_FIELD_ISSUE_CODES = [
  'CUSTOM_FIELD_REQUIRED',
  'CUSTOM_FIELD_TOO_SHORT',
  'CUSTOM_FIELD_TOO_LONG',
  'CUSTOM_FIELD_INVALID_NUMBER',
  'CUSTOM_FIELD_NUMBER_TOO_SMALL',
  'CUSTOM_FIELD_NUMBER_TOO_LARGE',
  'CUSTOM_FIELD_INVALID_FORMAT',
  'CUSTOM_FIELD_INVALID_CHARS',
  'CUSTOM_FIELD_LENGTH_MISMATCH',
  'CUSTOM_FIELD_COMBINED_TOO_LONG',
  'CUSTOM_FIELD_INVALID_OPTION',
  'CUSTOM_FIELD_INVALID_COLOR',
  'CUSTOM_FIELD_INVALID_DATE',
  'CUSTOM_FIELD_INVALID_FILE',
  'CUSTOM_FIELD_TOO_MANY_FILES',
  'CUSTOM_FIELD_INVALID_PAYLOAD',
] as const;

export type IssueCode = (typeof CUSTOM_FIELD_ISSUE_CODES)[number];

/**
 * Codes raised when a merchant saves a field definition (dashboard → API),
 * plus the defensive delete code. Not produced by `validatePersonalization`.
 */
export const CUSTOM_FIELD_DEFINITION_ERROR_CODES = [
  'CUSTOM_FIELD_INVALID_PATTERN',
  'CUSTOM_FIELD_INVALID_ALLOWED_CHARS',
  'CUSTOM_FIELD_INVALID_LINK',
  'CUSTOM_FIELD_NAME_TAKEN',
  'CUSTOM_FIELD_IN_USE',
  'CUSTOM_FIELD_INVALID_RULES',
] as const;

export type CustomFieldDefinitionErrorCode =
  (typeof CUSTOM_FIELD_DEFINITION_ERROR_CODES)[number];

/** Customer upload codes (M4.0 WP-B; `UPLOAD_*` codes of UploadsService are reused as-is). */
export const CUSTOMER_UPLOAD_ERROR_CODES = [
  'CUSTOMER_UPLOAD_TYPE_NOT_ALLOWED',
  'CUSTOMER_UPLOAD_EXPIRED',
  'CUSTOMER_UPLOAD_NOT_FOUND',
  'CUSTOMER_UPLOAD_PURGED',
  /** 429: the per-IP daily upload byte budget is used up. */
  'CUSTOMER_UPLOAD_QUOTA',
  /** 503: the server is low on disk space; try again later. */
  'CUSTOMER_UPLOAD_STORAGE_FULL',
] as const;

export type CustomerUploadErrorCode = (typeof CUSTOMER_UPLOAD_ERROR_CODES)[number];

export type LinkedValidation =
  | { type: 'equal_length'; target: string; fill_char?: string }
  | { type: 'max_combined'; target: string; max: number };

export interface ValidationRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  allowed_chars?: string;
}

export const PERSONALIZATION_LIMITS = {
  /** Keys in one values object (any nesting level). */
  maxKeys: 100,
  /** Code points in one string value (TEXTAREA). Also caps regex input (ReDoS, W6). */
  maxStringChars: 5000,
  /** Items in one array value (M4.1 checkbox groups allow up to 50). */
  maxArrayItems: 50,
  /** Nesting depth of objects/arrays (M4.1 repeaters need 2–3). */
  maxDepth: 4,
  /** Files in one MULTI_IMAGE value. */
  maxFiles: 20,
  /** Characters in a FONT value when the field has no option list. */
  maxFontChars: 100,
  /** Characters of a merchant `pattern` / `allowed_chars` body. */
  maxPatternLength: 200,
  maxAllowedCharsLength: 200,
  /** Code points of a value checked against a merchant `pattern` (ReDoS guard). */
  maxPatternInputChars: 500,
} as const;

const VARIATION_SELECTORS = /[\uFE0E\uFE0F]/g;

/** Removes U+FE0E/U+FE0F (text/emoji presentation selectors). */
export function stripVariationSelectors(s: string): string {
  return s.replace(VARIATION_SELECTORS, '');
}

/**
 * Length used by every rule (K4/C14): Unicode code points after NFC and after
 * removing U+FE0E/U+FE0F. U+2764 U+FE0F counts 1, a ZWJ family of three counts 5.
 */
export function charCount(s: string): number {
  return Array.from(stripVariationSelectors(s.normalize('NFC'))).length;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function toInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return parseInt(v, 10);
  return undefined;
}

/** Reads `validation_rules` leniently (legacy rows store numbers as strings). */
export function readValidationRules(raw: unknown): ValidationRules {
  if (!isPlainObject(raw)) return {};
  const out: ValidationRules = {};
  const min = toInt(raw.min_length);
  const max = toInt(raw.max_length);
  if (min !== undefined) out.min_length = min;
  if (max !== undefined) out.max_length = max;
  if (typeof raw.pattern === 'string' && raw.pattern !== '') out.pattern = raw.pattern;
  if (typeof raw.allowed_chars === 'string' && raw.allowed_chars !== '') {
    out.allowed_chars = raw.allowed_chars;
  }
  return out;
}

/**
 * Reads `linked_validation` (K3/C16). Legacy `target_field_id` is read as
 * `target`. `max_combined` without a numeric `max` is ignored (null).
 */
export function readLinkedValidation(raw: unknown): LinkedValidation | null {
  if (!isPlainObject(raw)) return null;
  const target =
    typeof raw.target === 'string' && raw.target.trim() !== ''
      ? raw.target.trim()
      : typeof raw.target_field_id === 'string' && raw.target_field_id.trim() !== ''
        ? raw.target_field_id.trim()
        : null;
  if (!target) return null;
  if (raw.type === 'equal_length') {
    // fill_char pads one character at a time: anything but exactly one code
    // point (C14 counting) is ignored.
    const fill =
      typeof raw.fill_char === 'string' && charCount(raw.fill_char) === 1
        ? raw.fill_char
        : undefined;
    return fill === undefined
      ? { type: 'equal_length', target }
      : { type: 'equal_length', target, fill_char: fill };
  }
  if (raw.type === 'max_combined') {
    const max = toInt(raw.max);
    if (max === undefined || max < 1) return null;
    return { type: 'max_combined', target, max };
  }
  return null;
}

/** Compiles a merchant `pattern` exactly like the storefront always did (no `u` flag). */
export function compilePattern(pattern: string): RegExp | null {
  if (typeof pattern !== 'string' || pattern === '') return null;
  if (pattern.length > PERSONALIZATION_LIMITS.maxPatternLength) return null;
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/** True when the body has an unescaped `[` or `]` (it would break out of the class). */
function hasUnescapedBracket(body: string): boolean {
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '[' || c === ']') return true;
  }
  return false;
}

/**
 * Compiles an `allowed_chars` character-class body as-is (C15):
 * `^[<body>]*$` with the `u` flag. Returns null when the body is empty, too
 * long, has an unescaped bracket or does not compile.
 */
export function compileAllowedChars(body: string): RegExp | null {
  if (typeof body !== 'string' || body === '') return null;
  if (body.length > PERSONALIZATION_LIMITS.maxAllowedCharsLength) return null;
  if (hasUnescapedBracket(body)) return null;
  try {
    return new RegExp('^[' + body + ']*$', 'u');
  } catch {
    return null;
  }
}

/** Why a merchant `pattern` is refused at save time. */
export type PatternProblem = 'invalid' | 'too_long' | 'unsafe';

/**
 * Save-time check for `pattern` (API DTO and dashboard): null when the
 * pattern may be saved. `too_long` over `maxPatternLength`, `invalid` when it
 * does not compile, `unsafe` when `isPatternSafe` refuses it.
 */
export function patternProblem(pattern: string): PatternProblem | null {
  if (typeof pattern !== 'string' || pattern === '') return 'invalid';
  if (pattern.length > PERSONALIZATION_LIMITS.maxPatternLength) return 'too_long';
  if (compilePattern(pattern) === null) return 'invalid';
  return isPatternSafe(pattern) ? null : 'unsafe';
}

/** Save-time check for `pattern` (API DTO and dashboard). */
export function isValidPattern(pattern: string): boolean {
  return patternProblem(pattern) === null;
}

/** First atom of an alternative, for the overlap check. */
type FirstAtom =
  | { kind: 'char'; ch: string }
  | { kind: 'class'; ranges: [number, number][] }
  | { kind: 'other' }
  | { kind: 'empty' };

/** One alternative of a group: its first atom and how its atoms are quantified. */
interface Alternative {
  first: FirstAtom;
  /** Atoms (chars, classes, escapes, nested groups) seen in this alternative. */
  atoms: number;
  /** Atoms of this alternative that carry a quantifier. */
  quantified: number;
}

interface PatternFrame {
  /** A quantifier inside a nested group, or a quantified nested group. */
  nestedQuantifier: boolean;
  /** Every alternative seen so far (the current one is last). */
  alts: Alternative[];
}

const DIGIT_RANGES: [number, number][] = [[48, 57]];
const WORD_RANGES: [number, number][] = [[48, 57], [65, 90], [95, 95], [97, 122]];
const SPACE_RANGES: [number, number][] = [
  [9, 13],
  [32, 32],
  [160, 160],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
  [0xfeff, 0xfeff],
];

/** `\d`, `\w`, `\s` as code ranges; null for anything else. */
function escapeRanges(n: string): [number, number][] | null {
  if (n === 'd') return DIGIT_RANGES;
  if (n === 'w') return WORD_RANGES;
  if (n === 's') return SPACE_RANGES;
  return null;
}

/**
 * Code ranges of a positive character class body (`a-zA-Z0-9`, `\d`, `_-`),
 * or null when the body is negated or uses anything the overlap check does
 * not model (the class then counts as "may start with anything").
 */
function classRanges(body: string): [number, number][] | null {
  if (body.startsWith('^')) return null;
  const out: [number, number][] = [];
  let i = 0;
  // One class item: a code point, -1 for an escape already added to `out`,
  // null when the item is not modelled.
  const readOne = (): number | null => {
    const c = body[i];
    if (c === '\\') {
      const n = body[i + 1];
      if (n === undefined) return null;
      i += 2;
      const r = escapeRanges(n);
      if (r) {
        out.push(...r);
        return -1;
      }
      if (/[DWSbBpPux0-9k]/.test(n)) return null;
      return n.codePointAt(0) ?? null;
    }
    i++;
    return c.codePointAt(0) ?? null;
  };
  while (i < body.length) {
    const lo = readOne();
    if (lo === null) return null;
    if (lo === -1) continue;
    if (body[i] === '-' && i + 1 < body.length) {
      i++;
      const hi = readOne();
      if (hi === null || hi === -1 || hi < lo) return null;
      out.push([lo, hi]);
      continue;
    }
    out.push([lo, lo]);
  }
  return out;
}

function rangesOverlap(a: [number, number][], b: [number, number][]): boolean {
  return a.some(([alo, ahi]) => b.some(([blo, bhi]) => alo <= bhi && blo <= ahi));
}

/** True when two first atoms may match the same character. */
function atomsOverlap(a: FirstAtom, b: FirstAtom): boolean {
  if (a.kind === 'other' || b.kind === 'other' || a.kind === 'empty' || b.kind === 'empty') return true;
  if (a.kind === 'char' && b.kind === 'char') return a.ch.toLowerCase() === b.ch.toLowerCase();
  if (a.kind === 'class' && b.kind === 'class') return rangesOverlap(a.ranges, b.ranges);
  const ch = a.kind === 'char' ? a : (b as { kind: 'char'; ch: string });
  const cls = a.kind === 'class' ? a : (b as { kind: 'class'; ranges: [number, number][] });
  const code = ch.ch.codePointAt(0) ?? -1;
  return rangesOverlap([[code, code]], cls.ranges);
}

/** True when two alternatives may start with the same character. */
function alternativesOverlap(alts: Alternative[]): boolean {
  for (let i = 0; i < alts.length; i++) {
    for (let j = i + 1; j < alts.length; j++) {
      if (atomsOverlap(alts[i].first, alts[j].first)) return true;
    }
  }
  return false;
}

/**
 * Reads a quantifier at `i`: its end index and maximum count (Infinity when
 * unbounded), or null when there is none. A `{` that is not a valid
 * quantifier is a literal (non-`u` regex syntax).
 */
function readQuantifier(p: string, i: number): { end: number; max: number } | null {
  const c = p[i];
  let end: number;
  let max: number;
  if (c === '*' || c === '+') {
    end = i + 1;
    max = Infinity;
  } else if (c === '?') {
    end = i + 1;
    max = 1;
  } else if (c === '{') {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i));
    if (!m) return null;
    end = i + m[0].length;
    max = m[2] === undefined ? Number(m[1]) : m[3] === '' ? Infinity : Number(m[3]);
  } else {
    return null;
  }
  if (p[end] === '?') end++; // lazy
  return { end, max };
}

/**
 * ReDoS heuristic for merchant patterns (no `re2`, M4.0; relaxed in M5 A10).
 * Refuses:
 * - backreferences (`\1`, `\k<name>`) and lookarounds (`(?=`, `(?!`, `(?<=`, `(?<!`);
 * - a group repeated more than once (`*`, `+`, `{n,}`, `{n,m}` with m > 1)
 *   whose body, or one of its alternatives, is a single quantified atom
 *   (`^(a+)+$`, `^(a{1,3}){2}$`, `^(a+|b+)+$`), or that holds a quantified
 *   nested group or a quantifier inside one (`^((a+)b)+$`);
 * - such a repeated group whose alternatives may start with the same
 *   character (`(a|ab)*`, `(\d|[0-9])+`); disjoint classes are fine
 *   (`([A-Z]|[a-z])+`).
 * A repeated group of several quantified atoms (`^(?:[a-z]+\s?)+$`, the
 * "words with an optional separator" idiom) is accepted: on the server every
 * pattern runs under the vm timeout (`pattern-tester.ts`), which is the
 * guard for anything this heuristic lets through. Polynomial cases such as
 * `.*.*` pass; they are bounded by `maxPatternInputChars` and that timeout.
 */
export function isPatternSafe(pattern: string): boolean {
  const p = pattern;
  const newFrame = (): PatternFrame => ({
    nestedQuantifier: false,
    alts: [{ first: { kind: 'empty' }, atoms: 0, quantified: 0 }],
  });
  const stack: PatternFrame[] = [newFrame()];
  const top = (): PatternFrame => stack[stack.length - 1];
  const current = (): Alternative => {
    const alts = top().alts;
    return alts[alts.length - 1];
  };
  // Records an atom of the current alternative (the first one is kept).
  const atom = (a: FirstAtom): void => {
    const alt = current();
    alt.atoms++;
    if (alt.first.kind === 'empty') alt.first = a;
  };
  // Applies a quantifier after an atom: the next index, or -1 when unsafe.
  const quantify = (i: number, group: PatternFrame | null): number => {
    const q = readQuantifier(p, i);
    if (!q) return i;
    current().quantified++;
    if (group) top().nestedQuantifier = true;
    if (group && q.max > 1) {
      if (group.nestedQuantifier) return -1;
      if (group.alts.some((a) => a.atoms === 1 && a.quantified > 0)) return -1;
      if (group.alts.length > 1 && alternativesOverlap(group.alts)) return -1;
    }
    return q.end;
  };

  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === '\\') {
      const n = p[i + 1];
      if (n === undefined) return false;
      if (/[1-9k]/.test(n)) return false; // backreference
      const ranges = escapeRanges(n);
      atom(ranges ? { kind: 'class', ranges } : /[DWSbB]/.test(n) ? { kind: 'other' } : { kind: 'char', ch: n });
      i = quantify(i + 2, null);
    } else if (c === '[') {
      let j = i + 1;
      if (p[j] === '^') j++;
      // A `]` right away closes the class (`[]` / `[^]` in JS).
      while (j < p.length && p[j] !== ']') j += p[j] === '\\' ? 2 : 1;
      if (j >= p.length) return false;
      const ranges = classRanges(p.slice(i + 1, j));
      atom(ranges ? { kind: 'class', ranges } : { kind: 'other' });
      i = quantify(j + 1, null);
    } else if (c === '(') {
      let body = i + 1;
      if (p[i + 1] === '?') {
        const kind = p[i + 2];
        if (kind === ':') body = i + 3;
        else if (kind === '<' && p[i + 3] !== '=' && p[i + 3] !== '!') {
          const close = p.indexOf('>', i + 3);
          if (close < 0) return false;
          body = close + 1;
        } else return false; // lookaround or unknown group
      }
      atom({ kind: 'other' });
      stack.push(newFrame());
      i = body;
    } else if (c === ')') {
      if (stack.length < 2) return false;
      const group = stack.pop() as PatternFrame;
      if (group.nestedQuantifier || group.alts.some((a) => a.quantified > 0)) {
        top().nestedQuantifier = true;
      }
      i = quantify(i + 1, group);
    } else if (c === '|') {
      top().alts.push({ first: { kind: 'empty' }, atoms: 0, quantified: 0 });
      i++;
    } else if (c === '^' || c === '$') {
      i++;
    } else {
      atom(c === '.' ? { kind: 'other' } : { kind: 'char', ch: c });
      i = quantify(i + 1, null);
    }
    if (i < 0) return false;
  }
  return stack.length === 1;
}

/** Save-time check for `allowed_chars` (API DTO and dashboard). */
export function isValidAllowedChars(body: string): boolean {
  return compileAllowedChars(body) !== null;
}

// ===========================================================================
// END MIRROR
// ===========================================================================

// The `*_CODES` arrays above are checked against `errors.*` of the six
// message files by `npm run check:personalization-mirror`.

// ---------------------------------------------------------------------------
// Order value snapshot (C1, C18)
// ---------------------------------------------------------------------------

/** Locale map written at order time, e.g. `{ "sv": "Namn", "en": "Name" }`. */
export type LocaleMap = Record<string, string>;

/** `upload` include of a value row (M4.0 WP-B, orders.service include). */
export interface OrderValueUpload {
  id: string;
  preview_url?: string | null;
  original_name?: string | null;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  purged_at?: string | null;
}

/** One `OrderCustomFieldValue` row as returned by `GET /orders/:id`. */
export interface OrderFieldValueRow {
  id?: string;
  custom_field_id?: string | null;
  value?: string | null;
  file_url?: string | null;
  // Snapshot columns (M4.0 §6); null on rows the backfill could not reach.
  field_name?: string | null;
  field_type?: string | null;
  field_label?: LocaleMap | null;
  display_value?: LocaleMap | null;
  sort_order?: number | null;
  upload_id?: string | null;
  upload?: OrderValueUpload | null;
  /** Live field; null once the field was deleted (SET NULL). */
  custom_field?: {
    name?: string | null;
    translations?: { locale?: string | null; label?: string | null; option_labels?: unknown }[] | null;
  } | null;
}

/**
 * `map[locale]` → `map[primary]` → `map.en` → first non-empty entry; null
 * when the map has no usable string (api `pickLocaleText`).
 */
function pickFromMap(map: unknown, locale: string, primary: string): string | null {
  if (!isPlainObject(map)) return null;
  const ok = (v: unknown): v is string => typeof v === 'string' && v !== '';
  for (const key of [locale, primary, 'en']) {
    if (key && ok(map[key])) return map[key];
  }
  for (const v of Object.values(map)) if (ok(v)) return v;
  return null;
}

type LiveTranslation = NonNullable<
  NonNullable<NonNullable<OrderFieldValueRow['custom_field']>['translations']>
>[number];

/** Exact locale → `en` → first row (api `pickTranslation`). */
function pickTranslation(
  trs: readonly LiveTranslation[] | null | undefined,
  locale: string,
): LiveTranslation | undefined {
  if (!trs?.length) return undefined;
  return (
    (locale ? trs.find((tr) => tr?.locale === locale) : undefined) ||
    trs.find((tr) => tr?.locale === 'en') ||
    trs[0]
  );
}

/**
 * Label and display text of an order value row (C18). Same chain as api
 * `src/common/personalization/snapshot-label.ts`:
 * - label: `field_label[locale]` → `[primary]` → `.en` → first → live
 *   translation (locale → en → first, then primary) → `field_name` → live
 *   name → '—';
 * - value: `display_value` by the same chain → for pre-snapshot rows the live
 *   option label of the raw value → the raw `value` ('' when absent).
 * File rows return the raw `value` (usually ''); callers render the file.
 */
export function snapshotLabel(
  row: OrderFieldValueRow,
  locale: string,
  primary: string,
): { label: string; value: string } {
  const live = row.custom_field ?? null;
  const liveTr =
    pickTranslation(live?.translations, locale) ??
    (primary ? pickTranslation(live?.translations, primary) : undefined);
  const label =
    pickFromMap(row.field_label, locale, primary) ||
    liveTr?.label ||
    row.field_name ||
    live?.name ||
    '—';

  const raw = row.value ?? null;
  let value = pickFromMap(row.display_value, locale, primary);
  if (value === null && raw !== null && raw !== '' && !row.display_value) {
    // Pre-snapshot rows of option fields: the live option label, if any.
    const labels = isPlainObject(liveTr?.option_labels) ? liveTr.option_labels : null;
    const opt = labels?.[raw];
    if (typeof opt === 'string' && opt !== '') value = opt;
  }
  return { label, value: value ?? raw ?? '' };
}

/** True when the row holds a customer file rather than a text value. */
export function isFileValueRow(row: OrderFieldValueRow): boolean {
  if (row.file_url) return true;
  if (row.upload_id || row.upload) return true;
  return false;
}

/** Sorts value rows by `sort_order` (nulls last), keeping the API order otherwise. */
export function sortValueRows<T extends OrderFieldValueRow>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? [])
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const sa = a.row.sort_order ?? Number.POSITIVE_INFINITY;
      const sb = b.row.sort_order ?? Number.POSITIVE_INFINITY;
      if (sa !== sb) return sa < sb ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}
