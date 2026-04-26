'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

interface PlatformSummary {
  platform_earnings: number;
  platform_this_month: number;
  total_revenue: number;
  total_orders: number;
}

export default function AdminCommissions() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<PlatformSummary>('/commissions/platform', { token })
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Commissions</h1>
        <p className="text-sm text-muted-foreground">Platform revenue and commission tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Platform Earnings"
          value={loading ? '...' : fmt(summary?.platform_earnings)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="This Month"
          value={loading ? '...' : fmt(summary?.platform_this_month)}
          trend="up" trendValue="0%"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          title="Total Revenue"
          value={loading ? '...' : fmt(summary?.total_revenue)}
          subtitle="all parties combined"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="Total Orders"
          value={loading ? '...' : summary?.total_orders ?? 0}
          icon={<ShoppingCart className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Provider Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">No payout data yet</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Creator Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">No payout data yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
