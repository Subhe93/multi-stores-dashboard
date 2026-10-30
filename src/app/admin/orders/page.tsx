'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/common/DataTable';
import { useBulkAction } from '@/components/common/useBulkAction';
import {
  OrderBulkActions,
  ORDER_STATUS_FLOW,
  type OrderStatusTarget,
} from '@/components/orders/OrderBulkActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';

// Order row as returned by GET /orders (only the fields this table reads).
interface AdminOrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at: string;
  currency?: string | null;
  payment_status?: string | null;
  market?: { currency?: string | null } | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  items?: unknown[];
}

// Mirrors the pagination shape DataTable expects.
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

// The admin detail page hides its status actions on these and offers only
// forward steps plus cancel otherwise; RETURNED is excluded here as well
// (the detail page has no flow position for it).
const ADMIN_LOCKED_STATUSES = ['DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'];

function adminCanApply(row: AdminOrderRow, target: string): boolean {
  if (ADMIN_LOCKED_STATUSES.includes(row.status)) return false;
  if (target === 'CANCELLED') return true;
  return ORDER_STATUS_FLOW.indexOf(target) > ORDER_STATUS_FLOW.indexOf(row.status);
}

export default function AdminOrders() {
  const t = useTranslations('admin');
  const tb = useTranslations('bulk');
  const bulk = useBulkAction();
  // admin.orderStatus_* exists for every lifecycle status.
  const statusLabel = (s: string) =>
    [...ORDER_STATUS_FLOW, ...ADMIN_LOCKED_STATUSES].includes(s)
      ? t(`orderStatus_${s}` as Parameters<typeof t>[0])
      : s;
  // Same targets as the admin detail page: every forward step + cancel.
  const statusTargets: OrderStatusTarget[] = [
    ...ORDER_STATUS_FLOW.slice(1).map((s) => ({ value: s, label: statusLabel(s) })),
    { value: 'CANCELLED', label: tb('cancelOrders'), destructive: true },
  ];
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [activeTab, setActiveTab] = useState('All');

  const fetchOrders = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: AdminOrderRow[]; meta?: PaginationMeta }>(`/orders?page=${page}&limit=20`, { token });
      setOrders(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [token]);

  const filtered = activeTab === 'All' ? orders : orders.filter((o) => o.status === activeTab.toUpperCase());

  const tabLabels: Record<string, string> = {
    All: t('tabAll'), Pending: t('statusPending'), Processing: t('statusProcessing'),
    Shipped: t('statusShipped'), Delivered: t('statusDelivered'), Cancelled: t('statusCancelled'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('allOrders')}</h1>
        <p className="text-sm text-muted-foreground">{t('allOrdersSubtitle')}</p>
      </div>

      <div className="flex gap-1.5">
        {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((tab) => (
          <Button key={tab} variant={activeTab === tab ? 'default' : 'ghost'} size="sm" className="h-8 text-xs"
            onClick={() => setActiveTab(tab)}>{tabLabels[tab] ?? tab}</Button>
        ))}
      </div>

      {bulk.notice}
      {bulk.dialog}

      <DataTable
        columns={[
          { key: 'order_number', label: t('order'), sortable: true, render: (item: AdminOrderRow) => (
            <Link href={`/admin/orders/${item.id}`} className="text-sm font-mono font-medium hover:underline">
              {item.order_number}
            </Link>
          )},
          { key: 'customer', label: t('customer'), render: (item: AdminOrderRow) => (
            <span className="text-sm">{item.customer ? `${item.customer.first_name} ${item.customer.last_name}` : '—'}</span>
          )},
          { key: 'items', label: t('items'), render: (item: AdminOrderRow) => (
            <span className="text-xs text-muted-foreground">{t('itemsCount', { count: item.items?.length || 0 })}</span>
          )},
          { key: 'total', label: t('total'), sortable: true, render: (item: AdminOrderRow) => (
            <span className="text-sm font-medium">{fmt(item.total)}</span>
          )},
          { key: 'status', label: t('status'), sortable: true, render: (item: AdminOrderRow) => (
            <Badge variant="outline" className={`text-[10px] font-semibold ${statusColors[item.status] || ''}`}>{statusLabel(item.status)}</Badge>
          )},
          { key: 'created_at', label: t('date'), sortable: true, render: (item: AdminOrderRow) => (
            <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
          )},
          { key: 'actions', label: '', render: (item: AdminOrderRow) => (
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => router.push(`/admin/orders/${item.id}`)}>{t('view')}</Button>
          )},
        ]}
        data={filtered}
        rowHref={(item: AdminOrderRow) => `/admin/orders/${item.id}`}
        selectable
        bulkActions={(rows, clear) => (
          <OrderBulkActions
            rows={rows}
            clear={clear}
            bulk={bulk}
            token={token}
            targets={statusTargets}
            canApply={adminCanApply}
            // Same timeline note the admin detail page sends.
            note={(s) => `Status changed to ${s} by admin`}
            statusLabel={statusLabel}
            after={() => fetchOrders(meta?.page || 1)}
          />
        )}
        pagination={meta ?? undefined}
        onPageChange={(p) => fetchOrders(p)}
        emptyMessage={loading ? t('loading') : t('noOrdersYet')}
      />
    </div>
  );
}
