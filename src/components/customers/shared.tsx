'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { relativeTimeParts } from '@/lib/customers';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  BANNED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_KEYS = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BANNED'] as const;

/** Account status badge (SUSPENDED reads as "Blocked"). */
export function CustomerStatusBadge({ status }: { status: string }) {
  const t = useTranslations('creator.customers.status');
  const known = (STATUS_KEYS as readonly string[]).includes(status);
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${STATUS_STYLES[status] ?? ''}`}>
      {known ? t(status as (typeof STATUS_KEYS)[number]) : status}
    </Badge>
  );
}

/** Amount in the given currency; falls back to `fallback` (the dashboard `fmt`) on unknown codes. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  fallback: (amount: number | string | null | undefined) => string,
): string {
  if (!currency) return fallback(amount);
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount ?? 0));
  } catch {
    return fallback(amount);
  }
}

/** Locale date, e.g. "1 Nov 2026". */
export function useDateFormatter() {
  const locale = useLocale();
  return (value: string | null | undefined): string => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };
}

/** "3 days ago" in the dashboard locale, with the full date as a tooltip. */
export function RelativeDate({ value }: { value: string | null | undefined }) {
  const locale = useLocale();
  const fmtDate = useDateFormatter();
  const parts = relativeTimeParts(value);
  if (!parts) return <span className="text-xs text-muted-foreground">—</span>;
  const text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(parts.value, parts.unit);
  return (
    <time dateTime={value ?? undefined} title={fmtDate(value)} className="text-xs text-muted-foreground">
      {text}
    </time>
  );
}
