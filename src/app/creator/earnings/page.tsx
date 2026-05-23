'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/common/StatCard';
import { DataTable } from '@/components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

interface CommissionSummary {
  total_earnings: number;
  this_month: number;
  pending: number;
  total_orders?: number;
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
  const t = useTranslations('creator');
  const tc = useTranslations('common');

  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<OrdersMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<CommissionSummary>('/commissions/summary', { token })
      .then(setSummary)
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<OrdersResponse>(`/orders?page=${page}&limit=${PAGE_SIZE}`, { token })
      .then((res) => {
        setOrders(Array.isArray(res?.data) ? res.data : []);
        setMeta(res?.meta ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, page]);

  const COMMISSION_COLUMNS = [
    {
      key: 'order_number',
      label: t('earnings.colOrder'),
      render: (item: Order) => (
        <Link
          href={`/creator/orders/${item.id}`}
          className="font-mono font-medium text-primary hover:underline"
        >
          #{item.order_number}
        </Link>
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
      label: t('earnings.colYourShare'),
      render: (item: Order) => {
        const amount = item.commission?.creator_amount;
        if (amount == null) {
          return <span className="text-muted-foreground">—</span>;
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title={t('earnings.pending')}
          value={summary == null ? '...' : fmt(Number(summary.pending ?? 0))}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          title={t('earnings.stripe')}
          value={t('earnings.connect')}
          subtitle={t('earnings.notConnected')}
          icon={<CreditCard className="w-4 h-4" />}
        />
      </div>

      {/* Commission Breakdown */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('earnings.commissionBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={COMMISSION_COLUMNS}
            data={loading ? [] : orders}
            emptyMessage={loading ? tc('loading') : t('earnings.noEarningsYet')}
            pagination={meta ?? undefined}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Stripe Payout */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('earnings.stripePayout')}</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-50 text-amber-700 border-0"
            >
              {t('earnings.notConnectedBadge')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" disabled>
            {t('earnings.connectStripe')}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {t('earnings.stripeComingSoon')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
