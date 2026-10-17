import type { PConditions, PPricing, PRepeat, PUi } from '@/lib/personalization';

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

/** The DTO a save sends (`sort_order` is managed by the list). */
export type CustomFieldPayload = Omit<CustomField, 'sort_order'>;

/** Per-locale editable data for a single custom field */
export interface LocaleFormData {
  label: string;
  placeholder: string;
  optionLabels: Record<string, string>;
}

export interface FieldTypeOption {
  value: string;
  label: string;
  description?: string;
}

export const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska',
};
export const RTL_LOCALES = ['ar'];

/** Field types whose `options` array is edited in the dialog */
export const TYPES_WITH_OPTIONS = ['SELECT'];
/** With the app on, checkbox groups and static palettes have options too. */
export const APP_TYPES_WITH_OPTIONS = ['SELECT', 'CHECKBOX_GROUP', 'COLOR_PALETTE'];

/** API bounds of the DTO (M4.0 §3.2). */
export const MAX_RULE_LENGTH = 5000;
export const MAX_COMBINED_LIMIT = 1000;

export const parseOptions = (raw: string): string[] =>
  raw.split(',').map(s => s.trim()).filter(Boolean);

export const emptyLocaleData = (): LocaleFormData => ({ label: '', placeholder: '', optionLabels: {} });

export const localeName = (locale: string) => LOCALE_LABELS[locale] || locale.toUpperCase();

/** Resolve the best translation for display: primary locale → en → first → nothing */
export const resolveTranslation = (field: CustomField, primaryLocale: string): CustomFieldTranslation | undefined =>
  field.translations?.find(tr => tr.locale === primaryLocale) ||
  field.translations?.find(tr => tr.locale === 'en') ||
  field.translations?.[0];

export const displayLabelOf = (field: CustomField, primaryLocale: string) =>
  resolveTranslation(field, primaryLocale)?.label || field.name;
