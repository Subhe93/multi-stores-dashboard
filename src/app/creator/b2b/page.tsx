'use client';

import { useTranslations } from 'next-intl';
import { Building2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { B2bGeneralSettings } from '@/components/apps/B2bGeneralSettings';
import { B2bReverseChargeSettings } from '@/components/apps/B2bReverseChargeSettings';
import { B2bExemptionsList } from '@/components/apps/B2bExemptionsList';
import { EcSalesReportPanel } from '@/components/taxes/EcSalesReportPanel';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';
import { normalizeB2bSettings } from '@/lib/b2b';

const TABS = ['settings', 'reverse-charge', 'exemptions', 'ec-sales'] as const;

/** Page of the "b2b" store app: business-buyer settings, reverse charge, exemptions and the EC sales list. */
export default function CreatorB2bPage() {
  const t = useTranslations('creator.b2b');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'b2b');
  const app = apps?.find((a) => a.key === 'b2b');
  const [tab, changeTab] = useUrlTab(TABS, 'settings');

  if (!token) return null;

  const header = <AppPageHeader icon={Building2} title={t('title')} subtitle={t('subtitle')} />;

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
        <AppTurnedOff icon={Building2} />
      </div>
    );
  }

  // Exemptions only take effect while reverse charge is on.
  const reverseChargeOn = normalizeB2bSettings(app.settings).reverse_charge_enabled;

  return (
    <div className="space-y-5">
      {header}

      <Tabs value={tab} onValueChange={(v) => changeTab(String(v))}>
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="settings" className="flex-none px-3">
            {t('tabs.settings')}
          </TabsTrigger>
          <TabsTrigger value="reverse-charge" className="flex-none px-3">
            {t('tabs.reverseCharge')}
          </TabsTrigger>
          <TabsTrigger value="exemptions" className="flex-none px-3">
            {t('tabs.exemptions')}
          </TabsTrigger>
          <TabsTrigger value="ec-sales" className="flex-none px-3">
            {t('tabs.ecSales')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="pt-4">
          <B2bGeneralSettings app={app} token={token} />
        </TabsContent>

        <TabsContent value="reverse-charge" className="pt-4">
          <B2bReverseChargeSettings app={app} token={token} />
        </TabsContent>

        <TabsContent value="exemptions" className="pt-4">
          {reverseChargeOn ? (
            <B2bExemptionsList token={token} />
          ) : (
            <Card className="shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldCheck className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">{t('exemptionsOff.title')}</p>
                <p className="max-w-sm text-sm text-muted-foreground">{t('exemptionsOff.body')}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => changeTab('reverse-charge')}>
                  {t('exemptionsOff.action')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ec-sales" className="pt-4">
          <EcSalesReportPanel token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
