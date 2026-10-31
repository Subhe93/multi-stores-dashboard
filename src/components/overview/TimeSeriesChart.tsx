'use client';

import { useEffect, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Table2, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Granularity } from './overview.api';
import { niceTicks, relativeChange, tickIndices, type OverviewFormat } from './format';

export interface ChartPoint {
  t: string;
  value: number;
}

export interface TimeSeriesChartLabels {
  current: string;
  previous: string;
  hint: string;
  showTable: string;
  showChart: string;
  date: string;
  previousDate: string;
}

interface TimeSeriesChartProps {
  kind: 'area' | 'bar';
  points: ChartPoint[];
  /** Same-length comparison series (previous period), drawn dashed / in the tooltip. */
  previous?: ChartPoint[];
  granularity: Granularity;
  fmt: OverviewFormat;
  formatValue: (n: number) => string;
  formatTick: (n: number) => string;
  /** Count data: ticks are whole numbers. */
  integer?: boolean;
  /** Accessible name of the chart (the card title). */
  label: string;
  labels: TimeSeriesChartLabels;
  /** Draw the previous period as a dashed line (area charts). */
  showPreviousLine?: boolean;
  height?: number;
}

const AXIS_BAND = 26;
const TOP_PAD = 10;
const END_PAD = 10;
const TICK_FONT = 11;

/** Width of an element that may mount/unmount (callback ref + ResizeObserver). */
function useElementWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

/** Bar path with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Time-series chart (area/line or columns) in plain SVG.
 * - Crosshair + tooltip on hover; the same readout on keyboard focus
 *   (arrow keys / Home / End) with a polite live region.
 * - A table view toggle exposes every value without hovering.
 * - In RTL the time axis is mirrored so time flows from the inline-start edge,
 *   matching the rest of the mirrored layout (and the KPI sparklines).
 */
export function TimeSeriesChart({
  kind,
  points,
  previous,
  granularity,
  fmt,
  formatValue,
  formatTick,
  integer = false,
  label,
  labels,
  showPreviousLine = false,
  height = 220,
}: TimeSeriesChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const hintId = useId();
  const rtl = fmt.rtl;
  const n = points.length;
  const hasPrev = !!previous && previous.length === n;

  const geo = useMemo(() => {
    const values = points.map((p) => p.value);
    const prevValues = hasPrev && showPreviousLine ? previous!.map((p) => p.value) : [];
    const rawMax = Math.max(0, ...values, ...prevValues);
    const ticks = niceTicks(integer ? Math.max(rawMax, 4) : rawMax);
    const top = ticks[ticks.length - 1] || 1;
    const tickLabels = ticks.map(formatTick);
    const labelW = Math.max(28, Math.max(...tickLabels.map((s) => s.length)) * 6.4 + 10);
    const plotTop = TOP_PAD;
    const plotBottom = TOP_PAD + height;
    const x0 = labelW;
    const plotW = Math.max(10, width - labelW - END_PAD);
    const band = plotW / Math.max(1, n);
    // LTR x of a point, then mirrored for RTL.
    const lx = (i: number) =>
      kind === 'bar' ? x0 + band * (i + 0.5) : n <= 1 ? x0 + plotW / 2 : x0 + (i / (n - 1)) * plotW;
    const X = (i: number) => (rtl ? width - lx(i) : lx(i));
    const Y = (v: number) => plotBottom - (v / top) * height;
    return { ticks, tickLabels, labelW, plotTop, plotBottom, x0, plotW, band, lx, X, Y };
  }, [points, previous, hasPrev, showPreviousLine, integer, formatTick, height, width, n, kind, rtl]);

  const svgH = TOP_PAD + height + AXIS_BAND;

  const indexFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ltrX = rtl ? width - px : px;
    let i: number;
    if (kind === 'bar') i = Math.floor((ltrX - geo.x0) / geo.band);
    else i = n <= 1 ? 0 : Math.round(((ltrX - geo.x0) / geo.plotW) * (n - 1));
    return Math.min(n - 1, Math.max(0, i));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    const cur = active ?? n - 1;
    let next: number | null = null;
    // Arrow keys follow the visual direction (mirrored in RTL).
    if (e.key === 'ArrowRight') next = rtl ? cur - 1 : cur + 1;
    else if (e.key === 'ArrowLeft') next = rtl ? cur + 1 : cur - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') {
      setActive(null);
      return;
    }
    if (next == null) return;
    e.preventDefault();
    setActive(Math.min(n - 1, Math.max(0, next)));
  };

  const readout = (i: number) => {
    const p = points[i];
    const prev = hasPrev ? previous![i] : null;
    const change = prev ? relativeChange(p.value, prev.value) : null;
    return { p, prev, change };
  };

  const xTicks = width ? tickIndices(n, Math.max(2, Math.floor(geo.plotW / 72))) : [];

  // Line/area paths.
  const linePath = (vals: ChartPoint[]) =>
    vals.map((p, i) => `${i ? 'L' : 'M'}${geo.X(i).toFixed(1)},${geo.Y(p.value).toFixed(1)}`).join('');
  const areaPath = () => {
    if (n < 1) return '';
    return `${linePath(points)}L${geo.X(n - 1).toFixed(1)},${geo.plotBottom}L${geo.X(0).toFixed(1)},${geo.plotBottom}Z`;
  };

  const barW = Math.max(2, Math.min(24, geo.band * 0.62, geo.band - 2));

  const live = active != null ? readout(active) : null;
  const liveText = live
    ? `${fmt.bucket(live.p.t, granularity)}: ${formatValue(live.p.value)}${
        live.prev ? ` · ${labels.previous} ${formatValue(live.prev.value)}` : ''
      }`
    : '';

  const tooltipLeft =
    active != null && width ? Math.min(Math.max(geo.X(active), 96), Math.max(96, width - 96)) : 0;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {showPreviousLine && hasPrev ? (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <svg width="16" height="4" aria-hidden="true">
                <line x1="0" x2="16" y1="2" y2="2" stroke="var(--viz-accent)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {labels.current}
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="16" height="4" aria-hidden="true">
                <line x1="1" x2="15" y1="2" y2="2" stroke="var(--viz-prev)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
              </svg>
              {labels.previous}
            </li>
          </ul>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-pressed={table}
        >
          {table ? <LineChart className="size-3.5" /> : <Table2 className="size-3.5" />}
          {table ? labels.showChart : labels.showTable}
        </button>
      </div>

      {table ? (
        <div className="max-h-65 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 bg-muted/80 text-muted-foreground backdrop-blur">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">{labels.date}</th>
                <th scope="col" className="px-3 py-2 text-end font-medium">{labels.current}</th>
                {hasPrev && (
                  <>
                    <th scope="col" className="px-3 py-2 text-start font-medium">{labels.previousDate}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{labels.previous}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((p, i) => (
                <tr key={p.t} className="border-t">
                  <td className="px-3 py-1.5">{fmt.bucket(p.t, granularity)}</td>
                  <td className="px-3 py-1.5 text-end font-medium">{formatValue(p.value)}</td>
                  {hasPrev && (
                    <>
                      <td className="px-3 py-1.5 text-muted-foreground">{fmt.bucket(previous![i].t, granularity)}</td>
                      <td className="px-3 py-1.5 text-end text-muted-foreground">{formatValue(previous![i].value)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrapRef}
          role="group"
          tabIndex={0}
          aria-label={label}
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((a) => a ?? (n ? n - 1 : null))}
          onBlur={() => setActive(null)}
          className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ height: svgH }}
        >
          <span id={hintId} className="sr-only">{labels.hint}</span>
          <span className="sr-only" aria-live="polite">{liveText}</span>
          {width > 0 && (
            <svg
              width={width}
              height={svgH}
              direction="ltr"
              className="block touch-pan-y select-none"
              aria-hidden="true"
              onPointerMove={(e) => setActive(indexFromPointer(e))}
              onPointerDown={(e) => setActive(indexFromPointer(e))}
              onPointerLeave={() => setActive(null)}
            >
              {/* Gridlines + y ticks (start side; mirrored in RTL). */}
              {geo.ticks.map((tv, k) => {
                const y = geo.Y(tv);
                const gx1 = rtl ? END_PAD : geo.x0;
                const gx2 = rtl ? width - geo.x0 : width - END_PAD;
                return (
                  <g key={tv}>
                    <line
                      x1={gx1}
                      x2={gx2}
                      y1={y}
                      y2={y}
                      stroke={k === 0 ? 'var(--viz-baseline)' : 'var(--viz-grid)'}
                      strokeWidth={1}
                      shapeRendering="crispEdges"
                    />
                    <text
                      x={rtl ? width - geo.x0 + 8 : geo.x0 - 8}
                      y={y}
                      dy="0.32em"
                      textAnchor={rtl ? 'start' : 'end'}
                      fontSize={TICK_FONT}
                      fill="var(--viz-muted)"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {geo.tickLabels[k]}
                    </text>
                  </g>
                );
              })}

              {/* X ticks. */}
              {xTicks.map((i) => {
                const x = geo.X(i);
                const first = i === 0;
                const last = i === n - 1 && n > 1;
                // Keep edge labels inside the plot for line charts.
                const anchor =
                  (!first && !last) || n === 1
                    ? 'middle'
                    : (first && !rtl) || (last && rtl)
                      ? 'start'
                      : 'end';
                return (
                  <text
                    key={i}
                    x={kind === 'bar' && (first || last) && n > 1 ? x + ((first !== rtl ? -1 : 1) * barW) / 2 : x}
                    y={geo.plotBottom + 17}
                    textAnchor={anchor}
                    fontSize={TICK_FONT}
                    fill="var(--viz-muted)"
                  >
                    {fmt.tick(points[i].t, granularity)}
                  </text>
                );
              })}

              {kind === 'area' ? (
                <>
                  <path d={areaPath()} fill="var(--viz-accent)" fillOpacity={0.1} />
                  {showPreviousLine && hasPrev && (
                    <path
                      d={linePath(previous!)}
                      fill="none"
                      stroke="var(--viz-prev)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={linePath(points)}
                    fill="none"
                    stroke="var(--viz-accent)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                points.map((p, i) => {
                  const y = geo.Y(p.value);
                  const h = geo.plotBottom - y;
                  return (
                    <path
                      key={p.t}
                      d={barPath(geo.X(i) - barW / 2, y, barW, h)}
                      fill={active === i ? 'var(--viz-accent-strong)' : 'var(--viz-accent)'}
                    />
                  );
                })
              )}

              {/* Crosshair + markers for the active point. */}
              {active != null && kind === 'area' && (
                <g>
                  <line
                    x1={geo.X(active)}
                    x2={geo.X(active)}
                    y1={geo.plotTop}
                    y2={geo.plotBottom}
                    stroke="var(--viz-baseline)"
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  {showPreviousLine && hasPrev && (
                    <circle
                      cx={geo.X(active)}
                      cy={geo.Y(previous![active].value)}
                      r={4}
                      fill="var(--viz-prev)"
                      stroke="var(--viz-surface)"
                      strokeWidth={2}
                    />
                  )}
                  <circle
                    cx={geo.X(active)}
                    cy={geo.Y(points[active].value)}
                    r={4.5}
                    fill="var(--viz-accent)"
                    stroke="var(--viz-surface)"
                    strokeWidth={2}
                  />
                </g>
              )}
            </svg>
          )}

          {live && width > 0 && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-42 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
              style={{ left: tooltipLeft }}
            >
              <p className="mb-1.5 font-medium text-foreground">{fmt.bucket(live.p.t, granularity)}</p>
              <div className="flex items-center gap-2">
                <svg width="12" height="4" aria-hidden="true" className="shrink-0">
                  <line x1="0" x2="12" y1="2" y2="2" stroke="var(--viz-accent)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="font-semibold tabular-nums text-foreground">{formatValue(live.p.value)}</span>
                <span className="ms-auto text-muted-foreground">{labels.current}</span>
              </div>
              {live.prev && (
                <div className="mt-1 flex items-center gap-2">
                  <svg width="12" height="4" aria-hidden="true" className="shrink-0">
                    <line x1="0" x2="12" y1="2" y2="2" stroke="var(--viz-prev)" strokeWidth="2" strokeDasharray="3 2" />
                  </svg>
                  <span className="font-medium tabular-nums text-foreground">{formatValue(live.prev.value)}</span>
                  <span className="ms-auto text-muted-foreground">{fmt.bucket(live.prev.t, granularity)}</span>
                </div>
              )}
              {live.change != null && live.change !== 0 && (
                <p
                  className={cn(
                    'mt-1.5 border-t pt-1.5 font-medium tabular-nums',
                    live.change > 0 ? 'text-emerald-700' : 'text-red-700',
                  )}
                >
                  {live.change > 0 ? '▲' : '▼'} {fmt.percent(Math.abs(live.change), 1)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
