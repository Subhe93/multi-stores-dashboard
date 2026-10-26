'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowLeft, Globe, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarketForm } from '@/components/markets/MarketForm';
import { DomainsPanel } from '@/components/markets/DomainsPanel';
import { MarketPreviewLink } from '@/components/markets/MarketPreviewLink';
import { MARKET_STATUS_CLASS, PaymentCheckCard } from '@/components/markets/PaymentCheckCard';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { ConfirmDialog } from '@/components/importer/ImporterBits';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useMarkets } from '@/lib/useMarkets';
import { deleteMarket, runPaymentCheck, setMarketStatus, type MarketStatus, type MarketView } from '@/lib/markets.api';
import { api } from '@/lib/api';

export default function CreatorMarketDetailPage() {
  const t = useTranslations('creator.markets');
  const tErrors = useTranslations('errors');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const describeError = useApiError();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'markets');
  // GET /markets has no single-item route; the list is small, so the detail
  // page derives its market from it. Local mutations (save, domains, status)
  // override the list copy until the next refresh clears the override.
  const { markets, loading, errorCode, errorMessage, refresh } = useMarkets(enabled);
  const listMarket = useMemo(() => markets?.find((m) => m.id === id) ?? null, [markets, id]);
  const [override, setOverride] = useState<MarketView | null>(null);
  const market = override && override.id === id ? override : listMarket;
  const setMarket = setOverride;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Status-change failures are shown inside the payment card (they may not be payment problems).
  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The default market without a StoreDomain row is served on the store's
  // legacy custom_domain; the indexing warning must treat that as a live host.
  const [storeCustomDomain, setStoreCustomDomain] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ custom_domain?: string | null }>('/stores/my/store', { token })
      .then((s) => { if (!cancelled) setStoreCustomDomain(s.custom_domain ?? null); })
      .catch(() => { /* the warning falls back to the market's own domains */ });
    return () => { cancelled = true; };
  }, [token]);

  if (!appsLoading && !enabled) return <AppTurnedOff icon={Globe} />;

  const loadError = errorCode && tErrors.has(errorCode) ? tErrors(errorCode) : errorMessage;

  if (loading || appsLoading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  if (loadError) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{loadError}</span>
      </div>
    );
  }
  if (!market) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{tErrors('MARKET_NOT_FOUND')}</p>;
  }

  const runAction = async (fn: () => Promise<void>) => {
    if (!token || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRecheck = () =>
    runAction(async () => {
      const check = await runPaymentCheck(token!, market.id);
      setMarket({ ...market, payment_check: check });
    });

  const handleSetStatus = async (status: MarketStatus) => {
    if (!token || busy) return;
    setBusy(true);
    setStatusError(null);
    try {
      const updated = await setMarketStatus(token, market.id, status);
      setMarket(updated);
    } catch (err) {
      // Mapped via errors.<code>: MARKET_PAYMENT_CHECK_FAILED or
      // MARKET_PRIMARY_DOMAIN_REQUIRED (no activated hostname yet).
      setStatusError(describeError(err));
      // The API re-runs the payment check before refusing; show that fresh result.
      setOverride(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => setConfirmDelete(true);

  const confirmDeleteMarket = async () => {
    await runAction(async () => {
      await deleteMarket(token!, market.id);
      router.push('/creator/markets');
    });
    // A failure is shown under the header; the dialog closes either way.
    setConfirmDelete(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/creator/markets" className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-muted">
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {market.name}
              <Badge variant="outline" className={`text-[10px] ${MARKET_STATUS_CLASS[market.status]}`}>{t(`status.${market.status}`)}</Badge>
              {market.is_default && (
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">{t('defaultBadge')}</Badge>
              )}
              {market.indexing === 'NEVER' && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{t('noindexBadge')}</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono" dir="ltr">{market.key}</span> · {market.currency}
            </p>
          </div>
        </div>
        {!market.is_default && (
          <Button variant="destructive" size="sm" disabled={busy} onClick={handleDelete}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('form.deleteMarket')}
          </Button>
        )}
      </div>
      {actionError && <p className="text-xs text-red-600">{actionError}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <MarketForm
            initial={market}
            storeCustomDomain={storeCustomDomain}
            onSaved={setMarket}
            // A refused PUT may have stored a fresh payment_check; reload it.
            onSaveFailed={() => { setOverride(null); void refresh(); }}
          />
          <DomainsPanel
            marketId={market.id}
            domains={market.domains}
            platformHostname={market.platform_hostname}
            onChange={(domains) => setMarket({ ...market, domains })}
          />
        </div>
        <div className="space-y-5">
          <PaymentCheckCard
            check={market.payment_check}
            status={market.status}
            isDefault={market.is_default}
            currency={market.currency}
            busy={busy}
            onRecheck={handleRecheck}
            onSetStatus={handleSetStatus}
            statusError={statusError}
          />
          {/* Non-default markets only (preview_url is null for the default one). */}
          <MarketPreviewLink previewUrl={market.preview_url ?? null} />
          {!market.is_default && <p className="text-[11px] text-muted-foreground">{t('form.deleteWarnOrders')}</p>}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('form.deleteMarket')}
        description={t('form.deleteConfirm', { name: market.name })}
        confirmLabel={t('form.deleteMarket')}
        destructive
        busy={busy}
        onConfirm={confirmDeleteMarket}
        onOpenChange={setConfirmDelete}
      />
    </div>
  );
}
