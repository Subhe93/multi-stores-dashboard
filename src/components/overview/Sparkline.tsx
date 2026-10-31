'use client';

import { useId } from 'react';

interface SparklineProps {
  values: number[];
  /** Mirror the time axis (RTL): the series starts at the inline-start edge. */
  rtl?: boolean;
  className?: string;
}

const W = 120;
const H = 32;
const PAD = 3;

/**
 * Decorative trend line for a KPI tile (hidden from assistive tech — the tile's
 * value and delta carry the information). Accent line + 10% wash.
 */
export function Sparkline({ values, rtl = false, className }: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const xr = i / (values.length - 1);
    const x = PAD + (rtl ? 1 - xr : xr) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${H}L${pts[0][0].toFixed(1)},${H}Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--viz-accent)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--viz-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--viz-accent)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
