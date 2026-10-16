'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import {
  Plus, Trash2, GripVertical, Pencil, Languages, Loader2, AlertTriangle,
  Sparkles, Library, BookmarkPlus, Lock, CornerDownRight, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useCurrency } from '@/lib/useCurrency';
import { useImageUpload } from '@/lib/useImageUpload';
import { charCount, isPlainObject, isValidAllowedChars, isValidPattern } from '@/lib/customFields';
import {
  isAppOnlyType,
  readConfigIssues,
  readErrorParamList,
  saveFieldToLibrary,
  MAX_CHECKED_LIMIT,
  MESSAGE_KEYS,
  REPEATER_CHILD_TYPES,
  TEMPLATE_NAME_MAX,
  TRANSLATION_EXTRA_KEYS,
  TRANSLATION_TEXT_EXTRA_KEYS,
  type MessageKey,
  type OptionConfigLike,
  type PConditions,
  type PPricing,
  type PRepeat,
  type PUi,
} from '@/lib/personalization';
import { FieldConditionsEditor, conditionsComplete, type ConditionFieldRef } from '@/components/apps/personalization/FieldConditionsEditor';
import { FieldPricingEditor, pricingValid } from '@/components/apps/personalization/FieldPricingEditor';
import { FieldRepeatEditor, repeatValid, DEFAULT_REPEAT } from '@/components/apps/personalization/FieldRepeatEditor';
import { FieldDisplayEditor, emptyExtras, type ExtrasForm } from '@/components/apps/personalization/FieldDisplayEditor';
import { ApplyPresetDialog } from '@/components/apps/personalization/ApplyPresetDialog';
import { InsertTemplateDialog } from '@/components/apps/personalization/InsertTemplateDialog';
import { useConfigIssueText } from '@/components/apps/personalization/useConfigIssueText';

export interface CustomFieldTranslation {
  locale: string;
  label: string;
  placeholder?: string;
  /** Display label per option value (SELECT fields) */
  option_labels?: Record<string, string>;
  // M4.1 columns (C6). Round-tripped on every save, app on or off (X19).
  display_label?: string | null;
  sublabel?: string | null;
  note?: string | null;
  help_text?: string | null;
  help_image_url?: string | null;
  messages?: Record<string, string> | null;
}

/** Validation constraints stored on a custom field (all optional) */
export interface CustomFieldValidationRules {
  max_length?: number;
  min_length?: number;
  pattern?: string;
  allowed_chars?: string;
  /** CHECKBOX_GROUP bounds (M4.1, C17). */
  min_checked?: number;
  max_checked?: number;
}

/**
 * Cross-field validation (M4.0 K3/C16): links this field's value to a sibling
 * field by its `name`. Saved as `{type, target, fill_char?}` (equal_length) or
 * `{type, target, max}` (max_combined). Legacy rows carry `target_field_id`
 * (a name, or an id on very old rows) and are still read.
 */
export interface CustomFieldLinkedValidation {
  type: string;
  target?: string;
  /** Legacy key; read only. */
  target_field_id?: string;
  fill_char?: string;
  max?: number;
}

export interface CustomField {
  id?: string;
  name: string;
  type: string;
  is_required: boolean;
  placeholder?: string;
  /** Option values for SELECT fields */
  options?: string[] | null;
  /** `null` clears the stored rules on update (M4.0 W5). */
  validation_rules?: CustomFieldValidationRules | null;
  /** `null` clears the stored link on update (M4.0 W5). */
  linked_validation?: CustomFieldLinkedValidation | null;
  sort_order: number;
  translations?: CustomFieldTranslation[];
  // Personalization app (M4.1 §2). Round-tripped by every save (X19).
  /** REPEATER child → parent id (temp id while the product is being created). */
  parent_id?: string | null;
  conditions?: PConditions | null;
  pricing?: PPricing | null;
  repeat?: PRepeat | null;
  ui?: PUi | null;
  /** Read only (set by presets / the importer). */
  preset_key?: string | null;
  preset_ref?: string | null;
}

interface CustomFieldManagerProps {
  fields: CustomField[];
  /** May return a promise; a rejection keeps the dialog open and shows the translated error. */
  onAdd: (field: Omit<CustomField, 'sort_order'>) => void | Promise<void>;
  onUpdate?: (id: string, field: Omit<CustomField, 'sort_order'>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  /**
   * New order of one sibling set (top-level fields or the sub-fields of one
   * repeater). A rejection must restore the previous order; the error is shown.
   */
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  /** Store content locales (primary first). Defaults to ['en'] when the store config is not loaded yet. */
  locales?: string[];
  primaryLocale?: string;
  /**
   * The personalization app is on for this product (creator's own product,
   * D2). Off = today's editor; advanced data received is still round-tripped.
   */
  personalization?: boolean;
  /** Variant options of the product as currently edited (conditions, repeat, palettes). */
  variantOptions?: OptionConfigLike[];
  /** Persisted product id; enables "Apply preset" and "From library" (edit mode only). */
  productId?: string;
  /** Called after a preset or library insert so the caller reloads the fields. */
  onFieldsChanged?: () => void | Promise<void>;
}

/** Per-locale editable data for a single custom field */
interface LocaleFormData {
  label: string;
  placeholder: string;
  optionLabels: Record<string, string>;
}

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska',
};
const RTL_LOCALES = ['ar'];

/** Field types whose `options` array is edited in the dialog */
const TYPES_WITH_OPTIONS = ['SELECT'];
/** With the app on, checkbox groups and static palettes have options too. */
const APP_TYPES_WITH_OPTIONS = ['SELECT', 'CHECKBOX_GROUP', 'COLOR_PALETTE'];

/** `ui` keys that only mean something for some types (dropped on save otherwise). */
const TEXT_UI_KEYS = ['transform', 'counter', 'insert_char', 'limit_to_target'];
const CHECKBOX_UI_KEYS = ['default_checked'];
const PALETTE_UI_KEYS = ['palette_from_option', 'palette_hex'];
const REPEATER_UI_KEYS = ['validation_summary'];

const parseOptions = (raw: string): string[] =>
  raw.split(',').map(s => s.trim()).filter(Boolean);

const emptyLocaleData = (): LocaleFormData => ({ label: '', placeholder: '', optionLabels: {} });

/** API bounds of the DTO (M4.0 §3.2). */
const MAX_RULE_LENGTH = 5000;
const MAX_COMBINED_LIMIT = 1000;

/** Raw link target: `target`, else the legacy `target_field_id`. */
const rawLinkTarget = (link?: CustomFieldLinkedValidation | null): string =>
  (link?.target || link?.target_field_id || '').trim();

/**
 * Shows a stored link target as a field name: by name first, then by id for
 * legacy rows (never the field itself); unknown targets are shown as stored.
 */
const linkTargetName = (raw: string, fields: CustomField[], selfId?: string): string => {
  const others = fields.filter(f => !(selfId && f.id === selfId));
  return others.find(f => f.name === raw)?.name ?? others.find(f => f.id === raw)?.name ?? raw;
};

/** True when a stored link target resolves to a sibling (by name, or by id on legacy rows). */
const linkTargetResolves = (raw: string, fields: CustomField[], selfId?: string): boolean =>
  fields.some(f => !(selfId && f.id === selfId) && (f.name === raw || (!!f.id && f.id === raw)));

/** The API reports a pattern it refuses as too slow (ReDoS) with `params.reason = 'unsafe'`. */
const isUnsafePatternError = (err: unknown): boolean => {
  if (!(err instanceof ApiError) || err.code !== 'CUSTOM_FIELD_INVALID_PATTERN') return false;
  const params = err.payload?.params as { reason?: unknown } | undefined;
  return params?.reason === 'unsafe';
};

/** Strictly parses a non-negative integer input; '' → undefined, invalid → NaN. */
const parseIntInput = (raw: string): number | undefined => {
  const v = raw.trim();
  if (v === '') return undefined;
  return /^\d+$/.test(v) ? parseInt(v, 10) : NaN;
};

/** Deep copy of plain JSON config (so dialog edits never mutate the list rows). */
const cloneJson = <T,>(v: T): T => (v === undefined || v === null ? v : (JSON.parse(JSON.stringify(v)) as T));

/** A stored extras value worth sending back (non-empty). */
const hasValue = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(isPlainObject(v) && Object.keys(v).length === 0);

/** Every M4.1 translation key exactly as received (X19 round trip). */
const receivedExtras = (tr: CustomFieldTranslation | undefined): Partial<CustomFieldTranslation> => {
  const out: Partial<CustomFieldTranslation> = {};
  if (!tr) return out;
  for (const key of TRANSLATION_EXTRA_KEYS) {
    const v = tr[key];
    if (hasValue(v)) (out as Record<string, unknown>)[key] = v;
  }
  return out;
};

/** Translation row in the DTO shape (rows from the API carry id, field_id, ...). */
const translationDto = (tr: CustomFieldTranslation, extras: Partial<CustomFieldTranslation>): CustomFieldTranslation => ({
  locale: tr.locale,
  label: tr.label,
  ...(tr.placeholder ? { placeholder: tr.placeholder } : {}),
  ...(tr.option_labels && Object.keys(tr.option_labels).length > 0 ? { option_labels: tr.option_labels } : {}),
  ...extras,
});

const extrasFromTranslation = (tr: CustomFieldTranslation | undefined): ExtrasForm => {
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

export function CustomFieldManager({
  fields,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  locales = ['en'],
  primaryLocale = 'en',
  personalization = false,
  variantOptions = [],
  productId,
  onFieldsChanged,
}: CustomFieldManagerProps) {
  const t = useTranslations();
  const apiError = useApiError();
  const describeIssues = useConfigIssueText();
  const { token } = useAuth();
  const { currency } = useCurrency();
  const { pickAndUpload, uploading } = useImageUpload(token);
  const on = personalization;
  const baseFieldTypes = [
    { value: 'TEXT', label: t('customField.typeText'), description: t('customField.typeTextDesc') },
    { value: 'TEXTAREA', label: t('customField.typeTextarea'), description: t('customField.typeTextareaDesc') },
    { value: 'NUMBER', label: t('customField.typeNumber'), description: t('customField.typeNumberDesc') },
    { value: 'IMAGE', label: t('customField.typeImage'), description: t('customField.typeImageDesc') },
    { value: 'FILE', label: t('customField.typeFile'), description: t('customField.typeFileDesc') },
    { value: 'SELECT', label: t('customField.typeSelect'), description: t('customField.typeSelectDesc') },
    { value: 'COLOR', label: t('customField.typeColor'), description: t('customField.typeColorDesc') },
    { value: 'DATE', label: t('customField.typeDate'), description: t('customField.typeDateDesc') },
    { value: 'MULTI_IMAGE', label: t('customField.typeMultiImage'), description: t('customField.typeMultiImageDesc') },
  ];
  const appFieldTypes = [
    { value: 'CHECKBOX_GROUP', label: t('customField.typeCheckboxGroup'), description: t('customField.typeCheckboxGroupDesc') },
    { value: 'COLOR_PALETTE', label: t('customField.typeColorPalette'), description: t('customField.typeColorPaletteDesc') },
    { value: 'REPEATER', label: t('customField.typeRepeater'), description: t('customField.typeRepeaterDesc') },
  ];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  // Name the field had when the dialog opened; the API only checks uniqueness on rename.
  const [originalName, setOriginalName] = useState('');
  const [type, setType] = useState('TEXT');
  const [required, setRequired] = useState(false);
  // Per-locale label / placeholder / option labels
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const [localeData, setLocaleData] = useState<Record<string, LocaleFormData>>({});
  // Translations for locales that are not part of the store's language list; passed through untouched on save
  const [extraTranslations, setExtraTranslations] = useState<CustomFieldTranslation[]>([]);
  const [translatingLocale, setTranslatingLocale] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [minLength, setMinLength] = useState('');
  const [pattern, setPattern] = useState('');
  const [allowedChars, setAllowedChars] = useState('');
  const [selectOptions, setSelectOptions] = useState('');
  // Linked validation
  const [linkedType, setLinkedType] = useState('');
  const [linkedTarget, setLinkedTarget] = useState('');
  const [linkedFillChar, setLinkedFillChar] = useState('');
  const [linkedMax, setLinkedMax] = useState('');
  // Save / delete round-trips (errors are translated from the API code)
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [listError, setListError] = useState('');
  // Personalization (M4.1): the row as received (round trip), parent of a
  // repeater child, advanced config and the per-locale texts.
  const [original, setOriginal] = useState<CustomField | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<PConditions | null>(null);
  const [pricing, setPricing] = useState<PPricing | null>(null);
  const [repeat, setRepeat] = useState<PRepeat | null>(null);
  const [ui, setUi] = useState<PUi | null>(null);
  const [localeExtras, setLocaleExtras] = useState<Record<string, ExtrasForm>>({});
  const [minChecked, setMinChecked] = useState('');
  const [maxChecked, setMaxChecked] = useState('');
  const [dialogTab, setDialogTab] = useState('basics');
  const [presetOpen, setPresetOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryField, setLibraryField] = useState<CustomField | null>(null);
  const [libraryName, setLibraryName] = useState('');
  const [librarySaving, setLibrarySaving] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [notice, setNotice] = useState('');

  const isChild = !!parentId;
  const fieldTypes = !on
    ? baseFieldTypes
    : isChild
      ? [...baseFieldTypes, ...appFieldTypes].filter(ft => (REPEATER_CHILD_TYPES as readonly string[]).includes(ft.value))
      : [...baseFieldTypes, ...appFieldTypes];
  const appOnly = isAppOnlyType(type);
  const hasOptions = (on ? APP_TYPES_WITH_OPTIONS : TYPES_WITH_OPTIONS).includes(type);
  const optionValues = useMemo(() => (hasOptions ? parseOptions(selectOptions) : []), [hasOptions, selectOptions]);
  const primaryLabel = localeData[primaryLocale]?.label?.trim() || '';

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

  // Live checks with friendly messages; the API repeats them on save (M4.0 §3.2).
  const trimmedName = name.trim();
  const minLen = parseIntInput(minLength);
  const maxLen = parseIntInput(maxLength);
  const maxCombined = parseIntInput(linkedMax);
  const minChk = parseIntInput(minChecked);
  const maxChk = parseIntInput(maxChecked);
  // Legacy products may already hold duplicate names; only a changed name is checked.
  const nameError =
    trimmedName && trimmedName !== originalName && siblings.some(f => f.name === trimmedName)
      ? t('customField.nameTaken')
      : '';
  const lengthError =
    [minLen, maxLen].some(v => v !== undefined && (Number.isNaN(v) || v > MAX_RULE_LENGTH))
      ? t('customField.invalidLength', { max: MAX_RULE_LENGTH })
      : minLen !== undefined && maxLen !== undefined && minLen > maxLen
        ? t('customField.minAboveMax')
        : '';
  const patternError = pattern && !isValidPattern(pattern) ? t('customField.invalidPattern') : '';
  const allowedCharsError = allowedChars && !isValidAllowedChars(allowedChars)
    ? t('customField.invalidAllowedChars')
    : '';
  const linkError = !linkedType
    ? ''
    : !linkedTarget
      ? t('customField.linkTargetRequired')
      : linkedTarget === trimmedName
        ? t('customField.linkTargetSelf')
        : !siblings.some(f => f.name === linkedTarget)
          ? t('customField.linkTargetMissing')
          : linkedType === 'max_combined' &&
              (maxCombined === undefined || Number.isNaN(maxCombined) || maxCombined < 1 || maxCombined > MAX_COMBINED_LIMIT)
            ? t('customField.linkLimitRequired', { max: MAX_COMBINED_LIMIT })
            : '';
  // One visible character (emoji presentation selectors do not count, so ❤️ is fine).
  const fillCharError =
    linkedType === 'equal_length' && linkedFillChar !== '' && charCount(linkedFillChar) !== 1
      ? t('customField.fillCharOne')
      : '';
  // App-only checks (never set while the app is off).
  const checkedError = !on || type !== 'CHECKBOX_GROUP'
    ? ''
    : [minChk, maxChk].some(v => v !== undefined && (Number.isNaN(v) || v > MAX_CHECKED_LIMIT))
      ? t('customField.checkedInvalid', { max: MAX_CHECKED_LIMIT })
      : minChk !== undefined && maxChk !== undefined && minChk > maxChk
        ? t('customField.minAboveMax')
        : '';
  const optionsError = on && (type === 'CHECKBOX_GROUP' || (type === 'COLOR_PALETTE' && !ui?.palette_from_option)) && optionValues.length === 0
    ? (type === 'CHECKBOX_GROUP' ? t('customField.optionsRequired') : t('customField.paletteRequired'))
    : '';
  const advancedErrors = on && (
    !conditionsComplete(conditions) ||
    !pricingValid(pricing) ||
    (type === 'REPEATER' && !repeatValid(repeat)) ||
    (!!ui?.insert_char && charCount(ui.insert_char) !== 1) ||
    (type === 'COLOR_PALETTE' && ui?.palette_from_option === '')
  );
  const hasErrors = !!(nameError || lengthError || patternError || allowedCharsError || linkError || fillCharError ||
    checkedError || optionsError || advancedErrors);
  const canSave = !!trimmedName && !!primaryLabel && !hasErrors && !saving;

  // Target picker: sibling names; a dangling stored target stays visible so it is not lost silently.
  const targetOptions = useMemo(() => {
    const opts: { value: string; label: string; description?: string }[] = siblings
      .filter(f => f.name)
      .map(f => {
        const tr = f.translations?.find(x => x.locale === primaryLocale) || f.translations?.[0];
        return { value: f.name, label: f.name, description: tr?.label && tr.label !== f.name ? tr.label : undefined };
      });
    if (linkedTarget && !opts.some(o => o.value === linkedTarget)) {
      opts.push({ value: linkedTarget, label: linkedTarget, description: t('customField.linkTargetMissing') });
    }
    return opts;
  }, [siblings, linkedTarget, primaryLocale, t]);
  const isRtl = RTL_LOCALES.includes(activeLocale);
  const localeName = (locale: string) => LOCALE_LABELS[locale] || locale.toUpperCase();

  const setLocaleField = (locale: string, key: 'label' | 'placeholder', value: string) =>
    setLocaleData(prev => ({
      ...prev,
      [locale]: { ...(prev[locale] || emptyLocaleData()), [key]: value },
    }));

  const setOptionLabel = (locale: string, option: string, value: string) =>
    setLocaleData(prev => {
      const current = prev[locale] || emptyLocaleData();
      return {
        ...prev,
        [locale]: { ...current, optionLabels: { ...current.optionLabels, [option]: value } },
      };
    });

  const setExtras = (locale: string, patch: Partial<ExtrasForm>) =>
    setLocaleExtras(prev => ({ ...prev, [locale]: { ...(prev[locale] || emptyExtras()), ...patch } }));

  const resetForm = (parent: string | null = null) => {
    setEditingId(null);
    setName(''); setOriginalName(''); setType('TEXT'); setRequired(false);
    const data: Record<string, LocaleFormData> = {};
    locales.forEach(l => { data[l] = emptyLocaleData(); });
    setLocaleData(data);
    setExtraTranslations([]);
    setActiveLocale(primaryLocale);
    setTranslatingLocale('');
    setMaxLength(''); setMinLength(''); setPattern('');
    setAllowedChars(''); setSelectOptions(''); setLinkedType(''); setLinkedTarget(''); setLinkedFillChar('');
    setLinkedMax(''); setSaveError('');
    setOriginal(null); setParentId(parent);
    setConditions(null); setPricing(null); setRepeat(null); setUi(null);
    setLocaleExtras({}); setMinChecked(''); setMaxChecked(''); setDialogTab('basics');
  };

  /** Resolve the best translation for display: primary locale → en → first → nothing */
  const resolveTranslation = (field: CustomField): CustomFieldTranslation | undefined =>
    field.translations?.find(tr => tr.locale === primaryLocale) ||
    field.translations?.find(tr => tr.locale === 'en') ||
    field.translations?.[0];

  const displayLabel = (field: CustomField) => resolveTranslation(field)?.label || field.name;

  const openEdit = (field: CustomField) => {
    setEditingId(field.id || null);
    setName(field.name);
    setOriginalName(field.name.trim());
    setType(field.type);
    setRequired(field.is_required);
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
        label: displayLabel(field),
        placeholder: data[primaryLocale]?.placeholder || field.placeholder || '',
      };
    }
    setLocaleData(data);
    setLocaleExtras(extras);
    setExtraTranslations((field.translations || []).filter(tr => !locales.includes(tr.locale)));
    setActiveLocale(primaryLocale);
    setTranslatingLocale('');
    setMaxLength(field.validation_rules?.max_length != null ? String(field.validation_rules.max_length) : '');
    setMinLength(field.validation_rules?.min_length != null ? String(field.validation_rules.min_length) : '');
    setPattern(field.validation_rules?.pattern || '');
    setAllowedChars(field.validation_rules?.allowed_chars || '');
    setMinChecked(field.validation_rules?.min_checked != null ? String(field.validation_rules.min_checked) : '');
    setMaxChecked(field.validation_rules?.max_checked != null ? String(field.validation_rules.max_checked) : '');
    setSelectOptions(Array.isArray(field.options) ? field.options.join(', ') : '');
    const link = field.linked_validation;
    const linkType = link?.type === 'equal_length' || link?.type === 'max_combined' ? link.type : '';
    setLinkedType(linkType);
    // Legacy links may hold a field id; show (and re-save) the sibling's name instead.
    setLinkedTarget(linkType ? linkTargetName(rawLinkTarget(link), fields, field.id) : '');
    setLinkedFillChar(link?.fill_char || '');
    setLinkedMax(link?.max != null ? String(link.max) : '');
    setOriginal(field);
    setParentId(field.parent_id ?? null);
    setConditions(cloneJson(field.conditions ?? null));
    setPricing(cloneJson(field.pricing ?? null));
    setRepeat(cloneJson(field.repeat ?? null));
    setUi(cloneJson(field.ui ?? null));
    setDialogTab('basics');
    setSaveError('');
    setShowForm(true);
  };

  const translateText = (text: string, targetLocale: string) =>
    api<{ translated: string }>('/translations/translate-text', {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify({ text, source_locale: primaryLocale, target_locale: targetLocale }),
    });

  /** Translate label, placeholder and option labels from the primary locale into the target locale */
  const handleTranslateTo = async (targetLocale: string) => {
    const source = localeData[primaryLocale];
    if (!source?.label.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      const labelTask = translateText(source.label, targetLocale);
      const placeholderTask = source.placeholder.trim()
        ? translateText(source.placeholder, targetLocale)
        : Promise.resolve<{ translated: string } | null>(null);
      const optionTasks = optionValues.map(opt =>
        translateText(source.optionLabels[opt]?.trim() || opt, targetLocale),
      );
      // With the app on, the help texts are translated too.
      const sourceExtras = localeExtras[primaryLocale];
      const extraKeys = on && sourceExtras
        ? (['display_label', 'sublabel', 'note', 'help_text'] as const).filter(k => sourceExtras[k].trim())
        : [];
      const extraTasks = extraKeys.map(k => translateText(sourceExtras![k], targetLocale));
      const [labelRes, placeholderRes, ...rest] = await Promise.all([labelTask, placeholderTask, ...optionTasks, ...extraTasks]);
      const optionRes = rest.slice(0, optionTasks.length);
      const extraRes = rest.slice(optionTasks.length);
      setLocaleData(prev => {
        const current = prev[targetLocale] || emptyLocaleData();
        const optionLabels = { ...current.optionLabels };
        optionValues.forEach((opt, i) => {
          const translated = optionRes[i]?.translated;
          if (translated) optionLabels[opt] = translated;
        });
        return {
          ...prev,
          [targetLocale]: {
            label: labelRes?.translated || current.label,
            placeholder: placeholderRes?.translated || current.placeholder,
            optionLabels,
          },
        };
      });
      if (extraKeys.length > 0) {
        const patch: Partial<ExtrasForm> = {};
        extraKeys.forEach((k, i) => {
          const translated = extraRes[i]?.translated;
          if (translated) patch[k] = translated;
        });
        setExtras(targetLocale, patch);
      }
    } catch {
      // silent
    } finally {
      setTranslatingLocale('');
    }
  };

  /**
   * M4.1 translation columns for one locale (X19). App off: exactly what was
   * received. App on: the edited texts; a cleared text sends `null` only when
   * the row had a value, so untouched rows send nothing new. Unknown message
   * keys are kept.
   */
  const extrasPayload = (locale: string): Partial<CustomFieldTranslation> => {
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
  const cleanUi = (): PUi | null => {
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
  const advancedPayload = (): Partial<CustomField> => {
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
    put('conditions', isChild ? null : conditions);
    let price = pricing;
    if (price?.mode === 'per_option') {
      const prices = Object.fromEntries(Object.entries(price.option_prices ?? {}).filter(([k]) => pricedValues.includes(k)));
      price = { mode: 'per_option', option_prices: prices };
    } else if (price?.mode === 'per_item' && type !== 'REPEATER') {
      price = null;
    }
    put('pricing', price);
    put('repeat', type === 'REPEATER' ? repeat ?? DEFAULT_REPEAT : null);
    put('ui', cleanUi());
    // A new child is created under its repeater; existing rows are never re-parented.
    if (!editingId && parentId) out.parent_id = parentId;
    return out;
  };

  /** True when the payload carries anything the app gate looks at. */
  const payloadIsAdvanced = (p: Omit<CustomField, 'sort_order'>): boolean =>
    p.conditions != null || p.pricing != null || p.repeat != null || p.ui != null || !!p.parent_id ||
    (p.translations ?? []).some(tr => TRANSLATION_EXTRA_KEYS.some(k => hasValue(tr[k])));

  /** Same payload without any M4.1 key (the API then keeps what is stored, X19). */
  const stripAdvanced = (p: Omit<CustomField, 'sort_order'>): Omit<CustomField, 'sort_order'> => {
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

  const handleSave = async () => {
    if (!canSave) return;

    const validationRules: CustomFieldValidationRules = {};
    if (!appOnly) {
      if (maxLen !== undefined) validationRules.max_length = maxLen;
      if (minLen !== undefined) validationRules.min_length = minLen;
      if (pattern) validationRules.pattern = pattern;
      if (allowedChars) validationRules.allowed_chars = allowedChars;
    }
    if (on && type === 'CHECKBOX_GROUP') {
      if (minChk !== undefined) validationRules.min_checked = minChk;
      if (maxChk !== undefined) validationRules.max_checked = maxChk;
    }

    // Saved by target NAME (K3); fill_char belongs to equal_length, max to max_combined.
    let linkedValidation: CustomFieldLinkedValidation | undefined;
    if (!appOnly && linkedType === 'equal_length' && linkedTarget) {
      linkedValidation = {
        type: 'equal_length',
        target: linkedTarget,
        ...(linkedFillChar ? { fill_char: linkedFillChar } : {}),
      };
    } else if (!appOnly && linkedType === 'max_combined' && linkedTarget && maxCombined !== undefined) {
      linkedValidation = { type: 'max_combined', target: linkedTarget, max: maxCombined };
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
            ...extrasPayload(locale),
          };
        }),
      // Rows loaded from the API carry extra columns (id, field_id, ...);
      // the DTO whitelist rejects unknown keys, so send only the DTO shape.
      ...extraTranslations.map(tr => translationDto(tr, receivedExtras(tr))),
    ];

    const primaryPlaceholder = localeData[primaryLocale]?.placeholder?.trim() || '';

    const fieldData: Omit<CustomField, 'sort_order'> = {
      name: trimmedName,
      type,
      is_required: type === 'REPEATER' ? false : required,
      placeholder: primaryPlaceholder || undefined,
      options,
      validation_rules: Object.keys(validationRules).length > 0 ? validationRules : cleared,
      linked_validation: linkedValidation ?? cleared,
      translations,
      ...advancedPayload(),
    };

    const send = (payload: Omit<CustomField, 'sort_order'>) =>
      editingId && onUpdate ? onUpdate(editingId, payload) : onAdd(payload);

    setSaving(true);
    setSaveError('');
    try {
      try {
        await send(fieldData);
      } catch (err) {
        // App off and the API refuses to accept the round-tripped M4.1 data:
        // save without it; the API keeps the stored values (X19 carry-over).
        if (!on && err instanceof ApiError && err.code === 'PERSONALIZATION_APP_REQUIRED' && payloadIsAdvanced(fieldData)) {
          await send(stripAdvanced(fieldData));
        } else {
          throw err;
        }
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      // Keep the dialog open so the merchant can fix the field.
      if (isUnsafePatternError(err)) {
        setSaveError(t('customField.patternUnsafe'));
      } else {
        const issues = err instanceof ApiError ? readConfigIssues(err.payload) : [];
        const { lines, firstArea } = describeIssues(issues);
        // Jump to the tab of the first issue; unknown tabs fall back to Basics.
        if (firstArea && firstArea !== 'productOptions') setDialogTab(firstArea);
        setSaveError([apiError(err), ...lines].join('\n'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setListError('');
    try {
      await onDelete(id);
    } catch (err) {
      // 409 PERSONALIZATION_FIELD_IN_USE names the fields that depend on this one.
      const dependents = err instanceof ApiError && err.code === 'PERSONALIZATION_FIELD_IN_USE'
        ? readErrorParamList(err.payload, 'fields')
        : [];
      setListError([
        apiError(err),
        dependents.length > 0 ? t('customField.fieldInUseDetail', { fields: dependents.join(', ') }) : '',
      ].filter(Boolean).join('\n'));
    }
  };

  // Moves a field one step within its sibling set; the caller persists and
  // restores the previous order when the API refuses it.
  const handleMove = async (siblings: CustomField[], index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (!onReorder || target < 0 || target >= siblings.length) return;
    const ids = siblings.map(f => f.id).filter((id): id is string => !!id);
    if (ids.length !== siblings.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setListError('');
    try {
      await onReorder(ids);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PERSONALIZATION_CONFIG_INVALID') {
        const issues = readConfigIssues(err.payload);
        const forward = issues.length === 0 || issues.some(issue => issue.code === 'FORWARD_REFERENCE');
        setListError([
          forward ? t('customField.reorderForwardReference') : apiError(err),
          ...describeIssues(issues, { optionNames: variantOptions.map(o => o.name) }).lines,
        ].join('\n'));
      } else {
        setListError(apiError(err));
      }
    }
  };

  const openSaveToLibrary = (field: CustomField) => {
    setLibraryField(field);
    setLibraryName(displayLabel(field).slice(0, TEMPLATE_NAME_MAX));
    setLibraryError('');
  };

  const handleSaveToLibrary = async () => {
    if (!libraryField?.id || !token || !libraryName.trim() || librarySaving) return;
    setLibrarySaving(true);
    setLibraryError('');
    try {
      await saveFieldToLibrary(token, libraryField.id, libraryName.trim());
      setLibraryField(null);
      setNotice(t('customField.savedToLibrary'));
    } catch (err) {
      const issues = err instanceof ApiError ? readConfigIssues(err.payload) : [];
      setLibraryError([apiError(err), ...describeIssues(issues).lines].join('\n'));
    } finally {
      setLibrarySaving(false);
    }
  };

  const afterInsert = async (count: number) => {
    setNotice(t('customField.fieldsInserted', { count }));
    await onFieldsChanged?.();
  };

  const allTypeLabels = [...baseFieldTypes, ...appFieldTypes];
  const typeIcon = (value: string) => allTypeLabels.find(ft => ft.value === value)?.label || value;

  // Repeater children are listed under their parent; orphans stay top-level.
  const topLevelFields = fields
    .filter(f => !f.parent_id || !fields.some(p => p.id === f.parent_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const childrenOf = (id?: string) =>
    id ? fields.filter(f => f.parent_id === id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) : [];
  // With the app off, fields only the app can use are delete-only (D10).
  const lockedWhenOff = (field: CustomField) => !on && (isAppOnlyType(field.type) || !!field.parent_id);
  const persistedId = (field: CustomField) => !!field.id && !field.id.startsWith('temp-');

  const renderFieldRow = (field: CustomField, i: number, child: boolean, siblings: CustomField[]) => {
    const locked = lockedWhenOff(field);
    const canMove = !!onReorder && siblings.length > 1;
    return (
      <div key={field.id || i} className={`flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border group ${child ? 'bg-white' : ''}`}>
        {child
          ? <CornerDownRight className="w-4 h-4 text-zinc-300 shrink-0 rtl:-scale-x-100" />
          : <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{displayLabel(field)}</p>
            <Badge variant="secondary" className="text-[9px] shrink-0">{typeIcon(field.type)}</Badge>
            {field.is_required && <Badge className="text-[9px] shrink-0">{t('customField.required')}</Badge>}
            {locked && (
              <Badge variant="outline" className="text-[9px] shrink-0 border-amber-300 bg-amber-50 text-amber-700">
                <Lock aria-hidden /> {t('customField.requiresApp')}
              </Badge>
            )}
            {on && field.conditions && (field.conditions.rules?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-[9px] shrink-0 border-violet-200 text-violet-700">{t('customField.conditionalBadge')}</Badge>
            )}
            {on && field.pricing && (
              <Badge variant="outline" className="text-[9px] shrink-0 border-emerald-200 text-emerald-700">{t('customField.pricedBadge')}</Badge>
            )}
            {on && field.preset_key && (
              <Badge variant="outline" className="text-[9px] shrink-0 font-mono" title={t('customField.presetBadge')}>{field.preset_key}</Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">{field.name}</p>
          {field.validation_rules && (
            <div className="flex gap-1 mt-1">
              {field.validation_rules.max_length && <Badge variant="outline" className="text-[8px]">{t('customField.maxBadge')}: {field.validation_rules.max_length}</Badge>}
              {field.validation_rules.pattern && <Badge variant="outline" className="text-[8px]">{t('customField.patternBadge')}: {field.validation_rules.pattern}</Badge>}
              {field.validation_rules.allowed_chars && <Badge variant="outline" className="text-[8px]">{t('customField.charsBadge')}: {field.validation_rules.allowed_chars}</Badge>}
            </div>
          )}
          {field.linked_validation && rawLinkTarget(field.linked_validation) && (
            <Badge variant="outline" className="text-[8px] mt-1 border-blue-200 text-blue-600">
              {t('customField.linkedBadge')}:{' '}
              {field.linked_validation.type === 'max_combined'
                ? t('customField.maxCombined')
                : field.linked_validation.type === 'equal_length'
                  ? t('customField.equalLength')
                  : field.linked_validation.type}
              {' → '}
              <span dir="ltr" className="font-mono">
                {linkTargetName(rawLinkTarget(field.linked_validation), fields, field.id)}
              </span>
              {field.linked_validation.type === 'max_combined' && field.linked_validation.max != null &&
                ` (${t('customField.maxBadge')}: ${field.linked_validation.max})`}
              {field.linked_validation.fill_char && ` (${t('customField.fillLabel')}: ${field.linked_validation.fill_char})`}
            </Badge>
          )}
          {field.linked_validation && rawLinkTarget(field.linked_validation) &&
            !linkTargetResolves(rawLinkTarget(field.linked_validation), fields, field.id) && (
            <Badge variant="outline" className="text-[8px] mt-1 ms-1 border-amber-300 bg-amber-50 text-amber-700">
              <AlertTriangle aria-hidden />
              {t('customField.linkTargetDangling')}
            </Badge>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 shrink-0">
          {canMove && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" disabled={i === 0} title={t('customField.moveUp')} aria-label={t('customField.moveUp')} onClick={() => handleMove(siblings, i, -1)}>
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" disabled={i === siblings.length - 1} title={t('customField.moveDown')} aria-label={t('customField.moveDown')} onClick={() => handleMove(siblings, i, 1)}>
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {on && persistedId(field) && !child && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" title={t('customField.saveToLibrary')} aria-label={t('customField.saveToLibrary')} onClick={() => openSaveToLibrary(field)}>
              <BookmarkPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          {!locked && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" onClick={() => openEdit(field)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => field.id && handleDelete(field.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  // ── Dialog sections (the app-off dialog renders them in today's order) ──

  const basicSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.basicInfo')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.internalName')}</Label>
          <Input className="h-8 text-sm font-mono" dir="ltr" placeholder={t('customField.internalNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} aria-invalid={!!nameError || undefined} />
          {nameError
            ? <p className="text-[10px] text-red-600">{nameError}</p>
            : <p className="text-[9px] text-muted-foreground">{t('customField.internalNameHint')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.fieldType')}</Label>
          <SearchableSelect value={type} onChange={setType} options={fieldTypes} />
        </div>
      </div>
    </div>
  );

  const optionsSection = hasOptions && (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">
        {type === 'SELECT' ? t('customField.dropdownOptions') : t('customField.choiceOptions')}
      </p>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('customField.optionsCommaSeparated')}</Label>
        <Input className="h-8 text-sm" placeholder={t('customField.optionsPlaceholder')} value={selectOptions} onChange={e => setSelectOptions(e.target.value)} />
        {type === 'COLOR_PALETTE' && <p className="text-[9px] text-muted-foreground">{t('customField.paletteOptionsHint')}</p>}
        {optionsError && <p className="text-[10px] text-red-600">{optionsError}</p>}
      </div>
    </div>
  );

  const localeBar = locales.length > 1 && (
    <div className="flex items-center gap-0 border-b mb-3">
      {locales.map(locale => (
        <button
          key={locale}
          type="button"
          onClick={() => setActiveLocale(locale)}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
            locale === activeLocale
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          {localeName(locale)}
          {locale === primaryLocale && <span className="text-[9px] text-zinc-400 ms-1">{t('customField.primaryParen')}</span>}
        </button>
      ))}
    </div>
  );

  const labelsSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.labelsSection')}</p>

      {/* Language tabs */}
      {localeBar}

      <div className="space-y-3">
        {/* Auto-translate from primary locale */}
        {activeLocale !== primaryLocale && (
          <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
            <span className="text-xs text-muted-foreground truncate">
              {t('customField.autoTranslateFrom')} <strong>{localeName(primaryLocale)}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleTranslateTo(activeLocale)}
              disabled={!!translatingLocale || !primaryLabel}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ms-3"
            >
              {translatingLocale === activeLocale ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {t('customField.translating')}</>
              ) : (
                <><Languages className="w-3 h-3" /> {t('customField.autoTranslate')}</>
              )}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('customField.labelIn', { locale: localeName(activeLocale) })}
              {activeLocale === primaryLocale && <span className="text-red-500"> *</span>}
            </Label>
            <Input
              className="h-8 text-sm"
              dir={isRtl ? 'rtl' : undefined}
              placeholder={type === 'REPEATER' ? t('customField.repeaterLabelPlaceholder') : t('customField.englishLabelPlaceholder')}
              value={localeData[activeLocale]?.label || ''}
              onChange={e => setLocaleField(activeLocale, 'label', e.target.value)}
            />
            {activeLocale === primaryLocale && !primaryLabel && (
              <p className="text-[9px] text-muted-foreground">{t('customField.primaryRequired')}</p>
            )}
            {type === 'REPEATER' && <p className="text-[9px] text-muted-foreground">{t('customField.repeaterLabelHint')}</p>}
          </div>
          {type !== 'REPEATER' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('customField.placeholderIn', { locale: localeName(activeLocale) })}</Label>
              <Input
                className="h-8 text-sm"
                dir={isRtl ? 'rtl' : undefined}
                placeholder={t('customField.placeholderPlaceholder')}
                value={localeData[activeLocale]?.placeholder || ''}
                onChange={e => setLocaleField(activeLocale, 'placeholder', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Per-option display labels for this locale */}
        {hasOptions && optionValues.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">{t('customField.optionLabelsTitle')}</Label>
            <div className="rounded-md border divide-y">
              {optionValues.map(opt => (
                <div key={opt} className="flex items-center gap-2 px-2 py-1">
                  <span className="text-[10px] font-mono text-zinc-500 w-28 truncate shrink-0" title={opt}>{opt}</span>
                  <Input
                    className="h-7 text-xs"
                    dir={isRtl ? 'rtl' : undefined}
                    placeholder={opt}
                    value={localeData[activeLocale]?.optionLabels?.[opt] || ''}
                    onChange={e => setOptionLabel(activeLocale, opt, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground">{t('customField.optionLabelsHint')}</p>
          </div>
        )}
      </div>
    </div>
  );

  const requiredToggle = (
    <label className="flex items-center gap-2 mt-3 cursor-pointer">
      <input type="checkbox" className="rounded accent-primary" checked={required} onChange={e => setRequired(e.target.checked)} />
      <span className="text-xs font-medium">{t('customField.requiredHint')}</span>
    </label>
  );

  const validationSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.validationRules')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.maxLength')}</Label>
          <Input type="number" className="h-8 text-sm" placeholder="15" value={maxLength} onChange={e => setMaxLength(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.minLength')}</Label>
          <Input type="number" className="h-8 text-sm" placeholder="1" value={minLength} onChange={e => setMinLength(e.target.value)} />
        </div>
      </div>
      {lengthError && <p className="text-[10px] text-red-600 mt-1">{lengthError}</p>}
      <div className="space-y-1.5 mt-3">
        <Label className="text-xs">{t('customField.validationPattern')}</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            { label: t('customField.presetEnglishOnly'), pattern: '^[a-zA-Z\\s]+$', chars: 'a-zA-Z\\s' },
            { label: t('customField.presetEnglishHeart'), pattern: '^[a-zA-Z❤\\s]+$', chars: 'a-zA-Z❤\\s' },
            { label: t('customField.presetUppercase'), pattern: '^[A-Z\\s]+$', chars: 'A-Z\\s' },
            { label: t('customField.presetLowercase'), pattern: '^[a-z\\s]+$', chars: 'a-z\\s' },
            { label: t('customField.presetNumbers'), pattern: '^[0-9]+$', chars: '0-9' },
            { label: t('customField.presetEnglishNumbers'), pattern: '^[a-zA-Z0-9\\s]+$', chars: 'a-zA-Z0-9\\s' },
            { label: t('customField.presetArabicOnly'), pattern: '^[\\u0600-\\u06FF\\s]+$', chars: '\\u0600-\\u06FF\\s' },
            { label: t('customField.presetArabicEnglish'), pattern: '^[a-zA-Z\\u0600-\\u06FF\\s]+$', chars: 'a-zA-Z\\u0600-\\u06FF\\s' },
            { label: t('customField.presetEmail'), pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', chars: '' },
            { label: t('customField.presetPhone'), pattern: '^\\+?[0-9\\s\\-()]+$', chars: '0-9+\\-()\\s' },
            { label: t('customField.presetNoSpecial'), pattern: '^[a-zA-Z0-9\\s]+$', chars: 'a-zA-Z0-9\\s' },
            { label: t('customField.presetCustom'), pattern: '', chars: '' },
          ].map(preset => (
            <button key={preset.label} type="button"
              onClick={() => { setPattern(preset.pattern); if (preset.chars) setAllowedChars(preset.chars); }}
              className={`text-[10px] px-2 py-1 rounded-md border transition ${pattern === preset.pattern ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-zinc-50'}`}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('customField.regexPattern')}</Label>
            <Input className="h-7 text-xs font-mono" dir="ltr" placeholder='^[a-zA-Z]+$' value={pattern} onChange={e => setPattern(e.target.value)} aria-invalid={!!patternError || undefined} />
            {patternError && <p className="text-[10px] text-red-600">{patternError}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('customField.allowedCharacters')}</Label>
            <Input className="h-7 text-xs font-mono" dir="ltr" placeholder='a-zA-Z❤' value={allowedChars} onChange={e => setAllowedChars(e.target.value)} aria-invalid={!!allowedCharsError || undefined} />
            {allowedCharsError
              ? <p className="text-[10px] text-red-600">{allowedCharsError}</p>
              : <p className="text-[9px] text-muted-foreground">{t('customField.allowedCharsHint')}</p>}
          </div>
        </div>
      </div>
      {requiredToggle}
    </div>
  );

  // App-only types: checkbox bounds (CHECKBOX_GROUP) and the required flag (not for repeaters).
  const appValidationSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.validationRules')}</p>
      {type === 'CHECKBOX_GROUP' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('customField.minChecked')}</Label>
              <Input type="number" min={0} max={MAX_CHECKED_LIMIT} className="h-8 text-sm" value={minChecked} onChange={e => setMinChecked(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('customField.maxChecked')}</Label>
              <Input type="number" min={0} max={MAX_CHECKED_LIMIT} className="h-8 text-sm" value={maxChecked} onChange={e => setMaxChecked(e.target.value)} />
            </div>
          </div>
          {checkedError && <p className="text-[10px] text-red-600 mt-1">{checkedError}</p>}
        </>
      )}
      {type === 'REPEATER'
        ? <p className="text-[10px] text-muted-foreground">{t('customField.repeaterRequiredHint')}</p>
        : requiredToggle}
    </div>
  );

  const linkedSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.linkedValidation')}</p>
      <p className="text-[10px] text-muted-foreground mb-2">{t('customField.linkedValidationHint')}</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.validationType')}</Label>
          <SearchableSelect value={linkedType} onChange={setLinkedType} placeholder={t('customField.none')} options={[
            { value: '', label: t('customField.none') },
            { value: 'equal_length', label: t('customField.equalLength'), description: t('customField.equalLengthDesc') },
            { value: 'max_combined', label: t('customField.maxCombined'), description: t('customField.maxCombinedDesc') },
          ]} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.targetField')}</Label>
          {targetOptions.length > 0 ? (
            <SearchableSelect
              value={linkedTarget}
              onChange={setLinkedTarget}
              placeholder={t('customField.selectTargetField')}
              options={targetOptions}
            />
          ) : (
            <p className="text-[10px] text-muted-foreground py-2">{t('customField.noOtherFields')}</p>
          )}
        </div>
        {linkedType === 'max_combined' ? (
          <div className="space-y-1.5">
            <Label className="text-xs">{t('customField.combinedLimit')}</Label>
            <Input
              type="number"
              min={1}
              max={MAX_COMBINED_LIMIT}
              className="h-8 text-sm"
              placeholder="22"
              value={linkedMax}
              onChange={e => setLinkedMax(e.target.value)}
            />
            <p className="text-[9px] text-muted-foreground">{t('customField.combinedLimitHint')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">{t('customField.fillCharacter')}</Label>
            <Input
              className="h-8 text-sm"
              placeholder="❤"
              disabled={linkedType !== 'equal_length'}
              value={linkedFillChar}
              onChange={e => setLinkedFillChar(e.target.value)}
              aria-invalid={!!fillCharError || undefined}
            />
            {fillCharError
              ? <p className="text-[10px] text-red-600">{fillCharError}</p>
              : <p className="text-[9px] text-muted-foreground">{t('customField.autoFillHint')}</p>}
          </div>
        )}
      </div>
      {linkError && <p className="text-[10px] text-red-600 mt-2">{linkError}</p>}
    </div>
  );

  // Tabs of the app-on dialog; Visibility is top-level only, Repeat is REPEATER only.
  const dialogTabs = [
    { key: 'basics', label: t('customField.tabs.basics') },
    ...(!isChild ? [{ key: 'visibility', label: t('customField.tabs.visibility') }] : []),
    { key: 'pricing', label: t('customField.tabs.pricing') },
    ...(type === 'REPEATER' ? [{ key: 'repeat', label: t('customField.tabs.repeat') }] : []),
    { key: 'display', label: t('customField.tabs.display') },
  ];
  const activeDialogTab = dialogTabs.some(tab => tab.key === dialogTab) ? dialogTab : 'basics';
  const tabHasError: Record<string, boolean> = {
    basics: !!(nameError || lengthError || patternError || allowedCharsError || linkError || fillCharError || checkedError || optionsError),
    visibility: !conditionsComplete(conditions),
    pricing: !pricingValid(pricing),
    repeat: type === 'REPEATER' && !repeatValid(repeat),
    display: (!!ui?.insert_char && charCount(ui.insert_char) !== 1) || (type === 'COLOR_PALETTE' && ui?.palette_from_option === ''),
  };
  const parentField = parentId ? fields.find(f => f.id === parentId) : undefined;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{t('customField.title')}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t('customField.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {on && (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!productId || !token} title={!productId ? t('customField.saveProductFirst') : undefined} onClick={() => setPresetOpen(true)}>
                  <Sparkles className="w-3 h-3 me-1" /> {t('customField.applyPreset')}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!productId || !token} title={!productId ? t('customField.saveProductFirst') : undefined} onClick={() => setLibraryOpen(true)}>
                  <Library className="w-3 h-3 me-1" /> {t('customField.fromLibrary')}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-3 h-3 me-1" /> {t('customField.addField')}
            </Button>
          </div>
        </div>
        {on && !productId && (
          <p className="text-[10px] text-muted-foreground mt-1">{t('customField.saveProductFirst')}</p>
        )}
      </CardHeader>
      <CardContent>
        {notice && (
          <p role="status" className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>
        )}
        {listError && (
          <p role="alert" className="mb-2 whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{listError}</p>
        )}
        {fields.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            {t('customField.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {topLevelFields.map((field, i) => {
              const kids = childrenOf(field.id);
              if (field.type !== 'REPEATER' && kids.length === 0) return renderFieldRow(field, i, false, topLevelFields);
              return (
                <div key={field.id || i} className="space-y-1.5">
                  {renderFieldRow(field, i, false, topLevelFields)}
                  <div className="ms-7 space-y-1.5 border-s ps-3">
                    {kids.map((kid, j) => renderFieldRow(kid, j, true, kids))}
                    {on && field.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary"
                        onClick={() => { resetForm(field.id ?? null); setShowForm(true); }}
                      >
                        <Plus className="w-3 h-3 me-1" /> {t('customField.addChildField')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add Field Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className={on ? 'sm:max-w-3xl' : 'max-w-2xl'}>
          <DialogHeader>
            <DialogTitle>{editingId ? t('customField.editFieldTitle') : t('customField.addFieldTitle')}</DialogTitle>
            {on && parentField && (
              <p className="text-[11px] text-muted-foreground">
                {t('customField.childOf', { parent: displayLabel(parentField) })}
              </p>
            )}
          </DialogHeader>
          {!on ? (
            <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
              {basicSection}
              {optionsSection}
              {labelsSection}
              {validationSection}
              {linkedSection}
            </div>
          ) : (
            <Tabs value={activeDialogTab} onValueChange={v => setDialogTab(String(v))}>
              <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
                {dialogTabs.map(tab => (
                  <TabsTrigger key={tab.key} value={tab.key} className="flex-none px-3">
                    {tab.label}
                    {tabHasError[tab.key] && <span className="ms-1 inline-block size-1.5 rounded-full bg-red-500" aria-hidden />}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="py-3 max-h-[65vh] overflow-y-auto pe-1">
                <TabsContent value="basics" className="space-y-5">
                  {basicSection}
                  {optionsSection}
                  {labelsSection}
                  {appOnly ? appValidationSection : validationSection}
                  {!appOnly && linkedSection}
                </TabsContent>
                {!isChild && (
                  <TabsContent value="visibility">
                    <FieldConditionsEditor
                      value={conditions}
                      onChange={setConditions}
                      variantOptions={variantOptions}
                      earlierFields={earlierFields}
                    />
                  </TabsContent>
                )}
                <TabsContent value="pricing">
                  <FieldPricingEditor
                    value={pricing}
                    onChange={setPricing}
                    optionValues={type === 'SELECT' || type === 'CHECKBOX_GROUP' || type === 'COLOR_PALETTE' ? pricedValues : []}
                    currency={currency}
                    isRepeater={type === 'REPEATER'}
                  />
                </TabsContent>
                {type === 'REPEATER' && (
                  <TabsContent value="repeat">
                    <FieldRepeatEditor
                      value={repeat}
                      onChange={setRepeat}
                      variantOptions={variantOptions}
                      earlierFields={earlierFields}
                    />
                  </TabsContent>
                )}
                <TabsContent value="display">
                  <FieldDisplayEditor
                    type={type}
                    isChild={isChild}
                    ui={ui}
                    onUiChange={setUi}
                    optionValues={optionValues}
                    variantOptions={variantOptions}
                    hasLinkedTarget={linkedType === 'equal_length' && !!linkedTarget}
                    localeBar={localeBar}
                    extras={localeExtras[activeLocale] ?? emptyExtras()}
                    onExtrasChange={patch => setExtras(activeLocale, patch)}
                    isRtl={isRtl}
                    uploading={uploading}
                    onPickImage={async () => (await pickAndUpload('products', false))[0]?.url ?? null}
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
          {saveError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-line">{saveError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {saving && <Loader2 className="w-3 h-3 me-1 animate-spin" />}
              {editingId ? t('customField.saveChanges') : t('customField.addField')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save to library (app on, persisted top-level fields) */}
      <Dialog open={libraryField !== null} onOpenChange={open => !open && setLibraryField(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('customField.saveToLibrary')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('customField.libraryName')}</Label>
            <Input
              className="h-8 text-sm"
              maxLength={TEMPLATE_NAME_MAX}
              value={libraryName}
              onChange={e => setLibraryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveToLibrary(); }}
            />
            <p className="text-[9px] text-muted-foreground">{t('customField.libraryHint')}</p>
          </div>
          {libraryError && <p role="alert" className="text-xs text-red-600 whitespace-pre-line">{libraryError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLibraryField(null)} disabled={librarySaving}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSaveToLibrary} disabled={librarySaving || !libraryName.trim()}>
              {librarySaving && <Loader2 className="w-3 h-3 me-1 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {on && productId && token && (
        <>
          <ApplyPresetDialog
            open={presetOpen}
            onOpenChange={setPresetOpen}
            token={token}
            primaryLocale={primaryLocale}
            locales={locales}
            productId={productId}
            productOptions={variantOptions}
            onApplied={(_pid, created) => afterInsert(created.length)}
          />
          <InsertTemplateDialog
            open={libraryOpen}
            onOpenChange={setLibraryOpen}
            token={token}
            primaryLocale={primaryLocale}
            productId={productId}
            onInserted={(_pid, created) => afterInsert(created.length)}
          />
        </>
      )}
    </Card>
  );
}
