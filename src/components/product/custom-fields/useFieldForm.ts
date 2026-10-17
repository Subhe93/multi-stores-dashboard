'use client';

import { useCallback, useMemo, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import {
  isAppOnlyType,
  REPEATER_CHILD_TYPES,
  type OptionConfigLike,
  type PConditions,
  type PPricing,
  type PRepeat,
  type PUi,
} from '@/lib/personalization';
import type { ConditionFieldRef } from '@/components/apps/personalization/FieldConditionsEditor';
import { emptyExtras, type ExtrasForm } from '@/components/apps/personalization/FieldDisplayEditor';
import { cloneJson, extrasFromTranslation, linkTargetName, rawLinkTarget } from './fieldPayload';
import { validateFieldForm, type FieldError, type FieldValidation } from './fieldValidation';
import {
  APP_TYPES_WITH_OPTIONS,
  TYPES_WITH_OPTIONS,
  RTL_LOCALES,
  displayLabelOf,
  emptyLocaleData,
  parseOptions,
  type CustomField,
  type CustomFieldTranslation,
  type FieldTypeOption,
  type LocaleFormData,
} from './types';

/** Everything the add / edit dialog edits (E18: one reducer instead of ~30 `useState`s). */
export interface FieldFormState {
  showForm: boolean;
  editingId: string | null;
  name: string;
  /** Name the field had when the dialog opened; the API only checks uniqueness on rename. */
  originalName: string;
  type: string;
  required: boolean;
  // Per-locale label / placeholder / option labels
  activeLocale: string;
  localeData: Record<string, LocaleFormData>;
  /** Translations for locales that are not part of the store's language list; passed through untouched on save */
  extraTranslations: CustomFieldTranslation[];
  translatingLocale: string;
  maxLength: string;
  minLength: string;
  pattern: string;
  allowedChars: string;
  selectOptions: string;
  // Linked validation
  linkedType: string;
  linkedTarget: string;
  linkedFillChar: string;
  linkedMax: string;
  // Save round-trip (errors are translated from the API code)
  saving: boolean;
  saveError: string;
  // Personalization (M4.1): the row as received (round trip), parent of a
  // repeater child, advanced config and the per-locale texts.
  original: CustomField | null;
  parentId: string | null;
  conditions: PConditions | null;
  pricing: PPricing | null;
  repeat: PRepeat | null;
  ui: PUi | null;
  localeExtras: Record<string, ExtrasForm>;
  minChecked: string;
  maxChecked: string;
  dialogTab: string;
}

interface FormContext {
  locales: string[];
  primaryLocale: string;
}

type Patch = Partial<Omit<FieldFormState, 'localeData' | 'localeExtras'>>;

export type FieldFormAction =
  | { type: 'patch'; patch: Patch }
  | { type: 'reset'; parent: string | null; ctx: FormContext }
  | { type: 'edit'; field: CustomField; fields: CustomField[]; ctx: FormContext }
  | { type: 'localeField'; locale: string; key: 'label' | 'placeholder'; value: string }
  | { type: 'optionLabel'; locale: string; option: string; value: string }
  | { type: 'extras'; locale: string; patch: Partial<ExtrasForm> }
  | {
      type: 'translated';
      locale: string;
      label?: string;
      placeholder?: string;
      /** Option value → translated label (only values that got a translation). */
      optionLabels: Record<string, string>;
      extras: Partial<ExtrasForm>;
    };

const blankForm = (parent: string | null, { locales, primaryLocale }: FormContext): Omit<FieldFormState, 'showForm' | 'saving'> => {
  const data: Record<string, LocaleFormData> = {};
  locales.forEach(l => { data[l] = emptyLocaleData(); });
  return {
    editingId: null,
    name: '', originalName: '', type: 'TEXT', required: false,
    activeLocale: primaryLocale,
    localeData: data,
    extraTranslations: [],
    translatingLocale: '',
    maxLength: '', minLength: '', pattern: '',
    allowedChars: '', selectOptions: '', linkedType: '', linkedTarget: '', linkedFillChar: '',
    linkedMax: '', saveError: '',
    original: null, parentId: parent,
    conditions: null, pricing: null, repeat: null, ui: null,
    localeExtras: {}, minChecked: '', maxChecked: '', dialogTab: 'basics',
  };
};

export const initialFieldForm = (ctx: FormContext): FieldFormState => ({
  showForm: false,
  saving: false,
  ...blankForm(null, ctx),
});

const editForm = (field: CustomField, fields: CustomField[], { locales, primaryLocale }: FormContext): Omit<FieldFormState, 'showForm' | 'saving'> => {
  const data: Record<string, LocaleFormData> = {};
  const extras: Record<string, ExtrasForm> = {};
  locales.forEach(l => {
    const tr = field.translations?.find(x => x.locale === l);
    data[l] = {
      label: tr?.label || '',
      placeholder: tr?.placeholder || '',
      optionLabels: { ...(tr?.option_labels || {}) },
    };
    extras[l] = extrasFromTranslation(tr);
  });
  // Legacy fields may have no row for the primary locale; seed it so the form is saveable
  if (!data[primaryLocale]?.label) {
    data[primaryLocale] = {
      ...(data[primaryLocale] || emptyLocaleData()),
      label: displayLabelOf(field, primaryLocale),
      placeholder: data[primaryLocale]?.placeholder || field.placeholder || '',
    };
  }
  const link = field.linked_validation;
  const linkType = link?.type === 'equal_length' || link?.type === 'max_combined' ? link.type : '';
  return {
    editingId: field.id || null,
    name: field.name,
    originalName: field.name.trim(),
    type: field.type,
    required: field.is_required,
    localeData: data,
    localeExtras: extras,
    extraTranslations: (field.translations || []).filter(tr => !locales.includes(tr.locale)),
    activeLocale: primaryLocale,
    translatingLocale: '',
    maxLength: field.validation_rules?.max_length != null ? String(field.validation_rules.max_length) : '',
    minLength: field.validation_rules?.min_length != null ? String(field.validation_rules.min_length) : '',
    pattern: field.validation_rules?.pattern || '',
    allowedChars: field.validation_rules?.allowed_chars || '',
    minChecked: field.validation_rules?.min_checked != null ? String(field.validation_rules.min_checked) : '',
    maxChecked: field.validation_rules?.max_checked != null ? String(field.validation_rules.max_checked) : '',
    selectOptions: Array.isArray(field.options) ? field.options.join(', ') : '',
    linkedType: linkType,
    // Legacy links may hold a field id; show (and re-save) the sibling's name instead.
    linkedTarget: linkType ? linkTargetName(rawLinkTarget(link), fields, field.id) : '',
    linkedFillChar: link?.fill_char || '',
    linkedMax: link?.max != null ? String(link.max) : '',
    original: field,
    parentId: field.parent_id ?? null,
    conditions: cloneJson(field.conditions ?? null),
    pricing: cloneJson(field.pricing ?? null),
    repeat: cloneJson(field.repeat ?? null),
    ui: cloneJson(field.ui ?? null),
    dialogTab: 'basics',
    saveError: '',
  };
};

export function fieldFormReducer(state: FieldFormState, action: FieldFormAction): FieldFormState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'reset':
      // Same as the old resetForm(): the dialog flag and `saving` are untouched.
      return { ...state, ...blankForm(action.parent, action.ctx) };
    case 'edit':
      return { ...state, ...editForm(action.field, action.fields, action.ctx), showForm: true };
    case 'localeField':
      return {
        ...state,
        localeData: {
          ...state.localeData,
          [action.locale]: { ...(state.localeData[action.locale] || emptyLocaleData()), [action.key]: action.value },
        },
      };
    case 'optionLabel': {
      const current = state.localeData[action.locale] || emptyLocaleData();
      return {
        ...state,
        localeData: {
          ...state.localeData,
          [action.locale]: { ...current, optionLabels: { ...current.optionLabels, [action.option]: action.value } },
        },
      };
    }
    case 'extras':
      return {
        ...state,
        localeExtras: { ...state.localeExtras, [action.locale]: { ...(state.localeExtras[action.locale] || emptyExtras()), ...action.patch } },
      };
    case 'translated': {
      const current = state.localeData[action.locale] || emptyLocaleData();
      const optionLabels = { ...current.optionLabels, ...action.optionLabels };
      const localeData = {
        ...state.localeData,
        [action.locale]: {
          label: action.label || current.label,
          placeholder: action.placeholder || current.placeholder,
          optionLabels,
        },
      };
      const localeExtras = Object.keys(action.extras).length > 0
        ? { ...state.localeExtras, [action.locale]: { ...(state.localeExtras[action.locale] || emptyExtras()), ...action.extras } }
        : state.localeExtras;
      return { ...state, localeData, localeExtras };
    }
    default:
      return state;
  }
}

export interface UseFieldFormArgs {
  fields: CustomField[];
  locales: string[];
  primaryLocale: string;
  on: boolean;
  variantOptions: OptionConfigLike[];
  baseFieldTypes: FieldTypeOption[];
  appFieldTypes: FieldTypeOption[];
}

/** Form state + derived values of the field dialog. */
export function useFieldForm({ fields, locales, primaryLocale, on, variantOptions, baseFieldTypes, appFieldTypes }: UseFieldFormArgs) {
  const t = useTranslations('customField');
  const [state, dispatch] = useReducer(fieldFormReducer, { locales, primaryLocale }, initialFieldForm);
  const ctx = useMemo<FormContext>(() => ({ locales, primaryLocale }), [locales, primaryLocale]);

  const patch = useCallback((p: Patch) => dispatch({ type: 'patch', patch: p }), []);
  const reset = useCallback((parent: string | null = null) => dispatch({ type: 'reset', parent, ctx }), [ctx]);
  const openEdit = useCallback((field: CustomField) => dispatch({ type: 'edit', field, fields, ctx }), [fields, ctx]);
  const setLocaleField = useCallback(
    (locale: string, key: 'label' | 'placeholder', value: string) => dispatch({ type: 'localeField', locale, key, value }),
    [],
  );
  const setOptionLabel = useCallback(
    (locale: string, option: string, value: string) => dispatch({ type: 'optionLabel', locale, option, value }),
    [],
  );
  const setExtras = useCallback((locale: string, p: Partial<ExtrasForm>) => dispatch({ type: 'extras', locale, patch: p }), []);

  const { type, editingId, parentId, selectOptions, ui, linkedTarget, activeLocale } = state;
  const isChild = !!parentId;
  const fieldTypes = !on
    ? baseFieldTypes
    : isChild
      ? [...baseFieldTypes, ...appFieldTypes].filter(ft => (REPEATER_CHILD_TYPES as readonly string[]).includes(ft.value))
      : [...baseFieldTypes, ...appFieldTypes];
  const appOnly = isAppOnlyType(type);
  const hasOptions = (on ? APP_TYPES_WITH_OPTIONS : TYPES_WITH_OPTIONS).includes(type);
  const optionValues = useMemo(() => (hasOptions ? parseOptions(selectOptions) : []), [hasOptions, selectOptions]);
  const primaryLabel = state.localeData[primaryLocale]?.label?.trim() || '';

  // Sibling fields the link may target (never the field itself); targets are saved by name.
  // Names are unique per sibling set (C16): top-level fields, or the children of one repeater.
  const siblings = useMemo(
    () => fields.filter(f => !(editingId && f.id === editingId) && (f.parent_id ?? null) === parentId),
    [fields, editingId, parentId],
  );

  // Top-level fields before the edited one: condition sources and repeater lead fields (D8, D11).
  const earlierFields = useMemo<ConditionFieldRef[]>(() => {
    const top = fields.filter(f => !f.parent_id);
    const idx = editingId ? top.findIndex(f => f.id === editingId) : top.length;
    return top
      .slice(0, idx < 0 ? top.length : idx)
      .filter(f => f.name && f.type !== 'REPEATER')
      .map(f => {
        const tr = f.translations?.find(x => x.locale === primaryLocale) || f.translations?.[0];
        return { name: f.name, label: tr?.label || f.name, options: f.options ?? null };
      });
  }, [fields, editingId, primaryLocale]);

  // Values that can carry a price / palette: the field's options, or the palette option's values.
  const pricedValues = useMemo(() => {
    if (type === 'COLOR_PALETTE' && ui?.palette_from_option) {
      return variantOptions.find(o => o.name === ui.palette_from_option)?.values ?? [];
    }
    return optionValues;
  }, [type, ui, variantOptions, optionValues]);

  const validation: FieldValidation = validateFieldForm({
    on,
    type,
    name: state.name,
    originalName: state.originalName,
    minLength: state.minLength,
    maxLength: state.maxLength,
    pattern: state.pattern,
    allowedChars: state.allowedChars,
    linkedType: state.linkedType,
    linkedTarget,
    linkedFillChar: state.linkedFillChar,
    linkedMax: state.linkedMax,
    minChecked: state.minChecked,
    maxChecked: state.maxChecked,
    optionValues,
    conditions: state.conditions,
    pricing: state.pricing,
    repeat: state.repeat,
    ui,
    siblings,
  });
  const errorText = (e: FieldError): string => (e ? t(e.key, e.params) : '');
  const errors = {
    name: errorText(validation.nameError),
    length: errorText(validation.lengthError),
    pattern: errorText(validation.patternError),
    allowedChars: errorText(validation.allowedCharsError),
    link: errorText(validation.linkError),
    fillChar: errorText(validation.fillCharError),
    checked: errorText(validation.checkedError),
    options: errorText(validation.optionsError),
  };
  const canSave = !!validation.trimmedName && !!primaryLabel && !validation.hasErrors && !state.saving;

  // Target picker: sibling names; a dangling stored target stays visible so it is not lost silently.
  const targetOptions = useMemo(() => {
    const opts: FieldTypeOption[] = siblings
      .filter(f => f.name)
      .map(f => {
        const tr = f.translations?.find(x => x.locale === primaryLocale) || f.translations?.[0];
        return { value: f.name, label: f.name, description: tr?.label && tr.label !== f.name ? tr.label : undefined };
      });
    if (linkedTarget && !opts.some(o => o.value === linkedTarget)) {
      opts.push({ value: linkedTarget, label: linkedTarget, description: t('linkTargetMissing') });
    }
    return opts;
  }, [siblings, linkedTarget, primaryLocale, t]);
  const isRtl = RTL_LOCALES.includes(activeLocale);

  // Tabs of the app-on dialog; Visibility is top-level only, Repeat is REPEATER only.
  const dialogTabs = [
    { key: 'basics', label: t('tabs.basics') },
    ...(!isChild ? [{ key: 'visibility', label: t('tabs.visibility') }] : []),
    { key: 'pricing', label: t('tabs.pricing') },
    ...(type === 'REPEATER' ? [{ key: 'repeat', label: t('tabs.repeat') }] : []),
    { key: 'display', label: t('tabs.display') },
  ];
  const activeDialogTab = dialogTabs.some(tab => tab.key === state.dialogTab) ? state.dialogTab : 'basics';

  return {
    state,
    dispatch,
    patch,
    reset,
    openEdit,
    setLocaleField,
    setOptionLabel,
    setExtras,
    isChild,
    fieldTypes,
    appOnly,
    hasOptions,
    optionValues,
    primaryLabel,
    siblings,
    earlierFields,
    pricedValues,
    validation,
    errors,
    canSave,
    targetOptions,
    isRtl,
    dialogTabs,
    activeDialogTab,
  };
}

export type FieldForm = ReturnType<typeof useFieldForm>;
