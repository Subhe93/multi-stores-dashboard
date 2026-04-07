import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: '📊' },
  { label: 'Users', href: '/admin/users', icon: '👥' },
  { label: 'Categories', href: '/admin/categories', icon: '📁' },
  { label: 'Orders', href: '/admin/orders', icon: '📋' },
  { label: 'Commissions', href: '/admin/commissions', icon: '💰' },
  { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={adminNav} title="Multi-Stores" subtitle="Admin Panel" />
      <div className="flex-1 flex flex-col">
        <DashboardHeader userName="Admin" userRole="ADMIN" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
