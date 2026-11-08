'use client';

import { useTranslations } from 'next-intl';
import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Orders carry `is_test` (Stripe test key / pre-live owner checkout); missing means false. */
export function isTestOrder(order: { is_test?: boolean | null } | null | undefined): boolean {
  return order?.is_test === true;
}

interface TestOrderBadgeProps {
  isTest?: boolean | null;
  className?: string;
}

/** Amber "Test" pill shown on order rows and the order header. */
export function TestOrderBadge({ isTest, className }: TestOrderBadgeProps) {
  const t = useTranslations('testOrder');
  if (isTest !== true) return null;
  return (
    <Badge
      variant="outline"
      title={t('badgeTitle')}
      className={cn('gap-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border-amber-300', className)}
    >
      <FlaskConical aria-hidden />
      {t('badge')}
    </Badge>
  );
}
