'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Rss } from 'lucide-react';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { FeedsSettingsPanel } from '@/components/feeds/FeedsSettingsPanel';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

/**
 * Page of the "feeds" store app (M5.6): Google Merchant / Meta catalog feed
 * settings, the per-market feed URLs and the server-side validation.
 */
export default function CreatorFeedsPage() {
  const t = useTranslations('creator.feeds');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'feeds');
  const app = apps?.find((a) => a.key === 'feeds');

  if (!token) return null;

  const header = <AppPageHeader icon={Rss} title={t('title')} subtitle={t('subtitle')} />;

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
        <AppTurnedOff icon={Rss} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <FeedsSettingsPanel app={app} token={token} />
    </div>
  );
}
