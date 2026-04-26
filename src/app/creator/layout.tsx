'use client';

import { AppSidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Store,
  Package,
  Layers,
  ClipboardList,
  Tag,
  DollarSign,
  FileText,
  Settings,
  Languages,
} from 'lucide-react';

const creatorNav = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/creator', icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: 'My Store', href: '/creator/store', icon: <Store className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Provider Products', href: '/creator/products', icon: <Package className="w-4 h-4" /> },
      { label: 'Custom Products', href: '/creator/custom-products', icon: <Layers className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Orders', href: '/creator/orders', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Promotions', href: '/creator/promotions', icon: <Tag className="w-4 h-4" /> },
      { label: 'Earnings', href: '/creator/earnings', icon: <DollarSign className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Store',
    items: [
      { label: 'Pages', href: '/creator/pages', icon: <FileText className="w-4 h-4" /> },
      { label: 'Translations', href: '/creator/translations', icon: <Languages className="w-4 h-4" /> },
      { label: 'Settings', href: '/creator/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['CREATOR']}>
      <div className="flex min-h-screen bg-zinc-50">
        <AppSidebar
          groups={creatorNav}
          title="Multi-Stores"
          subtitle="Creator Dashboard"
          userLabel={user?.creator?.display_name || user?.email || 'Creator'}
          onLogout={logout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader userName={user?.creator?.display_name || user?.email || 'Creator'} userRole="CREATOR" />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
