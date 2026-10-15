'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Active tab of a tabbed page, mirrored in `?tab=` so links (Apps catalog,
 * order cards, cross-page links) can land on a specific tab and a reload
 * keeps it. Unknown values are ignored.
 */
export function useUrlTab<T extends string>(tabs: readonly T[], fallback: T): [T, (value: string) => void] {
  const [tab, setTab] = useState<T>(fallback);

  // Read once on mount: the page is a client component and the URL is only
  // available in the browser.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (wanted && (tabs as readonly string[]).includes(wanted)) setTab(wanted as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tab list is a module constant
  }, []);

  const changeTab = useCallback(
    (value: string) => {
      if (!(tabs as readonly string[]).includes(value)) return;
      setTab(value as T);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', value);
      window.history.replaceState(null, '', url.toString());
    },
    [tabs],
  );

  return [tab, changeTab];
}
