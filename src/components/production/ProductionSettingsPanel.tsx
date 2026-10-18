'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Info, Loader2, Mail, RefreshCw, Wand2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { TagInput } from '@/components/common/TagInput';
import { AppSettingsFooter } from '@/components/apps/AppSettingsFooter';
import { useStoreAppSettingsForm } from '@/components/apps/useStoreAppSettingsForm';
import { useApiError } from '@/lib/useApiError';
import { FIELD_TYPES } from '@/lib/customFields';
import { cn } from '@/lib/utils';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import {
  PRODUCTION_LIMITS,
  applyProductionPreset,
  normalizeProductionSettings,
  prepareProductionSettings,
  productionApi,
  sameProductionSettings,
  type ProductionBackfillResult,
  type ProductionCompleteTarget,
  type ProductionOnComplete,
  type ProductionOnPrintReady,
  type ProductionSettings,
  type ProductionShipPrompt,
} from './production.api';

// Field types a check can come from (core + personalization-app types).
const EXCLUDABLE_FIELD_TYPES: readonly string[] = [...FIELD_TYPES, 'CHECKBOX_GROUP', 'COLOR_PALETTE', 'REPEATER'];

// `customField.type*` labels already exist for most types (FONT has none).
const FIELD_TYPE_LABEL_KEY: Record<string, string> = {
  TEXT: 'typeText',
  TEXTAREA: 'typeTextarea',
  NUMBER: 'typeNumber',
  IMAGE: 'typeImage',
  FILE: 'typeFile',
  SELECT: 'typeSelect',
  COLOR: 'typeColor',
  DATE: 'typeDate',
  MULTI_IMAGE: 'typeMultiImage',
  CHECKBOX_GROUP: 'typeCheckboxGroup',
  COLOR_PALETTE: 'typeColorPalette',
  REPEATER: 'typeRepeater',
};

interface ProductionSettingsPanelProps {
  app: MyStoreAppView;
  token: string;
}

/** "Settings" tab of the production app: checklist sources, automation, preset and backfill. */
export function ProductionSettingsPanel({ app, token }: ProductionSettingsPanelProps) {
  const t = useTranslations('creator.production.settings');
  const uid = useId();
  const tStatus = useTranslations('creator.orderStatus');
  const tField = useTranslations('customField');
  const apiError = useApiError();
  // PUT /stores/my/apps/production rejects unknown keys
  // (STORE_APP_SETTINGS_INVALID): `prepare` rebuilds the payload from the
  // known keys only, so stray keys of an older saved object never go back.
  const { form, update, saving, dirty, save, error, saved } = useStoreAppSettingsForm<ProductionSettings>({
    app,
    token,
    normalize: normalizeProductionSettings,
    same: sameProductionSettings,
    prepare: prepareProductionSettings,
    fallbackError: t('saveFailed'),
  });

  const [presets, setPresets] = useState<Record<string, Partial<ProductionSettings>> | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<ProductionBackfillResult | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    productionApi
      .settings(token)
      .then((res) => {
        if (!cancelled) setPresets(res?.presets ?? {});
      })
      .catch(() => {
        if (!cancelled) setPresets({});
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const namez = presets?.namez;

  const applyNamez = () => {
    const next = applyProductionPreset(form, namez);
    (Object.keys(next) as (keyof ProductionSettings)[]).forEach((key) => {
      if (JSON.stringify(next[key]) !== JSON.stringify(form[key])) update(key, next[key]);
    });
    setPresetApplied(true);
  };

  const runBackfill = async () => {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillError(null);
    setBackfillResult(null);
    try {
      const res = await productionApi.backfill(token);
      // Each call handles one batch; `remaining` > 0 offers "Continue".
      setBackfillResult({
        synced: res?.synced ?? 0,
        failed: res?.failed ?? 0,
        remaining: res?.remaining ?? 0,
      });
    } catch (err) {
      setBackfillError(apiError(err));
    } finally {
      setBackfilling(false);
    }
  };

  const fieldTypeLabel = (type: string) => {
    const key = FIELD_TYPE_LABEL_KEY[type];
    if (key && tField.has(key)) return tField(key);
    return type === 'FONT' ? t('fontType') : type;
  };

  const toggleFieldType = (type: string) => {
    const has = form.exclude_field_types.includes(type);
    update('exclude_field_types', has ? form.exclude_field_types.filter((x) => x !== type) : [...form.exclude_field_types, type]);
  };

  const onCompleteOptions = [
    { value: 'none', label: t('onComplete.none'), description: t('onComplete.noneHint') },
    { value: 'suggest', label: t('onComplete.suggest'), description: t('onComplete.suggestHint') },
    // Automatic shipping is never allowed (payment capture + shipped email without tracking).
    ...(form.complete_target === 'SHIPPED'
      ? []
      : [{ value: 'auto', label: t('onComplete.auto'), description: t('onComplete.autoHint') }]),
  ];

  const targetOptions = [
    { value: 'QUALITY_CHECK', label: tStatus('QUALITY_CHECK') },
    { value: 'SHIPPED', label: tStatus('SHIPPED') },
  ];

  const setTarget = (value: string) => {
    const target = value as ProductionCompleteTarget;
    update('complete_target', target);
    if (target === 'SHIPPED' && form.on_complete === 'auto') update('on_complete', 'suggest');
  };

  // M5.4: what the "move to Shipped" banner asks for.
  const shipPromptOptions = (['none', 'tracking_optional', 'tracking_required'] as ProductionShipPrompt[]).map((value) => ({
    value,
    label: t(`shipPrompt.${value}`),
  }));

  // M5.4: designer print files rendered → move the order forward once.
  const onPrintReadyOptions = (['none', 'PROCESSING', 'MANUFACTURING'] as ProductionOnPrintReady[]).map((value) => ({
    value,
    label: value === 'none' ? t('onPrintReady.none') : t('onPrintReady.moveTo', { status: tStatus(value) }),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* What becomes a check */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('sourcesTitle')}</CardTitle>
            <CardDescription>{t('sourcesHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${uid}-variant-options`} className="text-sm font-normal">{t('includeVariantOptions')}</Label>
                <p className="text-xs text-muted-foreground">{t('includeVariantOptionsHint')}</p>
              </div>
              <ToggleSwitch
                id={`${uid}-variant-options`}
                checked={form.include_variant_options}
                disabled={saving}
                onChange={(next) => update('include_variant_options', next)}
                label={t('includeVariantOptions')}
              />
            </div>

            {form.include_variant_options && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-exclude-options`} className="text-sm font-normal">{t('excludeOptionNames')}</Label>
                <TagInput
                  id={`${uid}-exclude-options`}
                  tags={form.exclude_option_names}
                  onChange={(tags) => update('exclude_option_names', tags.slice(0, PRODUCTION_LIMITS.exclude_option_names))}
                  placeholder={t('excludeOptionNamesPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('excludeOptionNamesHint', { max: PRODUCTION_LIMITS.exclude_option_names })}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label id={`${uid}-exclude-types`} className="text-sm font-normal">{t('excludeFieldTypes')}</Label>
              <div role="group" aria-labelledby={`${uid}-exclude-types`} className="flex flex-wrap gap-1.5">
                {EXCLUDABLE_FIELD_TYPES.map((type) => {
                  const active = form.exclude_field_types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleFieldType(type)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        active ? 'border-red-200 bg-red-50 text-red-700 line-through' : 'border-border bg-background hover:bg-muted',
                      )}
                    >
                      {fieldTypeLabel(type)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t('excludeFieldTypesHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-exclude-fields`} className="text-sm font-normal">{t('excludeFieldNames')}</Label>
              <TagInput
                id={`${uid}-exclude-fields`}
                tags={form.exclude_field_names}
                onChange={(tags) => update('exclude_field_names', tags.slice(0, PRODUCTION_LIMITS.exclude_field_names))}
                placeholder={t('excludeFieldNamesPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('excludeFieldNamesHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-custom-items`} className="text-sm font-normal">{t('defaultCustomItems')}</Label>
              <TagInput
                id={`${uid}-custom-items`}
                tags={form.default_custom_items}
                onChange={(tags) =>
                  update(
                    'default_custom_items',
                    tags.map((s) => s.slice(0, PRODUCTION_LIMITS.label)).slice(0, PRODUCTION_LIMITS.default_custom_items),
                  )
                }
                placeholder={t('defaultCustomItemsPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('defaultCustomItemsHint', { max: PRODUCTION_LIMITS.default_custom_items })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status automation */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('automationTitle')}</CardTitle>
            <CardDescription>{t('automationHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-on-complete`} className="text-sm font-normal">{t('onCompleteLabel')}</Label>
                <SearchableSelect
                  id={`${uid}-on-complete`}
                  value={form.on_complete}
                  onChange={(v) => update('on_complete', v as ProductionOnComplete)}
                  options={onCompleteOptions}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-complete-target`} className="text-sm font-normal">{t('completeTarget')}</Label>
                <SearchableSelect id={`${uid}-complete-target`} value={form.complete_target} onChange={setTarget} options={targetOptions} />
              </div>
            </div>
            {form.complete_target === 'SHIPPED' && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>{t('shippedNeverAuto')}</span>
              </div>
            )}
            {form.complete_target === 'SHIPPED' && form.on_complete !== 'none' && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-ship-prompt`} className="text-sm font-normal">{t('shipPromptLabel')}</Label>
                <SearchableSelect
                  id={`${uid}-ship-prompt`}
                  value={form.ship_prompt}
                  onChange={(v) => update('ship_prompt', v as ProductionShipPrompt)}
                  options={shipPromptOptions}
                />
                <p className="text-xs text-muted-foreground">{t('shipPromptHint')}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-print-ready`} className="text-sm font-normal">{t('onPrintReadyLabel')}</Label>
              <SearchableSelect
                id={`${uid}-print-ready`}
                value={form.on_print_ready}
                onChange={(v) => update('on_print_ready', v as ProductionOnPrintReady)}
                options={onPrintReadyOptions}
              />
              <p className="text-xs text-muted-foreground">{t('onPrintReadyHint')}</p>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${uid}-first-check`} className="text-sm font-normal">{t('startOnFirstCheck')}</Label>
                <p className="text-xs text-muted-foreground">{t('startOnFirstCheckHint')}</p>
              </div>
              <ToggleSwitch
                id={`${uid}-first-check`}
                checked={form.start_on_first_check}
                disabled={saving}
                onChange={(next) => update('start_on_first_check', next)}
                label={t('startOnFirstCheck')}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${uid}-quality-check`} className="text-sm font-normal">{t('useQualityCheck')}</Label>
                <p className="text-xs text-muted-foreground">{t('useQualityCheckHint')}</p>
              </div>
              <ToggleSwitch
                id={`${uid}-quality-check`}
                checked={form.use_quality_check}
                disabled={saving}
                onChange={(next) => update('use_quality_check', next)}
                label={t('useQualityCheck')}
              />
            </div>

            <AppSettingsFooter error={error} saved={saved} savedLabel={t('saved')} saving={saving} dirty={dirty} onSave={save} />
          </CardContent>
        </Card>

        {/* Staff notifications (M5.4) */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4 text-muted-foreground" />
              {t('notificationsTitle')}
            </CardTitle>
            <CardDescription>{t('notificationsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${uid}-notify-new`} className="text-sm font-normal">{t('notifyNewOrder')}</Label>
                <p className="text-xs text-muted-foreground">{t('notifyNewOrderHint')}</p>
              </div>
              <ToggleSwitch
                id={`${uid}-notify-new`}
                checked={form.notify_new_order}
                disabled={saving}
                onChange={(next) => update('notify_new_order', next)}
                label={t('notifyNewOrder')}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${uid}-notify-digest`} className="text-sm font-normal">{t('notifyDailyDigest')}</Label>
                <p className="text-xs text-muted-foreground">{t('notifyDailyDigestHint')}</p>
              </div>
              <ToggleSwitch
                id={`${uid}-notify-digest`}
                checked={form.notify_daily_digest}
                disabled={saving}
                onChange={(next) => update('notify_daily_digest', next)}
                label={t('notifyDailyDigest')}
              />
            </div>

            {(form.notify_new_order || form.notify_daily_digest) && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-notify-email`} className="text-sm font-normal">{t('notifyEmail')}</Label>
                <Input
                  id={`${uid}-notify-email`}
                  type="email"
                  autoComplete="email"
                  value={form.notify_email ?? ''}
                  onChange={(e) => update('notify_email', e.target.value.trim() ? e.target.value : null)}
                  placeholder={t('notifyEmailPlaceholder')}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">{t('notifyEmailHint')}</p>
              </div>
            )}

            <AppSettingsFooter error={error} saved={saved} savedLabel={t('saved')} saving={saving} dirty={dirty} onSave={save} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {namez && (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Wand2 className="size-4 text-muted-foreground" />
                {t('presetTitle')}
              </CardTitle>
              <CardDescription>{t('presetHint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={saving} onClick={applyNamez}>
                {t('applyNamezPreset')}
              </Button>
              {presetApplied && dirty && <p className="text-xs text-muted-foreground">{t('presetAppliedHint')}</p>}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className="size-4 text-muted-foreground" />
              {t('backfillTitle')}
            </CardTitle>
            <CardDescription>{t('backfillHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button type="button" variant="outline" size="sm" className="w-full" disabled={backfilling} onClick={runBackfill}>
              {backfilling ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t('backfillAction')}
            </Button>
            {backfillResult && (
              <div className="space-y-2">
                <p className={cn('text-xs font-medium', backfillResult.failed > 0 ? 'text-amber-700' : 'text-emerald-600')}>
                  {t('backfillResult', {
                    synced: backfillResult.synced,
                    failed: backfillResult.failed,
                    remaining: backfillResult.remaining,
                  })}
                </p>
                {backfillResult.remaining > 0 && (
                  <Button type="button" size="sm" className="w-full" disabled={backfilling} onClick={runBackfill}>
                    {backfilling ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    {t('backfillContinue', { remaining: backfillResult.remaining })}
                  </Button>
                )}
              </div>
            )}
            {backfillError && <p className="text-xs text-red-600">{backfillError}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
