// Per-breakpoint value helpers shared by the Style panel (section `_style`)
// and the imageSize field. Mirrors the `Responsive<T>` shape of
// multi-stores-web/src/themes/sectionStyle.ts: a bare value is the desktop
// value, or an object `{ desktop, tablet, mobile }`; narrower breakpoints
// inherit from the wider one when empty (mobile -> tablet -> desktop).
// Pure module (no React) so node tests can import it.

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

/** Value at exactly one breakpoint (no inheritance). */
export function pickResponsive<T>(field: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (field === undefined) return undefined;
  if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
    return (field as Partial<Record<Breakpoint, T>>)[bp];
  }
  return bp === 'desktop' ? (field as T) : undefined;
}

// Cascade: mobile inherits from tablet inherits from desktop. Use when the
// panel needs to show what the user *will see* at the active breakpoint.
export function resolveResponsive<T>(field: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (bp === 'mobile') {
    return pickResponsive(field, 'mobile')
      ?? pickResponsive(field, 'tablet')
      ?? pickResponsive(field, 'desktop');
  }
  if (bp === 'tablet') {
    return pickResponsive(field, 'tablet') ?? pickResponsive(field, 'desktop');
  }
  return pickResponsive(field, 'desktop');
}

export function setResponsive<T>(
  field: Responsive<T> | undefined,
  bp: Breakpoint,
  val: T | undefined,
): Responsive<T> | undefined {
  let obj: Partial<Record<Breakpoint, T>>;
  if (field === undefined) {
    obj = {};
  } else if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
    obj = { ...(field as Partial<Record<Breakpoint, T>>) };
  } else {
    obj = { desktop: field as T };
  }
  if (val === undefined) delete obj[bp];
  else obj[bp] = val;
  const keys = Object.keys(obj);
  if (keys.length === 0) return undefined;
  // Collapse to a bare value when only desktop is set — matches the legacy
  // shape so older readers stay happy.
  if (keys.length === 1 && obj.desktop !== undefined) return obj.desktop;
  return obj;
}

export function hasOwnResponsive<T>(field: Responsive<T> | undefined, bp: Breakpoint): boolean {
  return pickResponsive(field, bp) !== undefined;
}

export function inheritedSource<T>(field: Responsive<T> | undefined, bp: Breakpoint): Breakpoint | null {
  if (hasOwnResponsive(field, bp)) return null;
  if (bp === 'mobile' && hasOwnResponsive(field, 'tablet')) return 'tablet';
  if ((bp === 'mobile' || bp === 'tablet') && hasOwnResponsive(field, 'desktop')) return 'desktop';
  return null;
}
