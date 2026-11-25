'use client';

import { useTranslations } from 'next-intl';
import { reviewErrorKey } from '@/lib/reviews';

/**
 * Friendly message of a failed reviews request: `errors.<CODE>` when the
 * code is translated, the generic message otherwise. Raw API or validator
 * text is never shown.
 */
export function useReviewError() {
  const t = useTranslations('errors');
  return (err: unknown): string => t(reviewErrorKey(err, (code) => t.has(code)));
}
