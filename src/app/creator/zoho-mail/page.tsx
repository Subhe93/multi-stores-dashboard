'use client';

import { useTranslations } from 'next-intl';
import { AtSign, Loader2 } from 'lucide-react';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { ZohoMailPanel } from '@/components/zoho-mail/ZohoMailPanel';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

/**
 * Page of the "zoho_mail" store app: the store's transactional emails are
 * sent from its own Zoho Mail mailbox.
 */
export default function CreatorZohoMailPage() {
  const t = useTranslations('creator.zohoMail');
  const { token, user } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'zoho_mail');

  if (!token) return null;

  const header = <AppPageHeader icon={AtSign} title={t('title')} subtitle={t('subtitle')} />;

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

  return (
    <div className="space-y-5">
      {header}
      {enabled ? <ZohoMailPanel token={token} userEmail={user?.email ?? ''} /> : <AppTurnedOff icon={AtSign} />}
    </div>
  );
}
