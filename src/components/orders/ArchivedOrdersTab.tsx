'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/taxRate';

/**
 * "WooCommerce archive" tab of the orders page (plans/wp-order-archive,
 * M70): read-only list of the orders imported from the old WooCommerce
 * shop. Not platform orders: no actions, no stats.
 */

// Row of GET /archived-orders (the subset the table renders).
export interface ArchivedOrderRow {
  id: string;
  external_id: string;
  number: string;
  status: string;
  created_at_source: string;
  currency: string;
  total: number | string;
  customer_name?: string | null;
  customer_email?: string | null;
  payment_method_title?: string | null;
  lines_count: number;
}

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ArchivedOrdersSummary {
  count: number;
  min_date: string | null;
  max_date: string | null;
}

/** WooCommerce statuses (without the `wc-` prefix) offered in the filter. */
export const ARCHIVE_STATUSES = [
  'completed',
  'processing',
  'on-hold',
  'pending',
  'cancelled',
  'refunded',
  'failed',
  'checkout-draft',
  'trash',
] as const;

export const archiveStatusColors: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'on-hold': 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
};

/** Amount in the order's own currency (the archive keeps the source currency). */
export function formatArchiveMoney(value: number | string | null | undefined, currency: string, locale: string): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/** Status label: translated when known, else the raw WooCommerce status. */
export function useArchiveStatusLabel() {
  const t = useTranslations('orders.archive');
  return (status: string): string =>
    (ARCHIVE_STATUSES as readonly string[]).includes(status) ? t(`status.${status}`) : status;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

interface Props {
  token: string | null;
  summary: ArchivedOrdersSummary | null;
}

export function ArchivedOrdersTab({ token, summary }: Props) {
  const t = useTranslations('orders.archive');
  const tc = useTranslations('common');
  const locale = useLocale();
  const statusLabel = useArchiveStatusLabel();
  const [rows, setRows] = useState<ArchivedOrderRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState('');
  // The search box is debounced into `term`, the value the request uses.
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(h);
  }, [q]);

  const filters = { q: term, status, from, to };

  const fetchPage = useCallback(
    async (page = 1) => {
      if (!token) return;
      setLoading(true);
      setLoadError(false);
      try {
        const res = await api<{ data?: ArchivedOrderRow[]; meta?: ListMeta | null }>(
          `/archived-orders${buildQuery({ page, limit: 20, ...filters })}`,
          { token },
        );
        setRows(res?.data ?? []);
        setMeta(res?.meta ?? null);
      } catch (err) {
        console.error(err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, term, status, from, to],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  const handleExport = async () => {
    if (!token || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      await downloadCsv(`/archived-orders/export.csv${buildQuery(filters)}`, token, 'woocommerce-orders.csv');
    } catch (err) {
      console.error(err);
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  const fmtDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const columns = [
    {
      key: 'number',
      label: t('colNumber'),
      render: (item: ArchivedOrderRow) => (
        <Link href={`/creator/orders/archive/${item.id}`} className="text-sm font-mono font-medium hover:underline">
          {item.number}
        </Link>
      ),
    },
    {
      key: 'created_at_source',
      label: t('colDate'),
      render: (item: ArchivedOrderRow) => (
        <span className="text-xs text-muted-foreground">{fmtDate(item.created_at_source)}</span>
      ),
    },
    {
      key: 'customer_name',
      label: t('colCustomer'),
      render: (item: ArchivedOrderRow) => (
        <div className="min-w-0">
          <div className="text-sm">{item.customer_name || '—'}</div>
          {item.customer_email && <div className="text-xs text-muted-foreground">{item.customer_email}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      label: t('colStatus'),
      render: (item: ArchivedOrderRow) => (
        <Badge variant="outline" className={`text-[11px] font-semibold ${archiveStatusColors[item.status] ?? ''}`}>
          {statusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: 'total',
      label: t('colTotal'),
      render: (item: ArchivedOrderRow) => (
        <span className="text-sm font-medium">{formatArchiveMoney(item.total, item.currency, locale)}</span>
      ),
    },
    {
      key: 'lines_count',
      label: t('colLines'),
      render: (item: ArchivedOrderRow) => (
        <span className="text-xs text-muted-foreground">{t('lines', { count: item.lines_count })}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">{t('title')}</p>
        <p className="text-xs text-muted-foreground">
          {t('subtitle')}
          {summary && summary.count > 0 && summary.min_date && summary.max_date && (
            <>
              {' '}
              {t('summary', {
                count: summary.count,
                from: fmtDate(summary.min_date),
                to: fmtDate(summary.max_date),
              })}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-64">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <SearchableSelect
            value={status}
            onChange={setStatus}
            placeholder={t('statusAll')}
            options={[
              { value: '', label: t('statusAll') },
              ...ARCHIVE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
            ]}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t('from')}</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t('to')}</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        </label>
        <div className="ms-auto flex items-center gap-2">
          {exportError && <span className="text-xs text-destructive">{t('exportFailed')}</span>}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="size-3.5" />
            {exporting ? t('exporting') : t('exportCsv')}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchPage(meta?.page || 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowHref={(item: ArchivedOrderRow) => `/creator/orders/archive/${item.id}`}
          emptyMessage={loading ? tc('loading') : t('empty')}
          pagination={meta ?? undefined}
          onPageChange={(p) => void fetchPage(p)}
        />
      )}
    </div>
  );
}
