'use client';

import { useSyncExternalStore } from 'react';

function subscribe() {
  // Platform never changes during a session.
  return () => {};
}

function getSnapshot(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Whether the user is on an Apple platform (⌘ vs Ctrl). False during SSR. */
export function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
