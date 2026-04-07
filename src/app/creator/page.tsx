import { StatCard } from '@/components/common/StatCard';

export default function CreatorOverview() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="My Products" value={0} subtitle="in store" />
        <StatCard title="Designs" value={0} subtitle="published" />
        <StatCard title="Orders" value={0} subtitle="this month" />
        <StatCard title="Earnings" value="€0" subtitle="this month" trend="up" trendValue="0%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Orders</h3>
          <p className="text-sm text-gray-400">No orders yet</p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Store Stats</h3>
          <p className="text-sm text-gray-400">Create your store to see stats</p>
        </div>
      </div>
    </div>
  );
}
