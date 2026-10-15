'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Globe } from 'lucide-react';
import { MarketForm } from '@/components/markets/MarketForm';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

export default function CreatorNewMarketPage() {
  const t = useTranslations('creator.markets');
  const router = useRouter();
  const { apps, loading } = useStoreApps();

  if (!loading && !isAppEnabled(apps, 'markets')) return <AppTurnedOff icon={Globe} />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/creator/markets" className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-muted">
          <ArrowLeft className="size-4 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('form.newTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('form.newSubtitle')}</p>
        </div>
      </div>
      {/* Domains and the payment check become available on the detail page. */}
      <MarketForm onSaved={(market) => router.push(`/creator/markets/${market.id}`)} />
    </div>
  );
}
