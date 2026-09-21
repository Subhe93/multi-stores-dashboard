'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaxRatesManager } from '@/components/taxes/TaxRatesManager';
import { TaxReportPanel } from '@/components/taxes/TaxReportPanel';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { countryName } from '@/lib/taxCountries';
import type { MyTaxSettings } from '@/lib/taxRate';

interface StoreLanguageConfig {
  language_config?: { primary_locale?: string; secondary_locales?: string[] };
}

// Creator tax page: own rates (independent stores) and the store tax report.
export default function CreatorTaxesPage() {
  const t = useTranslations('taxes');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [settings, setSettings] = useState<MyTaxSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Store content locales, offered for the rate labels.
  const [locales, setLocales] = useState<string[]>(['en']);

  useEffect(() => {
    if (!token) return;
    api<MyTaxSettings>('/taxes/my/settings', { token })
      .then((s) => setSettings(s))
      .catch((err) => setLoadError((err instanceof Error && err.message) || t('loadFailed')))
      .finally(() => setLoading(false));
    api<StoreLanguageConfig>('/stores/my/store', { token })
      .then((store) => {
        const primary = store?.language_config?.primary_locale || 'en';
        const secondary = store?.language_config?.secondary_locales || [];
        setLocales(Array.from(new Set([primary, ...secondary, 'en'])));
      })
      .catch(() => {});
  }, [token, t]);

  const platformManaged = settings?.registrant === 'PLATFORM';
  const platformCountry = settings?.effective_tax_country ?? settings?.tax_country ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('creatorTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('creatorSubtitle')}{' '}
          <Link href="/creator/settings" className="text-primary hover:underline">{t('taxSettingsLink')}</Link>
        </p>
      </div>

      {loadError && <p className="text-[11px] text-red-600">{loadError}</p>}

      <Tabs defaultValue="rates">
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="rates" className="flex-none px-3">{t('tabRates')}</TabsTrigger>
          <TabsTrigger value="report" className="flex-none px-3">{t('tabReport')}</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="pt-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">{tc('loading')}</p>
          ) : platformManaged ? (
            // Marketplace stores: the platform is the tax registrant, so the
            // store has no rates of its own.
            <Card className="shadow-none max-w-2xl">
              <CardContent className="flex items-start gap-3 pt-5">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('platformManagedTitle')}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {platformCountry
                      ? t('platformManagedRates', { country: countryName(platformCountry, locale) })
                      : t('platformManagedRatesNoCountry')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <TaxRatesManager
              endpoint="/taxes/my/rates"
              classes={settings?.classes || []}
              locales={locales}
              note={settings?.use_platform_tax_rates ? t('ownRatesWithPlatformHint') : t('ownRatesOnlyHint')}
            />
          )}
        </TabsContent>

        <TabsContent value="report" className="pt-4">
          <TaxReportPanel endpoint="/taxes/my/report" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
