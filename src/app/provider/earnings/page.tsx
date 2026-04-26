'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { DollarSign, TrendingUp, Clock, CreditCard, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

const STATUS_COLORS: Record<string, string> = {
  PENDING:        'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED:      'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING:  'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK:  'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED:        'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:      'bg-zinc-100 text-zinc-500 border-zinc-200',
  REFUNDED:       'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const DATE_FILTERS = [
  { label: 'This Month',  value: 'this_month' },
  { label: 'Last Month',  value: 'last_month' },
  { label: 'Last 3 Mo.',  value: 'last_3_months' },
  { label: 'All Time',    value: 'all' },
];

function filterByDate(orders: any[], filter: string): any[] {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  return orders.filter(o => {
    const d = new Date(o.created_at);
    if (filter === 'this_month') return d >= startOf(now);
    if (filter === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= start && d < end;
    }
    if (filter === 'last_3_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return d >= start;
    }
    return true;
  });
}

function exportCsv(rows: any[]) {
  const header = ['Order', 'Date', 'Order Total', 'Platform Fee', 'Creator Share', 'Your Earnings', 'Status'];
  const lines = rows.map(o => [
    o.order_number,
    new Date(o.created_at).toLocaleDateString(),
    Number(o.total).toFixed(2),
    o.commission ? Number(o.commission.platform_amount).toFixed(2) : '—',
    o.commission ? Number(o.commission.creator_amount).toFixed(2) : '—',
    o.commission ? Number(o.commission.provider_amount).toFixed(2) : '—',
    o.status,
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `earnings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProviderEarnings() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const [earnings, setEarnings] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('this_month');

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<any>('/commissions/summary', { token }).catch(() => null),
      api<any>('/orders?limit=100', { token }).catch(() => ({ data: [] })),
    ]).then(([earn, ords]) => {
      setEarnings(earn);
      setOrders(ords?.data || []);
    }).finally(() => setLoading(false));
  }, [token]);

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);

  // Computed stats for current filter
  const filteredEarnings = filteredOrders.reduce((sum, o) => sum + Number(o.commission?.provider_amount || 0), 0);
  const filteredRevenue  = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avgOrderValue    = filteredOrders.length ? filteredRevenue / filteredOrders.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-sm text-muted-foreground">Track your revenue and payouts</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={filteredOrders.length === 0}
          onClick={() => exportCsv(filteredOrders)}
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={loading ? '...' : fmt(earnings?.total_earnings)}
          subtitle="all time"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="This Month"
          value={loading ? '...' : fmt(earnings?.this_month)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          title="Pending Payout"
          value={loading ? '...' : fmt(earnings?.pending)}
          subtitle="awaiting settlement"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          title="Total Orders"
          value={loading ? '...' : earnings?.total_orders ?? 0}
          subtitle="all time"
          icon={<CreditCard className="w-4 h-4" />}
        />
      </div>

      {/* Date filter + period stats */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">Revenue Breakdown</CardTitle>
            <div className="flex gap-1">
              {DATE_FILTERS.map(f => (
                <Button
                  key={f.value}
                  variant={dateFilter === f.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDateFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        {/* Period summary bar */}
        <CardContent className="pb-0">
          <div className="grid grid-cols-3 gap-4 p-3 bg-zinc-50 rounded-lg mb-4 text-xs">
            <div>
              <p className="text-muted-foreground mb-0.5">Orders</p>
              <p className="font-semibold text-base">{filteredOrders.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Your Earnings</p>
              <p className="font-semibold text-base text-emerald-700">{fmt(filteredEarnings)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Avg. Order Value</p>
              <p className="font-semibold text-base">{fmt(avgOrderValue)}</p>
            </div>
          </div>
        </CardContent>

        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No orders in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-semibold uppercase">Order</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">Date</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">Order Total</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">Platform Fee</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">Creator Share</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-emerald-700">Your Earnings</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order: any) => {
                  const providerAmt  = order.commission ? Number(order.commission.provider_amount) : null;
                  const platformAmt  = order.commission ? Number(order.commission.platform_amount) : null;
                  const creatorAmt   = order.commission ? Number(order.commission.creator_amount)  : null;
                  const total        = Number(order.total);
                  const providerPct  = providerAmt != null && total > 0
                    ? ((providerAmt / total) * 100).toFixed(0)
                    : null;

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="text-xs font-mono">{order.order_number}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{fmt(total)}</TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {platformAmt != null ? `−${fmt(platformAmt)}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {creatorAmt != null && creatorAmt > 0 ? `−${fmt(creatorAmt)}` : '—'}
                      </TableCell>
                      <TableCell>
                        {providerAmt != null ? (
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            {fmt(providerAmt)}
                            {providerPct && (
                              <span className="text-[9px] text-emerald-500 font-normal">({providerPct}%)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[order.status] || ''}`}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => router.push(`/provider/orders/${order.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Commission structure explanation */}
      <Card className="shadow-none bg-zinc-50/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">How Earnings Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
            <p><span className="font-medium text-foreground">Order Total</span> — the full amount paid by the customer (including shipping)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
            <p><span className="font-medium text-foreground">Platform Fee</span> — the platform's commission deducted from the subtotal</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
            <p><span className="font-medium text-foreground">Creator Share</span> — the creator's margin (only when a creator resells your product)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
            <p><span className="font-medium text-emerald-700">Your Earnings</span> — what you receive after all deductions, paid via Stripe Connect</p>
          </div>
          <Separator className="my-1" />
          <p>Payouts are processed automatically via{' '}
            <button onClick={() => router.push('/provider/settings')} className="text-primary hover:underline font-medium">
              Stripe Connect
            </button>. Connect your account in Settings to receive payouts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
