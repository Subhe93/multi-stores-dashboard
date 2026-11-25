'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ReviewStatus } from '@/lib/reviews';

const STYLES: Record<ReviewStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

/** Moderation status pill (list rows, dialog, order review links). */
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const t = useTranslations('creator.reviews.status');
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${STYLES[status]}`}>
      {t(status)}
    </Badge>
  );
}
