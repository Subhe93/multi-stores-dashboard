'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { AppSettingsFooter } from '@/components/apps/AppSettingsFooter';
import { useStoreAppSettingsForm } from '@/components/apps/useStoreAppSettingsForm';
import { api } from '@/lib/api';
import { useStoreType } from '@/lib/useStoreType';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import {
  REVERSE_CHARGE_PRICINGS,
  normalizeB2bSettings,
  prepareB2bSettings,
  sameB2bSettings,
  type ReverseChargePricing,
} from '@/lib/b2b';
import { countryLabel, EU_COUNTRY_CODES } from '@/lib/taxCountries';
import type { MyTaxSettings, TaxPricingMode } from '@/lib/taxRate';

interface B2bReverseChargeSettingsProps {
  app: MyStoreAppView;
  token: string;
}

/**
 * "Reverse charge" tab of the B2B app page (M2.5): VIES-validated EU
 * companies shipping to another EU country pay 0 % VAT; fail-closed when VIES
 * cannot confirm. Saves the same b2b settings object as the Settings tab.
 */
export function B2bReverseChargeSettings({ app, token }: B2bReverseChargeSettingsProps) {
  const t = useTranslations('creator.apps.b2b.settings');
  const tb = useTranslations('creator.b2b');
  const locale = useLocale();
  // Reverse charge needs the store as tax registrant (INDEPENDENT stores).
  const { storeType } = useStoreType();
  const marketplace = storeType === 'MARKETPLACE';
  const { form, update, saving, dirty, save, error, saved } = useStoreAppSettingsForm({
    app,
    token,
    normalize: normalizeB2bSettings,
    same: sameB2bSettings,
    prepare: prepareB2bSettings,
    fallbackError: t('saveFailed'),
  });
  // Store tax setup: the net/gross choice only matters for INCLUSIVE pricing,
  // and reverse charge needs an EU tax country. Null until loaded (or failed).
  const [taxSetup, setTaxSetup] = useState<{ mode: TaxPricingMode; country: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<MyTaxSettings>('/taxes/my/settings', { token })
      .then((res) => {
        if (cancelled || !res) return;
        setTaxSetup({
          mode: res.pricing_mode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE',
          country: (res.effective_tax_country ?? res.tax_country ?? null)?.toUpperCase() ?? null,
        });
      })
      .catch(() => {
        // Optional context only; the tab still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pricingOptions = REVERSE_CHARGE_PRICINGS.map((value) => ({
    value,
    label: value === 'net' ? t('rcPricingNet') : t('rcPricingGross'),
    description: value === 'net' ? t('rcPricingNetHint') : t('rcPricingGrossHint'),
  }));
  // Net/gross only matters for confirmed INCLUSIVE stores; hidden while the
  // tax settings load or when they failed to load.
  const showPricing = taxSetup?.mode === 'INCLUSIVE';
  const taxCountryOutsideEu = !!taxSetup?.country && !EU_COUNTRY_CODES.includes(taxSetup.country);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{tb('tabs.reverseCharge')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm font-medium">{t('reverseCharge')}</Label>
            <ToggleSwitch
              checked={form.reverse_charge_enabled}
              // Marketplace stores can still switch an enabled flag off.
              disabled={saving || (marketplace && !form.reverse_charge_enabled)}
              onChange={(next) => update('reverse_charge_enabled', next)}
              label={t('reverseCharge')}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('reverseChargeHint')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('reverseChargeOwnership')}</p>
        </div>

        {marketplace && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{t('reverseChargeIndependentOnly')}</span>
          </div>
        )}

        {taxCountryOutsideEu ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{t('reverseChargeNotEu', { country: countryLabel(taxSetup?.country ?? '', locale) })}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('reverseChargeEuNote')}</p>
        )}

        {form.reverse_charge_enabled && (
          <>
            {showPricing && (
              <div className="max-w-xl space-y-1.5">
                <Label className="text-sm font-normal">{t('rcPricing')}</Label>
                <SearchableSelect
                  value={form.reverse_charge_pricing}
                  onChange={(value) => update('reverse_charge_pricing', value as ReverseChargePricing)}
                  options={pricingOptions}
                />
                <div className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">{t('rcPricingExampleTitle')}</p>
                  <p>{t('rcPricingExampleNet')}</p>
                  <p>{t('rcPricingExampleGross')}</p>
                </div>
              </div>
            )}

            <div className="max-w-md space-y-1.5">
              <Label className="text-sm font-normal" htmlFor="b2b-vies-requester">
                {t('viesRequester')}
              </Label>
              <Input
                id="b2b-vies-requester"
                dir="ltr"
                className="h-8 font-mono text-sm"
                placeholder="SE556036079301"
                maxLength={32}
                value={form.vies_requester_vat ?? ''}
                disabled={saving}
                onChange={(e) => update('vies_requester_vat', e.target.value ? e.target.value : null)}
              />
              <p className="text-xs text-muted-foreground">{t('viesRequesterHint')}</p>
            </div>
          </>
        )}

        <AppSettingsFooter error={error} saved={saved} savedLabel={t('saved')} saving={saving} dirty={dirty} onSave={save} />
      </CardContent>
    </Card>
  );
}
