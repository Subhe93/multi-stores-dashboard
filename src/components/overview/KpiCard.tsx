'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from './Sparkline';
import { relativeChange, type OverviewFormat } from './format';

interface DeltaProps {
  value: number;
  previous: number;
  fmt: OverviewFormat;
}

/** Signed change vs the previous period: arrow + percent, with a screen-reader sentence. */
export function Delta({ value, previous, fmt }: DeltaProps) {
  const t = useTranslations('creator.overview');
  const change = relativeChange(value, previous);
  if (change == null) {
    // Nothing to compare with (previous period was zero).
    return (
      <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
        {t('deltaNew')}
      </span>
    );
  }
  const pct = fmt.percent(Math.abs(change), Math.abs(change) < 0.1 ? 1 : 0);
  const flat = Math.abs(change) < 0.0005;
  const up = change > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        flat ? 'bg-zinc-100 text-zinc-600' : up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      )}
    >
      <span aria-hidden="true">{flat ? '–' : up ? '▲' : '▼'}</span>
      <bdi aria-hidden="true">{flat ? '0%' : pct}</bdi>
      <span className="sr-only">
        {flat ? t('deltaFlat') : up ? t('deltaUp', { value: pct }) : t('deltaDown', { value: pct })}
      </span>
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  fmt: OverviewFormat;
  /** Current/previous pair; omitted for KPIs without a comparison (fallback data). */
  compare?: { value: number; previous: number };
  trend?: number[];
  footer?: ReactNode;
  icon?: ReactNode;
}

export function KpiCard({ label, value, fmt, compare, trend, footer, icon }: KpiCardProps) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && <span className="shrink-0 text-muted-foreground/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="mt-1.5 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        <bdi>{value}</bdi>
      </p>
      <div className="mt-2 flex min-h-5.5 items-center gap-2">
        {compare && <Delta value={compare.value} previous={compare.previous} fmt={fmt} />}
        {footer && <span className="truncate text-xs text-muted-foreground">{footer}</span>}
      </div>
      {trend !== undefined &&
        (trend.length > 1 ? (
          <Sparkline values={trend} rtl={fmt.rtl} className="mt-3 h-8 w-full" />
        ) : (
          // Keeps tiles in a row the same height when one has no per-bucket trend.
          <div className="mt-3 h-8" aria-hidden="true" />
        ))}
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-3 h-4 w-14" />
      <Skeleton className="mt-3 h-8 w-full" />
    </div>
  );
}
