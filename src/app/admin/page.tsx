'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Store, Package, DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

interface DashboardStats {
  totalUsers: number;
  totalProviders: number;
  totalCreators: number;
  totalCustomers: number;
  pendingProviders: number;
  pendingCreators: number;
}

// Row from GET /admin/users/recent (only the fields this page reads).
interface RecentUser {
  id: string;
  email: string;
  role: string;
  provider?: { company_name?: string | null } | null;
  creator?: { display_name?: string | null } | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
}

interface PlatformSummary {
  platform_earnings?: number | string | null;
}

export default function AdminOverview() {
  const t = useTranslations('admin');
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      api<DashboardStats>('/admin/users/stats', { token }),
      api<RecentUser[]>('/admin/users/recent', { token }),
      api<PlatformSummary>('/commissions/platform', { token }).catch(() => null),
    ])
      .then(([s, users, comm]) => {
        setStats(s);
        setRecentUsers(Array.isArray(users) ? users : []);
        setPlatformSummary(comm);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const roleColors: Record<string, string> = {
    PROVIDER: 'bg-blue-50 text-blue-700', CREATOR: 'bg-purple-50 text-purple-700',
    CUSTOMER: 'bg-emerald-50 text-emerald-700', ADMIN: 'bg-zinc-100 text-zinc-700',
  };

  const getName = (u: RecentUser) => {
    if (u.provider) return u.provider.company_name;
    if (u.creator) return u.creator.display_name;
    if (u.customer) return `${u.customer.first_name} ${u.customer.last_name}`;
    return u.email;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('platformOverview')}</h1>
        <p className="text-sm text-muted-foreground">{t('monitorMarketplace')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('totalUsers')} value={loading ? '...' : stats?.totalUsers ?? 0} icon={<Users className="w-4 h-4" />} />
        <StatCard title={t('providers')} value={loading ? '...' : stats?.totalProviders ?? 0} subtitle={t('registered')} icon={<Package className="w-4 h-4" />} />
        <StatCard title={t('creators')} value={loading ? '...' : stats?.totalCreators ?? 0} subtitle={t('registered')} icon={<Store className="w-4 h-4" />} />
        <StatCard title={t('platformRevenue')} value={loading ? '...' : fmt(platformSummary?.platform_earnings)} subtitle={t('allTime')} icon={<DollarSign className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t('pendingApprovals')}</CardTitle>
              <Badge variant="destructive" className="text-[10px]">
                {(stats?.pendingProviders ?? 0) + (stats?.pendingCreators ?? 0)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button onClick={() => router.push('/admin/providers')} className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-zinc-50 transition text-left">
                <span className="text-sm text-muted-foreground">{t('providerApplications')}</span>
                <Badge variant="secondary">{stats?.pendingProviders ?? 0}</Badge>
              </button>
              <button onClick={() => router.push('/admin/creators')} className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-zinc-50 transition text-left">
                <span className="text-sm text-muted-foreground">{t('creatorApplications')}</span>
                <Badge variant="secondary">{stats?.pendingCreators ?? 0}</Badge>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t('recentUsers')}</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push('/admin/users')}>{t('viewAll')}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('noUsersYet')}</p>
            ) : (
              <div className="space-y-2">
                {recentUsers.map(u => (
                  <button key={u.id} onClick={() => router.push(`/admin/users/${u.id}`)} className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-50 transition text-left">
                    <div>
                      <p className="text-xs font-medium">{getName(u)}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${roleColors[u.role] || ''}`}>{u.role}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
