'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Download, FileText, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/common/DataTable';
import { ListEmptyState } from '@/components/common/ListEmptyState';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { InvoiceKindBadge, InvoicePaidBadge } from '@/components/invoices/InvoiceBits';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { useInvoicePdfDownload } from '@/lib/useInvoices';
import { formatInvoiceAmount, formatInvoiceDate } from '@/lib/invoices';
import {
  listProviderInvoices,
  type InvoiceKind,
  type InvoiceListQuery,
  type ProviderInvoiceListResponse,
  type ProviderInvoiceSummary,
} from '@/lib/invoices.api';

const PAGE_SIZE = 25;

type KindFilter = 'all' | InvoiceKind;
type PaidFilter = 'all' | 'yes' | 'no';

/**
 * Read-only list of the invoices and credit notes stores issued for orders
 * containing items this provider fulfils. The store is the seller; the
 * provider can only view and download the PDFs.
 */
export default function ProviderInvoicesPage() {
  const t = useTranslations('provider.invoices');
  const ti = useTranslations('creator.invoices');
  const locale = useLocale();
  const { token } = useAuth();
  const describeError = useApiError();
  const { download, downloadingId, downloadError } = useInvoicePdfDownload(token);

  const [kind, setKind] = useState<KindFilter>('all');
  const [paid, setPaid] = useState<PaidFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ProviderInvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text search so typing doesn't fire a request per key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    if (!token) return;
    const query: InvoiceListQuery = {
      kind: kind === 'all' ? undefined : kind,
      paid: paid === 'all' ? undefined : paid === 'yes',
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
      page,
      limit: PAGE_SIZE,
    };
    setLoading(true);
    setError(null);
    listProviderInvoices(token, query)
      .then((res) => setData(res))
      .catch((err: unknown) => setError(describeError(err) || t('loadFailed')))
      .finally(() => setLoading(false));
    // describeError and t only read stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kind, paid, from, to, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  const resetFilters = () => {
    setKind('all');
    setPaid('all');
    setFrom('');
    setTo('');
    setSearch('');
    setQ('');
    setPage(1);
  };
  const hasFilters = kind !== 'all' || paid !== 'all' || !!from || !!to || !!search;

  const kindOptions = [
    { value: 'all', label: ti('filters.allKinds') },
    { value: 'INVOICE', label: ti('kind.INVOICE') },
    { value: 'CREDIT_NOTE', label: ti('kind.CREDIT_NOTE') },
  ];
  const paidOptions = [
    { value: 'all', label: ti('filters.paidAll') },
    { value: 'yes', label: ti('paidBadge') },
    { value: 'no', label: ti('unpaidBadge') },
  ];

  const downloadButton = (inv: ProviderInvoiceSummary) => (
    // Span carries the tooltip: disabled buttons get no pointer events.
    <span className="inline-flex" title={inv.pdf_available === false ? ti('detail.pdfUnavailable') : ti('download')}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!!downloadingId || inv.pdf_available === false}
        onClick={(e) => {
          e.stopPropagation();
          void download(inv);
        }}
        aria-label={ti('download')}
      >
        {downloadingId === inv.id ? <Loader2 className="animate-spin" /> : <Download />}
      </Button>
    </span>
  );

  const columns = [
    {
      key: 'number',
      label: ti('columns.number'),
      render: (inv: ProviderInvoiceSummary) => (
        <span className="font-mono text-sm font-medium" dir="ltr">
          {inv.number}
        </span>
      ),
    },
    {
      key: 'kind',
      label: ti('columns.kind'),
      render: (inv: ProviderInvoiceSummary) => (
        <div className="space-y-0.5">
          <InvoiceKindBadge kind={inv.kind} />
          {inv.credited_invoice && (
            <p className="text-[10px] text-muted-foreground">
              {ti('creditFor')} <span className="font-mono" dir="ltr">{inv.credited_invoice.number}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'issue_date',
      label: ti('columns.date'),
      render: (inv: ProviderInvoiceSummary) => (
        <span className="whitespace-nowrap">{formatInvoiceDate(inv.issue_date, locale)}</span>
      ),
    },
    {
      key: 'store_name',
      label: t('columns.store'),
      render: (inv: ProviderInvoiceSummary) => (
        <span className="block max-w-48 truncate" title={inv.store_name ?? undefined}>
          {inv.store_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'order_number',
      label: ti('columns.order'),
      render: (inv: ProviderInvoiceSummary) => (
        <Link
          href={`/provider/orders/${inv.order_id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs hover:underline"
          dir="ltr"
        >
          {inv.order_number}
        </Link>
      ),
    },
    {
      key: 'gross_total',
      label: ti('columns.total'),
      className: 'text-end',
      render: (inv: ProviderInvoiceSummary) => (
        <bdi dir="ltr" className={`whitespace-nowrap ${inv.gross_total < 0 ? 'text-rose-700' : ''}`}>
          {formatInvoiceAmount(inv.gross_total, inv.currency, locale)}
        </bdi>
      ),
    },
    {
      key: 'paid',
      label: ti('columns.status'),
      render: (inv: ProviderInvoiceSummary) => <InvoicePaidBadge paid={inv.paid} />,
    },
    {
      key: 'actions',
      label: ti('columns.actions'),
      render: downloadButton,
    },
  ];

  const pagination = data
    ? {
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))),
      }
    : undefined;

  // Nothing issued at all (not just filtered away): show the empty state.
  const noDocuments = !loading && !error && data?.total === 0 && !hasFilters;
  const firstLoad = loading && !data && !error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{t('notice')}</span>
      </div>

      <Card className="shadow-none">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">{ti('filters.search')}</Label>
            <Input
              type="search"
              className="h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{ti('filters.kind')}</Label>
            <SearchableSelect
              value={kind}
              onChange={(v) => {
                setKind(v as KindFilter);
                setPage(1);
              }}
              options={kindOptions}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{ti('filters.paid')}</Label>
            <SearchableSelect
              value={paid}
              onChange={(v) => {
                setPaid(v as PaidFilter);
                setPage(1);
              }}
              options={paidOptions}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{ti('filters.from')}</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{ti('filters.to')}</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-5">
            <p className="text-xs text-muted-foreground">{data ? ti('resultCount', { count: data.total }) : ' '}</p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X /> {ti('filters.clear')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={load}>
            <RefreshCw /> {t('retry')}
          </Button>
        </div>
      )}

      {downloadError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {firstLoad ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('loading')}
        </div>
      ) : noDocuments ? (
        <ListEmptyState icon={<FileText />} title={t('emptyTitle')} hint={t('emptyHint')} />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            pagination={pagination}
            onPageChange={setPage}
            emptyMessage={loading ? t('loading') : t('emptyFiltered')}
          />
        </div>
      )}
    </div>
  );
}
