'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

const STATUS_COLORS: Record<string, string> = {
  PENDING:        'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED:      'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING:  'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK:  'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED:        'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED:       'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED:      'bg-zinc-100 text-zinc-500 border-zinc-200',
  REFUNDED:       'bg-zinc-100 text-zinc-500 border-zinc-200',
};

// Tab label → actual status value(s)
const TABS: { label: string; statuses: string[] | null }[] = [
  { label: 'All',            statuses: null },
  { label: 'Pending',        statuses: ['PENDING'] },
  { label: 'Confirmed',      statuses: ['CONFIRMED'] },
  { label: 'Processing',     statuses: ['PROCESSING'] },
  { label: 'Manufacturing',  statuses: ['MANUFACTURING'] },
  { label: 'Quality Check',  statuses: ['QUALITY_CHECK'] },
  { label: 'Shipped',        statuses: ['SHIPPED'] },
  { label: 'Delivered',      statuses: ['DELIVERED'] },
  { label: 'Returned',       statuses: ['RETURNED'] },
  { label: 'Cancelled',      statuses: ['CANCELLED', 'REFUNDED'] },
];

export default function ProviderOrders() {
  const { fmt } = useCurrency();
  const { token, user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');

  const fetchOrders = async (page = 1) => {
    if (!token || !user) return;
    setLoading(true);
    try {
      const res = await api<any>(`/orders?page=${page}&limit=20`, { token });
      setOrders(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [token, user]);

  const activeTabDef = TABS.find(t => t.label === activeTab) ?? TABS[0];
  const filtered = activeTabDef.statuses
    ? orders.filter(o => activeTabDef.statuses!.includes(o.status))
    : orders;

  // Count per tab for badges
  const countFor = (statuses: string[] | null) =>
    statuses ? orders.filter(o => statuses.includes(o.status)).length : orders.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Manage incoming orders and fulfillment</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(tab => {
          const count = countFor(tab.statuses);
          const isActive = activeTab === tab.label;
          // Hide tabs with 0 orders except "All"
          if (tab.label !== 'All' && count === 0) return null;
          return (
            <Button
              key={tab.label}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setActiveTab(tab.label)}
            >
              {tab.label}
              {count > 0 && tab.label !== 'All' && (
                <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <DataTable
        columns={[
          {
            key: 'order_number',
            label: 'Order',
            sortable: true,
            render: (item: any) => (
              <button
                onClick={() => router.push(`/provider/orders/${item.id}`)}
                className="text-sm font-mono font-medium hover:underline text-left"
              >
                {item.order_number}
              </button>
            ),
          },
          {
            key: 'customer',
            label: 'Customer',
            render: (item: any) => (
              <span className="text-sm">
                {item.customer ? `${item.customer.first_name} ${item.customer.last_name}` : '—'}
              </span>
            ),
          },
          {
            key: 'items',
            label: 'Items',
            render: (item: any) => (
              <span className="text-xs text-muted-foreground">{item.items?.length || 0} item{item.items?.length !== 1 ? 's' : ''}</span>
            ),
          },
          {
            key: 'total',
            label: 'Total',
            sortable: true,
            render: (item: any) => (
              <span className="text-sm font-medium">{fmt(item.total)}</span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (item: any) => (
              <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[item.status] || ''}`}>
                {item.status.replace('_', ' ')}
              </Badge>
            ),
          },
          {
            key: 'created_at',
            label: 'Date',
            sortable: true,
            render: (item: any) => (
              <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (item: any) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => router.push(`/provider/orders/${item.id}`)}
              >
                View
              </Button>
            ),
          },
        ]}
        data={filtered}
        pagination={meta}
        onPageChange={p => fetchOrders(p)}
        emptyMessage={loading ? 'Loading...' : 'No orders'}
      />
    </div>
  );
}
