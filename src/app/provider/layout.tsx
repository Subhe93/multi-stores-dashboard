'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import type { ShellNav } from '@/components/layout/nav-types';
import { useAuth } from '@/lib/auth';
import { usePlatformName } from '@/lib/usePlatformName';
import { useTranslations } from 'next-intl';
import {
  Home,
  Package,
  ClipboardList,
  Truck,
  Landmark,
  Settings,
  CheckSquare,
  Store as StoreIcon,
} from 'lucide-react';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const platformName = usePlatformName();
  const t = useTranslations('nav');

  const nav: ShellNav = {
    groups: [
      {
        id: 'main',
        items: [
          { label: t('home'), href: '/provider', icon: <Home className="w-4 h-4" />, exact: true },
          { label: t('orders'), href: '/provider/orders', icon: <ClipboardList className="w-4 h-4" /> },
          { label: t('products'), href: '/provider/products', icon: <Package className="w-4 h-4" /> },
          // Custom-product approval queue; kept top-level so pending work stays visible.
          { label: t('reviews'), href: '/provider/reviews', icon: <CheckSquare className="w-4 h-4" /> },
          { label: t('stores'), href: '/provider/stores', icon: <StoreIcon className="w-4 h-4" /> },
          { label: t('shipping'), href: '/provider/shipping', icon: <Truck className="w-4 h-4" /> },
          { label: t('finances'), href: '/provider/earnings', icon: <Landmark className="w-4 h-4" /> },
        ],
      },
    ],
    footerItems: [
      { label: t('settings'), href: '/provider/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  };

  return (
    <ProtectedRoute allowedRoles={['PROVIDER']}>
      <AppShell
        nav={nav}
        user={{
          label: user?.provider?.company_name || user?.email || 'Provider',
          email: user?.email,
          role: 'PROVIDER',
          roleLabel: t('providerDashboard'),
        }}
        brandTitle={platformName}
        onLogout={logout}
      >
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
