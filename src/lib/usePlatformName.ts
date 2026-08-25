'use client';

// Platform name inherited from the admin-configured PlatformConfig
// (Admin → Settings → Platform Info) via the public storefront endpoint —
// the single source across the dashboard, no hardcoded brand strings.

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const DEFAULT_PLATFORM_NAME = 'Multi Stores';

// Module-level cache so the shell doesn't refetch on every navigation.
let cached: string | null = null;

export function usePlatformName(): string {
  const [name, setName] = useState(cached || DEFAULT_PLATFORM_NAME);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    fetch(`${API_BASE}/storefront/platform-meta`)
      .then((r) => r.json())
      .then((j) => {
        const n = j?.data?.platform_name || j?.platform_name;
        if (n && !cancelled) {
          cached = n;
          setName(n);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}
