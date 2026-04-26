'use client';

import { useEffect, useState } from 'react';
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
}

interface Order {
  id: string | number;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
  commission?: number;
}

interface OrdersResponse {
  data: Order[];
  meta: { total: number };
}

export default function CreatorEarnings() {
  const { token } = useAuth();

  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  useEffect(() => {
    if (!token) return;

    Promise.all([
      api<CommissionSummary>('/commissions/summary', { token }),
      api<OrdersResponse>('/orders?limit=20', { token }),
    ])
      .then(([comm, ord]) => {
        setSummary(comm);
        setOrders(Array.isArray(ord?.data) ? ord.data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const COMMISSION_COLUMNS = [
    {
      key: 'order_number',
      label: 'Order',
      render: (item: Order) => (
        <span className="font-medium">#{item.order_number}</span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (item: Order) => fmt(Number(item.total ?? 0)),
    },
    {
      key: 'commission',
      label: 'Your Share',
      render: (item: Order) =>
        item.commission != null ? fmt(Number(item.commission)) : '—',
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (item: Order) => new Date(item.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Earnings</h1>
        <p className="text-sm text-muted-foreground">Track your revenue and payouts</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={loading ? '...' : fmt(Number(summary?.total_earnings ?? 0))}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="This Month"
          value={loading ? '...' : fmt(Number(summary?.this_month ?? 0))}
          trend="up"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          title="Pending"
          value={loading ? '...' : fmt(Number(summary?.pending ?? 0))}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          title="Stripe"
          value="Connect"
          subtitle="Not connected"
          icon={<CreditCard className="w-4 h-4" />}
        />
      </div>

      {/* Commission Breakdown */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Commission Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={COMMISSION_COLUMNS}
            data={orders}
            emptyMessage="No earnings yet"
          />
        </CardContent>
      </Card>

      {/* Stripe Payout */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Stripe Payout</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-50 text-amber-700 border-0"
            >
              Not Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" disabled>
            Connect Stripe
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Stripe Connect integration coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
