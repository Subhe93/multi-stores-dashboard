'use client';

import { DataTable } from '@/components/common/DataTable';

export default function ProviderOrders() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders</h1>
      <DataTable
        columns={[
          { key: 'order_number', label: 'Order #' },
          { key: 'customer', label: 'Customer' },
          { key: 'total', label: 'Total' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Date' },
        ]}
        data={[]}
        searchPlaceholder="Search orders..."
        onSearch={() => {}}
        emptyMessage="No orders yet"
      />
    </div>
  );
}
