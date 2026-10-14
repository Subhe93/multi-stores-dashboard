'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Boolean that switches itself off after `ms` ("Saved" / "Copied" feedback).
 * The timer is cleared on unmount so a late tick never updates a gone component.
 */
export function useTransientFlag(ms = 3000): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  return [on, trigger];
}
