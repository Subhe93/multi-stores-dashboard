'use client';

import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Read-only star row of a review. Always left to right (stars are not
 * mirrored in RTL) and announced as one image with a text label.
 */
export function ReviewStars({ rating, className }: { rating: number; className?: string }) {
  const t = useTranslations('creator.reviews');
  return (
    <span
      dir="ltr"
      role="img"
      aria-label={t('starsLabel', { rating })}
      title={t('starsLabel', { rating })}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn('size-3.5', n <= rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-zinc-300')}
        />
      ))}
    </span>
  );
}
