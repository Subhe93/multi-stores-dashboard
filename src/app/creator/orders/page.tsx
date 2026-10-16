'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useMarkets } from '@/lib/useMarkets';
import type { BuyerType } from '@/lib/b2b';
import { ProductionProgressBar } from '@/components/production/ProductionProgressBar';
import {
  PRODUCTION_FILTERS,
  productionApi,
  type ProductionSummaries,
} from '@/components/production/production.api';

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING: 'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK: 'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

const TABS = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
// Production app: extra status tabs after "Processing".
const PRODUCTION_TABS = ['All', 'Pending', 'Processing', 'Manufacturing', 'QualityCheck', 'Shipped', 'Delivered', 'Cancelled'];
// Tab → `?status=` value (tabs are PascalCase i18n suffixes).
const TAB_STATUS: Record<string, string> = { QualityCheck: 'QUALITY_CHECK' };

type Translator = ReturnType<typeof useTranslations>;

// Order list row — the subset of the API order payload the table renders.
interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  items?: unknown[] | null;
  currency?: string | null;
  // Present when the Markets app priced the order (GET /orders includes market).
  market?: { key: string; name: string; currency: string } | null;
  // b2b app snapshot: COMPANY orders carry the company name bought under.
  customer_type?: BuyerType | null;
  company_name?: string | null;
}

interface OrdersMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Translated labels for the order-status badge (mirrors the detail page).
function statusLabels(t: Translator): Record<string, string> {
  return {
    PENDING: t('orderStatus.PENDING'),
    CONFIRMED: t('orderStatus.CONFIRMED'),
    PROCESSING: t('orderStatus.PROCESSING'),
    MANUFACTURING: t('orderStatus.MANUFACTURING'),
    QUALITY_CHECK: t('orderStatus.QUALITY_CHECK'),
    SHIPPED: t('orderStatus.SHIPPED'),
    DELIVERED: t('orderStatus.DELIVERED'),
    RETURNED: t('orderStatus.RETURNED'),
    CANCELLED: t('orderStatus.CANCELLED'),
    REFUNDED: t('orderStatus.REFUNDED'),
  };
}

export default function CreatorOrdersPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  const STATUS_LABELS = statusLabels(t);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<OrdersMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  // Market filter (Markets app only): `?market=<key>` is mirrored in the URL
  // so a filtered list can be linked.
  const searchParams = useSearchParams();
  const marketKey = searchParams.get('market') ?? '';
  const { apps } = useStoreApps();
  const marketsEnabled = isAppEnabled(apps, 'markets');
  const { markets } = useMarkets(marketsEnabled);
  // Buyer filter (b2b app only): `?buyer=company|person` mirrored in the URL.
  const b2bEnabled = isAppEnabled(apps, 'b2b');
  const buyer = searchParams.get('buyer') ?? '';
  // The API only knows the filter when the b2b app is on; drop it otherwise.
  // Kept as a string so the first `apps` arrival doesn't refetch an unfiltered list.
  const buyerParam = b2bEnabled && buyer ? `&buyer=${encodeURIComponent(buyer)}` : '';
  // Production app: `?production=in_production|ready|not_started` filter,
  // extra status tabs and a progress column (summaries fetched per page).
  const productionEnabled = isAppEnabled(apps, 'production');
  const production = searchParams.get('production') ?? '';
  const productionParam =
    productionEnabled && (PRODUCTION_FILTERS as readonly string[]).includes(production)
      ? `&production=${encodeURIComponent(production)}`
      : '';
  const tabs = productionEnabled ? PRODUCTION_TABS : TABS;
  const [summaries, setSummaries] = useState<ProductionSummaries>({});

  const setMarketKey = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key) params.set('market', key);
    else params.delete('market');
    const qs = params.toString();
    router.replace(qs ? `/creator/orders?${qs}` : '/creator/orders');
  };

  const setBuyer = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('buyer', value);
    else params.delete('buyer');
    const qs = params.toString();
    router.replace(qs ? `/creator/orders?${qs}` : '/creator/orders');
  };

  const setProduction = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('production', value);
    else params.delete('production');
    const qs = params.toString();
    router.replace(qs ? `/creator/orders?${qs}` : '/creator/orders');
  };

  // Status filtering happens server-side so tabs cover ALL orders,
  // not just the currently fetched page.
  const fetchOrders = async (page = 1, tab = activeTab) => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      const statusParam = tab === 'All' ? '' : `&status=${TAB_STATUS[tab] ?? tab.toUpperCase()}`;
      const marketParam = marketKey ? `&market=${encodeURIComponent(marketKey)}` : '';
      const res = await api<{ data?: OrderRow[]; meta?: OrdersMeta | null }>(`/orders?page=${page}&limit=20${statusParam}${marketParam}${buyerParam}${productionParam}`, { token });
      setOrders(res?.data ?? []);
      setMeta(res?.meta ?? null);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Refetch from page 1 whenever the active tab or a filter changes.
    fetchOrders(1, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab, marketKey, buyerParam, productionParam]);

  // Production progress of the visible page (production app only).
  useEffect(() => {
    if (!token || !productionEnabled || orders.length === 0) return;
    let cancelled = false;
    productionApi
      .summaries(token, orders.map((o) => o.id))
      .then((res) => {
        if (!cancelled) setSummaries(res ?? {});
      })
      .catch(() => {
        // Progress is decorative here; the list stays usable without it.
      });
    return () => {
      cancelled = true;
    };
  }, [token, productionEnabled, orders]);

  // Market orders are charged in the market currency, which can differ from
  // the store currency `fmt` formats in.
  const fmtOrderTotal = (item: OrderRow) => {
    const cur = item.market?.currency ?? item.currency;
    if (!cur) return fmt(item.total);
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).format(Number(item.total ?? 0));
    } catch {
      return fmt(item.total);
    }
  };

  const columns = [
    {
      key: 'order_number',
      label: t('orders.colOrder'),
      sortable: true,
      render: (item: OrderRow) => (
        <button
          type="button"
          onClick={() => router.push(`/creator/orders/${item.id}`)}
          className="text-sm font-mono font-medium hover:underline text-start"
        >
          {item.order_number}
        </button>
      ),
    },
    {
      key: 'customer',
      label: t('orders.colCustomer'),
      render: (item: OrderRow) => (
        <div className="min-w-0">
          <span className="text-sm">
            {item.customer
              ? `${item.customer.first_name} ${item.customer.last_name}`.trim()
              : '—'}
          </span>
          {/* Company orders (b2b app) show the company bought under. */}
          {item.customer_type === 'COMPANY' && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-medium bg-violet-50 text-violet-700 border-violet-200">
                {t('orders.companyBadge')}
              </Badge>
              {item.company_name && <span className="text-xs text-muted-foreground">{item.company_name}</span>}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      label: t('orders.colItems'),
      render: (item: OrderRow) => (
        <span className="text-xs text-muted-foreground">
          {t('orders.itemCount', { count: item.items?.length ?? 0 })}
        </span>
      ),
    },
    {
      key: 'total',
      label: t('orders.colTotal'),
      sortable: true,
      render: (item: OrderRow) => (
        <span className="text-sm font-medium">{fmtOrderTotal(item)}</span>
      ),
    },
    // Market column only for stores running the Markets app.
    ...(marketsEnabled
      ? [{
          key: 'market',
          label: t('orders.market'),
          render: (item: OrderRow) =>
            item.market ? (
              <Badge variant="outline" className="text-[10px] font-medium bg-sky-50 text-sky-700 border-sky-200">
                {item.market.name} · {item.market.currency}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            ),
        }]
      : []),
    // Production column only for stores running the production app.
    ...(productionEnabled
      ? [{
          key: 'production',
          label: t('orders.colProduction'),
          render: (item: OrderRow) => {
            const s = summaries[item.id];
            return s ? (
              <ProductionProgressBar className="w-36" done={s.done} total={s.total} />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            );
          },
        }]
      : []),
    {
      key: 'status',
      label: tc('status'),
      sortable: true,
      render: (item: OrderRow) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${statusColors[item.status] ?? ''}`}
        >
          {STATUS_LABELS[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: t('orders.colDate'),
      sortable: true,
      render: (item: OrderRow) => (
        <span className="text-xs text-muted-foreground">
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: OrderRow) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px]"
          onClick={() => router.push(`/creator/orders/${item.id}`)}
        >
          {t('orders.view')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('orders.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('orders.subtitle')}</p>
      </div>

      {/* Tab filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setActiveTab(tab)}
            >
              {t(`orders.tab${tab}`)}
            </Button>
          ))}
        </div>
        {(marketsEnabled || b2bEnabled || productionEnabled) && (
          <div className="flex flex-wrap items-center gap-2">
            {marketsEnabled && markets && markets.length > 0 && (
              <div className="w-56">
                <SearchableSelect
                  value={marketKey}
                  onChange={setMarketKey}
                  placeholder={t('orders.marketFilter')}
                  options={[
                    { value: '', label: t('orders.marketAll') },
                    ...markets.map((m) => ({ value: m.key, label: m.name, description: `${m.key} · ${m.currency}` })),
                  ]}
                />
              </div>
            )}
            {productionEnabled && (
              <div className="w-48">
                <SearchableSelect
                  value={productionParam ? production : ''}
                  onChange={setProduction}
                  placeholder={t('orders.productionFilter')}
                  options={[
                    { value: '', label: t('orders.productionAll') },
                    { value: 'in_production', label: t('orders.productionInProgress') },
                    { value: 'not_started', label: t('orders.productionNotStarted') },
                    { value: 'ready', label: t('orders.productionReady') },
                  ]}
                />
              </div>
            )}
            {b2bEnabled && (
              <div className="w-44">
                <SearchableSelect
                  value={buyer}
                  onChange={setBuyer}
                  placeholder={t('orders.buyerFilter')}
                  options={[
                    { value: '', label: t('orders.buyerAll') },
                    { value: 'company', label: t('orders.buyerCompany') },
                    { value: 'person', label: t('orders.buyerPerson') },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{t('orders.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => fetchOrders(meta?.page || 1)}>
            {t('orders.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          emptyMessage={loading ? tc('loading') : t('orders.noOrdersYet')}
          pagination={meta ?? undefined}
          onPageChange={(p) => fetchOrders(p)}
        />
      )}
    </div>
  );
}
