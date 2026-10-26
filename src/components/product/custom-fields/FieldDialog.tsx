'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Languages, Loader2 } from 'lucide-react';
import { LocaleTabs, useTranslationPlaceholder } from '@/components/common/LocaleTabs';
import { MAX_CHECKED_LIMIT, type OptionConfigLike } from '@/lib/personalization';
import { FieldConditionsEditor } from '@/components/apps/personalization/FieldConditionsEditor';
import { FieldPricingEditor } from '@/components/apps/personalization/FieldPricingEditor';
import { FieldRepeatEditor } from '@/components/apps/personalization/FieldRepeatEditor';
import { FieldDisplayEditor, emptyExtras } from '@/components/apps/personalization/FieldDisplayEditor';
import type { FieldForm } from './useFieldForm';
import { MAX_COMBINED_LIMIT, displayLabelOf, localeName, type CustomField } from './types';

interface FieldDialogProps {
  form: FieldForm;
  fields: CustomField[];
  on: boolean;
  locales: string[];
  primaryLocale: string;
  variantOptions: OptionConfigLike[];
  currency: string;
  uploading: boolean;
  onPickImage: () => Promise<string | null>;
  onSave: () => void;
  onTranslate: (targetLocale: string) => void;
  onClose: () => void;
}

/**
 * Add / edit dialog of a custom field. App off: today's single column. App
 * on: tabs Basics · Visibility · Pricing · Repeat (REPEATER) · Display & help
 * with a red dot (and a screen-reader hint, E27) on tabs holding an error.
 */
export function FieldDialog({
  form, fields, on, locales, primaryLocale, variantOptions, currency, uploading, onPickImage, onSave, onTranslate, onClose,
}: FieldDialogProps) {
  const t = useTranslations();
  const translationPlaceholder = useTranslationPlaceholder();
  const {
    state, patch, setLocaleField, setOptionLabel, setExtras,
    isChild, fieldTypes, appOnly, hasOptions, optionValues, primaryLabel, earlierFields, pricedValues,
    validation, errors, canSave, targetOptions, isRtl, dialogTabs, activeDialogTab,
  } = form;
  const {
    showForm, editingId, name, type, required, activeLocale, localeData, translatingLocale,
    maxLength, minLength, pattern, allowedChars, selectOptions, linkedType, linkedTarget, linkedFillChar, linkedMax,
    saving, saveError, parentId, conditions, pricing, repeat, ui, localeExtras, minChecked, maxChecked,
  } = state;
  const parentField = parentId ? fields.find(f => f.id === parentId) : undefined;

  // ── Dialog sections (the app-off dialog renders them in today's order) ──

  const basicSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.basicInfo')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.internalName')}</Label>
          <Input className="h-8 text-sm font-mono" dir="ltr" placeholder={t('customField.internalNamePlaceholder')} value={name} onChange={e => patch({ name: e.target.value })} aria-invalid={!!errors.name || undefined} />
          {errors.name
            ? <p className="text-[10px] text-red-600">{errors.name}</p>
            : <p className="text-[9px] text-muted-foreground">{t('customField.internalNameHint')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.fieldType')}</Label>
          <SearchableSelect value={type} onChange={v => patch({ type: v })} options={fieldTypes} />
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
        <Input className="h-8 text-sm" placeholder={t('customField.optionsPlaceholder')} value={selectOptions} onChange={e => patch({ selectOptions: e.target.value })} />
        {type === 'COLOR_PALETTE' && <p className="text-[9px] text-muted-foreground">{t('customField.paletteOptionsHint')}</p>}
        {errors.options && <p className="text-[10px] text-red-600">{errors.options}</p>}
      </div>
    </div>
  );

  const localeBar = locales.length > 1 && (
    <LocaleTabs
      className="mb-3"
      value={activeLocale}
      onChange={locale => patch({ activeLocale: locale })}
      locales={locales}
      primaryLocale={primaryLocale}
      filled={Object.fromEntries(locales.map(l => [l, !!localeData[l]?.label?.trim()]))}
    />
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
              onClick={() => onTranslate(activeLocale)}
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
              placeholder={translationPlaceholder({
                locale: activeLocale,
                primaryLocale,
                baseValue: localeData[primaryLocale]?.label,
                primaryPlaceholder: type === 'REPEATER' ? t('customField.repeaterLabelPlaceholder') : t('customField.englishLabelPlaceholder'),
              })}
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
                placeholder={translationPlaceholder({
                  locale: activeLocale,
                  primaryLocale,
                  baseValue: localeData[primaryLocale]?.placeholder,
                  primaryPlaceholder: t('customField.placeholderPlaceholder'),
                })}
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
      <input type="checkbox" className="rounded accent-primary" checked={required} onChange={e => patch({ required: e.target.checked })} />
      <span className="text-xs font-medium">{t('customField.requiredHint')}</span>
    </label>
  );

  const validationSection = (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{t('customField.validationRules')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.maxLength')}</Label>
          <Input type="number" className="h-8 text-sm" placeholder="15" value={maxLength} onChange={e => patch({ maxLength: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('customField.minLength')}</Label>
          <Input type="number" className="h-8 text-sm" placeholder="1" value={minLength} onChange={e => patch({ minLength: e.target.value })} />
        </div>
      </div>
      {errors.length && <p className="text-[10px] text-red-600 mt-1">{errors.length}</p>}
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
              onClick={() => patch(preset.chars ? { pattern: preset.pattern, allowedChars: preset.chars } : { pattern: preset.pattern })}
              className={`text-[10px] px-2 py-1 rounded-md border transition ${pattern === preset.pattern ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-zinc-50'}`}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('customField.regexPattern')}</Label>
            <Input className="h-7 text-xs font-mono" dir="ltr" placeholder='^[a-zA-Z]+$' value={pattern} onChange={e => patch({ pattern: e.target.value })} aria-invalid={!!errors.pattern || undefined} />
            {errors.pattern && <p className="text-[10px] text-red-600">{errors.pattern}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('customField.allowedCharacters')}</Label>
            <Input className="h-7 text-xs font-mono" dir="ltr" placeholder='a-zA-Z❤' value={allowedChars} onChange={e => patch({ allowedChars: e.target.value })} aria-invalid={!!errors.allowedChars || undefined} />
            {errors.allowedChars
              ? <p className="text-[10px] text-red-600">{errors.allowedChars}</p>
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
              <Input type="number" min={0} max={MAX_CHECKED_LIMIT} className="h-8 text-sm" value={minChecked} onChange={e => patch({ minChecked: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('customField.maxChecked')}</Label>
              <Input type="number" min={0} max={MAX_CHECKED_LIMIT} className="h-8 text-sm" value={maxChecked} onChange={e => patch({ maxChecked: e.target.value })} />
            </div>
          </div>
          {errors.checked && <p className="text-[10px] text-red-600 mt-1">{errors.checked}</p>}
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
          <SearchableSelect value={linkedType} onChange={v => patch({ linkedType: v })} placeholder={t('customField.none')} options={[
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
              onChange={v => patch({ linkedTarget: v })}
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
              onChange={e => patch({ linkedMax: e.target.value })}
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
              onChange={e => patch({ linkedFillChar: e.target.value })}
              aria-invalid={!!errors.fillChar || undefined}
            />
            {errors.fillChar
              ? <p className="text-[10px] text-red-600">{errors.fillChar}</p>
              : <p className="text-[9px] text-muted-foreground">{t('customField.autoFillHint')}</p>}
          </div>
        )}
      </div>
      {errors.link && <p className="text-[10px] text-red-600 mt-2">{errors.link}</p>}
    </div>
  );

  return (
    <Dialog open={showForm} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={on ? 'sm:max-w-3xl' : 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>{editingId ? t('customField.editFieldTitle') : t('customField.addFieldTitle')}</DialogTitle>
          {on && parentField && (
            <p className="text-[11px] text-muted-foreground">
              {t('customField.childOf', { parent: displayLabelOf(parentField, primaryLocale) })}
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
          <Tabs value={activeDialogTab} onValueChange={v => patch({ dialogTab: String(v) })}>
            <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
              {dialogTabs.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex-none px-3">
                  {tab.label}
                  {validation.tabHasError[tab.key] && (
                    <>
                      <span className="ms-1 inline-block size-1.5 rounded-full bg-red-500" aria-hidden />
                      <span className="sr-only">{t('customField.editor.tabHasError')}</span>
                    </>
                  )}
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
                    onChange={v => patch({ conditions: v })}
                    variantOptions={variantOptions}
                    earlierFields={earlierFields}
                  />
                </TabsContent>
              )}
              <TabsContent value="pricing">
                <FieldPricingEditor
                  value={pricing}
                  onChange={v => patch({ pricing: v })}
                  optionValues={type === 'SELECT' || type === 'CHECKBOX_GROUP' || type === 'COLOR_PALETTE' ? pricedValues : []}
                  currency={currency}
                  isRepeater={type === 'REPEATER'}
                />
              </TabsContent>
              {type === 'REPEATER' && (
                <TabsContent value="repeat">
                  <FieldRepeatEditor
                    value={repeat}
                    onChange={v => patch({ repeat: v })}
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
                  onUiChange={v => patch({ ui: v })}
                  optionValues={optionValues}
                  variantOptions={variantOptions}
                  hasLinkedTarget={linkedType === 'equal_length' && !!linkedTarget}
                  localeBar={localeBar}
                  extras={localeExtras[activeLocale] ?? emptyExtras()}
                  onExtrasChange={p => setExtras(activeLocale, p)}
                  isRtl={isRtl}
                  uploading={uploading}
                  onPickImage={onPickImage}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
        {saveError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-line">{saveError}</p>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            {saving && <Loader2 className="w-3 h-3 me-1 animate-spin" />}
            {editingId ? t('customField.saveChanges') : t('customField.addField')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
