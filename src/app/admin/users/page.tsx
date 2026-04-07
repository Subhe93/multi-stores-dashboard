'use client';

import { DataTable } from '@/components/common/DataTable';

export default function AdminUsers() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['All', 'Providers', 'Creators', 'Customers', 'Pending'].map((tab) => (
          <button
            key={tab}
            className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-gray-50 transition"
          >
            {tab}
          </button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (item: any) => (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              item.role === 'PROVIDER' ? 'bg-blue-100 text-blue-700' :
              item.role === 'CREATOR' ? 'bg-purple-100 text-purple-700' :
              'bg-green-100 text-green-700'
            }`}>{item.role}</span>
          )},
          { key: 'status', label: 'Status', render: (item: any) => (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
              item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>{item.status}</span>
          )},
          { key: 'created_at', label: 'Joined' },
          { key: 'actions', label: 'Actions', render: () => (
            <button className="text-blue-600 text-xs font-medium hover:underline">View</button>
          )},
        ]}
        data={[]}
        searchPlaceholder="Search by email..."
        onSearch={() => {}}
        emptyMessage="No users found"
      />
    </div>
  );
}
