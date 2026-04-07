import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

const providerNav = [
  { label: 'Overview', href: '/provider', icon: '📊' },
  { label: 'Products', href: '/provider/products', icon: '📦' },
  { label: 'Orders', href: '/provider/orders', icon: '📋' },
  { label: 'Shipping', href: '/provider/shipping', icon: '🚚' },
  { label: 'Earnings', href: '/provider/earnings', icon: '💰' },
  { label: 'Settings', href: '/provider/settings', icon: '⚙️' },
];

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={providerNav} title="Multi-Stores" subtitle="Provider Dashboard" />
      <div className="flex-1 flex flex-col">
        <DashboardHeader userName="Provider" userRole="PROVIDER" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
