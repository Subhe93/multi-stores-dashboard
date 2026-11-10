'use client';

import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DeletedOrderBadgeProps {
  /** `deleted_at` of the order; nothing is rendered while it is null. */
  deletedAt?: string | null;
  className?: string;
}

/** Grey "Deleted <date>" pill shown on soft-deleted order rows and headers. */
export function DeletedOrderBadge({ deletedAt, className }: DeletedOrderBadgeProps) {
  const t = useTranslations('orders.trash');
  if (!deletedAt) return null;
  const date = new Date(deletedAt);
  const label = Number.isNaN(date.getTime()) ? deletedAt : date.toLocaleDateString();
  return (
    <Badge
      variant="outline"
      title={t('badgeTitle', { date: Number.isNaN(date.getTime()) ? deletedAt : date.toLocaleString() })}
      className={cn('gap-1 text-[11px] font-semibold bg-zinc-100 text-zinc-600 border-zinc-300', className)}
    >
      <Trash2 aria-hidden />
      {t('badge', { date: label })}
    </Badge>
  );
}
