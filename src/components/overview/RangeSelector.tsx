'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { OVERVIEW_RANGES, type OverviewRange } from './overview.api';

/** Segmented date-range presets; scrolls inside itself on narrow screens. */
export function RangeSelector({
  value,
  onChange,
  disabled,
}: {
  value: OverviewRange;
  onChange: (r: OverviewRange) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('creator.overview.range');
  return (
    <div className="max-w-full overflow-x-auto">
      <div
        role="group"
        aria-label={t('label')}
        className="inline-flex rounded-lg border bg-card p-0.5"
      >
        {OVERVIEW_RANGES.map((r) => {
          const selected = r === value;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(r)}
              title={t(`long.${r}`)}
              className={cn(
                'h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50',
                selected
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground',
              )}
            >
              {t(`short.${r}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
