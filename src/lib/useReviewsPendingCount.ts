'use client';

import { useEffect, useState } from 'react';
import { getPendingReviewCount } from '@/lib/reviews.api';

// Fired after every moderation action so the sidebar badge follows at once.
const CHANGE_EVENT = 'ms-reviews-changed';

/** Tells every mounted `useReviewsPendingCount()` to ask again. */
export function notifyReviewsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Number of reviews waiting for moderation (sidebar badge). Asked on mount,
 * when the window regains focus and after each moderation action. `active`
 * false (app neither enabled nor available) makes no request and reports 0;
 * a failed request keeps the last known value.
 */
export function useReviewsPendingCount(token: string | null | undefined, active: boolean): number {
  // Keyed by token so another account in the same tab never shows this count.
  const [state, setState] = useState<{ token: string; count: number } | null>(null);

  useEffect(() => {
    if (!token || !active) return;
    let cancelled = false;
    const load = () => {
      getPendingReviewCount(token)
        .then((count) => {
          if (!cancelled) setState({ token, count });
        })
        .catch(() => {
          // Best effort: the badge is a hint, never an error surface.
        });
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener(CHANGE_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
      window.removeEventListener(CHANGE_EVENT, load);
    };
  }, [token, active]);

  if (!token || !active || !state || state.token !== token) return 0;
  return state.count;
}
