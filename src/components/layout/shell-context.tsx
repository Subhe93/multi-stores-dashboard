'use client';

import { createContext, useContext } from 'react';
import type { ShellNav, ShellUser } from './nav-types';

export interface ShellContextValue {
  nav: ShellNav;
  user: ShellUser;
  brandTitle: string;
  onLogout: () => void;
  /** Mobile navigation drawer (below the lg breakpoint). */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside <AppShell>');
  return ctx;
}
