'use client';

import { AppSidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  DollarSign,
  Settings,
  CheckSquare,
  Store as StoreIcon,
} from 'lucide-react';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const t = useTranslations('nav');

  const providerNav = [
    {
      title: t('main'),
      items: [
        { label: t('overview'), href: '/provider', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: t('products'), href: '/provider/products', icon: <Package className="w-4 h-4" /> },
        { label: t('stores'), href: '/provider/stores', icon: <StoreIcon className="w-4 h-4" /> },
        { label: t('orders'), href: '/provider/orders', icon: <ClipboardList className="w-4 h-4" /> },
        { label: t('reviews'), href: '/provider/reviews', icon: <CheckSquare className="w-4 h-4" /> },
      ],
    },
    {
      title: t('manage'),
      items: [
        { label: t('shipping'), href: '/provider/shipping', icon: <Truck className="w-4 h-4" /> },
        { label: t('earnings'), href: '/provider/earnings', icon: <DollarSign className="w-4 h-4" /> },
        { label: t('settings'), href: '/provider/settings', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['PROVIDER']}>
      <div className="flex min-h-screen bg-zinc-50">
        <AppSidebar
          groups={providerNav}
          title="Multi-Stores"
          subtitle={t('providerDashboard')}
          role="Provider"
          userLabel={user?.provider?.company_name || user?.email || 'Provider'}
          onLogout={logout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader
            userName={user?.provider?.company_name || user?.email || 'Provider'}
            userRole="PROVIDER"
          />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
