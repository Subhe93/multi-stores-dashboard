import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

const creatorNav = [
  { label: 'Overview', href: '/creator', icon: '📊' },
  { label: 'My Store', href: '/creator/store', icon: '🏪' },
  { label: 'Products', href: '/creator/products', icon: '📦' },
  { label: 'Designs', href: '/creator/designs', icon: '🎨' },
  { label: 'Orders', href: '/creator/orders', icon: '📋' },
  { label: 'Promotions', href: '/creator/promotions', icon: '🏷️' },
  { label: 'Earnings', href: '/creator/earnings', icon: '💰' },
];

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={creatorNav} title="Multi-Stores" subtitle="Creator Dashboard" />
      <div className="flex-1 flex flex-col">
        <DashboardHeader userName="Creator" userRole="CREATOR" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
