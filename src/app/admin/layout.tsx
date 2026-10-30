'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import type { ShellNav } from '@/components/layout/nav-types';
import { useAuth } from '@/lib/auth';
import { usePlatformName } from '@/lib/usePlatformName';
import { useTranslations } from 'next-intl';
import {
  Home,
  Users,
  ClipboardList,
  Landmark,
  Settings,
  Package,
  Scale,
  Mail,
  BookOpen,
  DatabaseBackup,
  Blocks,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const platformName = usePlatformName();
  const t = useTranslations('nav');

  const nav: ShellNav = {
    groups: [
      {
        id: 'main',
        items: [
          { label: t('home'), href: '/admin', icon: <Home className="w-4 h-4" />, exact: true },
          { label: t('orders'), href: '/admin/orders', icon: <ClipboardList className="w-4 h-4" /> },
          {
            label: t('products'),
            href: '/admin/products',
            icon: <Package className="w-4 h-4" />,
            children: [
              { label: t('categories'), href: '/admin/categories' },
              { label: t('attributes'), href: '/admin/attributes' },
            ],
          },
          // All accounts; providers and creators are the two business profiles.
          {
            label: t('users'),
            href: '/admin/users',
            icon: <Users className="w-4 h-4" />,
            children: [
              { label: t('providers'), href: '/admin/providers' },
              { label: t('creators'), href: '/admin/creators' },
            ],
          },
          {
            label: t('finances'),
            href: '/admin/commissions',
            icon: <Landmark className="w-4 h-4" />,
            children: [{ label: t('taxes'), href: '/admin/taxes' }],
          },
          { label: t('storeApps'), href: '/admin/store-apps', icon: <Blocks className="w-4 h-4" /> },
          {
            label: t('notifications'),
            href: '/admin/notifications',
            icon: <Mail className="w-4 h-4" />,
            children: [{ label: t('emailLog'), href: '/admin/email-log' }],
          },
          { label: t('legalPages'), href: '/admin/legal', icon: <Scale className="w-4 h-4" /> },
        ],
      },
    ],
    footerItems: [
      { label: t('backups'), href: '/admin/backups', icon: <DatabaseBackup className="w-4 h-4" /> },
      { label: t('guide'), href: '/admin/guide', icon: <BookOpen className="w-4 h-4" /> },
      { label: t('settings'), href: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <AppShell
        nav={nav}
        user={{
          label: user?.email || 'Admin',
          email: user?.email,
          role: 'ADMIN',
          roleLabel: t('adminPanel'),
        }}
        brandTitle={platformName}
        onLogout={logout}
      >
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
