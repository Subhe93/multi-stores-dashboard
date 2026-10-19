'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Globe, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { localeLabel } from '@/components/markets/MarketForm';
import { MARKET_STATUS_CLASS, ProviderDot, kustomCheckMessage, stripeCheckMessage } from '@/components/markets/PaymentCheckCard';
import { countryFlag } from '@/components/common/CountryMultiSelect';
import { countryName } from '@/lib/taxCountries';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useMarkets } from '@/lib/useMarkets';
import { runPaymentCheck, type MarketView } from '@/lib/markets.api';

export default function CreatorMarketsPage() {
  const t = useTranslations('creator.markets');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const { token } = useAuth();
  const describeError = useApiError();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'markets');
  const { markets, loading, errorCode, errorMessage, setMarkets } = useMarkets(enabled);
  const [checking, setChecking] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  if (!appsLoading && !enabled) {
    return (
      <div className="space-y-5">
        <AppPageHeader icon={Globe} title={t('title')} subtitle={t('subtitle')} />
        <AppTurnedOff icon={Globe} />
      </div>
    );
  }

  const handleRecheck = async (m: MarketView) => {
    if (!token || checking || !markets) return;
    setChecking(m.id);
    setCheckError(null);
    try {
      const check = await runPaymentCheck(token, m.id);
      setMarkets(markets.map((x) => (x.id === m.id ? { ...x, payment_check: check } : x)));
    } catch (err) {
      setCheckError(describeError(err));
    } finally {
      setChecking(null);
    }
  };

  const loadError = errorCode && tErrors.has(errorCode) ? tErrors(errorCode) : errorMessage;

  return (
    <div className="space-y-5">
      <AppPageHeader
        icon={Globe}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Link href="/creator/markets/new" className={buttonVariants({ size: 'sm' })}>
            <Plus /> {t('addMarket')}
          </Link>
        }
      />

      {loading || appsLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="shadow-none">
              <CardHeader className="pb-3"><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : !markets || markets.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {markets.map((m) => {
            const primary = m.domains.find((d) => d.is_primary && d.status === 'ACTIVE') ?? m.domains.find((d) => d.is_primary);
            const check = m.payment_check;
            return (
              <Card key={m.id} className="shadow-none">
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm font-semibold">
                      <Link href={`/creator/markets/${m.id}`} className="hover:underline">{m.name}</Link>{' '}
                      <span className="font-mono text-[11px] font-normal text-muted-foreground" dir="ltr">({m.key})</span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${MARKET_STATUS_CLASS[m.status]}`}>{t(`status.${m.status}`)}</Badge>
                      {m.is_default && (
                        <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">{t('defaultBadge')}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-mono">{m.currency}</Badge>
                    </div>
                  </div>
                  <Link href={`/creator/markets/${m.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {t('list.edit')}
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {m.countries.length === 0 ? (
                      <span className="text-muted-foreground">{t('list.allCountries')}</span>
                    ) : (
                      m.countries.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-zinc-50 px-2 py-0.5" title={countryName(c, locale)}>
                          <span aria-hidden>{countryFlag(c)}</span> {c}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="grid gap-1 text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{t('list.locales')}:</span>{' '}
                      {[m.default_locale, ...m.locales].map(localeLabel).join(', ')}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">{t('list.primaryDomain')}:</span>{' '}
                      <code className="font-mono" dir="ltr">{primary?.hostname ?? m.platform_hostname}</code>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5">
                        <ProviderDot state={check?.stripe ?? 'unknown'} />
                        <span className="font-medium">{t('check.stripe.label')}</span>
                        <span className="text-muted-foreground">{check ? stripeCheckMessage(t, check, m.currency) : t('check.never')}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <ProviderDot state={check?.kustom ?? 'unknown'} />
                        <span className="font-medium">{t('check.kustom.label')}</span>
                        <span className="text-muted-foreground">{check ? kustomCheckMessage(t, check) : t('check.never')}</span>
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" disabled={!!checking} onClick={() => handleRecheck(m)}>
                      {checking === m.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t('check.recheck')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {checkError && <p className="text-[11px] text-red-600">{checkError}</p>}
    </div>
  );
}
