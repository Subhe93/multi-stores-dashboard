'use client';

import { useTranslations } from 'next-intl';
import { ListChecks, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { ProductionQueue } from '@/components/production/ProductionQueue';
import { ProductionSettingsPanel } from '@/components/production/ProductionSettingsPanel';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';

const TABS = ['queue', 'settings'] as const;

/**
 * Page of the "production" store app (M4.3): the production queue (open
 * orders with checklist progress) and the checklist settings
 * (`?tab=settings` is the registry href).
 */
export default function CreatorProductionPage() {
  const t = useTranslations('creator.production');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'production');
  const app = apps?.find((a) => a.key === 'production');
  const [tab, changeTab] = useUrlTab(TABS, 'queue');

  if (!token) return null;

  const header = <AppPageHeader icon={ListChecks} title={t('title')} subtitle={t('subtitle')} />;

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
        <AppTurnedOff icon={ListChecks} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <Tabs value={tab} onValueChange={(v) => changeTab(String(v))}>
        <TabsList variant="line" className="w-full justify-start rounded-none border-b px-0">
          <TabsTrigger value="queue" className="flex-none px-3">
            {t('tabs.queue')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-3">
            {t('tabs.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="pt-4">
          <ProductionQueue token={token} />
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <ProductionSettingsPanel app={app} token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
