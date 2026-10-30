import type { ReactNode } from 'react';

/** One sidebar entry. `children` render as an indented sub-list (Shopify style). */
export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  /** Active only on an exact path match (e.g. the dashboard home). */
  exact?: boolean;
  children?: NavItem[];
}

/** A block of entries; groups without a title render as the main list. */
export interface NavGroup {
  id: string;
  title?: string;
  items: NavItem[];
}

/** Everything the shell needs to draw the navigation. */
export interface ShellNav {
  groups: NavGroup[];
  /** Entries pinned to the bottom of the sidebar (e.g. Settings). */
  footerItems?: NavItem[];
}

export interface ShellUser {
  label: string;
  email?: string;
  /** Stable role key: 'ADMIN' | 'PROVIDER' | 'CREATOR'. */
  role: 'ADMIN' | 'PROVIDER' | 'CREATOR';
  /** Translated role / panel name, e.g. "Creator dashboard". */
  roleLabel?: string;
}
