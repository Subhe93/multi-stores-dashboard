'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { SETUP_DISMISS_KEY } from '@/lib/onboardingSurvey';

const subscribeNoop = () => () => {};
const readDismissed = () => {
  try {
    return window.localStorage.getItem(SETUP_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/** Settings row: "Show setup guide" reopens the dismissed home checklist. */
export function SetupGuideToggle() {
  const t = useTranslations('creator.overview.setup');
  const dismissed = useSyncExternalStore(subscribeNoop, readDismissed, () => false);
  const [reopened, setReopened] = useState(false);
  if (!dismissed || reopened) return null;

  const reopen = () => {
    try {
      window.localStorage.removeItem(SETUP_DISMISS_KEY);
    } catch {
      // Storage unavailable: nothing was hidden persistently either.
    }
    setReopened(true);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <ListChecks className="size-3.5" aria-hidden="true" />
        {t('hiddenHint')}
      </span>
      <Link href="/creator" onClick={reopen} className="font-medium underline underline-offset-2">
        {t('show')}
      </Link>
    </div>
  );
}
