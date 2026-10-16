'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  applyPreset,
  cleanPresetParams,
  defaultPresetParams,
  listPresets,
  loadProductOptions,
  mergePresetSummaries,
  readConfigIssues,
  PRESET_MODES,
  type OptionConfigLike,
  type PresetMode,
  type PresetSummary,
} from '@/lib/personalization';
import { PresetParamsForm } from './PresetParamsForm';
import { ProductPicker } from './ProductPicker';
import { useConfigIssueText } from './useConfigIssueText';

export interface ApplyPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  primaryLocale: string;
  /** Store content locales (primary first), for locale params. */
  locales?: string[];
  /** Preset chosen up front (app page cards); otherwise the dialog shows a preset select. */
  presetKey?: string;
  /** Product fixed by the caller (product editor); otherwise the dialog shows a product picker. */
  productId?: string;
  /** Options of the fixed product as currently edited (may be unsaved); loaded from the API otherwise. */
  productOptions?: OptionConfigLike[];
  /** Preset list already loaded by the caller; loaded on open otherwise. */
  presets?: PresetSummary[];
  /** Called with the created fields after a successful apply. */
  onApplied?: (productId: string, fields: unknown[]) => void;
}

/**
 * "Apply preset" dialog (§6 PresetsPanel / CustomFieldManager header): target
 * product, params form built from `PresetSummary.params`, and the apply mode.
 * Calls `POST /personalization/my/products/:productId/presets/:key`.
 */
export function ApplyPresetDialog({
  open,
  onOpenChange,
  token,
  primaryLocale,
  locales,
  presetKey,
  productId,
  productOptions,
  presets: presetsProp,
  onApplied,
}: ApplyPresetDialogProps) {
  const t = useTranslations('creator.personalization.presets');
  const apiError = useApiError();
  const describeIssues = useConfigIssueText();

  const [presets, setPresets] = useState<PresetSummary[] | null>(presetsProp ? mergePresetSummaries(presetsProp) : null);
  const [key, setKey] = useState(presetKey ?? '');
  const [product, setProduct] = useState(productId ?? '');
  const [options, setOptions] = useState<OptionConfigLike[]>(productOptions ?? []);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [mode, setMode] = useState<PresetMode>('skip_if_exists');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Re-seed on every open.
  useEffect(() => {
    if (!open) return;
    setKey(presetKey ?? '');
    setProduct(productId ?? '');
    setOptions(productOptions ?? []);
    setMode('skip_if_exists');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  useEffect(() => {
    if (!open || presetsProp) return;
    let cancelled = false;
    listPresets(token)
      .then((list) => !cancelled && setPresets(mergePresetSummaries(list)))
      // The local catalogue keeps the dialog usable when the list cannot load.
      .catch(() => !cancelled && setPresets(mergePresetSummaries(null)));
    return () => {
      cancelled = true;
    };
  }, [open, presetsProp, token]);

  useEffect(() => {
    if (presetsProp) setPresets(mergePresetSummaries(presetsProp));
  }, [presetsProp]);

  const preset = useMemo(() => presets?.find((p) => p.key === key) ?? null, [presets, key]);

  // Defaults of the chosen preset.
  useEffect(() => {
    setValues(preset ? defaultPresetParams(preset.params) : {});
  }, [preset]);

  // Options of a product picked inside the dialog.
  useEffect(() => {
    if (!open || !product || (productId && productOptions)) return;
    let cancelled = false;
    setOptionsLoading(true);
    loadProductOptions(token, product)
      .then((opts) => !cancelled && setOptions(opts))
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setOptionsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, product, productId, productOptions, token]);

  const presetName = (k: string) => (t.has(`items.${k}.name`) ? t(`items.${k}.name`) : k);
  const missingRequired = preset?.params.some((p) => {
    if (!p.required) return false;
    const v = values[p.key];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const canApply = !!preset && !!product && !missingRequired && !saving;

  const handleApply = async () => {
    if (!preset || !canApply) return;
    setSaving(true);
    setError('');
    try {
      const fields = await applyPreset(token, product, preset.key, {
        params: cleanPresetParams(preset.params, values),
        mode,
      });
      onApplied?.(product, Array.isArray(fields) ? fields : []);
      onOpenChange(false);
    } catch (err) {
      const issues = err instanceof ApiError ? readConfigIssues(err.payload) : [];
      setError([apiError(err), ...describeIssues(issues).lines].join('\n'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            {preset ? t('applyTitleNamed', { name: presetName(preset.key) }) : t('applyTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto py-1 pe-1">
          {!presetKey && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('preset')}</Label>
              {presets === null ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <SearchableSelect
                  value={key}
                  onChange={setKey}
                  placeholder={t('pickPreset')}
                  options={presets.map((p) => ({
                    value: p.key,
                    label: presetName(p.key),
                    description: t.has(`items.${p.key}.description`) ? t(`items.${p.key}.description`) : undefined,
                  }))}
                />
              )}
            </div>
          )}

          {!productId && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('product')}</Label>
              <ProductPicker token={token} primaryLocale={primaryLocale} value={product} onChange={setProduct} />
            </div>
          )}

          {preset && product && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-xs font-semibold text-muted-foreground">{t('paramsTitle')}</p>
              {optionsLoading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <PresetParamsForm
                  presetKey={preset.key}
                  params={preset.params}
                  values={values}
                  onChange={setValues}
                  options={options}
                  locales={locales ?? [primaryLocale]}
                  primaryLocale={primaryLocale}
                />
              )}
            </div>
          )}

          {preset && (
            <div className="max-w-md space-y-1.5">
              <Label className="text-xs">{t('modeLabel')}</Label>
              <SearchableSelect
                value={mode}
                onChange={(v) => setMode(v as PresetMode)}
                options={PRESET_MODES.map((m) => ({ value: m, label: t(`mode.${m}`), description: t(`mode.${m}Hint`) }))}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-line">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!canApply}>
            {saving && <Loader2 className="me-1 size-3 animate-spin" />}
            {t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
