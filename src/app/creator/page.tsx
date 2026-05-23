'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

interface CommissionSummary {
  total_earnings: number;
  this_month: number;
  pending: number;
}

interface Order {
  id: string | number;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
  customer?: {
    first_name: string;
    last_name: string;
  };
}

interface OrdersResponse {
  data: Order[];
  meta: { total: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PROCESSING: 'bg-indigo-50 text-indigo-700',
  SHIPPED: 'bg-sky-50 text-sky-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export default function CreatorOverview() {
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');

  const [commissions, setCommissions] = useState<CommissionSummary | null>(null);
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  useEffect(() => {
    if (!token) return;

    Promise.all([
      api<CommissionSummary>('/commissions/summary', { token }),
      api<OrdersResponse>('/orders?limit=5', { token }),
      api<{ meta: { total: number } }>('/custom-products?limit=1', { token }),
    ])
      .then(([comm, ord, prods]) => {
        setCommissions(comm);
        setOrders(ord);
        setProductCount(prods?.meta?.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('overview.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('overview.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('overview.customProducts')}
          value={loading ? '...' : productCount}
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          title={t('overview.orders')}
          value={loading ? '...' : orders?.meta?.total ?? 0}
          icon={<ShoppingCart className="w-4 h-4" />}
        />
        <StatCard
          title={t('overview.earningsThisMonth')}
          value={loading ? '...' : fmt(commissions?.this_month ?? 0)}
          trend="up"
          icon={<DollarSign className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t('overview.recentOrders')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => router.push('/creator/orders')}
              >
                {t('overview.viewAll')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!loading && (!orders || orders.data.length === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('overview.noOrdersYet')}</p>
            ) : (
              <div className="space-y-1">
                {(orders?.data ?? []).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => router.push(`/creator/orders/${order.id}`)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-zinc-50 transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">#{order.order_number}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {order.customer
                          ? `${order.customer.first_name} ${order.customer.last_name}`
                          : t('overview.guest')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium">{fmt(Number(order.total ?? 0))}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] border-0 ${STATUS_COLORS[order.status] ?? 'bg-zinc-100 text-zinc-700'}`}
                      >
                        {order.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('overview.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => router.push('/creator/products')}
              >
                {t('overview.browseProducts')}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => router.push('/creator/products/new')}
              >
                {t('overview.newCustomProduct')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
