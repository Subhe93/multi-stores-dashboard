'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Active tab of a tabbed page, mirrored in `?tab=` so links (Apps catalog,
 * order cards, cross-page links) can land on a specific tab and a reload
 * keeps it. Unknown values are ignored.
 *
 * E11: the tab is derived from `useSearchParams()` on the very first render,
 * so a deep link never flashes the fallback tab nor mounts its panel (no
 * stray request). The dashboard renders dynamically (locale cookie in the
 * root layout), so callers need no Suspense boundary; the hook also works
 * inside one. Tab changes keep using `replaceState` (no history entry): the
 * local choice is remembered against the URL it was made on, so it applies
 * whether or not the router re-reads the params, and any later URL change
 * (back / forward, in-app links) takes over again.
 */
export function useUrlTab<T extends string>(tabs: readonly T[], fallback: T): [T, (value: string) => void] {
  const searchParams = useSearchParams();
  const wanted = searchParams.get('tab');
  const fromUrl = wanted && (tabs as readonly string[]).includes(wanted) ? (wanted as T) : null;
  // The last `changeTab` choice together with the URL value it replaced.
  const [choice, setChoice] = useState<{ url: T | null; tab: T } | null>(null);
  const tab = choice && choice.url === fromUrl ? choice.tab : (fromUrl ?? fallback);

  const changeTab = useCallback(
    (value: string) => {
      if (!(tabs as readonly string[]).includes(value)) return;
      setChoice({ url: fromUrl, tab: value as T });
      const url = new URL(window.location.href);
      url.searchParams.set('tab', value);
      window.history.replaceState(null, '', url.toString());
    },
    [tabs, fromUrl],
  );

  return [tab, changeTab];
}
