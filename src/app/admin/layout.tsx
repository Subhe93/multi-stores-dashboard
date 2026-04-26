'use client';

import { AppSidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  Factory,
  Palette,
  FolderTree,
  SlidersHorizontal,
  ClipboardList,
  DollarSign,
  Settings,
  Package,
  Truck,
} from 'lucide-react';

const adminNav = [
  {
    title: 'Platform',
    items: [
      { label: 'Overview', href: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: 'Users', href: '/admin/users', icon: <Users className="w-4 h-4" /> },
      { label: 'Providers', href: '/admin/providers', icon: <Factory className="w-4 h-4" /> },
      { label: 'Creators', href: '/admin/creators', icon: <Palette className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Products', href: '/admin/products', icon: <Package className="w-4 h-4" /> },
      { label: 'Categories', href: '/admin/categories', icon: <FolderTree className="w-4 h-4" /> },
      { label: 'Attributes', href: '/admin/attributes', icon: <SlidersHorizontal className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: <ClipboardList className="w-4 h-4" /> },
      { label: 'Shipping Zones', href: '/admin/shipping', icon: <Truck className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Commissions', href: '/admin/commissions', icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Settings', href: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="flex min-h-screen bg-zinc-50">
        <AppSidebar
          groups={adminNav}
          title="Multi-Stores"
          subtitle="Admin Panel"
          userLabel={user?.email || 'Admin'}
          onLogout={logout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader userName={user?.email || 'Admin'} userRole="ADMIN" />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
