'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { storeStatusTone, type StoreStatus } from '@/lib/storeStatus';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<ReturnType<typeof storeStatusTone>, string> = {
  neutral: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

/** Store lifecycle badge; API builds without `status` fall back to is_active. */
export function StoreStatusBadge({
  status,
  isActive,
  className,
}: {
  status?: StoreStatus | string | null;
  isActive?: boolean;
  className?: string;
}) {
  const t = useTranslations('creator.storeStatus');
  const effective = status ?? (isActive ? 'LIVE' : 'PAUSED');
  const label = t.has(`labels.${effective}`) ? t(`labels.${effective}`) : effective;
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', TONE_CLASS[storeStatusTone(effective)], className)}>
      {label}
    </Badge>
  );
}
