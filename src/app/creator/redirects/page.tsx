'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { RedirectsManager } from '@/components/redirects/RedirectsManager';

/**
 * Online store -> Redirects: the store's URL redirects (manual, imported and
 * old-slug rows). A core feature for every store type.
 */
export default function CreatorRedirectsPage() {
  const tn = useTranslations('nav');
  const t = useTranslations('creator.redirects');
  const { token } = useAuth();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{tn('redirects')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>
      {token && <RedirectsManager token={token} showIntro={false} />}
    </div>
  );
}
