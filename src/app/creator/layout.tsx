'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import type { NavItem, ShellNav } from '@/components/layout/nav-types';
import { StoreLinkButton } from '@/components/creator/StoreLinkButton';
import { useAuth } from '@/lib/auth';
import { usePlatformName } from '@/lib/usePlatformName';
import { useStoreType } from '@/lib/useStoreType';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useImporterHistory } from '@/lib/useImporterHistory';
import { useTranslations } from 'next-intl';
import {
  Home,
  Store,
  Package,
  ClipboardList,
  Tag,
  Landmark,
  FileText,
  Settings,
  Truck,
  Mail,
  Blocks,
  Globe,
  Building2,
  PenLine,
  ListChecks,
  Import,
  PenTool,
  Rss,
  AtSign,
} from 'lucide-react';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout } = useAuth();
  const platformName = usePlatformName();
  const t = useTranslations('nav');
  // Independent stores sell only their own products, so marketplace-only
  // entries (provider catalog, imported products) are hidden from the nav.
  const { storeType } = useStoreType();
  const isIndependent = storeType === 'INDEPENDENT';
  // Store apps gate their own nav entries (markets only while enabled).
  const { apps } = useStoreApps();
  const marketsEnabled = isAppEnabled(apps, 'markets');
  const b2bEnabled = isAppEnabled(apps, 'b2b');
  const personalizationEnabled = isAppEnabled(apps, 'personalization');
  const productionEnabled = isAppEnabled(apps, 'production');
  const feedsEnabled = isAppEnabled(apps, 'feeds');
  const zohoMailEnabled = isAppEnabled(apps, 'zoho_mail');
  // Invoices stay reachable (read-only) while the app is merely available,
  // so issued documents remain accessible after it is switched off (L1).
  const invoicesVisible =
    isAppEnabled(apps, 'invoices') || !!apps?.some((a) => a.key === 'invoices' && a.available);
  // Importer: shown while available or enabled (the page explains how to turn it on).
  const importerOffered =
    isAppEnabled(apps, 'importer') || !!apps?.some((a) => a.key === 'importer' && a.available);
  // Also kept while the store has import runs or redirects (read-only page).
  const importerHistory = useImporterHistory(token, user?.id, !!apps && !importerOffered);
  const importerVisible = importerOffered || importerHistory;
  // Designer: shown while available or enabled (the page explains how to turn it on).
  const designerVisible =
    isAppEnabled(apps, 'designer') || !!apps?.some((a) => a.key === 'designer' && a.available);

  // Products section: the parent links to the store's own product list.
  // Marketplace-only entries are hidden for independent stores, which get
  // their own-products list instead.
  const productsItem: NavItem = isIndependent
    ? {
        label: t('products'),
        href: '/creator/products/own',
        icon: <Package className="w-4 h-4" />,
        children: [
          { label: t('addProduct'), href: '/creator/products/own/new' },
          { label: t('collections'), href: '/creator/categories' },
          { label: t('bundles'), href: '/creator/bundles' },
        ],
      }
    : {
        label: t('products'),
        href: '/creator/custom-products',
        icon: <Package className="w-4 h-4" />,
        children: [
          { label: t('exploreProviderProducts'), href: '/creator/products/browse' },
          { label: t('addProduct'), href: '/creator/products/own/new' },
          { label: t('collections'), href: '/creator/categories' },
          { label: t('bundles'), href: '/creator/bundles' },
        ],
      };

  // Store apps, Shopify style: every app page lives in the Apps group.
  const appItems: NavItem[] = [
    // Optional store apps the admin made available; the creator switches
    // them on here and each enabled app gets its own page.
    { label: t('manageApps'), href: '/creator/apps', icon: <Blocks className="w-4 h-4" /> },
    // Markets app: per-country domains, currencies and locales.
    ...(marketsEnabled
      ? [{ label: t('markets'), href: '/creator/markets', icon: <Globe className="w-4 h-4" /> }]
      : []),
    // Production app: per-order production queue and checklist settings.
    ...(productionEnabled
      ? [{ label: t('production'), href: '/creator/production', icon: <ListChecks className="w-4 h-4" /> }]
      : []),
    // Invoices app: issued invoices/credit notes, backlog, seller profile.
    ...(invoicesVisible
      ? [{ label: t('invoices'), href: '/creator/invoices', icon: <FileText className="w-4 h-4" /> }]
      : []),
    // Personalization app: settings, presets and the field library.
    ...(personalizationEnabled
      ? [{ label: t('personalization'), href: '/creator/personalization', icon: <PenLine className="w-4 h-4" /> }]
      : []),
    // Designer app: design templates, fonts, print queue and settings.
    ...(designerVisible
      ? [{ label: t('designer'), href: '/creator/designer', icon: <PenTool className="w-4 h-4" /> }]
      : []),
    // Importer app: WooCommerce sources, import runs and redirects.
    ...(importerVisible
      ? [{ label: t('importer'), href: '/creator/importer', icon: <Import className="w-4 h-4" /> }]
      : []),
    // B2B app: business-buyer settings, reverse charge, EC sales list.
    ...(b2bEnabled
      ? [{ label: t('b2b'), href: '/creator/b2b', icon: <Building2 className="w-4 h-4" /> }]
      : []),
    // Feeds app: Google Merchant / Meta catalog feed URLs and settings.
    ...(feedsEnabled
      ? [{ label: t('feeds'), href: '/creator/feeds', icon: <Rss className="w-4 h-4" /> }]
      : []),
    // Zoho Mail app: send the store's emails from its own Zoho mailbox.
    ...(zohoMailEnabled
      ? [{ label: t('zohoMail'), href: '/creator/zoho-mail', icon: <AtSign className="w-4 h-4" /> }]
      : []),
  ];

  const nav: ShellNav = {
    groups: [
      {
        id: 'main',
        items: [
          { label: t('home'), href: '/creator', icon: <Home className="w-4 h-4" />, exact: true },
          { label: t('orders'), href: '/creator/orders', icon: <ClipboardList className="w-4 h-4" /> },
          productsItem,
          { label: t('discounts'), href: '/creator/promotions', icon: <Tag className="w-4 h-4" /> },
          {
            label: t('finances'),
            href: '/creator/earnings',
            icon: <Landmark className="w-4 h-4" />,
            children: [{ label: t('taxes'), href: '/creator/taxes' }],
          },
          {
            label: t('onlineStore'),
            href: '/creator/store',
            icon: <Store className="w-4 h-4" />,
            children: [
              { label: t('themes'), href: '/creator/themes' },
              { label: t('templates'), href: '/creator/templates' },
              { label: t('pages'), href: '/creator/pages' },
              { label: t('menus'), href: '/creator/menus' },
              { label: t('landingPages'), href: '/creator/landing-pages' },
              { label: t('translations'), href: '/creator/translations' },
            ],
          },
          { label: t('shipping'), href: '/creator/shipping', icon: <Truck className="w-4 h-4" /> },
          // Every store type: order notifications address + delivery log. The
          // own-sender and template sections inside are independent-only.
          { label: t('email'), href: '/creator/email', icon: <Mail className="w-4 h-4" /> },
        ],
      },
      { id: 'apps', title: t('appsGroup'), items: appItems },
    ],
    footerItems: [
      { label: t('settings'), href: '/creator/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  };

  return (
    <ProtectedRoute allowedRoles={['CREATOR']}>
      <AppShell
        nav={nav}
        user={{
          label: user?.creator?.display_name || user?.email || 'Creator',
          email: user?.email,
          role: 'CREATOR',
          roleLabel: t('creatorDashboard'),
        }}
        brandTitle={platformName}
        onLogout={logout}
        headerExtras={<StoreLinkButton />}
      >
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
