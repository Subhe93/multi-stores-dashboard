import { StatCard } from '@/components/common/StatCard';

export default function AdminOverview() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Users" value={0} />
        <StatCard title="Providers" value={0} subtitle="active" />
        <StatCard title="Creators" value={0} subtitle="active" />
        <StatCard title="Platform Revenue" value="€0" subtitle="this month" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard title="Pending Provider Approvals" value={0} />
        <StatCard title="Pending Creator Approvals" value={0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Orders</h3>
          <p className="text-sm text-gray-400">No orders yet</p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
      </div>
    </div>
  );
}
