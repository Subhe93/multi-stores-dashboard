'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/common/DataTable';
import { useBulkAction } from '@/components/common/useBulkAction';
import {
  OrderBulkActions,
  ORDER_STATUS_FLOW,
  ORDER_TERMINAL_STATUSES,
  ownItemsProgress,
  type OrderStatusTarget,
} from '@/components/orders/OrderBulkActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/useCurrency';
import { useTranslations } from 'next-intl';

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

/** Order list row (GET /orders) — only the fields rendered by the table. */
interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at: string;
  currency?: string | null;
  payment_status?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  items?: { id: string; fulfiller_type?: string | null; fulfiller_id?: string | null; fulfillment_status?: string | null }[] | null;
}

/** Pagination block returned next to `data` by list endpoints. */
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

// Maps each tab's internal label to its translation key (display only)
const TAB_LABEL_KEYS: Record<string, string> = {
  All:           'tabAll',
  Pending:       'orderStatus.pending',
  Confirmed:     'orderStatus.confirmed',
  Processing:    'orderStatus.processing',
  Manufacturing: 'orderStatus.manufacturing',
  'Quality Check': 'orderStatus.qualityCheck',
  Shipped:       'orderStatus.shipped',
  Delivered:     'orderStatus.delivered',
  Returned:      'orderStatus.returned',
  Cancelled:     'orderStatus.cancelled',
};

// Same keys as the provider detail page's status labels.
const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING:       'orderStatus.pending',
  CONFIRMED:     'orderStatus.confirmed',
  PROCESSING:    'orderStatus.processing',
  MANUFACTURING: 'orderStatus.manufacturing',
  QUALITY_CHECK: 'orderStatus.qualityCheck',
  SHIPPED:       'orderStatus.shipped',
  DELIVERED:     'orderStatus.delivered',
  RETURNED:      'orderStatus.returned',
  CANCELLED:     'orderStatus.cancelled',
  REFUNDED:      'orderStatus.refunded',
};

// Bulk targets mirror the provider detail page's forward steps, except
// SHIPPED: there it always goes through the per-order tracking prompt.
const PROVIDER_BULK_TARGETS = ORDER_STATUS_FLOW.filter((s) => s !== 'PENDING' && s !== 'SHIPPED');

export default function ProviderOrders() {
  const { fmt } = useCurrency();
  const { token, user } = useAuth();
  const router = useRouter();
  const t = useTranslations('provider');
  const tc = useTranslations('common');
  const tb = useTranslations('bulk');
  const bulk = useBulkAction();
  const statusLabel = (s: string) => (STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s);
  const statusTargets: OrderStatusTarget[] = PROVIDER_BULK_TARGETS.map((s) => ({
    value: s,
    label: statusLabel(s),
  }));
  const providerId = user?.provider?.id as string | undefined;
  // The detail page offers status steps only while the provider fulfills an
  // item, the order is not terminal and not waiting on quality check
  // (approve needs tracking, reject is a single-order decision).
  const canApply = (row: OrderRow, target: string) => {
    if (ORDER_TERMINAL_STATUSES.includes(row.status) || row.status === 'QUALITY_CHECK') return false;
    const progress = ownItemsProgress(row, 'PROVIDER', providerId);
    return progress !== null && ORDER_STATUS_FLOW.indexOf(target) > progress;
  };
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');

  const fetchOrders = async (page = 1) => {
    if (!token || !user) return;
    setLoading(true);
    try {
      const res = await api<{ data: OrderRow[]; meta?: PaginationMeta | null }>(`/orders?page=${page}&limit=20`, { token });
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
        <h1 className="text-xl font-semibold tracking-tight">{t('orders')}</h1>
        <p className="text-sm text-muted-foreground">{t('ordersSubtitle')}</p>
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
              {t(TAB_LABEL_KEYS[tab.label])}
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

      {bulk.notice}
      {bulk.dialog}

      <DataTable
        columns={[
          {
            key: 'order_number',
            label: t('csvOrder'),
            sortable: true,
            render: (item: OrderRow) => (
              <Link
                href={`/provider/orders/${item.id}`}
                className="text-sm font-mono font-medium hover:underline"
              >
                {item.order_number}
              </Link>
            ),
          },
          {
            key: 'customer',
            label: t('customer'),
            render: (item: OrderRow) => (
              <span className="text-sm">
                {item.customer ? `${item.customer.first_name} ${item.customer.last_name}` : '—'}
              </span>
            ),
          },
          {
            key: 'items',
            label: t('items'),
            render: (item: OrderRow) => (
              <span className="text-xs text-muted-foreground">{t('itemCount', { count: item.items?.length || 0 })}</span>
            ),
          },
          {
            key: 'total',
            label: t('total'),
            sortable: true,
            render: (item: OrderRow) => (
              <span className="text-sm font-medium">{fmt(item.total)}</span>
            ),
          },
          {
            key: 'status',
            label: t('colStatus'),
            sortable: true,
            render: (item: OrderRow) => (
              <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[item.status] || ''}`}>
                {statusLabel(item.status)}
              </Badge>
            ),
          },
          {
            key: 'created_at',
            label: t('csvDate'),
            sortable: true,
            render: (item: OrderRow) => (
              <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (item: OrderRow) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => router.push(`/provider/orders/${item.id}`)}
              >
                {t('view')}
              </Button>
            ),
          },
        ]}
        data={filtered}
        rowHref={(item: OrderRow) => `/provider/orders/${item.id}`}
        selectable
        bulkActions={(rows, clear) => (
          <OrderBulkActions
            rows={rows}
            clear={clear}
            bulk={bulk}
            token={token}
            targets={statusTargets}
            canApply={canApply}
            // Same timeline note the provider detail page sends.
            note={(s) => t('noteStatusUpdated', { status: s })}
            statusLabel={statusLabel}
            after={() => fetchOrders(meta?.page || 1)}
            menuHint={tb('ordersShipNeedsTracking')}
          />
        )}
        pagination={meta ?? undefined}
        onPageChange={p => fetchOrders(p)}
        emptyMessage={loading ? tc('loading') : t('noOrders')}
      />
    </div>
  );
}
