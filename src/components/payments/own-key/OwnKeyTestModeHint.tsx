'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Settings anchor of the "Your Stripe account" card (OwnStripeKeyCard). */
export const OWN_KEY_SETTINGS_HREF = '/creator/settings?tab=payments#own-stripe-key';

/**
 * Shown while the store's own Stripe key is a TEST key (go-live checklist
 * `payments_hint: 'OWN_KEY_TEST_MODE'`): the public checkout offers no card
 * payments until a live key is connected.
 */
export function OwnKeyTestModeHint({ className }: { className?: string }) {
  const t = useTranslations('ownStripeKey');
  return (
    <p className={cn('flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900', className)} role="note">
      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {t('testModeHint')}{' '}
        <Link href={OWN_KEY_SETTINGS_HREF} className="font-medium underline underline-offset-2 hover:text-amber-950">
          {t('testModeHintCta')}
        </Link>
      </span>
    </p>
  );
}
