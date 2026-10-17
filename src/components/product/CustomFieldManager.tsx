'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Sparkles, Library } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useCurrency } from '@/lib/useCurrency';
import { useImageUpload } from '@/lib/useImageUpload';
import {
  readConfigIssues,
  readErrorParamList,
  saveFieldToLibrary,
  TEMPLATE_NAME_MAX,
  type OptionConfigLike,
} from '@/lib/personalization';
import type { ExtrasForm } from '@/components/apps/personalization/FieldDisplayEditor';
import { ApplyPresetDialog } from '@/components/apps/personalization/ApplyPresetDialog';
import { InsertTemplateDialog } from '@/components/apps/personalization/InsertTemplateDialog';
import { useConfigIssueText } from '@/components/apps/personalization/useConfigIssueText';
import { FieldList } from './custom-fields/FieldList';
import { FieldDialog } from './custom-fields/FieldDialog';
import { useFieldForm } from './custom-fields/useFieldForm';
import { buildFieldPayload, payloadIsAdvanced, stripAdvanced } from './custom-fields/fieldPayload';
import { isUnsafePatternError } from './custom-fields/fieldValidation';
import { displayLabelOf, type CustomField, type CustomFieldPayload } from './custom-fields/types';

export type {
  CustomField,
  CustomFieldTranslation,
  CustomFieldValidationRules,
  CustomFieldLinkedValidation,
} from './custom-fields/types';

interface CustomFieldManagerProps {
  fields: CustomField[];
  /** May return a promise; a rejection keeps the dialog open and shows the translated error. */
  onAdd: (field: CustomFieldPayload) => void | Promise<void>;
  onUpdate?: (id: string, field: CustomFieldPayload) => void | Promise<void>;
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

const DEFAULT_LOCALES = ['en'];
const NO_OPTIONS: OptionConfigLike[] = [];

/**
 * Custom fields of a product (E18 split): the list (`custom-fields/FieldList`),
 * the add / edit dialog (`FieldDialog`) driven by the `useFieldForm` reducer,
 * the DTO assembly (`fieldPayload`) and the live checks (`fieldValidation`).
 * This file keeps the round-trips: save (with the X19 app-off retry), delete,
 * reorder, save-to-library and the preset / library inserts.
 */
export function CustomFieldManager({
  fields,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  locales = DEFAULT_LOCALES,
  primaryLocale = 'en',
  personalization = false,
  variantOptions = NO_OPTIONS,
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

  const form = useFieldForm({ fields, locales, primaryLocale, on, variantOptions, baseFieldTypes, appFieldTypes });
  const { state, patch, reset, openEdit, dispatch, appOnly, hasOptions, optionValues, pricedValues, validation, canSave } = form;
  const { editingId, localeData, localeExtras, translatingLocale } = state;

  // List-level round-trips and the library / preset dialogs.
  const [listError, setListError] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryField, setLibraryField] = useState<CustomField | null>(null);
  const [libraryName, setLibraryName] = useState('');
  const [librarySaving, setLibrarySaving] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [notice, setNotice] = useState('');

  const displayLabel = (field: CustomField) => displayLabelOf(field, primaryLocale);

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
    patch({ translatingLocale: targetLocale });
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
      const optionLabels: Record<string, string> = {};
      optionValues.forEach((opt, i) => {
        const translated = optionRes[i]?.translated;
        if (translated) optionLabels[opt] = translated;
      });
      const extras: Partial<ExtrasForm> = {};
      extraKeys.forEach((k, i) => {
        const translated = extraRes[i]?.translated;
        if (translated) extras[k] = translated;
      });
      dispatch({
        type: 'translated',
        locale: targetLocale,
        label: labelRes?.translated,
        placeholder: placeholderRes?.translated,
        optionLabels,
        extras,
      });
    } catch {
      // silent
    } finally {
      patch({ translatingLocale: '' });
    }
  };

  const handleSave = async () => {
    if (!canSave) return;

    const fieldData = buildFieldPayload(state, {
      on,
      locales,
      primaryLocale,
      appOnly,
      hasOptions,
      optionValues,
      pricedValues,
      trimmedName: validation.trimmedName,
      minLen: validation.minLen,
      maxLen: validation.maxLen,
      maxCombined: validation.maxCombined,
      minChk: validation.minChk,
      maxChk: validation.maxChk,
    });

    const send = (payload: CustomFieldPayload) =>
      editingId && onUpdate ? onUpdate(editingId, payload) : onAdd(payload);

    patch({ saving: true, saveError: '' });
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
      reset();
      patch({ showForm: false });
    } catch (err) {
      // Keep the dialog open so the merchant can fix the field.
      if (isUnsafePatternError(err)) {
        patch({ saveError: t('customField.patternUnsafe') });
      } else {
        const issues = err instanceof ApiError ? readConfigIssues(err.payload) : [];
        const { lines, firstArea } = describeIssues(issues);
        // Jump to the tab of the first issue; unknown tabs fall back to Basics.
        patch({
          ...(firstArea && firstArea !== 'productOptions' ? { dialogTab: firstArea } : {}),
          saveError: [apiError(err), ...lines].join('\n'),
        });
      }
    } finally {
      patch({ saving: false });
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
  const typeLabel = (value: string) => allTypeLabels.find(ft => ft.value === value)?.label || value;

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
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { reset(); patch({ showForm: true }); }}>
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
        <FieldList
          fields={fields}
          on={on}
          primaryLocale={primaryLocale}
          canReorder={!!onReorder}
          typeLabel={typeLabel}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMove={handleMove}
          onSaveToLibrary={openSaveToLibrary}
          onAddChild={parentId => { reset(parentId); patch({ showForm: true }); }}
        />
      </CardContent>

      {/* Add Field Dialog */}
      <FieldDialog
        form={form}
        fields={fields}
        on={on}
        locales={locales}
        primaryLocale={primaryLocale}
        variantOptions={variantOptions}
        currency={currency}
        uploading={uploading}
        onPickImage={async () => (await pickAndUpload('products', false))[0]?.url ?? null}
        onSave={handleSave}
        onTranslate={handleTranslateTo}
        onClose={() => patch({ showForm: false })}
      />

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
