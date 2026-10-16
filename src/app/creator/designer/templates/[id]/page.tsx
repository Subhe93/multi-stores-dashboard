'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, PenTool } from 'lucide-react';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { TemplateEditor } from '@/components/designer/TemplateEditor';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

/** Template editor of the designer app (M4.2 §8.2); same app guard as the app page. */
export default function CreatorDesignerTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('creator.designer');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'designer');

  if (!token) return null;

  if (appsLoading && !apps) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="space-y-5">
        <AppPageHeader icon={PenTool} title={t('title')} subtitle={t('subtitle')} />
        <AppTurnedOff icon={PenTool} />
      </div>
    );
  }

  return <TemplateEditor key={id} id={id} token={token} />;
}
