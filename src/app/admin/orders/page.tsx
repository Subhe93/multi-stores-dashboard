'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING: 'bg-purple-50 text-purple-700 border-purple-200',
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

export default function AdminOrders() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('All');

  const fetchOrders = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<any>(`/orders?page=${page}&limit=20`, { token });
      setOrders(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [token]);

  const filtered = activeTab === 'All' ? orders : orders.filter((o) => o.status === activeTab.toUpperCase());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">All Orders</h1>
        <p className="text-sm text-muted-foreground">Platform-wide order management</p>
      </div>

      <div className="flex gap-1.5">
        {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((tab) => (
          <Button key={tab} variant={activeTab === tab ? 'default' : 'ghost'} size="sm" className="h-8 text-xs"
            onClick={() => setActiveTab(tab)}>{tab}</Button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'order_number', label: 'Order', sortable: true, render: (item: any) => (
            <button onClick={() => router.push(`/admin/orders/${item.id}`)} className="text-sm font-mono font-medium hover:underline text-left">
              {item.order_number}
            </button>
          )},
          { key: 'customer', label: 'Customer', render: (item: any) => (
            <span className="text-sm">{item.customer ? `${item.customer.first_name} ${item.customer.last_name}` : '—'}</span>
          )},
          { key: 'items', label: 'Items', render: (item: any) => (
            <span className="text-xs text-muted-foreground">{item.items?.length || 0} items</span>
          )},
          { key: 'total', label: 'Total', sortable: true, render: (item: any) => (
            <span className="text-sm font-medium">{fmt(item.total)}</span>
          )},
          { key: 'status', label: 'Status', sortable: true, render: (item: any) => (
            <Badge variant="outline" className={`text-[10px] font-semibold ${statusColors[item.status] || ''}`}>{item.status}</Badge>
          )},
          { key: 'created_at', label: 'Date', sortable: true, render: (item: any) => (
            <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
          )},
          { key: 'actions', label: '', render: (item: any) => (
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push(`/admin/orders/${item.id}`)}>View</Button>
          )},
        ]}
        data={filtered}
        pagination={meta}
        onPageChange={(p) => fetchOrders(p)}
        emptyMessage={loading ? 'Loading...' : 'No orders yet'}
      />
    </div>
  );
}
