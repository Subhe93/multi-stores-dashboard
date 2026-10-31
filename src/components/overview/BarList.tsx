import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BarListItem {
  key: string;
  label: ReactNode;
  /** Bar length driver. */
  value: number;
  /** Text shown at the bar end (already formatted). */
  display: string;
  /** Secondary text under/after the value (e.g. order count). */
  secondary?: string;
  /** Bar fill; defaults to the chart accent (one hue for ranked bars). */
  color?: string;
  href?: string;
}

/**
 * Ranked horizontal bars: label + value on one line, a thin bar below.
 * Values are always printed, so no tooltip is needed to read them.
 */
export function BarList({ items, className }: { items: BarListItem[]; className?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => {
        const pct = Math.max(0, (item.value / max) * 100);
        return (
          <li key={item.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span dir="auto" className="min-w-0 truncate text-start text-foreground">{item.label}</span>
              <bdi className="shrink-0 font-medium tabular-nums text-foreground">{item.display}</bdi>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--viz-track)" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct > 0 ? Math.max(pct, 1.5) : 0}%`,
                    background: item.color ?? 'var(--viz-accent)',
                  }}
                />
              </div>
              {item.secondary && (
                <bdi className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.secondary}</bdi>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
