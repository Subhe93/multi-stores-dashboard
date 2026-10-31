'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  ExternalLink,
  Info,
  PackagePlus,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { OverviewFallback, OverviewRange, OverviewResponse, OverviewResult } from './overview.api';
import { useOverviewFormat, type OverviewFormat } from './format';
import { KpiCard, KpiCardSkeleton } from './KpiCard';
import { TimeSeriesChart, type TimeSeriesChartLabels } from './TimeSeriesChart';
import { BarList } from './BarList';
import { TodoStrip, TodoStripSkeleton } from './TodoStrip';
import { ChecklistCard } from './ChecklistCard';
import { LowStockList, TopProductsList } from './ProductLists';
import { RecentOrdersTable } from './RecentOrders';
import { RangeSelector } from './RangeSelector';
import { DEFAULT_STATUS_BADGE, ORDER_STATUS_BADGE, STATUS_ORDER } from './statusColors';

// Chart tokens (dataviz reference palette, slot 1 blue as the single accent;
// previous period in the de-emphasis gray). Dark values are selected steps,
// not an automatic flip.
const VIZ_TOKENS =
  '[--viz-accent:#2a78d6] [--viz-accent-strong:#1c5cab] [--viz-prev:#a1a1aa] [--viz-grid:#ececee] [--viz-baseline:#d4d4d8] [--viz-muted:#71717a] [--viz-track:#f1f1f3] [--viz-surface:#ffffff] ' +
  'dark:[--viz-accent:#3987e5] dark:[--viz-accent-strong:#6da7ec] dark:[--viz-prev:#71717a] dark:[--viz-grid:#2c2c2a] dark:[--viz-baseline:#3f3f46] dark:[--viz-muted:#a1a1aa] dark:[--viz-track:#27272a] dark:[--viz-surface:#18181b]';

export type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message?: string }
  | { status: 'ready'; result: OverviewResult };

export interface OverviewViewProps {
  range: OverviewRange;
  onRangeChange: (r: OverviewRange) => void;
  state: OverviewState;
  /** A refetch is running while older data is on screen. */
  refreshing?: boolean;
  /** The last refetch failed (older data still shown). */
  refreshFailed?: boolean;
  updatedAt?: Date | null;
  onRefresh: () => void;
  /** Creator display name for the greeting. */
  name?: string | null;
  storeUrl?: string | null;
  /** Store type known before the overview loads (fallback data has none). */
  independent: boolean;
  /** Store currency used until the response provides one. */
  currency: string;
  /** Local hour for the greeting; set after mount to avoid a hydration mismatch. */
  hour?: number | null;
}

function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border bg-card', className)}>
      <header className="flex min-h-12 items-center justify-between gap-2 px-4 pt-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      <div className={cn('flex-1 px-4 pt-2 pb-4', bodyClassName)}>{children}</div>
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-(--viz-accent-strong) hover:underline">
      {children}
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full min-h-40 flex-col items-center justify-center px-4 py-8 text-center', className)}>
      {icon && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 [&_svg]:size-5">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function PanelSkeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <Skeleton className="h-4 w-32" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-7 w-28" />
      <div className="mt-6 flex h-48 items-end gap-1.5">
        {[40, 55, 35, 70, 60, 85, 50, 65, 90, 75, 60, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function greetingKey(hour: number): 'greetMorning' | 'greetAfternoon' | 'greetEvening' {
  if (hour >= 5 && hour < 12) return 'greetMorning';
  if (hour >= 12 && hour < 18) return 'greetAfternoon';
  return 'greetEvening';
}

export function OverviewView(props: OverviewViewProps) {
  const t = useTranslations('creator.overview');
  const { state, range, onRangeChange, refreshing, refreshFailed, updatedAt, onRefresh, name, storeUrl } = props;
  const full = state.status === 'ready' && state.result.kind === 'full' ? state.result.data : null;
  const fallback = state.status === 'ready' && state.result.kind === 'fallback' ? state.result.data : null;
  const currency = full?.currency || props.currency;
  const fmt = useOverviewFormat(currency);
  const independent = full ? full.store_type === 'INDEPENDENT' : props.independent;
  const hour = props.hour ?? null;
  const productsHref = independent ? '/creator/products/own' : '/creator/custom-products';
  const newProductHref = independent ? '/creator/products/own/new' : '/creator/custom-products/new';

  return (
    <div className={cn('space-y-5', VIZ_TOKENS)}>
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {name && hour != null ? t(greetingKey(hour), { name }) : t('title')}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!fallback && <RangeSelector value={range} onChange={onRangeChange} />}
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', className: 'border-zinc-200 bg-card' })}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {t('visitStore')}
            </a>
          )}
        </div>
      </div>

      <div className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
        {updatedAt && <span>{t('updatedAt', { time: fmt.time(updatedAt) })}</span>}
        {refreshFailed && (
          <span className="inline-flex items-center gap-1 text-red-700">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            {t('refreshFailed')}
          </span>
        )}
        {state.status !== 'loading' && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground/80 transition hover:bg-zinc-200/60 disabled:opacity-60"
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            {refreshing ? t('refreshing') : t('refresh')}
          </button>
        )}
      </div>

      {state.status === 'loading' && <LoadingBody />}

      {state.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<AlertCircle />}
            title={t('loadFailed')}
            hint={state.message}
            action={
              <button type="button" onClick={onRefresh} className={buttonVariants({ variant: 'outline', className: 'border-zinc-200 bg-card' })}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t('retry')}
              </button>
            }
          />
        </div>
      )}

      {full && (
        <div className={cn('space-y-5 transition-opacity', refreshing && 'pointer-events-none opacity-60')} aria-busy={refreshing}>
          <FullBody
            data={full}
            fmt={fmt}
            independent={independent}
            productsHref={productsHref}
            newProductHref={newProductHref}
            storeUrl={storeUrl}
          />
        </div>
      )}

      {fallback && (
        <div className={cn('space-y-5 transition-opacity', refreshing && 'opacity-60')}>
          <FallbackBody
            data={fallback}
            fmt={fmt}
            independent={independent}
            productsHref={productsHref}
            newProductHref={newProductHref}
          />
        </div>
      )}
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="space-y-5" aria-busy="true">
      <TodoStripSkeleton />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" />
        <ChartSkeleton />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <PanelSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={5} />
      </div>
    </div>
  );
}

interface BodyProps {
  fmt: OverviewFormat;
  independent: boolean;
  productsHref: string;
  newProductHref: string;
}

function FullBody({
  data,
  fmt,
  independent,
  productsHref,
  newProductHref,
  storeUrl,
}: BodyProps & { data: OverviewResponse; storeUrl?: string | null }) {
  const t = useTranslations('creator.overview');
  const tc = useTranslations('creator');
  const { kpis, granularity } = data;

  const chartLabels: TimeSeriesChartLabels = {
    current: t('chart.current'),
    previous: t('chart.previous'),
    hint: t('chart.hint'),
    showTable: t('chart.showTable'),
    showChart: t('chart.showChart'),
    date: t('chart.date'),
    previousDate: t('chart.previousDate'),
  };

  const revenuePoints = useMemo(() => data.series.map((p) => ({ t: p.t, value: p.revenue })), [data.series]);
  const revenuePrev = useMemo(
    () => data.previous_series.map((p) => ({ t: p.t, value: p.revenue })),
    [data.previous_series],
  );
  const orderPoints = useMemo(() => data.series.map((p) => ({ t: p.t, value: p.orders })), [data.series]);
  const orderPrev = useMemo(
    () => data.previous_series.map((p) => ({ t: p.t, value: p.orders })),
    [data.previous_series],
  );
  const aovTrend = data.series.map((p) => (p.orders ? p.revenue / p.orders : 0));
  const hasSales = data.series.some((p) => p.revenue > 0 || p.orders > 0);

  const returningShare = kpis.customers.value ? kpis.returning_customers.value / kpis.customers.value : 0;

  const statusItems = [...data.status_breakdown]
    .filter((s) => s.count > 0)
    .sort((a, b) => {
      const ia = STATUS_ORDER.indexOf(a.status);
      const ib = STATUS_ORDER.indexOf(b.status);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  const statusTotal = statusItems.reduce((s, i) => s + i.count, 0);

  const methodLabel = (m: string) => (t.has(`paymentMethod.${m}`) ? t(`paymentMethod.${m}`) : m);
  const marketLabel = (m: { key: string; label: string }) =>
    m.key === 'other' ? t('other') : /^[A-Za-z]{2}$/.test(m.key) ? fmt.country(m.key) : m.label;

  const kpiCount = kpis.earnings ? 6 : 5;

  return (
    <>
      <TodoStrip todo={data.todo} independent={independent} />

      <ChecklistCard setup={data.setup} independent={independent} />

      {/* KPI row */}
      <div
        className={cn(
          'grid grid-cols-2 gap-3 md:grid-cols-3',
          kpiCount === 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-5',
        )}
      >
        <KpiCard
          label={t('kpi.revenue')}
          value={fmt.moneyHeadline(kpis.revenue.value)}
          compare={kpis.revenue}
          trend={revenuePoints.map((p) => p.value)}
          fmt={fmt}
        />
        <KpiCard
          label={t('kpi.orders')}
          value={fmt.number(kpis.orders.value)}
          compare={kpis.orders}
          trend={orderPoints.map((p) => p.value)}
          fmt={fmt}
        />
        <KpiCard
          label={t('kpi.aov')}
          value={fmt.moneyHeadline(kpis.aov.value)}
          compare={kpis.aov}
          trend={aovTrend}
          fmt={fmt}
        />
        <KpiCard
          label={t('kpi.itemsSold')}
          value={fmt.number(kpis.items_sold.value)}
          compare={kpis.items_sold}
          trend={[]}
          fmt={fmt}
        />
        <KpiCard
          label={t('kpi.customers')}
          value={fmt.number(kpis.customers.value)}
          compare={kpis.customers}
          footer={kpis.customers.value ? t('kpi.returning', { percent: fmt.percent(returningShare) }) : undefined}
          trend={[]}
          fmt={fmt}
        />
        {kpis.earnings && (
          <KpiCard
            label={t('kpi.earnings')}
            value={fmt.moneyHeadline(kpis.earnings.value)}
            compare={kpis.earnings}
            trend={[]}
            fmt={fmt}
          />
        )}
      </div>

      {/* Main charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={t('salesOverTime')}
          className="lg:col-span-2"
          action={<span className="text-xs text-muted-foreground">{t(`range.long.${data.range}`)}</span>}
        >
          {hasSales ? (
            <>
              <p className="mb-3 text-2xl font-semibold tracking-tight">{fmt.money(kpis.revenue.value)}</p>
              <TimeSeriesChart
                kind="area"
                points={revenuePoints}
                previous={revenuePrev}
                showPreviousLine
                granularity={granularity}
                fmt={fmt}
                formatValue={(n) => fmt.money(n)}
                formatTick={(n) => fmt.moneyCompact(n)}
                label={t('salesOverTime')}
                labels={chartLabels}
              />
            </>
          ) : (
            <EmptyState
              className="min-h-72"
              icon={<ShoppingBag />}
              title={t('noSales')}
              hint={t('noSalesHint')}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={newProductHref} className={buttonVariants({ variant: 'default' })}>
                    <PackagePlus className="size-3.5" aria-hidden="true" />
                    {t('addProduct')}
                  </Link>
                  {storeUrl && (
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: 'outline', className: 'border-zinc-200 bg-card' })}
                    >
                      {t('visitStore')}
                    </a>
                  )}
                </div>
              }
            />
          )}
        </Panel>

        <Panel title={t('ordersOverTime')}>
          {hasSales ? (
            <>
              <p className="mb-3 text-2xl font-semibold tracking-tight">{fmt.number(kpis.orders.value)}</p>
              <TimeSeriesChart
                kind="bar"
                points={orderPoints}
                previous={orderPrev}
                integer
                granularity={granularity}
                fmt={fmt}
                formatValue={(n) => t('ordersCount', { count: n })}
                formatTick={(n) => fmt.compact(n)}
                label={t('ordersOverTime')}
                labels={chartLabels}
              />
            </>
          ) : (
            <EmptyState className="min-h-72" title={t('noData')} />
          )}
        </Panel>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title={t('salesByMarket')}>
          {data.sales_by_market.length ? (
            <BarList
              items={data.sales_by_market.map((m) => ({
                key: m.key,
                label: marketLabel(m),
                value: m.revenue,
                display: fmt.money(m.revenue),
                secondary: t('ordersCount', { count: m.orders }),
              }))}
            />
          ) : (
            <EmptyState title={t('noData')} />
          )}
        </Panel>

        <Panel title={t('paymentMethods')}>
          {data.payment_methods.length ? (
            <BarList
              items={[...data.payment_methods]
                .sort((a, b) => b.revenue - a.revenue)
                .map((m) => ({
                  key: m.method,
                  label: methodLabel(m.method),
                  value: m.revenue,
                  display: fmt.money(m.revenue),
                  secondary: t('ordersCount', { count: m.orders }),
                }))}
            />
          ) : (
            <EmptyState title={t('noData')} />
          )}
        </Panel>

        <Panel title={t('ordersByStatus')} action={<PanelLink href="/creator/orders">{t('viewAll')}</PanelLink>}>
          {statusItems.length ? (
            <BarList
              items={statusItems.map((s) => ({
                key: s.status,
                label: (
                  <span
                    className={cn(
                      'inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                      ORDER_STATUS_BADGE[s.status] ?? DEFAULT_STATUS_BADGE,
                    )}
                  >
                    {tc.has(`orderStatus.${s.status}`) ? tc(`orderStatus.${s.status}`) : s.status}
                  </span>
                ),
                value: s.count,
                display: fmt.number(s.count),
                secondary: statusTotal ? fmt.percent(s.count / statusTotal) : undefined,
              }))}
            />
          ) : (
            <EmptyState title={t('noData')} />
          )}
        </Panel>

        <Panel title={t('lowStock')} action={<PanelLink href={productsHref}>{t('viewAll')}</PanelLink>}>
          {data.low_stock.length ? (
            <LowStockList products={data.low_stock} />
          ) : (
            <EmptyState title={t('allStocked')} />
          )}
        </Panel>
      </div>

      {/* Products and orders */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('topProducts')} action={<PanelLink href={productsHref}>{t('viewAll')}</PanelLink>}>
          {data.top_products.length ? (
            <TopProductsList products={data.top_products} total={kpis.revenue.value} fmt={fmt} />
          ) : (
            <EmptyState title={t('noTopProducts')} hint={t('noTopProductsHint')} />
          )}
        </Panel>
        <Panel title={t('recentOrdersTitle')} action={<PanelLink href="/creator/orders">{t('viewAll')}</PanelLink>}>
          {data.recent_orders.length ? (
            <RecentOrdersTable orders={data.recent_orders} fmt={fmt} />
          ) : (
            <EmptyState title={t('noOrdersYet')} />
          )}
        </Panel>
      </div>
    </>
  );
}

function FallbackBody({ data, fmt, independent, productsHref, newProductHref }: BodyProps & { data: OverviewFallback }) {
  const t = useTranslations('creator.overview');
  return (
    <>
      <div className="flex items-start gap-2 rounded-xl border border-dashed bg-card px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
        {t('fallbackNote')}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          label={independent ? t('myProducts') : t('customProducts')}
          value={data.productCount == null ? '—' : fmt.number(data.productCount)}
          fmt={fmt}
        />
        <KpiCard label={t('totalOrders')} value={fmt.number(data.totalOrders)} fmt={fmt} />
        {data.earningsThisMonth != null && (
          <KpiCard label={t('earningsThisMonth')} value={fmt.moneyHeadline(data.earningsThisMonth)} fmt={fmt} />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={t('recentOrdersTitle')}
          className="lg:col-span-2"
          action={<PanelLink href="/creator/orders">{t('viewAll')}</PanelLink>}
        >
          {data.recentOrders.length ? (
            <RecentOrdersTable orders={data.recentOrders} fmt={fmt} />
          ) : (
            <EmptyState title={t('noOrdersYet')} />
          )}
        </Panel>
        <Panel title={t('quickActions')}>
          <div className="flex flex-col gap-2">
            <Link href={newProductHref} className={buttonVariants({ variant: 'default' })}>
              <PackagePlus className="size-3.5" aria-hidden="true" />
              {t('addProduct')}
            </Link>
            <Link href={productsHref} className={buttonVariants({ variant: 'outline', className: 'border-zinc-200 bg-card' })}>
              {independent ? t('myProducts') : t('customProducts')}
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
