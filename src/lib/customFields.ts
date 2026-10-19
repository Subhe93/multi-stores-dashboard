/**
 * Personalization field helpers for the dashboard (M4.0 WP-D).
 *
 * Part 1 — RULES. The save-time checks used by the custom-field editor
 * (`isValidPattern`, `isValidAllowedChars`, `readLinkedValidation`,
 * `readValidationRules`, `charCount`) and the field/error-code constants are
 * re-exported from `@multi-stores/core/personalization/rules`, the single
 * source of truth shared with the api and web (M5.3; it replaced the old
 * byte-copied block). Never copy rules code into this file.
 *
 * Part 2 — dashboard-only helpers: the order snapshot reader `snapshotLabel`
 * (copy of api `src/common/personalization/snapshot-label.ts`, C18) and the
 * order value row type used by the creator/admin/provider order pages.
 */

import { isPlainObject } from '@multi-stores/core/personalization/rules';

export {
  FIELD_TYPES,
  FILE_FIELD_TYPES,
  CUSTOM_FIELD_ISSUE_CODES,
  CUSTOM_FIELD_DEFINITION_ERROR_CODES,
  CUSTOMER_UPLOAD_ERROR_CODES,
  PERSONALIZATION_LIMITS,
  stripVariationSelectors,
  charCount,
  isPlainObject,
  readValidationRules,
  readLinkedValidation,
  compilePattern,
  compileAllowedChars,
  patternProblem,
  isValidPattern,
  isPatternSafe,
  isValidAllowedChars,
} from '@multi-stores/core/personalization/rules';
export type {
  FieldType,
  IssueCode,
  CustomFieldDefinitionErrorCode,
  CustomerUploadErrorCode,
  LinkedValidation,
  ValidationRules,
  PatternProblem,
} from '@multi-stores/core/personalization/rules';

// The `*_CODES` arrays are checked against `errors.*` of the six message
// files by `npm run check:personalization-codes`.

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
