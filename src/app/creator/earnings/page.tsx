'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/common/StatCard';
import { DataTable } from '@/components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TestOrderBadge } from '@/components/orders/TestOrderBadge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CreditCard, Info, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { useStoreType } from '@/lib/useStoreType';
import { OWN_KEY_ENDPOINT, type OwnKeyStatus } from '@/lib/ownStripeKey';
import { isOfflineEarning, offlineHintRows } from '@/lib/creatorEarnings';

interface CommissionSummary {
  total_earnings: number;
  this_month: number;
  pending: number;
  total_orders?: number;
  // Markets app: per-currency split (M1). The cross-currency totals above
  // are meaningless when more than one currency is present (L14).
  by_currency?: Array<{ currency: string; orders: number; total_earnings: number; pending: number; paid: number; offline?: number }>;
  // Marketplace stores: earnings of cash-on-delivery orders, settled outside
  // platform payouts (absent on an API that does not send it yet).
  offline?: number;
}

interface OrderCommission {
  creator_amount: number | string;
  provider_amount: number | string;
  platform_amount: number | string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  currency?: string;
}

interface Order {
  id: string;
  order_number: string;
  subtotal: number | string;
  total: number | string;
  status: string;
  created_at: string;
  // Stripe test key / pre-live owner checkout (absent = false); no money moved.
  is_test?: boolean | null;
  payment_method?: string | null;
  commission?: OrderCommission | null;
}

interface OrdersMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OrdersResponse {
  data: Order[];
  meta: OrdersMeta;
}

interface ConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed: boolean;
  account_type?: string;
  requires_relink: boolean;
}

const PAGE_SIZE = 20;

const commissionStatusStyles: Record<OrderCommission['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

export default function CreatorEarnings() {
  const { token } = useAuth();
  const { fmt } = useCurrency();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const { storeType } = useStoreType();
  const isIndependent = storeType === 'INDEPENDENT';

  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<OrdersMeta | null>(null);
  const [page, setPage] = useState(1);
  // The orders request that has completed; "loading" is derived from it, so
  // no state is set when the effect starts (react-hooks/set-state-in-effect).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== `${token ?? ''}:${page}`;
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectStatusLoading, setConnectStatusLoading] = useState(true);
  // Independent stores: own Stripe account via a restricted key (preferred route).
  const [ownKeyStatus, setOwnKeyStatus] = useState<OwnKeyStatus | null>(null);
  // Independent stores: Kustom (Klarna) is a second direct provider.
  const [kustomReady, setKustomReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<CommissionSummary>('/commissions/summary', { token })
      .then(setSummary)
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api<ConnectStatus>('/payments/connect/status', { token })
      .then(setConnectStatus)
      .catch(() => setConnectStatus(null))
      .finally(() => setConnectStatusLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !isIndependent) return;
    api<OwnKeyStatus | null>(OWN_KEY_ENDPOINT, { token })
      .then((s) => setOwnKeyStatus(s && typeof s === 'object' && 'status' in s ? s : null))
      .catch(() => setOwnKeyStatus(null));
  }, [token, isIndependent]);

  useEffect(() => {
    if (!token || !isIndependent) return;
    api<{ enabled?: boolean; ready?: boolean } | null>('/payments/kustom/settings', { token })
      .then((k) => setKustomReady(Boolean(k?.enabled && k?.ready)))
      .catch(() => setKustomReady(false));
  }, [token, isIndependent]);

  // Independent stores charge customers directly, so what matters is being
  // able to take payments; marketplace creators are paid out by the platform,
  // so what matters is payouts being enabled.
  const ownKeyActive = isIndependent && ownKeyStatus?.status === 'ACTIVE';
  const stripeReady =
    ownKeyActive ||
    (connectStatus
      ? isIndependent
        ? connectStatus.charges_enabled && !connectStatus.requires_relink
        : connectStatus.payouts_enabled
      : false);

  // Independent stores can take payments through Stripe, Kustom or both, so
  // the page speaks of "payments" and names the providers that are ready.
  const kustomActive = isIndependent && kustomReady;
  const paymentsReady = stripeReady || kustomActive;
  const readyProviders = [stripeReady ? 'Stripe' : null, kustomActive ? 'Kustom' : null]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (!token) return;
    api<OrdersResponse>(`/orders?page=${page}&limit=${PAGE_SIZE}`, { token })
      .then((res) => {
        setOrders(Array.isArray(res?.data) ? res.data : []);
        setMeta(res?.meta ?? null);
      })
      .catch(console.error)
      .finally(() => setLoadedKey(`${token}:${page}`));
  }, [token, page]);

  const byCurrency = summary?.by_currency ?? [];
  const multiCurrency = byCurrency.length > 1;
  const offlineHints = offlineHintRows(summary);
  const fmtIn = (currency: string, amount: number | string | null | undefined) => {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount ?? 0));
    } catch {
      return `${Number(amount ?? 0).toFixed(2)} ${currency}`;
    }
  };

  const COMMISSION_COLUMNS = [
    {
      key: 'order_number',
      label: t('earnings.colOrder'),
      render: (item: Order) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Link
            href={`/creator/orders/${item.id}`}
            className="font-mono font-medium text-primary hover:underline"
          >
            #{item.order_number}
          </Link>
          <TestOrderBadge isTest={item.is_test} />
        </span>
      ),
    },
    {
      key: 'subtotal',
      label: t('earnings.colSubtotal'),
      render: (item: Order) => (
        <span className="text-muted-foreground tabular-nums">
          {fmt(Number(item.subtotal ?? 0))}
        </span>
      ),
    },
    {
      key: 'commission',
      // Independent stores keep the full amount, so "share" would be misleading.
      label: isIndependent ? t('earnings.colRevenue') : t('earnings.colYourShare'),
      render: (item: Order) => {
        const amount = item.commission?.creator_amount;
        if (amount == null) {
          return <span className="text-muted-foreground">—</span>;
        }
        // Test orders are not income: muted and struck through.
        if (item.is_test) {
          return (
            <span className="text-muted-foreground line-through tabular-nums">
              {fmt(Number(amount))}
            </span>
          );
        }
        return (
          <span className="font-semibold text-emerald-700 tabular-nums">
            {fmt(Number(amount))}
          </span>
        );
      },
    },
    {
      key: 'commission_status',
      label: tc('status'),
      render: (item: Order) => {
        const status = item.commission?.status;
        if (!status) {
          return (
            <Badge
              variant="outline"
              className="text-[10px] font-semibold bg-zinc-50 text-zinc-600 border-zinc-200"
            >
              {t('earnings.notApplicable')}
            </Badge>
          );
        }
        // Cash on delivery in a marketplace store: the cash never passes
        // through the platform, so the share is not "completed" (paid out).
        if (status !== 'FAILED' && isOfflineEarning(item, storeType)) {
          return (
            <Badge
              variant="outline"
              title={t('earnings.statusOfflineTitle')}
              className="text-[10px] font-semibold bg-sky-50 text-sky-700 border-sky-200"
            >
              {t('earnings.statusOffline')}
            </Badge>
          );
        }
        return (
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold ${commissionStatusStyles[status]}`}
          >
            {status}
          </Badge>
        );
      },
    },
    {
      key: 'created_at',
      label: t('earnings.colDate'),
      render: (item: Order) => (
        <span className="text-muted-foreground">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('earnings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('earnings.subtitle')}</p>
      </div>

      {/* Independent stores are paid directly per order through their own
          Stripe account — no platform commission is withheld. */}
      {isIndependent && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">{t('earnings.independentBannerTitle')}</p>
            <p>{t('earnings.independentBannerDesc')}</p>
            {stripeReady && (
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-blue-900"
            >
              {t('earnings.independentBannerLink')}
              <ExternalLink className="size-3" />
            </a>
            )}
          </div>
        </div>
      )}

      {/* Per-currency cards (Markets app with several currencies): the mixed
          totals are hidden because summing SEK and EUR is meaningless. */}
      {multiCurrency && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('earnings.byCurrency.mixedHidden')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {byCurrency.map((row) => (
              <StatCard
                key={row.currency}
                title={t('earnings.byCurrency.title', { currency: row.currency })}
                value={fmtIn(row.currency, row.total_earnings)}
                subtitle={`${t('earnings.orderCount', { count: row.orders })} · ${t('earnings.byCurrency.pending', { amount: fmtIn(row.currency, row.pending) })}`}
                icon={<DollarSign className="w-4 h-4" />}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {!multiCurrency && (
          <>
            <StatCard
              title={t('earnings.totalEarnings')}
              value={summary == null ? '...' : fmt(Number(summary.total_earnings ?? 0))}
              subtitle={
                summary?.total_orders != null
                  ? t('earnings.orderCount', { count: summary.total_orders })
                  : undefined
              }
              icon={<DollarSign className="w-4 h-4" />}
            />
            <StatCard
              title={t('earnings.thisMonth')}
              value={summary == null ? '...' : fmt(Number(summary.this_month ?? 0))}
              trend="up"
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <StatCard
              title={isIndependent ? t('earnings.revenuePending') : t('earnings.pending')}
              value={summary == null ? '...' : fmt(Number(summary.pending ?? 0))}
              icon={<Clock className="w-4 h-4" />}
            />
          </>
        )}
        <StatCard
          title={isIndependent ? t('earnings.paymentsTitle') : t('earnings.stripe')}
          value={
            connectStatusLoading
              ? '...'
              : paymentsReady
                ? t('earnings.connected')
                : t('earnings.notConnected')
          }
          subtitle={
            paymentsReady
              ? isIndependent
                ? readyProviders
                : t('settings.payoutsEnabled')
              : connectStatus?.requires_relink
                ? t('settings.stripeRelinkRequired')
                : connectStatus?.connected
                  ? t('settings.onboardingPending')
                  : undefined
          }
          icon={<CreditCard className="w-4 h-4" />}
        />
      </div>

      {/* Earnings of cash-on-delivery orders: counted above, never paid out
          by the platform. Shown only when the API reports such an amount. */}
      {offlineHints.length > 0 && (
        <div className="space-y-1">
          {offlineHints.map((row) => (
            <p key={row.currency ?? 'all'} className="text-xs text-sky-700">
              {t('earnings.offlineHint', {
                amount: row.currency ? fmtIn(row.currency, row.amount) : fmt(row.amount),
              })}
            </p>
          ))}
        </div>
      )}

      {/* Commission Breakdown */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {isIndependent ? t('earnings.revenueBreakdown') : t('earnings.commissionBreakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={COMMISSION_COLUMNS}
            data={loading ? [] : orders}
            rowHref={(item: Order) => `/creator/orders/${item.id}`}
            emptyMessage={loading ? tc('loading') : t('earnings.noEarningsYet')}
            pagination={meta ?? undefined}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Stripe Payout — live connection status; setup itself lives in Settings. */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {isIndependent ? t('earnings.paymentProviders') : t('earnings.stripePayout')}
            </CardTitle>
            <Badge
              variant="outline"
              className={`text-[10px] border-0 ${
                paymentsReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {paymentsReady
                ? isIndependent
                  ? readyProviders
                  : t('earnings.connected')
                : t('earnings.notConnectedBadge')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            {isIndependent ? t('earnings.paymentProvidersDesc') : t('settings.stripeConnectDesc')}
          </p>
          <Button
            size="sm"
            onClick={() =>
              router.push('/creator/settings?tab=payments')
            }
          >
            {paymentsReady
              ? t('earnings.manageInSettings')
              : isIndependent
                ? t('earnings.setUpPayments')
                : t('earnings.connectStripe')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
