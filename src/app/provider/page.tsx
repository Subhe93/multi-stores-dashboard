import { StatCard } from '@/components/common/StatCard';

export default function ProviderOverview() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Products" value={0} subtitle="active products" />
        <StatCard title="Total Orders" value={0} subtitle="all time" />
        <StatCard title="Revenue" value="€0" subtitle="this month" trend="up" trendValue="0%" />
        <StatCard title="Pending Orders" value={0} subtitle="awaiting action" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Orders</h3>
          <p className="text-sm text-gray-400">No orders yet</p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Products</h3>
          <p className="text-sm text-gray-400">No products yet</p>
        </div>
      </div>
    </div>
  );
}
