'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import type { Granularity } from './overview.api';

/**
 * Intl locale for numbers and dates. Arabic keeps Latin digits so amounts read
 * the same as in the rest of the dashboard (orders, products, earnings).
 */
function numberLocale(locale: string): string {
  return locale === 'ar' ? 'ar-u-nu-latn' : locale;
}

/** Parse a bucket key (YYYY-MM, YYYY-MM-DD or YYYY-MM-DDTHH:00) as a UTC date. */
export function parseBucket(t: string): Date {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T(\d{2}))?/.exec(t);
  if (!m) return new Date(t);
  return new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1, m[4] ? +m[4] : 0));
}

export interface OverviewFormat {
  locale: string;
  rtl: boolean;
  money: (n: number, currency?: string | null) => string;
  /** Headline amount: whole units from 1,000 up so tiles never truncate. */
  moneyHeadline: (n: number) => string;
  moneyCompact: (n: number) => string;
  number: (n: number) => string;
  compact: (n: number) => string;
  percent: (ratio: number, digits?: number) => string;
  /** Short axis tick for a bucket. */
  tick: (t: string, g: Granularity) => string;
  /** Full label for tooltips and tables. */
  bucket: (t: string, g: Granularity) => string;
  date: (iso: string) => string;
  time: (d: Date) => string;
  country: (code: string) => string;
}

export function useOverviewFormat(currency: string): OverviewFormat {
  const uiLocale = useLocale();
  return useMemo(() => {
    const loc = numberLocale(uiLocale);
    const cache = new Map<string, Intl.NumberFormat>();
    const moneyFmt = (cur: string) => {
      let f = cache.get(cur);
      if (!f) {
        try {
          f = new Intl.NumberFormat(loc, { style: 'currency', currency: cur });
        } catch {
          f = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        cache.set(cur, f);
      }
      return f;
    };
    let moneyCompactFmt: Intl.NumberFormat;
    try {
      moneyCompactFmt = new Intl.NumberFormat(loc, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      });
    } catch {
      moneyCompactFmt = new Intl.NumberFormat(loc, { notation: 'compact' });
    }
    const intFmt = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
    const compactFmt = new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 });
    const utc = { timeZone: 'UTC' } as const;
    const dayTick = new Intl.DateTimeFormat(loc, { ...utc, day: 'numeric', month: 'short' });
    const hourTick = new Intl.DateTimeFormat(loc, { ...utc, hour: 'numeric' });
    const monthTick = new Intl.DateTimeFormat(loc, { ...utc, month: 'short' });
    const dayFull = new Intl.DateTimeFormat(loc, { ...utc, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const hourFull = new Intl.DateTimeFormat(loc, { ...utc, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const monthFull = new Intl.DateTimeFormat(loc, { ...utc, month: 'long', year: 'numeric' });
    const dateFmt = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' });
    const timeFmt = new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit' });
    let regions: Intl.DisplayNames | null = null;
    try {
      regions = new Intl.DisplayNames([uiLocale], { type: 'region' });
    } catch {
      regions = null;
    }
    return {
      locale: uiLocale,
      rtl: uiLocale === 'ar',
      money: (n, cur) => moneyFmt(cur || currency).format(n),
      moneyHeadline: (n) => {
        if (Math.abs(n) < 1000) return moneyFmt(currency).format(n);
        try {
          return new Intl.NumberFormat(loc, { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);
        } catch {
          return intFmt.format(n);
        }
      },
      moneyCompact: (n) => moneyCompactFmt.format(n),
      number: (n) => intFmt.format(n),
      compact: (n) => compactFmt.format(n),
      percent: (ratio, digits = 0) =>
        new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: digits }).format(ratio),
      tick: (t, g) => {
        const d = parseBucket(t);
        return (g === 'hour' ? hourTick : g === 'month' ? monthTick : dayTick).format(d);
      },
      bucket: (t, g) => {
        const d = parseBucket(t);
        return (g === 'hour' ? hourFull : g === 'month' ? monthFull : dayFull).format(d);
      },
      date: (iso) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
      },
      time: (d) => timeFmt.format(d),
      country: (code) => {
        if (!/^[A-Za-z]{2}$/.test(code) || !regions) return code;
        try {
          return regions.of(code.toUpperCase()) ?? code;
        } catch {
          return code;
        }
      },
    };
  }, [uiLocale, currency]);
}

/** Relative change; null when there is no meaningful base to compare with. */
export function relativeChange(value: number, previous: number): number | null {
  if (!previous) return value ? null : 0;
  return (value - previous) / Math.abs(previous);
}

/** Round-number axis ticks from 0 to a "nice" maximum. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const rough = max / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Indices of the x-axis labels to show, evenly spread, always incl. first and last. */
export function tickIndices(n: number, maxLabels: number): number[] {
  if (n <= 0) return [];
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (maxLabels - 1));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  // Drop a label that would crowd the final one.
  if (n - 1 - out[out.length - 1] < step / 2) out.pop();
  out.push(n - 1);
  return out;
}
