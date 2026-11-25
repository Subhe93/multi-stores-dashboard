'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Loader2, Star } from 'lucide-react';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { ReviewSettingsCard } from '@/components/reviews/ReviewSettingsCard';
import { ReviewsManager } from '@/components/reviews/ReviewsManager';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

/**
 * Page of the "reviews" store app (M171): moderation of the store's product
 * reviews and the auto-publish setting. While the app is switched off but
 * still available the list stays usable (existing reviews can be moderated
 * and deleted); only the setting is hidden.
 */
export default function CreatorReviewsPage() {
  const t = useTranslations('creator.reviews');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'reviews');
  const app = apps?.find((a) => a.key === 'reviews');

  if (!token) return null;

  const header = <AppPageHeader icon={Star} title={t('title')} subtitle={t('subtitle')} />;

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

  if (!app || (!enabled && !app.available)) {
    return (
      <div className="space-y-5">
        {header}
        <AppTurnedOff icon={Star} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {!enabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>{t('appOff')}</span>
          <Link href="/creator/apps" className="font-medium underline">
            {t('appOffLink')}
          </Link>
        </div>
      )}
      {/* useSearchParams (URL tab / filter state) needs a Suspense boundary. */}
      <Suspense>
        <ReviewsManager token={token} />
      </Suspense>
      {enabled && <ReviewSettingsCard app={app} token={token} />}
    </div>
  );
}
