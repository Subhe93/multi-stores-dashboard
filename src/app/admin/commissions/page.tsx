'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/common/StatCard';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Store,
  Truck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

interface PlatformSummary {
  platform_earnings: number;
  platform_this_month: number;
  provider_earnings: number;
  provider_this_month: number;
  creator_earnings: number;
  creator_this_month: number;
  total_revenue: number;
  total_this_month: number;
  pending_platform: number;
  paid_platform: number;
  total_orders: number;
}

interface CommissionRow {
  id: string;
  order_id: string;
  order_number: string;
  order_status: string;
  order_total: number;
  order_subtotal: number;
  order_discount: number;
  platform_amount: number;
  provider_amount: number;
  creator_amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  customer: { id: string; name: string; email: string } | null;
  store: { id: string; name: string; slug: string } | null;
  creator: { id: string; name: string } | null;
  providers: string[];
}

interface ListResponse {
  data: CommissionRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const statusStyles: Record<CommissionRow['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_TABS: Array<{ label: string; value: CommissionRow['status'] | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
];

export default function AdminCommissions() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { token } = useAuth();

  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CommissionRow['status'] | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!token) return;
    setSummaryLoading(true);
    api<PlatformSummary>('/commissions/platform', { token })
      .then(setSummary)
      .catch(console.error)
      .finally(() => setSummaryLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setListLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());

    api<ListResponse>(`/commissions/admin/list?${params.toString()}`, { token })
      .then((res) => {
        setRows(res.data || []);
        setMeta(res.meta || null);
      })
      .catch(console.error)
      .finally(() => setListLoading(false));
  }, [token, page, statusFilter, search]);

  const monthTrend = useMemo(() => {
    if (!summary || summary.platform_earnings === 0) return null;
    const pct = (summary.platform_this_month / summary.platform_earnings) * 100;
    return `${pct.toFixed(1)}%`;
  }, [summary]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Commissions</h1>
        <p className="text-sm text-muted-foreground">
          Full earnings breakdown across platform, providers, and creators
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Platform Earnings"
          value={summaryLoading ? '...' : fmt(summary?.platform_earnings)}
          subtitle={
            summary
              ? `${fmt(summary.platform_this_month)} this month`
              : undefined
          }
          trend="up"
          trendValue={monthTrend ?? undefined}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="Provider Payouts"
          value={summaryLoading ? '...' : fmt(summary?.provider_earnings)}
          subtitle={
            summary
              ? `${fmt(summary.provider_this_month)} this month`
              : undefined
          }
          icon={<Truck className="w-4 h-4" />}
        />
        <StatCard
          title="Creator Payouts"
          value={summaryLoading ? '...' : fmt(summary?.creator_earnings)}
          subtitle={
            summary
              ? `${fmt(summary.creator_this_month)} this month`
              : undefined
          }
          icon={<Sparkles className="w-4 h-4" />}
        />
        <StatCard
          title="Total Revenue"
          value={summaryLoading ? '...' : fmt(summary?.total_revenue)}
          subtitle={`${summary?.total_orders ?? 0} orders`}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Pending Platform"
          value={summaryLoading ? '...' : fmt(summary?.pending_platform)}
          subtitle="not yet released"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="Paid Platform"
          value={summaryLoading ? '...' : fmt(summary?.paid_platform)}
          subtitle="completed orders"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="Orders With Commission"
          value={summaryLoading ? '...' : summary?.total_orders ?? 0}
          icon={<ShoppingCart className="w-4 h-4" />}
        />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: 'order_number',
            label: 'Order',
            render: (item: CommissionRow) => (
              <button
                onClick={() => router.push(`/admin/orders/${item.order_id}`)}
                className="text-sm font-mono font-medium hover:underline text-left"
              >
                {item.order_number}
              </button>
            ),
          },
          {
            key: 'created_at',
            label: 'Date',
            render: (item: CommissionRow) => (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            ),
          },
          {
            key: 'customer',
            label: 'Customer',
            render: (item: CommissionRow) => (
              <div className="flex flex-col">
                <span className="text-sm">{item.customer?.name || '—'}</span>
                {item.customer?.email && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-45">
                    {item.customer.email}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'store',
            label: 'Store / Creator',
            render: (item: CommissionRow) => (
              <div className="flex flex-col">
                {item.store ? (
                  <span className="text-sm flex items-center gap-1">
                    <Store className="w-3 h-3 text-muted-foreground" />
                    {item.store.name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No store</span>
                )}
                {item.creator && (
                  <span className="text-[11px] text-muted-foreground">
                    {item.creator.name}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'providers',
            label: 'Providers',
            render: (item: CommissionRow) =>
              item.providers.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-1 max-w-50">
                  {item.providers.slice(0, 2).map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="text-[10px] font-normal"
                    >
                      {name}
                    </Badge>
                  ))}
                  {item.providers.length > 2 && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      +{item.providers.length - 2}
                    </Badge>
                  )}
                </div>
              ),
          },
          {
            key: 'order_total',
            label: 'Order Total',
            className: 'text-right',
            render: (item: CommissionRow) => (
              <span className="text-sm font-medium text-right block">
                {fmt(item.order_total)}
              </span>
            ),
          },
          {
            key: 'platform_amount',
            label: 'Platform',
            className: 'text-right',
            render: (item: CommissionRow) => (
              <span className="text-sm font-semibold text-emerald-700 text-right block">
                {fmt(item.platform_amount)}
              </span>
            ),
          },
          {
            key: 'provider_amount',
            label: 'Provider',
            className: 'text-right',
            render: (item: CommissionRow) => (
              <span className="text-sm text-blue-700 text-right block">
                {fmt(item.provider_amount)}
              </span>
            ),
          },
          {
            key: 'creator_amount',
            label: 'Creator',
            className: 'text-right',
            render: (item: CommissionRow) => (
              <span className="text-sm text-purple-700 text-right block">
                {fmt(item.creator_amount)}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (item: CommissionRow) => (
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold ${statusStyles[item.status]}`}
              >
                {item.status}
              </Badge>
            ),
          },
        ]}
        data={rows}
        searchPlaceholder="Search order # or customer..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        pagination={meta || undefined}
        onPageChange={(p) => setPage(p)}
        emptyMessage={listLoading ? 'Loading...' : 'No commissions yet'}
      />
    </div>
  );
}
