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
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react';

export interface CustomField {
  id?: string;
  name: string;
  type: string;
  is_required: boolean;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  linked_validation?: any;
  sort_order: number;
  translations?: { locale: string; label: string; placeholder?: string }[];
}

interface CustomFieldManagerProps {
  fields: CustomField[];
  onAdd: (field: Omit<CustomField, 'sort_order'>) => void;
  onUpdate?: (id: string, field: Omit<CustomField, 'sort_order'>) => void;
  onDelete: (id: string) => void;
}

export function CustomFieldManager({ fields, onAdd, onUpdate, onDelete }: CustomFieldManagerProps) {
  const t = useTranslations();
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
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [minLength, setMinLength] = useState('');
  const [pattern, setPattern] = useState('');
  const [allowedChars, setAllowedChars] = useState('');
  const [selectOptions, setSelectOptions] = useState('');
  // Linked validation
  const [linkedType, setLinkedType] = useState('');
  const [linkedTarget, setLinkedTarget] = useState('');
  const [linkedFillChar, setLinkedFillChar] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName(''); setType('TEXT'); setRequired(false); setLabelEn(''); setLabelAr('');
    setPlaceholder(''); setMaxLength(''); setMinLength(''); setPattern('');
    setAllowedChars(''); setSelectOptions(''); setLinkedType(''); setLinkedTarget(''); setLinkedFillChar('');
  };

  const openEdit = (field: CustomField) => {
    setEditingId(field.id || null);
    setName(field.name);
    setType(field.type);
    setRequired(field.is_required);
    setLabelEn(field.translations?.find(t => t.locale === 'en')?.label || field.name);
    setLabelAr(field.translations?.find(t => t.locale === 'ar')?.label || '');
    setPlaceholder(field.placeholder || '');
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

  const handleSave = () => {
    if (!name || !labelEn) return;

    const validationRules: any = {};
    if (maxLength) validationRules.max_length = parseInt(maxLength);
    if (minLength) validationRules.min_length = parseInt(minLength);
    if (pattern) validationRules.pattern = pattern;
    if (allowedChars) validationRules.allowed_chars = allowedChars;

    const linkedValidation = linkedType && linkedTarget ? {
      type: linkedType,
      target_field_id: linkedTarget,
      fill_char: linkedFillChar || undefined,
    } : undefined;

    const fieldData = {
      name,
      type,
      is_required: required,
      placeholder: placeholder || undefined,
      options: selectOptions ? selectOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      validation_rules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
      linked_validation: linkedValidation,
      translations: [
        { locale: 'en', label: labelEn, placeholder: placeholder || undefined },
        ...(labelAr ? [{ locale: 'ar', label: labelAr }] : []),
      ],
    };

    if (editingId && onUpdate) {
      onUpdate(editingId, fieldData);
    } else {
      onAdd(fieldData);
    }

    resetForm();
    setShowForm(false);
  };

  const typeIcon = (t: string) => fieldTypes.find(ft => ft.value === t)?.label || t;

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
            <Plus className="w-3 h-3 mr-1" /> {t('customField.addField')}
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
                    <p className="text-sm font-medium truncate">{field.translations?.[0]?.label || field.name}</p>
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

            {/* Labels */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.labelsSection')}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.englishLabel')}</Label>
                  <Input className="h-8 text-sm" placeholder={t('customField.englishLabelPlaceholder')} value={labelEn} onChange={e => setLabelEn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.arabicLabel')}</Label>
                  <Input className="h-8 text-sm" dir="rtl" placeholder="الاسم المطلوب" value={labelAr} onChange={e => setLabelAr(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.placeholder')}</Label>
                  <Input className="h-8 text-sm" placeholder={t('customField.placeholderPlaceholder')} value={placeholder} onChange={e => setPlaceholder(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Select Options */}
            {type === 'SELECT' && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.dropdownOptions')}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customField.optionsCommaSeparated')}</Label>
                  <Input className="h-8 text-sm" placeholder={t('customField.optionsPlaceholder')} value={selectOptions} onChange={e => setSelectOptions(e.target.value)} />
                </div>
              </div>
            )}

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
            <Button size="sm" onClick={handleSave} disabled={!name || !labelEn}>{editingId ? t('customField.saveChanges') : t('customField.addField')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
