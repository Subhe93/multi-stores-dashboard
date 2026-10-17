import { ApiError } from '@/lib/api';
import { charCount, isValidAllowedChars, isValidPattern } from '@/lib/customFields';
import { MAX_CHECKED_LIMIT, type PConditions, type PPricing, type PRepeat, type PUi } from '@/lib/personalization';
import { conditionsComplete } from '@/components/apps/personalization/FieldConditionsEditor';
import { pricingValid } from '@/components/apps/personalization/FieldPricingEditor';
import { repeatValid } from '@/components/apps/personalization/FieldRepeatEditor';
import { MAX_COMBINED_LIMIT, MAX_RULE_LENGTH, type CustomField } from './types';

/** A translatable error: `customField.<key>` plus ICU params; `null` = no error. */
export type FieldError = { key: string; params?: Record<string, string | number> } | null;

/** Strictly parses a non-negative integer input; '' → undefined, invalid → NaN. */
export const parseIntInput = (raw: string): number | undefined => {
  const v = raw.trim();
  if (v === '') return undefined;
  return /^\d+$/.test(v) ? parseInt(v, 10) : NaN;
};

/** The API reports a pattern it refuses as too slow (ReDoS) with `params.reason = 'unsafe'`. */
export const isUnsafePatternError = (err: unknown): boolean => {
  if (!(err instanceof ApiError) || err.code !== 'CUSTOM_FIELD_INVALID_PATTERN') return false;
  const params = err.payload?.params as { reason?: unknown } | undefined;
  return params?.reason === 'unsafe';
};

/** The form values the live checks look at (strings exactly as typed). */
export interface FieldValidationInput {
  on: boolean;
  type: string;
  name: string;
  originalName: string;
  minLength: string;
  maxLength: string;
  pattern: string;
  allowedChars: string;
  linkedType: string;
  linkedTarget: string;
  linkedFillChar: string;
  linkedMax: string;
  minChecked: string;
  maxChecked: string;
  optionValues: string[];
  conditions: PConditions | null;
  pricing: PPricing | null;
  repeat: PRepeat | null;
  ui: PUi | null;
  /** Sibling fields (never the field itself). */
  siblings: CustomField[];
}

export interface FieldValidation {
  trimmedName: string;
  minLen: number | undefined;
  maxLen: number | undefined;
  maxCombined: number | undefined;
  minChk: number | undefined;
  maxChk: number | undefined;
  nameError: FieldError;
  lengthError: FieldError;
  patternError: FieldError;
  allowedCharsError: FieldError;
  linkError: FieldError;
  fillCharError: FieldError;
  checkedError: FieldError;
  optionsError: FieldError;
  advancedErrors: boolean;
  hasErrors: boolean;
  /** Per dialog tab: whether it holds an error (drives the red dot). */
  tabHasError: Record<string, boolean>;
}

/** Live checks with friendly messages; the API repeats them on save (M4.0 §3.2). */
export function validateFieldForm(f: FieldValidationInput): FieldValidation {
  const { on, type, siblings, ui } = f;
  const trimmedName = f.name.trim();
  const minLen = parseIntInput(f.minLength);
  const maxLen = parseIntInput(f.maxLength);
  const maxCombined = parseIntInput(f.linkedMax);
  const minChk = parseIntInput(f.minChecked);
  const maxChk = parseIntInput(f.maxChecked);
  // Legacy products may already hold duplicate names; only a changed name is checked.
  const nameError: FieldError =
    trimmedName && trimmedName !== f.originalName && siblings.some(s => s.name === trimmedName)
      ? { key: 'nameTaken' }
      : null;
  const lengthError: FieldError =
    [minLen, maxLen].some(v => v !== undefined && (Number.isNaN(v) || v > MAX_RULE_LENGTH))
      ? { key: 'invalidLength', params: { max: MAX_RULE_LENGTH } }
      : minLen !== undefined && maxLen !== undefined && minLen > maxLen
        ? { key: 'minAboveMax' }
        : null;
  const patternError: FieldError = f.pattern && !isValidPattern(f.pattern) ? { key: 'invalidPattern' } : null;
  const allowedCharsError: FieldError = f.allowedChars && !isValidAllowedChars(f.allowedChars)
    ? { key: 'invalidAllowedChars' }
    : null;
  const linkError: FieldError = !f.linkedType
    ? null
    : !f.linkedTarget
      ? { key: 'linkTargetRequired' }
      : f.linkedTarget === trimmedName
        ? { key: 'linkTargetSelf' }
        : !siblings.some(s => s.name === f.linkedTarget)
          ? { key: 'linkTargetMissing' }
          : f.linkedType === 'max_combined' &&
              (maxCombined === undefined || Number.isNaN(maxCombined) || maxCombined < 1 || maxCombined > MAX_COMBINED_LIMIT)
            ? { key: 'linkLimitRequired', params: { max: MAX_COMBINED_LIMIT } }
            : null;
  // One visible character (emoji presentation selectors do not count, so ❤️ is fine).
  const fillCharError: FieldError =
    f.linkedType === 'equal_length' && f.linkedFillChar !== '' && charCount(f.linkedFillChar) !== 1
      ? { key: 'fillCharOne' }
      : null;
  // App-only checks (never set while the app is off).
  const checkedError: FieldError = !on || type !== 'CHECKBOX_GROUP'
    ? null
    : [minChk, maxChk].some(v => v !== undefined && (Number.isNaN(v) || v > MAX_CHECKED_LIMIT))
      ? { key: 'checkedInvalid', params: { max: MAX_CHECKED_LIMIT } }
      : minChk !== undefined && maxChk !== undefined && minChk > maxChk
        ? { key: 'minAboveMax' }
        : null;
  const optionsError: FieldError =
    on && (type === 'CHECKBOX_GROUP' || (type === 'COLOR_PALETTE' && !ui?.palette_from_option)) && f.optionValues.length === 0
      ? { key: type === 'CHECKBOX_GROUP' ? 'optionsRequired' : 'paletteRequired' }
      : null;
  const advancedErrors = on && (
    !conditionsComplete(f.conditions) ||
    !pricingValid(f.pricing) ||
    (type === 'REPEATER' && !repeatValid(f.repeat)) ||
    (!!ui?.insert_char && charCount(ui.insert_char) !== 1) ||
    (type === 'COLOR_PALETTE' && ui?.palette_from_option === '')
  );
  const hasErrors = !!(nameError || lengthError || patternError || allowedCharsError || linkError || fillCharError ||
    checkedError || optionsError || advancedErrors);
  const tabHasError: Record<string, boolean> = {
    basics: !!(nameError || lengthError || patternError || allowedCharsError || linkError || fillCharError || checkedError || optionsError),
    visibility: !conditionsComplete(f.conditions),
    pricing: !pricingValid(f.pricing),
    repeat: type === 'REPEATER' && !repeatValid(f.repeat),
    display: (!!ui?.insert_char && charCount(ui.insert_char) !== 1) || (type === 'COLOR_PALETTE' && ui?.palette_from_option === ''),
  };
  return {
    trimmedName, minLen, maxLen, maxCombined, minChk, maxChk,
    nameError, lengthError, patternError, allowedCharsError, linkError, fillCharError, checkedError, optionsError,
    advancedErrors, hasErrors, tabHasError,
  };
}
