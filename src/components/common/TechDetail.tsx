'use client';

// "Show technical details" switch (E6): technical identifiers (`W_*` codes,
// `external_ref`, meta prefixes, add-on keys, raw field names) are hidden by
// default and rendered on demand; the choice is kept per browser. Callers keep
// the id reachable through `title=` on the readable element next to it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TECH_DETAILS_KEY = 'importer:tech-details';

const TechDetailsContext = createContext<{ shown: boolean; toggle: () => void }>({ shown: false, toggle: () => undefined });

/** Holds the switch for a page (or a dialog) and persists it in localStorage. */
export function TechDetailsProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let stored = false;
    try {
      stored = window.localStorage.getItem(TECH_DETAILS_KEY) === '1';
    } catch {
      // Storage unavailable: default stays hidden.
    }
    // Async like a subscription, so the hydrated markup never differs from the server's.
    if (stored) void Promise.resolve().then(() => !cancelled && setShown(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const toggle = useCallback(() => {
    setShown((v) => {
      try {
        window.localStorage.setItem(TECH_DETAILS_KEY, v ? '0' : '1');
      } catch {
        // Best-effort persistence.
      }
      return !v;
    });
  }, []);
  const value = useMemo(() => ({ shown, toggle }), [shown, toggle]);
  return <TechDetailsContext.Provider value={value}>{children}</TechDetailsContext.Provider>;
}

export function useTechDetails(): boolean {
  return useContext(TechDetailsContext).shown;
}

/** Toggle button for a page header / dialog toolbar (`creator.importer.techDetails.*`). */
export function TechDetailsToggle({ className }: { className?: string }) {
  const t = useTranslations('creator.importer.techDetails');
  const { shown, toggle } = useContext(TechDetailsContext);
  return (
    <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-pressed={shown} className={className}>
      <Code2 />
      {shown ? t('hide') : t('show')}
    </Button>
  );
}

/**
 * A technical identifier: rendered in monospace only while technical details
 * are shown; otherwise nothing.
 */
export function TechDetail({ value, className, block }: { value: string | null | undefined; className?: string; block?: boolean }) {
  const shown = useTechDetails();
  if (!shown || !value) return null;
  return (
    <span className={`${block ? 'block' : ''} font-mono text-[11px] text-muted-foreground ${className ?? ''}`} dir="ltr">
      {value}
    </span>
  );
}
