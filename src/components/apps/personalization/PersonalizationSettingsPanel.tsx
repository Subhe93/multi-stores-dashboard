'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { AppSettingsFooter } from '@/components/apps/AppSettingsFooter';
import { useStoreAppSettingsForm } from '@/components/apps/useStoreAppSettingsForm';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import { taxCountryOptions } from '@/lib/taxCountries';
import {
  normalizePersonalizationSettings,
  samePersonalizationSettings,
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  URL_PARAM_RE,
  URL_PREFILL_MAX_ENTRIES,
  URL_PREFILL_TARGET_MAX,
  type CardPriceMode,
  type ListingCta,
  type PersonalizationSettings,
} from '@/lib/personalization';

interface PersonalizationSettingsPanelProps {
  app: MyStoreAppView;
  token: string;
}

/** Sentinel of the country select for "automatic" (stored as null). */
const AUTO = '__auto__';

/** Editable row of the URL prefill map (kept as a list so order and blanks survive typing). */
interface PrefillRow {
  param: string;
  target: string;
}

const toRows = (map: Record<string, string>): PrefillRow[] =>
  Object.entries(map).map(([param, target]) => ({ param, target }));

/**
 * "Settings" tab of the personalization app page. Saves the whole settings
 * object through `PUT /stores/my/apps/personalization` `{settings}`.
 */
export function PersonalizationSettingsPanel({ app, token }: PersonalizationSettingsPanelProps) {
  const t = useTranslations('creator.personalization.settings');
  const uiLocale = useLocale();

  // The prefill map is edited as rows; incomplete rows are dropped on save.
  const prepare = (form: PersonalizationSettings): PersonalizationSettings => {
    const url_prefill: Record<string, string> = {};
    for (const [param, target] of Object.entries(form.url_prefill)) {
      const p = param.trim();
      const v = target.trim();
      // `__row<i>` keys are placeholders of rows whose param is still empty.
      if (!p || p.startsWith('__row')) continue;
      if (v && v !== 'option:' && URL_PARAM_RE.test(p) && v.length <= URL_PREFILL_TARGET_MAX) url_prefill[p] = v;
    }
    return { ...form, url_prefill };
  };

  const { form, update, saving, dirty, save, error, saved } = useStoreAppSettingsForm({
    app,
    token,
    normalize: normalizePersonalizationSettings,
    same: samePersonalizationSettings,
    prepare,
    fallbackError: t('saveFailed'),
  });

  const countryOptions = useMemo(
    () => [{ value: AUTO, label: t('countryAuto'), description: t('countryAutoHint') }, ...taxCountryOptions(uiLocale)],
    [uiLocale, t],
  );

  const rows = toRows(form.url_prefill);
  const setRows = (next: PrefillRow[]) => {
    const map: Record<string, string> = {};
    // Later duplicates overwrite earlier ones, like the API would.
    next.forEach((r, i) => {
      map[r.param || `__row${i}`] = r.target;
    });
    update('url_prefill', map);
  };
  const rowError = (r: PrefillRow) => (r.param && !r.param.startsWith('__row') && !URL_PARAM_RE.test(r.param) ? t('prefillParamInvalid') : '');

  const retentionInvalid =
    !Number.isInteger(form.retention_days) ||
    form.retention_days < RETENTION_MIN_DAYS ||
    form.retention_days > RETENTION_MAX_DAYS;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t('storefrontTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm font-normal">{t('freeShippingBadge')}</Label>
              <p className="text-xs text-muted-foreground">{t('freeShippingBadgeHint')}</p>
            </div>
            <ToggleSwitch
              checked={form.free_shipping_badge}
              disabled={saving}
              onChange={(next) => update('free_shipping_badge', next)}
              label={t('freeShippingBadge')}
            />
          </div>

          {form.free_shipping_badge && (
            <div className="max-w-md space-y-1.5">
              <Label className="text-sm font-normal">{t('freeShippingCountry')}</Label>
              <SearchableSelect
                value={form.free_shipping_country ?? AUTO}
                onChange={(v) => update('free_shipping_country', v === AUTO ? null : v)}
                options={countryOptions}
              />
            </div>
          )}

          <div className="max-w-md space-y-1.5">
            <Label className="text-sm font-normal">{t('cardPriceMode')}</Label>
            <SearchableSelect
              value={form.card_price_mode}
              onChange={(v) => update('card_price_mode', v as CardPriceMode)}
              options={[
                { value: 'selection', label: t('cardPriceSelection'), description: t('cardPriceSelectionHint') },
                { value: 'from', label: t('cardPriceFrom'), description: t('cardPriceFromHint') },
              ]}
            />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm font-normal">{t('validationSummary')}</Label>
              <p className="text-xs text-muted-foreground">{t('validationSummaryHint')}</p>
            </div>
            <ToggleSwitch
              checked={form.validation_summary}
              disabled={saving}
              onChange={(next) => update('validation_summary', next)}
              label={t('validationSummary')}
            />
          </div>

          <div className="max-w-md space-y-1.5">
            <Label className="text-sm font-normal">{t('listingCta')}</Label>
            <SearchableSelect
              value={form.listing_cta}
              onChange={(v) => update('listing_cta', v as ListingCta)}
              options={[
                { value: 'personalize', label: t('listingCtaPersonalize'), description: t('listingCtaPersonalizeHint') },
                { value: 'none', label: t('listingCtaNone') },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('prefillTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('prefillHint')}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 && (
              <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">{t('prefillEmpty')}</p>
            )}
            {rows.map((row, i) => {
              const err = rowError(row);
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-40 font-mono text-xs"
                      dir="ltr"
                      placeholder={t('prefillParamPlaceholder')}
                      value={row.param.startsWith('__row') ? '' : row.param}
                      aria-invalid={!!err || undefined}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, param: e.target.value } : r)))}
                    />
                    <span className="text-xs text-muted-foreground" aria-hidden>
                      <span className="rtl:hidden">→</span>
                      <span className="hidden rtl:inline">←</span>
                    </span>
                    <Input
                      className="h-8 flex-1 font-mono text-xs"
                      dir="ltr"
                      placeholder={t('prefillTargetPlaceholder')}
                      maxLength={URL_PREFILL_TARGET_MAX}
                      value={row.target}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, target: e.target.value } : r)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-red-500"
                      aria-label={t('prefillRemove')}
                      onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {err && <p className="text-[10px] text-red-600">{err}</p>}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={rows.length >= URL_PREFILL_MAX_ENTRIES}
              onClick={() => setRows([...rows, { param: '', target: '' }])}
            >
              <Plus className="me-1 size-3" /> {t('prefillAdd')}
            </Button>
            <p className="text-[10px] text-muted-foreground">{t('prefillTargetHint')}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('privacyTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-xs space-y-1.5">
              <Label className="text-sm font-normal">{t('retentionDays')}</Label>
              <Input
                type="number"
                min={RETENTION_MIN_DAYS}
                max={RETENTION_MAX_DAYS}
                className="h-8 text-sm"
                value={Number.isFinite(form.retention_days) ? String(form.retention_days) : ''}
                aria-invalid={retentionInvalid || undefined}
                onChange={(e) => update('retention_days', e.target.value === '' ? NaN : Number(e.target.value))}
              />
              <p className={`text-xs ${retentionInvalid ? 'text-red-600' : 'text-muted-foreground'}`}>
                {t('retentionHint', { min: RETENTION_MIN_DAYS, max: RETENTION_MAX_DAYS })}
              </p>
            </div>

            <AppSettingsFooter
              error={error}
              saved={saved}
              savedLabel={t('saved')}
              saving={saving}
              dirty={dirty && !retentionInvalid}
              onSave={save}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
