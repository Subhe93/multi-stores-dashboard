'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

const TABS = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

type Translator = ReturnType<typeof useTranslations>;

// Translated labels for the order-status badge (mirrors the detail page).
function statusLabels(t: Translator): Record<string, string> {
  return {
    PENDING: t('orderStatus.PENDING'),
    CONFIRMED: t('orderStatus.CONFIRMED'),
    PROCESSING: t('orderStatus.PROCESSING'),
    MANUFACTURING: t('orderStatus.MANUFACTURING'),
    QUALITY_CHECK: t('orderStatus.QUALITY_CHECK'),
    SHIPPED: t('orderStatus.SHIPPED'),
    DELIVERED: t('orderStatus.DELIVERED'),
    RETURNED: t('orderStatus.RETURNED'),
    CANCELLED: t('orderStatus.CANCELLED'),
    REFUNDED: t('orderStatus.REFUNDED'),
  };
}

export default function CreatorOrdersPage() {
  const { fmt } = useCurrency();
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  const STATUS_LABELS = statusLabels(t);
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  // Status filtering happens server-side so tabs cover ALL orders,
  // not just the currently fetched page.
  const fetchOrders = async (page = 1, tab = activeTab) => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      const statusParam = tab === 'All' ? '' : `&status=${tab.toUpperCase()}`;
      const res = await api<any>(`/orders?page=${page}&limit=20${statusParam}`, { token });
      setOrders(res?.data ?? []);
      setMeta(res?.meta ?? null);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Refetch from page 1 whenever the active tab changes.
    fetchOrders(1, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  const columns = [
    {
      key: 'order_number',
      label: t('orders.colOrder'),
      sortable: true,
      render: (item: any) => (
        <button
          type="button"
          onClick={() => router.push(`/creator/orders/${item.id}`)}
          className="text-sm font-mono font-medium hover:underline text-left"
        >
          {item.order_number}
        </button>
      ),
    },
    {
      key: 'customer',
      label: t('orders.colCustomer'),
      render: (item: any) => (
        <span className="text-sm">
          {item.customer
            ? `${item.customer.first_name} ${item.customer.last_name}`.trim()
            : '—'}
        </span>
      ),
    },
    {
      key: 'items',
      label: t('orders.colItems'),
      render: (item: any) => (
        <span className="text-xs text-muted-foreground">
          {t('orders.itemCount', { count: item.items?.length ?? 0 })}
        </span>
      ),
    },
    {
      key: 'total',
      label: t('orders.colTotal'),
      sortable: true,
      render: (item: any) => (
        <span className="text-sm font-medium">{fmt(item.total)}</span>
      ),
    },
    {
      key: 'status',
      label: tc('status'),
      sortable: true,
      render: (item: any) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${statusColors[item.status] ?? ''}`}
        >
          {STATUS_LABELS[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: t('orders.colDate'),
      sortable: true,
      render: (item: any) => (
        <span className="text-xs text-muted-foreground">
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
        </span>
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
          onClick={() => router.push(`/creator/orders/${item.id}`)}
        >
          {t('orders.view')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('orders.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('orders.subtitle')}</p>
      </div>

      {/* Tab filters */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setActiveTab(tab)}
          >
            {t(`orders.tab${tab}`)}
          </Button>
        ))}
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{t('orders.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => fetchOrders(meta?.page || 1)}>
            {t('orders.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          emptyMessage={loading ? tc('loading') : t('orders.noOrdersYet')}
          pagination={meta}
          onPageChange={(p) => fetchOrders(p)}
        />
      )}
    </div>
  );
}
