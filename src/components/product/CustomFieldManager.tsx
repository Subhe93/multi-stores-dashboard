'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Plus, Trash2, GripVertical, Pencil, Languages, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export interface CustomFieldTranslation {
  locale: string;
  label: string;
  placeholder?: string;
  /** Display label per option value (SELECT fields) */
  option_labels?: Record<string, string>;
}

/** Validation constraints stored on a custom field (all optional) */
export interface CustomFieldValidationRules {
  max_length?: number;
  min_length?: number;
  pattern?: string;
  allowed_chars?: string;
}

/** Cross-field validation: links this field's value to another field by name */
export interface CustomFieldLinkedValidation {
  type: string;
  target_field_id: string;
  fill_char?: string;
}

export interface CustomField {
  id?: string;
  name: string;
  type: string;
  is_required: boolean;
  placeholder?: string;
  /** Option values for SELECT fields */
  options?: string[] | null;
  validation_rules?: CustomFieldValidationRules | null;
  linked_validation?: CustomFieldLinkedValidation | null;
  sort_order: number;
  translations?: CustomFieldTranslation[];
}

interface CustomFieldManagerProps {
  fields: CustomField[];
  onAdd: (field: Omit<CustomField, 'sort_order'>) => void;
  onUpdate?: (id: string, field: Omit<CustomField, 'sort_order'>) => void;
  onDelete: (id: string) => void;
  /** Store content locales (primary first). Defaults to ['en'] when the store config is not loaded yet. */
  locales?: string[];
  primaryLocale?: string;
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

const parseOptions = (raw: string): string[] =>
  raw.split(',').map(s => s.trim()).filter(Boolean);

const emptyLocaleData = (): LocaleFormData => ({ label: '', placeholder: '', optionLabels: {} });

export function CustomFieldManager({
  fields,
  onAdd,
  onUpdate,
  onDelete,
  locales = ['en'],
  primaryLocale = 'en',
}: CustomFieldManagerProps) {
  const t = useTranslations();
  const { token } = useAuth();
  const fieldTypes = [
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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
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

  const hasOptions = TYPES_WITH_OPTIONS.includes(type);
  const optionValues = hasOptions ? parseOptions(selectOptions) : [];
  const primaryLabel = localeData[primaryLocale]?.label?.trim() || '';
  const canSave = !!name && !!primaryLabel;
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

  const resetForm = () => {
    setEditingId(null);
    setName(''); setType('TEXT'); setRequired(false);
    const data: Record<string, LocaleFormData> = {};
    locales.forEach(l => { data[l] = emptyLocaleData(); });
    setLocaleData(data);
    setExtraTranslations([]);
    setActiveLocale(primaryLocale);
    setTranslatingLocale('');
    setMaxLength(''); setMinLength(''); setPattern('');
    setAllowedChars(''); setSelectOptions(''); setLinkedType(''); setLinkedTarget(''); setLinkedFillChar('');
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
    setType(field.type);
    setRequired(field.is_required);
    const data: Record<string, LocaleFormData> = {};
    locales.forEach(l => {
      const tr = field.translations?.find(x => x.locale === l);
      data[l] = {
        label: tr?.label || '',
        placeholder: tr?.placeholder || '',
        optionLabels: { ...(tr?.option_labels || {}) },
      };
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
    setExtraTranslations((field.translations || []).filter(tr => !locales.includes(tr.locale)));
    setActiveLocale(primaryLocale);
    setTranslatingLocale('');
    setMaxLength(field.validation_rules?.max_length ? String(field.validation_rules.max_length) : '');
    setMinLength(field.validation_rules?.min_length ? String(field.validation_rules.min_length) : '');
    setPattern(field.validation_rules?.pattern || '');
    setAllowedChars(field.validation_rules?.allowed_chars || '');
    setSelectOptions(Array.isArray(field.options) ? field.options.join(', ') : '');
    setLinkedType(field.linked_validation?.type || '');
    setLinkedTarget(field.linked_validation?.target_field_id || '');
    setLinkedFillChar(field.linked_validation?.fill_char || '');
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
      const [labelRes, placeholderRes, ...optionRes] = await Promise.all([labelTask, placeholderTask, ...optionTasks]);
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
    } catch {
      // silent
    } finally {
      setTranslatingLocale('');
    }
  };

  const handleSave = () => {
    if (!canSave) return;

    const validationRules: CustomFieldValidationRules = {};
    if (maxLength) validationRules.max_length = parseInt(maxLength);
    if (minLength) validationRules.min_length = parseInt(minLength);
    if (pattern) validationRules.pattern = pattern;
    if (allowedChars) validationRules.allowed_chars = allowedChars;

    const linkedValidation = linkedType && linkedTarget ? {
      type: linkedType,
      target_field_id: linkedTarget,
      fill_char: linkedFillChar || undefined,
    } : undefined;

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
          };
        }),
      // Rows loaded from the API carry extra columns (id, field_id, ...);
      // the DTO whitelist rejects unknown keys, so send only the DTO shape.
      ...extraTranslations.map(tr => ({
        locale: tr.locale,
        label: tr.label,
        ...(tr.placeholder ? { placeholder: tr.placeholder } : {}),
        ...(tr.option_labels && Object.keys(tr.option_labels).length > 0
          ? { option_labels: tr.option_labels }
          : {}),
      })),
    ];

    const primaryPlaceholder = localeData[primaryLocale]?.placeholder?.trim() || '';

    const fieldData = {
      name,
      type,
      is_required: required,
      placeholder: primaryPlaceholder || undefined,
      options,
      validation_rules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
      linked_validation: linkedValidation,
      translations,
    };

    if (editingId && onUpdate) {
      onUpdate(editingId, fieldData);
    } else {
      onAdd(fieldData);
    }

    resetForm();
    setShowForm(false);
  };

  const typeIcon = (value: string) => fieldTypes.find(ft => ft.value === value)?.label || value;

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
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-3 h-3 me-1" /> {t('customField.addField')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            {t('customField.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id || i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border group">
                <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{displayLabel(field)}</p>
                    <Badge variant="secondary" className="text-[9px] shrink-0">{typeIcon(field.type)}</Badge>
                    {field.is_required && <Badge className="text-[9px] shrink-0">{t('customField.required')}</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">{field.name}</p>
                  {field.validation_rules && (
                    <div className="flex gap-1 mt-1">
                      {field.validation_rules.max_length && <Badge variant="outline" className="text-[8px]">{t('customField.maxBadge')}: {field.validation_rules.max_length}</Badge>}
                      {field.validation_rules.pattern && <Badge variant="outline" className="text-[8px]">{t('customField.patternBadge')}: {field.validation_rules.pattern}</Badge>}
                      {field.validation_rules.allowed_chars && <Badge variant="outline" className="text-[8px]">{t('customField.charsBadge')}: {field.validation_rules.allowed_chars}</Badge>}
                    </div>
                  )}
                  {field.linked_validation && (
                    <Badge variant="outline" className="text-[8px] mt-1 border-blue-200 text-blue-600">
                      {t('customField.linkedBadge')}: {field.linked_validation.type} → {field.linked_validation.target_field_id}
                      {field.linked_validation.fill_char && ` (${t('customField.fillLabel')}: ${field.linked_validation.fill_char})`}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" onClick={() => openEdit(field)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => field.id && onDelete(field.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Field Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t('customField.editFieldTitle') : t('customField.addFieldTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
            {/* Basic */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.basicInfo')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.internalName')}</Label>
                  <Input className="h-8 text-sm" placeholder={t('customField.internalNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
                  <p className="text-[9px] text-muted-foreground">{t('customField.internalNameHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.fieldType')}</Label>
                  <SearchableSelect value={type} onChange={setType} options={fieldTypes} />
                </div>
              </div>
            </div>

            {/* Select Options */}
            {hasOptions && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.dropdownOptions')}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.optionsCommaSeparated')}</Label>
                  <Input className="h-8 text-sm" placeholder={t('customField.optionsPlaceholder')} value={selectOptions} onChange={e => setSelectOptions(e.target.value)} />
                </div>
              </div>
            )}

            {/* Labels (per store locale) */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.labelsSection')}</p>

              {/* Language tabs */}
              {locales.length > 1 && (
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
              )}

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
                      placeholder={t('customField.englishLabelPlaceholder')}
                      value={localeData[activeLocale]?.label || ''}
                      onChange={e => setLocaleField(activeLocale, 'label', e.target.value)}
                    />
                    {activeLocale === primaryLocale && !primaryLabel && (
                      <p className="text-[9px] text-muted-foreground">{t('customField.primaryRequired')}</p>
                    )}
                  </div>
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

            {/* Validation */}
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
                    <Input className="h-7 text-xs font-mono" placeholder='^[a-zA-Z]+$' value={pattern} onChange={e => setPattern(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{t('customField.allowedCharacters')}</Label>
                    <Input className="h-7 text-xs font-mono" placeholder='a-zA-Z❤' value={allowedChars} onChange={e => setAllowedChars(e.target.value)} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary" checked={required} onChange={e => setRequired(e.target.checked)} />
                <span className="text-xs font-medium">{t('customField.requiredHint')}</span>
              </label>
            </div>

            {/* Linked Validation */}
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
                  <Label className="text-xs">{t('customField.targetFieldName')}</Label>
                  <Input className="h-8 text-sm font-mono" placeholder="name_2" value={linkedTarget} onChange={e => setLinkedTarget(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.fillCharacter')}</Label>
                  <Input className="h-8 text-sm" placeholder="❤" value={linkedFillChar} onChange={e => setLinkedFillChar(e.target.value)} />
                  <p className="text-[9px] text-muted-foreground">{t('customField.autoFillHint')}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>{editingId ? t('customField.saveChanges') : t('customField.addField')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
