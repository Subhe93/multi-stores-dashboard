'use client';

import { AppSidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  DollarSign,
  Settings,
  CheckSquare,
} from 'lucide-react';

const providerNav = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/provider', icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: 'Products', href: '/provider/products', icon: <Package className="w-4 h-4" /> },
      { label: 'Orders', href: '/provider/orders', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Reviews', href: '/provider/reviews', icon: <CheckSquare className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Shipping', href: '/provider/shipping', icon: <Truck className="w-4 h-4" /> },
      { label: 'Earnings', href: '/provider/earnings', icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Settings', href: '/provider/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['PROVIDER']}>
      <div className="flex min-h-screen bg-zinc-50">
        <AppSidebar
          groups={providerNav}
          title="Multi-Stores"
          subtitle="Provider Dashboard"
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
