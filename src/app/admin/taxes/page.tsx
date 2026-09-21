'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { TaxClassesManager } from '@/components/taxes/TaxClassesManager';
import { TaxRatesManager } from '@/components/taxes/TaxRatesManager';
import { TaxReportPanel } from '@/components/taxes/TaxReportPanel';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { taxCountryOptions } from '@/lib/taxCountries';
import type { PlatformTaxSettings, TaxClass, TaxPricingMode } from '@/lib/taxRate';

interface StoreOption {
  id: string;
  name: string;
}

const DEFAULT_SETTINGS: PlatformTaxSettings = {
  default_tax_pricing_mode: 'INCLUSIVE',
  platform_tax_country: null,
  platform_oss_registered: false,
};

// Admin tax hub: platform classes, platform rates, platform settings and the
// tax report (see plans/tax-system/API-CONTRACT-TAX.md §3 and §5).
export default function AdminTaxesPage() {
  const t = useTranslations('taxes');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  // Platform classes (shared by the Classes and Rates tabs)
  const [classes, setClasses] = useState<TaxClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  // Platform UI locales, used for class names / rate labels
  const [locales, setLocales] = useState<string[]>(['en']);

  // Settings tab
  const [settings, setSettings] = useState<PlatformTaxSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<PlatformTaxSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Report tab store filter (loaded lazily on first open)
  const [stores, setStores] = useState<StoreOption[] | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!token) return;
    setClassesLoading(true);
    try {
      const rows = await api<TaxClass[]>('/taxes/admin/classes', { token });
      setClasses(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error(err);
    } finally {
      setClassesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (!token) return;
    api<{ supported_locales?: string[]; default_locale?: string }>('/admin/platform-config', { token })
      .then((config) => {
        const supported = config?.supported_locales?.length ? config.supported_locales : ['en'];
        // English first so the fallback label is always filled.
        setLocales(['en', ...supported.filter((l) => l !== 'en')]);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setSettingsLoading(true);
    api<PlatformTaxSettings>('/taxes/admin/settings', { token })
      .then((s) => {
        const next: PlatformTaxSettings = {
          default_tax_pricing_mode: s?.default_tax_pricing_mode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE',
          platform_tax_country: s?.platform_tax_country || null,
          platform_oss_registered: !!s?.platform_oss_registered,
          tax_rates_seeded_at: s?.tax_rates_seeded_at ?? null,
        };
        setSettings(next);
        setSavedSettings(next);
      })
      .catch((err) => setSettingsMsg({ type: 'error', text: (err instanceof Error && err.message) || t('loadFailed') }))
      .finally(() => setSettingsLoading(false));
  }, [token, t]);

  // The report store filter needs a store list; there is no admin store index,
  // so the list is assembled from the creators and their stores on demand.
  const loadStores = useCallback(async () => {
    if (!token || stores !== null || storesLoading) return;
    setStoresLoading(true);
    try {
      const res = await api<{ data?: { id: string; display_name: string }[] }>('/creators?limit=100', { token });
      const creators = res?.data || [];
      const results = await Promise.allSettled(
        creators.map((c) => api<{ id: string; name: string }>(`/stores/by-creator/${c.id}`, { token })),
      );
      const list: StoreOption[] = [];
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.id) list.push({ id: r.value.id, name: r.value.name });
      });
      setStores(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [token, stores, storesLoading]);

  const settingsDirty =
    settings.default_tax_pricing_mode !== savedSettings.default_tax_pricing_mode ||
    (settings.platform_tax_country || null) !== (savedSettings.platform_tax_country || null) ||
    settings.platform_oss_registered !== savedSettings.platform_oss_registered;

  const handleSaveSettings = async () => {
    if (!token || settingsSaving) return;
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const body = {
        default_tax_pricing_mode: settings.default_tax_pricing_mode,
        platform_tax_country: settings.platform_tax_country || null,
        platform_oss_registered: settings.platform_oss_registered,
      };
      const updated = await api<PlatformTaxSettings>('/taxes/admin/settings', { method: 'PUT', token, body: JSON.stringify(body) });
      const next: PlatformTaxSettings = { ...settings, ...(updated && typeof updated === 'object' ? updated : {}) };
      setSettings(next);
      setSavedSettings(next);
      setSettingsMsg({ type: 'success', text: t('settingsSaved') });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: (err instanceof Error && err.message) || t('settingsSaveFailed') });
    } finally {
      setSettingsSaving(false);
    }
  };

  const countryOptions = useMemo(() => taxCountryOptions(locale), [locale]);

  const pricingModes: { value: TaxPricingMode; label: string; hint: string }[] = [
    { value: 'INCLUSIVE', label: t('pricingModeInclusive'), hint: t('pricingModeInclusiveHint') },
    { value: 'EXCLUSIVE', label: t('pricingModeExclusive'), hint: t('pricingModeExclusiveHint') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs
        defaultValue="classes"
        onValueChange={(value) => {
          if (value === 'report') void loadStores();
        }}
      >
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="classes" className="flex-none px-3">{t('tabClasses')}</TabsTrigger>
          <TabsTrigger value="rates" className="flex-none px-3">{t('tabRates')}</TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-3">{t('tabSettings')}</TabsTrigger>
          <TabsTrigger value="report" className="flex-none px-3">{t('tabReport')}</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="pt-4">
          <TaxClassesManager classes={classes} loading={classesLoading} locales={locales} onChanged={() => void fetchClasses()} />
        </TabsContent>

        <TabsContent value="rates" className="pt-4">
          <TaxRatesManager
            endpoint="/taxes/admin/rates"
            classes={classes}
            locales={locales}
            canSeed
            onSeeded={() => void fetchClasses()}
            note={t('platformRatesHint')}
          />
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <Card className="shadow-none max-w-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('settingsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {settingsLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">{t('platformSettingsHint')}</p>

                  {/* Pricing mode */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pricingMode')}</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pricingModes.map((mode) => (
                        <label
                          key={mode.value}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                            settings.default_tax_pricing_mode === mode.value ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="platform-pricing-mode"
                            className="mt-0.5 accent-zinc-900"
                            checked={settings.default_tax_pricing_mode === mode.value}
                            onChange={() => setSettings({ ...settings, default_tax_pricing_mode: mode.value })}
                          />
                          <span className="space-y-0.5">
                            <span className="block text-sm font-medium">{mode.label}</span>
                            <span className="block text-[11px] text-muted-foreground">{mode.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Platform registration country */}
                  <div className="space-y-1.5 max-w-xs">
                    <Label className="text-xs">{t('platformCountry')}</Label>
                    <SearchableSelect
                      value={settings.platform_tax_country || ''}
                      onChange={(v) => setSettings({ ...settings, platform_tax_country: v || null })}
                      options={[{ value: '', label: t('noCountry') }, ...countryOptions]}
                      placeholder={t('selectCountry')}
                    />
                    <p className="text-[10px] text-muted-foreground">{t('platformCountryHint')}</p>
                  </div>

                  {/* OSS */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t('ossRegistered')}</p>
                      <p className="text-[11px] text-muted-foreground">{t('ossRegisteredHint')}</p>
                    </div>
                    <ToggleSwitch
                      checked={settings.platform_oss_registered}
                      onChange={(v) => setSettings({ ...settings, platform_oss_registered: v })}
                      label={t('ossRegistered')}
                    />
                  </div>

                  {settings.tax_rates_seeded_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {t('seededAt', { date: new Date(settings.tax_rates_seeded_at).toLocaleDateString(locale) })}
                    </p>
                  )}

                  {settingsMsg && (
                    <p className={`text-[11px] ${settingsMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{settingsMsg.text}</p>
                  )}

                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSaveSettings} disabled={settingsSaving || !settingsDirty}>
                      {settingsSaving && <Loader2 className="size-3.5 animate-spin" />}
                      {settingsSaving ? tc('saving') : tc('save')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="pt-4">
          <TaxReportPanel endpoint="/taxes/admin/report" stores={stores ?? []} storesLoading={storesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
