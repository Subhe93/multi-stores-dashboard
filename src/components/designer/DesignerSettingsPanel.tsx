'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppSettingsFooter } from '@/components/apps/AppSettingsFooter';
import { useStoreAppSettingsForm } from '@/components/apps/useStoreAppSettingsForm';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import { loadStoreLocales } from '@/lib/personalization';

/** Mirror of the API `DesignerSettings` (designer-settings.ts). */
export interface DesignerSettings {
  retention_days: number;
  draft_retention_days: number;
  print_keep_days_after_shipped: number;
  max_upload_mb: number;
  min_effective_dpi_warning: number;
  print_px_per_mm: number;
  print_formats: string[];
  shop_button_text: Record<string, string>;
}

type IntKey = 'retention_days' | 'draft_retention_days' | 'print_keep_days_after_shipped' | 'max_upload_mb' | 'min_effective_dpi_warning';

/** API DESIGNER_SETTINGS_LIMITS. */
const LIMITS: Record<IntKey, [number, number]> = {
  retention_days: [7, 730],
  draft_retention_days: [1, 730],
  print_keep_days_after_shipped: [0, 365],
  max_upload_mb: [1, 40],
  min_effective_dpi_warning: [30, 300],
};
const BUTTON_TEXT_MAX = 40;

const DEFAULTS: DesignerSettings = {
  retention_days: 60,
  draft_retention_days: 30,
  print_keep_days_after_shipped: 30,
  max_upload_mb: 25,
  min_effective_dpi_warning: 100,
  print_px_per_mm: 6,
  print_formats: ['png'],
  // No default text: an empty map means the storefront uses its own translated label.
  shop_button_text: {},
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function normalize(raw: unknown): DesignerSettings {
  const r = isRecord(raw) ? raw : {};
  const int = (k: IntKey) => {
    const v = r[k];
    const [min, max] = LIMITS[k];
    return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : DEFAULTS[k];
  };
  const text: Record<string, string> = {};
  if (isRecord(r.shop_button_text)) {
    for (const [k, v] of Object.entries(r.shop_button_text)) if (typeof v === 'string' && v.trim()) text[k] = v;
  }
  return {
    retention_days: int('retention_days'),
    draft_retention_days: int('draft_retention_days'),
    print_keep_days_after_shipped: int('print_keep_days_after_shipped'),
    max_upload_mb: int('max_upload_mb'),
    min_effective_dpi_warning: int('min_effective_dpi_warning'),
    print_px_per_mm: 6,
    print_formats: ['png'],
    shop_button_text: text,
  };
}

const same = (a: DesignerSettings, b: DesignerSettings) => JSON.stringify(a) === JSON.stringify(b);

/** Empty button texts are dropped; the API rejects texts over 40 characters. */
const prepare = (f: DesignerSettings): DesignerSettings => {
  const text: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.shop_button_text)) if (v.trim()) text[k] = v.trim();
  return { ...f, shop_button_text: text };
};

const fieldId = (k: string) => `dz-set-${k}`;

/**
 * "Settings" tab: retention (photo originals, drafts, print files), upload
 * limit, low-DPI warning threshold, print resolution (locked at 6 px/mm in
 * M4.2) and the storefront button text per store locale. Saving an invalid
 * value focuses the field instead of sending it.
 */
export function DesignerSettingsPanel({ app, token }: { app: MyStoreAppView; token: string }) {
  const t = useTranslations('creator.designer.settings');
  const [locales, setLocales] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const { form, update, saving, dirty, save, error, saved } = useStoreAppSettingsForm({
    app,
    token,
    normalize,
    same,
    prepare,
    fallbackError: t('saveFailed'),
  });

  useEffect(() => {
    let cancelled = false;
    loadStoreLocales(token)
      .then(({ locales: list }) => {
        if (!cancelled) setLocales(list);
      })
      .catch(() => {
        // Keep the stored locales only.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const allLocales = [...new Set([...locales, ...Object.keys(form.shop_button_text)])];

  const intError = (k: IntKey): string | null => {
    const v = form[k];
    const [min, max] = LIMITS[k];
    const hi = k === 'draft_retention_days' ? Math.min(max, form.retention_days || max) : max;
    if (!Number.isInteger(v) || v < min || v > hi) {
      return k === 'draft_retention_days' && Number.isInteger(v) && v > hi ? t('draftsTooLong') : t('rangeError', { min, max: hi });
    }
    return null;
  };
  const textError = (loc: string): string | null =>
    (form.shop_button_text[loc] ?? '').trim().length > BUTTON_TEXT_MAX ? t('buttonTextTooLong', { max: BUTTON_TEXT_MAX }) : null;

  const firstInvalid = (): string | null => {
    for (const k of Object.keys(LIMITS) as IntKey[]) if (intError(k)) return fieldId(k);
    for (const loc of allLocales) if (textError(loc)) return fieldId(`btn-${loc}`);
    return null;
  };

  const onSave = () => {
    const bad = firstInvalid();
    if (bad) {
      setShowErrors(true);
      const node = document.getElementById(bad);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node?.focus({ preventScroll: true });
      return;
    }
    setShowErrors(false);
    save();
  };

  const numField = (k: IntKey, label: string, hint: string) => {
    const err = intError(k);
    const visible = showErrors || (err !== null && Number.isFinite(form[k]));
    return (
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor={fieldId(k)} className="text-sm font-normal">
          {label}
        </Label>
        <Input
          id={fieldId(k)}
          type="number"
          dir="ltr"
          min={LIMITS[k][0]}
          max={LIMITS[k][1]}
          className="h-8 text-sm"
          value={Number.isFinite(form[k]) ? String(form[k]) : ''}
          aria-invalid={(visible && !!err) || undefined}
          onChange={(e) => update(k, e.target.value === '' ? NaN : Number(e.target.value))}
        />
        <p className={`text-xs ${visible && err ? 'text-red-600' : 'text-muted-foreground'}`}>{visible && err ? err : hint}</p>
      </div>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('privacyTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('privacyIntro')}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {numField('retention_days', t('retentionDays'), t('retentionDaysHint', { min: 7, max: 730 }))}
            {numField('draft_retention_days', t('draftDays'), t('draftDaysHint'))}
            {numField('print_keep_days_after_shipped', t('keepDays'), t('keepDaysHint'))}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('photosTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {numField('max_upload_mb', t('maxUpload'), t('maxUploadHint', { min: 1, max: 40 }))}
            {numField('min_effective_dpi_warning', t('minDpi'), t('minDpiHint', { min: 30, max: 300 }))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('printTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-3 py-2">
              <span>{t('printResolution')}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> {t('printResolutionValue')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-3 py-2">
              <span>{t('printFormats')}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> {t('printFormatsValue')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t('printHint')}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('storefrontTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('buttonTextHint', { max: BUTTON_TEXT_MAX })}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {allLocales.map((loc) => {
                const err = textError(loc);
                return (
                  <div key={loc} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={fieldId(`btn-${loc}`)} className="w-8 shrink-0 text-center font-mono text-[11px] uppercase text-muted-foreground">
                        {loc}
                      </Label>
                      <Input
                        id={fieldId(`btn-${loc}`)}
                        className="h-8 text-sm"
                        value={form.shop_button_text[loc] ?? ''}
                        aria-invalid={!!err || undefined}
                        placeholder={t('buttonTextPlaceholder')}
                        onChange={(e) => update('shop_button_text', { ...form.shop_button_text, [loc]: e.target.value })}
                      />
                    </div>
                    {err && <p className="ps-10 text-xs text-red-600">{err}</p>}
                  </div>
                );
              })}
            </div>

            <AppSettingsFooter error={error} saved={saved} savedLabel={t('saved')} saving={saving} dirty={dirty} onSave={onSave} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
