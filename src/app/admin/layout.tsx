'use client';

import { AppSidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
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
  Scale,
  Mail,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const t = useTranslations('nav');

  const adminNav = [
    {
      title: t('platform'),
      items: [
        { label: t('overview'), href: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: t('users'), href: '/admin/users', icon: <Users className="w-4 h-4" /> },
        { label: t('providers'), href: '/admin/providers', icon: <Factory className="w-4 h-4" /> },
        { label: t('creators'), href: '/admin/creators', icon: <Palette className="w-4 h-4" /> },
      ],
    },
    {
      title: t('catalog'),
      items: [
        { label: t('products'), href: '/admin/products', icon: <Package className="w-4 h-4" /> },
        { label: t('categories'), href: '/admin/categories', icon: <FolderTree className="w-4 h-4" /> },
        { label: t('attributes'), href: '/admin/attributes', icon: <SlidersHorizontal className="w-4 h-4" /> },
      ],
    },
    {
      title: t('operations'),
      items: [
        { label: t('orders'), href: '/admin/orders', icon: <ClipboardList className="w-4 h-4" /> },
        // Global shipping zones are hidden for now — creators/providers manage
        // their own shipping. Re-enable when platform-level fallback is built.
        // { label: t('shippingZones'), href: '/admin/shipping', icon: <Truck className="w-4 h-4" /> },
      ],
    },
    {
      title: t('finance'),
      items: [
        { label: t('commissions'), href: '/admin/commissions', icon: <DollarSign className="w-4 h-4" /> },
        { label: t('settings'), href: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
        { label: t('legalPages'), href: '/admin/legal', icon: <Scale className="w-4 h-4" /> },
        { label: t('notificationTemplates'), href: '/admin/notifications', icon: <Mail className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="flex min-h-screen bg-zinc-50">
        <AppSidebar
          groups={adminNav}
          title="Multi-Stores"
          subtitle={t('adminPanel')}
          role="Admin"
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
