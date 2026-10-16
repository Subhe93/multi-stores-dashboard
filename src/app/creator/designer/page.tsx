'use client';

import { useTranslations } from 'next-intl';
import { Loader2, PenTool } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { TemplatesTab } from '@/components/designer/TemplatesTab';
import { AssetsPanel } from '@/components/designer/AssetsPanel';
import { FontsPanel } from '@/components/designer/FontsPanel';
import { PrintQueueTab } from '@/components/designer/PrintQueueTab';
import { DesignerSettingsPanel } from '@/components/designer/DesignerSettingsPanel';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';

const TABS = ['templates', 'assets', 'print-queue', 'settings'] as const;

/**
 * Page of the "designer" store app (M4.2 §8.2): templates, the asset and
 * font libraries, the print queue and the settings (`?tab=settings` is the
 * registry href). Switched off, the page explains how to turn it on.
 */
export default function CreatorDesignerPage() {
  const t = useTranslations('creator.designer');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'designer');
  const app = apps?.find((a) => a.key === 'designer');
  const [tab, changeTab] = useUrlTab(TABS, 'templates');

  if (!token) return null;

  const header = <AppPageHeader icon={PenTool} title={t('title')} subtitle={t('subtitle')} />;

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
        <AppTurnedOff icon={PenTool} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <Tabs value={tab} onValueChange={(v) => changeTab(String(v))}>
        <TabsList variant="line" className="w-full justify-start rounded-none border-b px-0">
          <TabsTrigger value="templates" className="flex-none px-3">
            {t('tabs.templates')}
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex-none px-3">
            {t('tabs.assets')}
          </TabsTrigger>
          <TabsTrigger value="print-queue" className="flex-none px-3">
            {t('tabs.printQueue')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-3">
            {t('tabs.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="pt-4">
          <TemplatesTab token={token} />
        </TabsContent>
        <TabsContent value="assets" className="space-y-8 pt-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">{t('tabs.fonts')}</h2>
            <FontsPanel token={token} />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">{t('tabs.images')}</h2>
            <AssetsPanel token={token} />
          </section>
        </TabsContent>
        <TabsContent value="print-queue" className="pt-4">
          <PrintQueueTab token={token} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <DesignerSettingsPanel app={app} token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
