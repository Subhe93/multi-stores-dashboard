'use client';

import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CountryMultiSelect } from '@/components/common/CountryMultiSelect';
import { AppSettingsFooter } from '@/components/apps/AppSettingsFooter';
import { useStoreAppSettingsForm } from '@/components/apps/useStoreAppSettingsForm';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import { BUYER_TYPES, normalizeB2bSettings, prepareB2bSettings, sameB2bSettings, type BuyerType } from '@/lib/b2b';

interface B2bGeneralSettingsProps {
  app: MyStoreAppView;
  token: string;
}

/**
 * "Settings" tab of the B2B app page: company purchases, default buyer type,
 * VAT-number requirement and organisation-number validation. The reverse
 * charge fields live on their own tab but share the same settings object.
 */
export function B2bGeneralSettings({ app, token }: B2bGeneralSettingsProps) {
  const t = useTranslations('creator.apps.b2b.settings');
  const { form, update, saving, dirty, save, error, saved } = useStoreAppSettingsForm({
    app,
    token,
    normalize: normalizeB2bSettings,
    same: sameB2bSettings,
    prepare: prepareB2bSettings,
    fallbackError: t('saveFailed'),
  });

  const buyerTypeOptions = BUYER_TYPES.map((value) => ({
    value,
    label: value === 'COMPANY' ? t('company') : t('person'),
  }));

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-normal">{t('allowCompany')}</Label>
          <ToggleSwitch
            checked={form.allow_company}
            disabled={saving}
            onChange={(next) => update('allow_company', next)}
            label={t('allowCompany')}
          />
        </div>

        <div className="max-w-md space-y-1.5">
          <Label className="text-sm font-normal">{t('defaultBuyerType')}</Label>
          <SearchableSelect
            value={form.default_buyer_type}
            onChange={(value) => update('default_buyer_type', value as BuyerType)}
            options={buyerTypeOptions}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-normal">{t('requireVat')}</Label>
          <ToggleSwitch
            checked={form.require_vat_number}
            disabled={saving}
            onChange={(next) => update('require_vat_number', next)}
            label={t('requireVat')}
          />
        </div>

        <div className="max-w-md space-y-1.5">
          <Label className="text-sm font-normal">{t('orgCountries')}</Label>
          <CountryMultiSelect
            value={form.org_number_countries}
            onChange={(codes) => update('org_number_countries', codes)}
          />
          <p className="text-xs text-muted-foreground">{t('orgCountriesHint')}</p>
        </div>

        {/* Kustom collects organisation data in its own iframe; that only works
            when the merchant account has organisation purchases switched on. */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{t('kustomNote')}</span>
        </div>

        <AppSettingsFooter error={error} saved={saved} savedLabel={t('saved')} saving={saving} dirty={dirty} onSave={save} />
      </CardContent>
    </Card>
  );
}
