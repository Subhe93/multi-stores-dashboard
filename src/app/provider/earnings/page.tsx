'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeftRight, Clock, Download, RotateCw, Undo2, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/DataTable';
import { StatCard } from '@/components/common/StatCard';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { downloadAuthed } from '@/lib/http';

/** Payout state of one order line (GET /commissions/provider/lines). */
type LineStatus = 'pending' | 'unpaid' | 'transferred' | 'failed' | 'offline' | 'refunded' | 'cancelled';
const LINE_STATUSES: LineStatus[] = ['pending', 'unpaid', 'transferred', 'failed', 'offline', 'refunded', 'cancelled'];

/** One currency of GET /commissions/provider/summary (major units). */
interface CurrencySummary {
  currency: string;
  orders: number;
  refunded_orders: number;
  gross: number;
  earned: number;
  pending: number;
  failed: number;
  unpaid: number;
  /** Paid without a platform charge (COD, ...): in `earned`, not in `pending`. */
  offline: number;
  transferred: number;
  refunded: number;
  refunded_after_transfer: number;
}

interface EarningsLine {
  order_id: string;
  order_number: string;
  created_at: string;
  order_status: string;
  store: { id: string; name: string | null } | null;
  items_count: number;
  gross: number;
  amount: number;
  currency: string;
  status: LineStatus;
  payout: { status: string; updated_at: string; stripe_transfer_id: string | null } | null;
}

interface PayoutRow {
  id: string;
  order_id: string;
  order_number: string;
  amount: number;
  currency: string;
  status: string;
  stripe_transfer_id: string | null;
  error: string | null;
  order_refunded: boolean;
  created_at: string;
  updated_at: string;
}

interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-zinc-50 text-zinc-600 border-zinc-200',
  transferred: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  offline: 'bg-sky-50 text-sky-700 border-sky-200',
  refunded: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

type Preset = 'this_month' | 'last_month' | 'last_3_months' | 'all' | 'custom';
const PRESETS: { key: Preset; labelKey: string }[] = [
  { key: 'this_month', labelKey: 'filterThisMonth' },
  { key: 'last_month', labelKey: 'filterLastMonth' },
  { key: 'last_3_months', labelKey: 'filterLast3Months' },
  { key: 'all', labelKey: 'filterAllTime' },
];

/** YYYY-MM-DD in the viewer's local calendar. */
function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inclusive from/to bounds of a preset (empty strings = unbounded). */
function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === 'this_month') return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
  if (preset === 'last_month') return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (preset === 'last_3_months') return { from: ymd(new Date(y, m - 2, 1)), to: ymd(new Date(y, m + 1, 0)) };
  return { from: '', to: '' };
}

/**
 * ISO instants of the viewer's local day bounds, so the API filters on the
 * same calendar days the viewer picked (a date-only value would be a UTC day).
 */
function localDayStart(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}
function localDayEnd(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** Row cap of the CSV export (mirrors CSV_MAX_ROWS in the API). */
const CSV_MAX_ROWS = 20000;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export default function ProviderEarnings() {
  const { token } = useAuth();
  const locale = useLocale();
  const t = useTranslations('provider');
  const te = useTranslations('provider.earningsPage');
  const tc = useTranslations('common');

  const [preset, setPreset] = useState<Preset>('this_month');
  const [range, setRange] = useState(() => presetRange('this_month'));
  const [status, setStatus] = useState<LineStatus | ''>('');
  const [tab, setTab] = useState<'lines' | 'payouts'>('lines');

  const [summary, setSummary] = useState<CurrencySummary[] | null>(null);
  const [lines, setLines] = useState<{ data: EarningsLine[]; meta: PageMeta } | null>(null);
  const [linesPage, setLinesPage] = useState(1);
  const [payouts, setPayouts] = useState<{ data: PayoutRow[]; meta: PageMeta } | null>(null);
  const [payoutsPage, setPayoutsPage] = useState(1);
  // One error per data source, so a failing list never hides a loaded summary.
  const [summaryError, setSummaryError] = useState(false);
  const [linesError, setLinesError] = useState(false);
  const [payoutsError, setPayoutsError] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [reload, setReload] = useState({ summary: 0, lines: 0, payouts: 0 });
  const [exporting, setExporting] = useState(false);

  const fmtIn = useCallback(
    (currency: string, amount: number | null | undefined) => {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount ?? 0));
      } catch {
        return `${Number(amount ?? 0).toFixed(2)} ${currency}`;
      }
    },
    [locale],
  );
  const fmtDate = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(locale),
    [locale],
  );

  const rangeQuery = useMemo(
    () => ({
      from: range.from ? localDayStart(range.from) : '',
      to: range.to ? localDayEnd(range.to) : '',
    }),
    [range],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setSummaryError(false);
    api<{ by_currency: CurrencySummary[] }>(`/commissions/provider/summary${buildQuery(rangeQuery)}`, { token })
      .then((res) => {
        if (cancelled) return;
        setSummary(res?.by_currency ?? []);
      })
      .catch(() => !cancelled && setSummaryError(true));
    return () => {
      cancelled = true;
    };
  }, [token, rangeQuery, reload.summary]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLinesError(false);
    api<{ data: EarningsLine[]; meta: PageMeta }>(
      `/commissions/provider/lines${buildQuery({ ...rangeQuery, status, page: linesPage, limit: 20 })}`,
      { token },
    )
      .then((res) => !cancelled && setLines(res))
      .catch(() => !cancelled && setLinesError(true));
    return () => {
      cancelled = true;
    };
  }, [token, rangeQuery, status, linesPage, reload.lines]);

  useEffect(() => {
    if (!token || tab !== 'payouts') return;
    let cancelled = false;
    setPayoutsError(false);
    api<{ data: PayoutRow[]; meta: PageMeta }>(
      `/commissions/provider/payouts${buildQuery({ page: payoutsPage, limit: 20 })}`,
      { token },
    )
      .then((res) => !cancelled && setPayouts(res))
      .catch(() => !cancelled && setPayoutsError(true));
    return () => {
      cancelled = true;
    };
  }, [token, tab, payoutsPage, reload.payouts]);

  const retry = (key: 'summary' | 'lines' | 'payouts') => setReload((r) => ({ ...r, [key]: r[key] + 1 }));

  const choosePreset = (p: Preset) => {
    setPreset(p);
    setRange(presetRange(p));
    setLinesPage(1);
  };
  const setBound = (key: 'from' | 'to', value: string) => {
    setPreset('custom');
    setRange((r) => ({ ...r, [key]: value }));
    setLinesPage(1);
  };

  const exportCsv = async () => {
    if (!token) return;
    setExporting(true);
    setExportNotice(null);
    try {
      let truncated = false;
      await downloadAuthed(
        `/commissions/provider/lines.csv${buildQuery({ ...rangeQuery, status })}`,
        token,
        `earnings-${ymd(new Date())}.csv`,
        { onHeaders: (h) => (truncated = h.get('x-truncated') === '1') },
      );
      if (truncated) {
        setExportNotice(te('csvTruncated', { count: CSV_MAX_ROWS.toLocaleString(locale) }));
      }
    } catch {
      setExportNotice(te('exportError'));
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = (s: string) => te(`status.${s}` as 'status.pending');

  const lineColumns = [
    {
      key: 'order_number',
      label: t('csvOrder'),
      render: (l: EarningsLine) => (
        <Link href={`/provider/orders/${l.order_id}`} className="text-xs font-mono hover:underline">
          {l.order_number}
        </Link>
      ),
    },
    {
      key: 'created_at',
      label: t('csvDate'),
      render: (l: EarningsLine) => <span className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</span>,
    },
    {
      key: 'store',
      label: te('store'),
      render: (l: EarningsLine) => <span className="text-xs">{l.store?.name ?? '—'}</span>,
    },
    {
      key: 'items_count',
      label: te('items'),
      render: (l: EarningsLine) => <span className="text-xs tabular-nums">{l.items_count}</span>,
    },
    {
      key: 'gross',
      label: te('grossBase'),
      render: (l: EarningsLine) => <span className="text-xs tabular-nums text-zinc-500">{fmtIn(l.currency, l.gross)}</span>,
    },
    {
      key: 'amount',
      label: t('csvYourEarnings'),
      render: (l: EarningsLine) => (
        <span
          className={`text-xs font-semibold tabular-nums ${
            l.status === 'refunded' || l.status === 'cancelled' ? 'text-zinc-400 line-through' : 'text-emerald-700'
          }`}
        >
          {fmtIn(l.currency, l.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: te('payoutStatus'),
      render: (l: EarningsLine) => (
        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[l.status] ?? ''}`}>
          {statusLabel(l.status)}
        </Badge>
      ),
    },
  ];

  const payoutColumns = [
    {
      key: 'created_at',
      label: t('csvDate'),
      render: (p: PayoutRow) => <span className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</span>,
    },
    {
      key: 'order_number',
      label: t('csvOrder'),
      render: (p: PayoutRow) => (
        <Link href={`/provider/orders/${p.order_id}`} className="text-xs font-mono hover:underline">
          {p.order_number}
        </Link>
      ),
    },
    {
      key: 'amount',
      label: te('amount'),
      render: (p: PayoutRow) => <span className="text-xs font-semibold tabular-nums">{fmtIn(p.currency, p.amount)}</span>,
    },
    {
      key: 'status',
      label: t('csvStatus'),
      render: (p: PayoutRow) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[p.status] ?? ''}`}>
            {p.status === 'paid' ? statusLabel('transferred') : statusLabel('failed')}
          </Badge>
          {p.order_refunded && (
            <span className="text-[10px] text-amber-700">{te('refundedAfterTransfer')}</span>
          )}
        </div>
      ),
    },
    {
      key: 'stripe_transfer_id',
      label: te('transferId'),
      render: (p: PayoutRow) => (
        <span className="text-xs font-mono text-muted-foreground" dir="ltr">
          {p.stripe_transfer_id ?? '—'}
        </span>
      ),
    },
    {
      key: 'error',
      label: te('failureReason'),
      render: (p: PayoutRow) =>
        p.error ? <span className="text-[11px] text-red-600 leading-snug">{p.error}</span> : <span className="text-xs">—</span>,
    },
  ];

  const statusOptions = [
    { value: '', label: te('allStatuses') },
    ...LINE_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('earnings')}</h1>
          <p className="text-sm text-muted-foreground">{t('earningsSubtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={exporting || !lines || lines.meta.total === 0}
          onClick={exportCsv}
        >
          <Download className="w-3.5 h-3.5" /> {t('exportCsv')}
        </Button>
      </div>

      {exportNotice && (
        <p className="text-sm text-red-600" role="alert">
          {exportNotice}
        </p>
      )}

      {/* Date range filter */}
      <Card className="shadow-none">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={preset === p.key ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => choosePreset(p.key)}
              >
                {t(p.labelKey)}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2 ms-auto">
            <div className="space-y-1">
              <Label htmlFor="earnings-from" className="text-[11px] text-muted-foreground">
                {te('from')}
              </Label>
              <Input
                id="earnings-from"
                type="date"
                className="h-8 text-xs w-36"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => setBound('from', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="earnings-to" className="text-[11px] text-muted-foreground">
                {te('to')}
              </Label>
              <Input
                id="earnings-to"
                type="date"
                className="h-8 text-xs w-36"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => setBound('to', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary per currency: amounts in different currencies are never added up. */}
      {summaryError ? (
        <ErrorState message={te('loadError')} retryLabel={tc('retry')} onRetry={() => retry('summary')} />
      ) : summary === null ? (
        <p className="text-sm text-muted-foreground">{te('loading')}</p>
      ) : summary.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground text-center">{t('noOrdersInPeriod')}</CardContent>
        </Card>
      ) : (
        summary.map((s) => (
          <div key={s.currency} className="space-y-2">
            {summary.length > 1 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.currency}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={te('earned')}
                value={fmtIn(s.currency, s.earned)}
                subtitle={te('ordersAndGross', { count: s.orders, gross: fmtIn(s.currency, s.gross) })}
                icon={<Wallet className="w-4 h-4" />}
              />
              <StatCard
                title={t('pendingPayout')}
                value={fmtIn(s.currency, s.pending)}
                subtitle={
                  s.failed > 0
                    ? te('failedIncluded', { amount: fmtIn(s.currency, s.failed) })
                    : s.unpaid > 0
                      ? te('unpaidHint', { amount: fmtIn(s.currency, s.unpaid) })
                      : t('awaitingSettlement')
                }
                icon={<Clock className="w-4 h-4" />}
              />
              <StatCard
                title={te('transferred')}
                value={fmtIn(s.currency, s.transferred)}
                subtitle={te('transferredHint')}
                icon={<ArrowLeftRight className="w-4 h-4" />}
              />
              <StatCard
                title={te('refunded')}
                value={fmtIn(s.currency, s.refunded)}
                subtitle={
                  s.refunded_after_transfer > 0
                    ? te('refundedAfterTransferAmount', { amount: fmtIn(s.currency, s.refunded_after_transfer) })
                    : te('refundedOrders', { count: s.refunded_orders })
                }
                icon={<Undo2 className="w-4 h-4" />}
              />
            </div>
            {s.offline > 0 && (
              <p className="text-xs text-sky-700">{te('offlineHint', { amount: fmtIn(s.currency, s.offline) })}</p>
            )}
          </div>
        ))
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'lines' | 'payouts')}>
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="lines" className="flex-none px-3">
            {te('tabLines')}
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-none px-3">
            {te('tabPayouts')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="pt-2 space-y-2">
          {linesError && (
            <ErrorState message={te('linesLoadError')} retryLabel={tc('retry')} onRetry={() => retry('lines')} />
          )}
          <DataTable<EarningsLine>
            columns={lineColumns}
            data={lines?.data ?? []}
            getRowId={(l) => l.order_id}
            rowHref={(l) => `/provider/orders/${l.order_id}`}
            emptyMessage={lines ? t('noOrdersInPeriod') : linesError ? '—' : te('loading')}
            pagination={lines?.meta}
            onPageChange={setLinesPage}
            actions={
              <div className="w-48">
                <SearchableSelect
                  options={statusOptions}
                  value={status}
                  onChange={(v) => {
                    setStatus(v as LineStatus | '');
                    setLinesPage(1);
                  }}
                  placeholder={te('allStatuses')}
                />
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="payouts" className="pt-2 space-y-2">
          {payoutsError && (
            <ErrorState message={te('payoutsLoadError')} retryLabel={tc('retry')} onRetry={() => retry('payouts')} />
          )}
          <DataTable<PayoutRow>
            columns={payoutColumns}
            data={payouts?.data ?? []}
            emptyMessage={payouts ? te('noPayouts') : payoutsError ? '—' : te('loading')}
            pagination={payouts?.meta}
            onPageChange={setPayoutsPage}
          />
        </TabsContent>
      </Tabs>

      {/* Commission structure explanation */}
      <Card className="shadow-none bg-zinc-50/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('howEarningsWork')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
            <p>
              <span className="font-medium text-foreground">{te('grossBase')}</span> — {te('explainGross')}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
            <p>
              <span className="font-medium text-foreground">{t('csvPlatformFee')}</span> — {t('explainPlatformFee')}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
            <p>
              <span className="font-medium text-emerald-700">{t('csvYourEarnings')}</span> — {t('explainYourEarnings')}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
            <p>
              <span className="font-medium text-foreground">{statusLabel('offline')}</span> — {te('explainOffline')}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <p>
              <span className="font-medium text-foreground">{te('refunded')}</span> — {te('explainRefunds')}
            </p>
          </div>
          <Separator className="my-1" />
          <p>
            {t('payoutsIntro')}{' '}
            <Link href="/provider/settings" className="text-primary hover:underline font-medium">
              {t('stripeConnect')}
            </Link>
            . {t('payoutsOutro')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Inline error of one data source, with a retry. */
function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2"
      role="alert"
    >
      <p className="text-sm text-red-700">{message}</p>
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0" onClick={onRetry}>
        <RotateCw className="w-3.5 h-3.5" /> {retryLabel}
      </Button>
    </div>
  );
}
