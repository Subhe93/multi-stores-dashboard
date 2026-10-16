'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, PenLine } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { PersonalizationSettingsPanel } from '@/components/apps/personalization/PersonalizationSettingsPanel';
import { PresetsPanel } from '@/components/apps/personalization/PresetsPanel';
import { LibraryPanel } from '@/components/apps/personalization/LibraryPanel';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';
import { loadStoreLocales } from '@/lib/personalization';

const TABS = ['settings', 'presets', 'library'] as const;

/** Page of the "personalization" store app: settings, presets and the field library. */
export default function CreatorPersonalizationPage() {
  const t = useTranslations('creator.personalization');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'personalization');
  const app = apps?.find((a) => a.key === 'personalization');
  const [tab, changeTab] = useUrlTab(TABS, 'settings');
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [storeLocales, setStoreLocales] = useState<string[]>(['en']);

  useEffect(() => {
    if (!token || !enabled) return;
    let cancelled = false;
    loadStoreLocales(token)
      .then(({ primary, locales }) => {
        if (cancelled) return;
        setPrimaryLocale(primary);
        setStoreLocales(locales);
      })
      .catch(() => {
        // Product titles then fall back to the first translation.
      });
    return () => {
      cancelled = true;
    };
  }, [token, enabled]);

  if (!token) return null;

  const header = <AppPageHeader icon={PenLine} title={t('title')} subtitle={t('subtitle')} />;

  if (appsLoading && !apps) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!enabled || !app) {
    return (
      <div className="space-y-5">
        {header}
        <AppTurnedOff icon={PenLine} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <Tabs value={tab} onValueChange={(v) => changeTab(String(v))}>
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="settings" className="flex-none px-3">
            {t('tabs.settings')}
          </TabsTrigger>
          <TabsTrigger value="presets" className="flex-none px-3">
            {t('tabs.presets')}
          </TabsTrigger>
          <TabsTrigger value="library" className="flex-none px-3">
            {t('tabs.library')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="pt-4">
          <PersonalizationSettingsPanel app={app} token={token} />
        </TabsContent>

        <TabsContent value="presets" className="pt-4">
          <PresetsPanel token={token} primaryLocale={primaryLocale} locales={storeLocales} />
        </TabsContent>

        <TabsContent value="library" className="pt-4">
          <LibraryPanel token={token} primaryLocale={primaryLocale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
