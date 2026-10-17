'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { progressTone } from './production.api';

const TONE_BAR: Record<string, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  none: 'bg-zinc-300',
};

interface ProductionProgressBarProps {
  done: number;
  total: number;
  /** Show the "Ready" badge at 100 %. */
  showReady?: boolean;
  className?: string;
  /** Thicker bar for the workspace header. */
  size?: 'sm' | 'md';
}

/**
 * Checklist progress: bar (<50 % red, ≥50 % amber, 100 % green) and done/total.
 * Renders a dash when the order has no checks.
 */
export function ProductionProgressBar({ done, total, showReady = true, className, size = 'sm' }: ProductionProgressBarProps) {
  const t = useTranslations('creator.production');
  if (total <= 0) return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  const pct = Math.min(100, Math.round((done / total) * 100));
  const tone = progressTone(done, total);
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div
        className={cn('relative flex-1 overflow-hidden rounded-full bg-muted', size === 'md' ? 'h-2.5' : 'h-1.5', 'min-w-16')}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={t('progressLabel', { done, total })}
      >
        <div className={cn('absolute inset-y-0 start-0 rounded-full transition-all', TONE_BAR[tone])} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground" dir="ltr">
        {done}/{total}
      </span>
      {showReady && tone === 'green' && (
        <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700">
          {t('readyBadge')}
        </Badge>
      )}
    </div>
  );
}
