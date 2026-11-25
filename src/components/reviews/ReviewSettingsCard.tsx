'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { api } from '@/lib/api';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { sanitizeStoreApps, setCachedStoreApps } from '@/lib/useStoreApps';
import { normalizeReviewsSettings } from '@/lib/reviews';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import { useReviewError } from './useReviewError';

/**
 * Settings of the `reviews` app: one switch, saved at once through
 * PUT /stores/my/apps/reviews `{ settings: { auto_publish } }`. The API
 * answers the refreshed app list, which is pushed to the shared cache.
 */
export function ReviewSettingsCard({ app, token }: { app: MyStoreAppView; token: string }) {
  const t = useTranslations('creator.reviews.settings');
  const tToasts = useTranslations('creator.reviews.toasts');
  const describeError = useReviewError();
  const persisted = normalizeReviewsSettings(app.settings).auto_publish;
  // Optimistic value while the save is in flight; null = show the stored one.
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useTransientFlag();
  const checked = pending ?? persisted;

  const toggle = async (next: boolean) => {
    if (pending !== null) return;
    setPending(next);
    setError(null);
    try {
      const result = await api<MyStoreAppView[]>('/stores/my/apps/reviews', {
        method: 'PUT',
        token,
        body: JSON.stringify({ settings: { auto_publish: next } }),
      });
      const refreshed = sanitizeStoreApps(result);
      if (refreshed) setCachedStoreApps(refreshed);
      flashSaved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <label htmlFor="reviews-auto-publish" className="block text-sm font-medium">
              {t('autoPublish')}
            </label>
            <p className="text-xs text-muted-foreground">{t('autoPublishHint')}</p>
          </div>
          <ToggleSwitch
            id="reviews-auto-publish"
            checked={checked}
            disabled={pending !== null}
            onChange={(next) => void toggle(next)}
            label={t('autoPublish')}
          />
        </div>
        <p className="rounded-md border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-900">{t('policyNote')}</p>
        <div aria-live="polite">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && !error && <p className="text-xs font-medium text-emerald-600">{tToasts('settingsSaved')}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
