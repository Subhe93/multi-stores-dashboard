'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package, ClipboardList, DollarSign, Clock,
  ImageIcon, Truck, ArrowRight, CheckCircle2,
  AlertCircle, CreditCard, Settings,
  Store as StoreIcon, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { useTranslations } from 'next-intl';

const STATUS_COLORS: Record<string, string> = {
  PENDING:        'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED:      'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING:  'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK:  'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED:        'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED:       'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED:      'bg-zinc-100 text-zinc-500 border-zinc-200',
  REFUNDED:       'bg-zinc-100 text-zinc-500 border-zinc-200',
};

type Translator = ReturnType<typeof useTranslations>;

const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING:        'orderStatus.pending',
  CONFIRMED:      'orderStatus.confirmed',
  PROCESSING:     'orderStatus.processing',
  MANUFACTURING:  'orderStatus.manufacturing',
  QUALITY_CHECK:  'orderStatus.qualityCheck',
  SHIPPED:        'orderStatus.shipped',
  DELIVERED:      'orderStatus.delivered',
  RETURNED:       'orderStatus.returned',
  CANCELLED:      'orderStatus.cancelled',
  REFUNDED:       'orderStatus.refunded',
};

function statusLabel(t: Translator, status: string): string {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

function countByStatus(orders: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
  return counts;
}

/** Calculate month-over-month earnings trend */
function calcTrend(orders: any[]): { value: string; direction: 'up' | 'down' | 'flat' } {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = orders
    .filter(o => new Date(o.created_at) >= startThisMonth)
    .reduce((s, o) => s + Number(o.commission?.provider_amount || 0), 0);
  const lastMonth = orders
    .filter(o => {
      const d = new Date(o.created_at);
      return d >= startLastMonth && d < startThisMonth;
    })
    .reduce((s, o) => s + Number(o.commission?.provider_amount || 0), 0);
  if (lastMonth === 0) return { value: thisMonth > 0 ? '+100%' : '0%', direction: thisMonth > 0 ? 'up' : 'flat' };
  const pct = ((thisMonth - lastMonth) / lastMonth) * 100;
  return {
    value: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  };
}

export default function ProviderOverview() {
  const { token } = useAuth();
  const router = useRouter();
  const { fmt } = useCurrency();
  const t = useTranslations('provider');
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [shippingProfiles, setShippingProfiles] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storesMeta, setStoresMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<any>('/products/mine?limit=5', { token }).catch(() => ({ data: [] })),
      api<any>('/orders?limit=100', { token }).catch(() => ({ data: [] })),
      api<any>('/commissions/summary', { token }).catch(() => null),
      api<any[]>('/shipping/profiles', { token }).catch(() => []),
      api<any>('/providers/me', { token }).catch(() => null),
      api<any>('/providers/me/stores?limit=5', { token }).catch(() => ({ data: [], meta: null })),
    ]).then(([prods, ords, earn, shipping, prov, strs]) => {
      setProducts(prods?.data || []);
      setOrders(ords?.data || []);
      setEarnings(earn);
      setShippingProfiles(Array.isArray(shipping) ? shipping : []);
      setProfile(prov);
      setStores(strs?.data || []);
      setStoresMeta(strs?.meta || null);
    }).finally(() => setLoading(false));
  }, [token]);

  const statusCounts = countByStatus(orders);
  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status));
  const needsAction = orders.filter(o => ['PENDING', 'CONFIRMED', 'QUALITY_CHECK'].includes(o.status));
  const recentOrders = orders.slice(0, 5);
  const trend = calcTrend(orders);

  // Setup checklist
  const hasProducts = products.length > 0;
  const hasShipping = shippingProfiles.some(p => p.zones?.length > 0);
  const hasStripe = !!profile?.stripe_account_id;
  const setupDone = hasProducts && hasShipping && hasStripe;
  const setupSteps = [
    { done: hasProducts, label: t('setupAddProduct'), action: () => router.push('/provider/products/new'), icon: Package },
    { done: hasShipping, label: t('setupShipping'), action: () => router.push('/provider/shipping'), icon: Truck },
    { done: hasStripe,   label: t('setupStripe'), action: () => router.push('/provider/settings'), icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('overviewTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('overviewSubtitle')}</p>
      </div>

      {/* Setup checklist — shown until all steps are done */}
      {!loading && !setupDone && (
        <Card className="shadow-none border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Settings className="w-4 h-4" /> {t('completeSetup')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {setupSteps.map(step => (
              <div key={step.label} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-white/70 border border-blue-100">
                <div className="flex items-center gap-2">
                  {step.done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                  <span className={`text-xs ${step.done ? 'line-through text-muted-foreground' : 'font-medium text-zinc-700'}`}>
                    {step.label}
                  </span>
                </div>
                {!step.done && (
                  <Button variant="outline" size="sm" className="h-6 text-[10px] border-blue-200 text-blue-700" onClick={step.action}>
                    {t('setUp')}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={t('totalProducts')} value={loading ? '...' : products.length} subtitle={t('listed')} icon={<Package className="w-4 h-4" />} />
        <StatCard title={t('stores')} value={loading ? '...' : (storesMeta?.total ?? stores.length)} subtitle={t('usingYourProducts')} icon={<StoreIcon className="w-4 h-4" />} />
        <StatCard title={t('activeOrders')} value={loading ? '...' : activeOrders.length} subtitle={t('inProgress')} icon={<ClipboardList className="w-4 h-4" />} />
        <StatCard title={t('revenue')} value={loading ? '...' : fmt(earnings?.total_earnings)} subtitle={t('allTime')} icon={<DollarSign className="w-4 h-4" />} />
        <StatCard
          title={t('thisMonth')}
          value={loading ? '...' : fmt(earnings?.this_month)}
          trend={trend.direction === 'flat' ? undefined : trend.direction}
          trendValue={trend.value}
          icon={<Clock className="w-4 h-4" />}
        />
      </div>

      {/* Needs action alert */}
      {needsAction.length > 0 && (
        <Card className="shadow-none border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {t('ordersNeedAttention', { count: needsAction.length })}
              </span>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 text-amber-700" onClick={() => router.push('/provider/orders')}>
              {t('viewOrders')} <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <Card className="shadow-none lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t('recentOrders')}</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push('/provider/orders')}>{t('viewAll')}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('noOrdersYet')}</p>
            ) : (
              <div className="space-y-1">
                {recentOrders.map((o: any) => (
                  <button
                    key={o.id}
                    onClick={() => router.push(`/provider/orders/${o.id}`)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-zinc-100 transition text-left"
                  >
                    <div>
                      <p className="text-xs font-mono font-medium">{o.order_number}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{fmt(o.total)}</span>
                      <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[o.status] || ''}`}>
                        {statusLabel(t, o.status)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Orders by status */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{t('ordersByStatus')}</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push('/provider/orders')}>{t('all')}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(statusCounts).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">{t('noOrdersYet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {(Object.entries(statusCounts) as [string, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[status] || ''}`}>
                          {statusLabel(t, status)}
                        </Badge>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{t('products')}</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push('/provider/products')}>{t('all')}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">{t('noProductsYet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {products.slice(0, 4).map((p: any) => {
                    const img = p.images?.find((i: any) => i.is_featured)?.url || p.images?.[0]?.url;
                    return (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/provider/products/${p.id}`)}
                        className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-100 transition text-left"
                      >
                        <div className="h-7 w-7 rounded bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                          {img ? <img src={img} className="h-full w-full object-cover" /> : <ImageIcon className="w-3 h-3 text-zinc-300" />}
                        </div>
                        <p className="text-[11px] font-medium truncate flex-1">{p.translations?.[0]?.title || t('untitled')}</p>
                        <span className="text-[10px] font-medium shrink-0">{fmt(p.base_price)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Earnings */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{t('earnings')}</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push('/provider/earnings')}>{t('details')}</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('total')}</span><span className="font-medium">{fmt(earnings?.total_earnings)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('thisMonthLower')}</span><span className="font-medium">{fmt(earnings?.this_month)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('pending')}</span><span className="font-medium">{fmt(earnings?.pending)}</span></div>
            </CardContent>
          </Card>

          {/* Stores using your products */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{t('storesUsingYourProducts')}</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push('/provider/stores')}>{t('all')}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {stores.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">{t('noStoresYet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {stores.slice(0, 4).map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/provider/stores/${s.id}`)}
                      className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-100 transition text-left"
                    >
                      <div className="h-7 w-7 rounded bg-zinc-100 border overflow-hidden flex items-center justify-center shrink-0">
                        {s.logo_url
                          ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
                          : <StoreIcon className="w-3 h-3 text-zinc-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate">{s.name}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground truncate">{s.creator?.display_name}</span>
                          {s.creator?.verified && <BadgeCheck className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground shrink-0">{s.products_using_count || 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
