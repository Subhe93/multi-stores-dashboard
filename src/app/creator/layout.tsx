'use client';

import { AppSidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { StoreLinkButton } from '@/components/creator/StoreLinkButton';
import { useAuth } from '@/lib/auth';
import { useStoreType } from '@/lib/useStoreType';
import { useTranslations } from 'next-intl';
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
  Plus,
  FolderTree,
  Sparkles,
  ListTree,
  LayoutTemplate,
  Truck,
  Mail,
} from 'lucide-react';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const t = useTranslations('nav');
  // Independent stores sell only their own products, so marketplace-only
  // entries (provider catalog, imported products) are hidden from the nav.
  const { storeType } = useStoreType();
  const isIndependent = storeType === 'INDEPENDENT';

  const creatorNav = [
    {
      title: t('main'),
      items: [
        { label: t('overview'), href: '/creator', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: t('myStore'), href: '/creator/store', icon: <Store className="w-4 h-4" /> },
      ],
    },
    {
      title: t('catalog'),
      items: [
        // Marketplace-only entries are hidden for independent stores, which
        // get their own-products list instead.
        ...(isIndependent
          ? [{ label: t('myProducts'), href: '/creator/products/own', icon: <Package className="w-4 h-4" /> }]
          : [{ label: t('exploreProviderProducts'), href: '/creator/products/browse', icon: <Package className="w-4 h-4" /> }]),
        { label: t('addProduct'), href: '/creator/products/own/new', icon: <Plus className="w-4 h-4" /> },
        ...(isIndependent
          ? []
          : [{ label: t('products'), href: '/creator/custom-products', icon: <Layers className="w-4 h-4" /> }]),
        { label: t('collections'), href: '/creator/categories', icon: <FolderTree className="w-4 h-4" /> },
        { label: t('shipping'), href: '/creator/shipping', icon: <Truck className="w-4 h-4" /> },
      ],
    },
    {
      title: t('sales'),
      items: [
        { label: t('orders'), href: '/creator/orders', icon: <ClipboardList className="w-4 h-4" /> },
        { label: t('promotions'), href: '/creator/promotions', icon: <Tag className="w-4 h-4" /> },
        { label: t('bundles'), href: '/creator/bundles', icon: <Layers className="w-4 h-4" /> },
        { label: t('earnings'), href: '/creator/earnings', icon: <DollarSign className="w-4 h-4" /> },
      ],
    },
    {
      title: t('store'),
      items: [
        { label: t('templates'), href: '/creator/templates', icon: <LayoutTemplate className="w-4 h-4" /> },
        { label: t('pages'), href: '/creator/pages', icon: <FileText className="w-4 h-4" /> },
        { label: t('menus'), href: '/creator/menus', icon: <ListTree className="w-4 h-4" /> },
        { label: t('landingPages'), href: '/creator/landing-pages', icon: <Sparkles className="w-4 h-4" /> },
        { label: t('translations'), href: '/creator/translations', icon: <Languages className="w-4 h-4" /> },
        // Only independent stores send under their own address; a marketplace
        // store's customer mail always goes out from the platform.
        ...(isIndependent
          ? [{ label: t('email'), href: '/creator/email', icon: <Mail className="w-4 h-4" /> }]
          : []),
        { label: t('settings'), href: '/creator/settings', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['CREATOR']}>
      <div className="flex min-h-screen bg-zinc-50">
        <AppSidebar
          groups={creatorNav}
          title="Multi-Stores"
          subtitle={t('creatorDashboard')}
          role="Creator"
          userLabel={user?.creator?.display_name || user?.email || 'Creator'}
          onLogout={logout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader
            userName={user?.creator?.display_name || user?.email || 'Creator'}
            userRole="CREATOR"
            extras={<StoreLinkButton />}
          />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
