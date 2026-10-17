import { isPlainObject } from '@/lib/customFields';
import {
  MESSAGE_KEYS,
  TRANSLATION_EXTRA_KEYS,
  TRANSLATION_TEXT_EXTRA_KEYS,
  type MessageKey,
  type PUi,
} from '@/lib/personalization';
import { DEFAULT_REPEAT } from '@/components/apps/personalization/FieldRepeatEditor';
import { emptyExtras, type ExtrasForm } from '@/components/apps/personalization/FieldDisplayEditor';
import type { FieldFormState } from './useFieldForm';
import type {
  CustomField,
  CustomFieldLinkedValidation,
  CustomFieldPayload,
  CustomFieldTranslation,
  CustomFieldValidationRules,
} from './types';

/** `ui` keys that only mean something for some types (dropped on save otherwise). */
const TEXT_UI_KEYS = ['transform', 'counter', 'insert_char', 'limit_to_target'];
const CHECKBOX_UI_KEYS = ['default_checked'];
const PALETTE_UI_KEYS = ['palette_from_option', 'palette_hex'];
const REPEATER_UI_KEYS = ['validation_summary'];

/** Raw link target: `target`, else the legacy `target_field_id`. */
export const rawLinkTarget = (link?: CustomFieldLinkedValidation | null): string =>
  (link?.target || link?.target_field_id || '').trim();

/**
 * Shows a stored link target as a field name: by name first, then by id for
 * legacy rows (never the field itself); unknown targets are shown as stored.
 */
export const linkTargetName = (raw: string, fields: CustomField[], selfId?: string): string => {
  const others = fields.filter(f => !(selfId && f.id === selfId));
  return others.find(f => f.name === raw)?.name ?? others.find(f => f.id === raw)?.name ?? raw;
};

/** True when a stored link target resolves to a sibling (by name, or by id on legacy rows). */
export const linkTargetResolves = (raw: string, fields: CustomField[], selfId?: string): boolean =>
  fields.some(f => !(selfId && f.id === selfId) && (f.name === raw || (!!f.id && f.id === raw)));

/** Deep copy of plain JSON config (so dialog edits never mutate the list rows). */
export const cloneJson = <T,>(v: T): T => (v === undefined || v === null ? v : (JSON.parse(JSON.stringify(v)) as T));

/** A stored extras value worth sending back (non-empty). */
export const hasValue = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(isPlainObject(v) && Object.keys(v).length === 0);

/** Every M4.1 translation key exactly as received (X19 round trip). */
export const receivedExtras = (tr: CustomFieldTranslation | undefined): Partial<CustomFieldTranslation> => {
  const out: Partial<CustomFieldTranslation> = {};
  if (!tr) return out;
  for (const key of TRANSLATION_EXTRA_KEYS) {
    const v = tr[key];
    if (hasValue(v)) (out as Record<string, unknown>)[key] = v;
  }
  return out;
};

/** Translation row in the DTO shape (rows from the API carry id, field_id, ...). */
export const translationDto = (tr: CustomFieldTranslation, extras: Partial<CustomFieldTranslation>): CustomFieldTranslation => ({
  locale: tr.locale,
  label: tr.label,
  ...(tr.placeholder ? { placeholder: tr.placeholder } : {}),
  ...(tr.option_labels && Object.keys(tr.option_labels).length > 0 ? { option_labels: tr.option_labels } : {}),
  ...extras,
});

export const extrasFromTranslation = (tr: CustomFieldTranslation | undefined): ExtrasForm => {
  const messages: Partial<Record<MessageKey, string>> = {};
  if (isPlainObject(tr?.messages)) {
    for (const key of MESSAGE_KEYS) {
      const v = tr.messages[key];
      if (typeof v === 'string') messages[key] = v;
    }
  }
  return {
    display_label: tr?.display_label ?? '',
    sublabel: tr?.sublabel ?? '',
    note: tr?.note ?? '',
    help_text: tr?.help_text ?? '',
    help_image_url: tr?.help_image_url ?? '',
    messages,
  };
};

/**
 * M4.1 translation columns for one locale (X19). App off: exactly what was
 * received. App on: the edited texts; a cleared text sends `null` only when
 * the row had a value, so untouched rows send nothing new. Unknown message
 * keys are kept.
 */
export const extrasPayload = (
  locale: string,
  on: boolean,
  original: CustomField | null,
  localeExtras: Record<string, ExtrasForm>,
): Partial<CustomFieldTranslation> => {
  const orig = original?.translations?.find(tr => tr.locale === locale);
  if (!on) return receivedExtras(orig);
  const form = localeExtras[locale] ?? emptyExtras();
  const out: Partial<CustomFieldTranslation> = {};
  for (const key of TRANSLATION_TEXT_EXTRA_KEYS) {
    const v = form[key].trim();
    if (v) out[key] = v;
    else if (hasValue(orig?.[key])) out[key] = null;
  }
  const messages: Record<string, string> = {};
  if (isPlainObject(orig?.messages)) {
    for (const [k, v] of Object.entries(orig.messages)) {
      if (!(MESSAGE_KEYS as readonly string[]).includes(k) && typeof v === 'string' && v) messages[k] = v;
    }
  }
  for (const key of MESSAGE_KEYS) {
    const v = form.messages[key]?.trim();
    if (v) messages[key] = v;
  }
  if (Object.keys(messages).length > 0) out.messages = messages;
  else if (hasValue(orig?.messages)) out.messages = null;
  return out;
};

/** `ui` without keys that do not apply to the current type (unknown keys kept). */
export const cleanUi = (ui: PUi | null, type: string, isChild: boolean, optionValues: string[]): PUi | null => {
  if (!ui) return null;
  const next: PUi = { ...ui };
  const drop = (keys: string[]) => keys.forEach(k => { delete next[k]; });
  if (type !== 'TEXT' && type !== 'TEXTAREA') drop(TEXT_UI_KEYS);
  if (type !== 'CHECKBOX_GROUP') drop(CHECKBOX_UI_KEYS);
  if (type !== 'COLOR_PALETTE') drop(PALETTE_UI_KEYS);
  if (type !== 'REPEATER') drop(REPEATER_UI_KEYS);
  if (isChild) delete next.placement;
  if (next.default_checked) next.default_checked = next.default_checked.filter(v => optionValues.includes(v));
  return Object.keys(next).length > 0 ? next : null;
};

/**
 * M4.1 field keys (X19). App off: the received non-null values, unchanged.
 * App on: the edited config; `null` clears a stored value.
 */
export const advancedPayload = (
  s: FieldFormState,
  on: boolean,
  optionValues: string[],
  pricedValues: string[],
): Partial<CustomField> => {
  const { original, type, editingId, parentId } = s;
  const isChild = !!parentId;
  const out: Partial<CustomField> = {};
  if (!on) {
    if (original?.conditions != null) out.conditions = original.conditions;
    if (original?.pricing != null) out.pricing = original.pricing;
    if (original?.repeat != null) out.repeat = original.repeat;
    if (original?.ui != null) out.ui = original.ui;
    return out;
  }
  const put = <K extends 'conditions' | 'pricing' | 'repeat' | 'ui'>(key: K, value: CustomField[K] | null) => {
    if (value !== null && value !== undefined) out[key] = value;
    else if (original?.[key] != null) out[key] = null;
  };
  put('conditions', isChild ? null : s.conditions);
  let price = s.pricing;
  if (price?.mode === 'per_option') {
    const prices = Object.fromEntries(Object.entries(price.option_prices ?? {}).filter(([k]) => pricedValues.includes(k)));
    price = { mode: 'per_option', option_prices: prices };
  } else if (price?.mode === 'per_item' && type !== 'REPEATER') {
    price = null;
  }
  put('pricing', price);
  put('repeat', type === 'REPEATER' ? s.repeat ?? DEFAULT_REPEAT : null);
  put('ui', cleanUi(s.ui, type, isChild, optionValues));
  // A new child is created under its repeater; existing rows are never re-parented.
  if (!editingId && parentId) out.parent_id = parentId;
  return out;
};

/** True when the payload carries anything the app gate looks at. */
export const payloadIsAdvanced = (p: CustomFieldPayload): boolean =>
  p.conditions != null || p.pricing != null || p.repeat != null || p.ui != null || !!p.parent_id ||
  (p.translations ?? []).some(tr => TRANSLATION_EXTRA_KEYS.some(k => hasValue(tr[k])));

/** Same payload without any M4.1 key (the API then keeps what is stored, X19). */
export const stripAdvanced = (p: CustomFieldPayload): CustomFieldPayload => {
  const { conditions: _c, pricing: _p, repeat: _r, ui: _u, parent_id: _pid, ...rest } = p;
  void _c; void _p; void _r; void _u; void _pid;
  return {
    ...rest,
    translations: (p.translations ?? []).map(tr => {
      const copy = { ...tr };
      TRANSLATION_EXTRA_KEYS.forEach(k => { delete copy[k]; });
      return copy;
    }),
  };
};

export interface PayloadContext {
  on: boolean;
  locales: string[];
  primaryLocale: string;
  appOnly: boolean;
  hasOptions: boolean;
  optionValues: string[];
  pricedValues: string[];
  /** Parsed numeric inputs (from `validateFieldForm`). */
  trimmedName: string;
  minLen: number | undefined;
  maxLen: number | undefined;
  maxCombined: number | undefined;
  minChk: number | undefined;
  maxChk: number | undefined;
}

/** Assembles the DTO of a save exactly as the dialog sends it. */
export function buildFieldPayload(s: FieldFormState, ctx: PayloadContext): CustomFieldPayload {
  const { on, locales, primaryLocale, appOnly, hasOptions, optionValues, pricedValues } = ctx;
  const { type, editingId, localeData, localeExtras, extraTranslations, original } = s;

  const validationRules: CustomFieldValidationRules = {};
  if (!appOnly) {
    if (ctx.maxLen !== undefined) validationRules.max_length = ctx.maxLen;
    if (ctx.minLen !== undefined) validationRules.min_length = ctx.minLen;
    if (s.pattern) validationRules.pattern = s.pattern;
    if (s.allowedChars) validationRules.allowed_chars = s.allowedChars;
  }
  if (on && type === 'CHECKBOX_GROUP') {
    if (ctx.minChk !== undefined) validationRules.min_checked = ctx.minChk;
    if (ctx.maxChk !== undefined) validationRules.max_checked = ctx.maxChk;
  }

  // Saved by target NAME (K3); fill_char belongs to equal_length, max to max_combined.
  let linkedValidation: CustomFieldLinkedValidation | undefined;
  if (!appOnly && s.linkedType === 'equal_length' && s.linkedTarget) {
    linkedValidation = {
      type: 'equal_length',
      target: s.linkedTarget,
      ...(s.linkedFillChar ? { fill_char: s.linkedFillChar } : {}),
    };
  } else if (!appOnly && s.linkedType === 'max_combined' && s.linkedTarget && ctx.maxCombined !== undefined) {
    linkedValidation = { type: 'max_combined', target: s.linkedTarget, max: ctx.maxCombined };
  }

  // An update must send an explicit null to clear stored rules/links (W5);
  // `undefined` is dropped by JSON and leaves the old value in place. New and
  // not-yet-persisted (temp-) fields simply omit the keys.
  const persisted = !!editingId && !editingId.startsWith('temp-');
  const cleared = persisted ? null : undefined;

  const options = hasOptions && optionValues.length > 0 ? optionValues : undefined;

  // One entry per store locale with a label, plus any untouched rows for locales outside the store list
  const translations: CustomFieldTranslation[] = [
    ...locales
      .filter(locale => localeData[locale]?.label?.trim())
      .map(locale => {
        const data = localeData[locale];
        const placeholder = data.placeholder.trim();
        const optionLabels: Record<string, string> = {};
        (options || []).forEach(opt => {
          const label = data.optionLabels[opt]?.trim();
          if (label) optionLabels[opt] = label;
        });
        return {
          locale,
          label: data.label.trim(),
          ...(placeholder ? { placeholder } : {}),
          ...(Object.keys(optionLabels).length > 0 ? { option_labels: optionLabels } : {}),
          ...extrasPayload(locale, on, original, localeExtras),
        };
      }),
    // Rows loaded from the API carry extra columns (id, field_id, ...);
    // the DTO whitelist rejects unknown keys, so send only the DTO shape.
    ...extraTranslations.map(tr => translationDto(tr, receivedExtras(tr))),
  ];

  const primaryPlaceholder = localeData[primaryLocale]?.placeholder?.trim() || '';

  return {
    name: ctx.trimmedName,
    type,
    is_required: type === 'REPEATER' ? false : s.required,
    placeholder: primaryPlaceholder || undefined,
    options,
    validation_rules: Object.keys(validationRules).length > 0 ? validationRules : cleared,
    linked_validation: linkedValidation ?? cleared,
    translations,
    ...advancedPayload(s, on, optionValues, pricedValues),
  };
}
