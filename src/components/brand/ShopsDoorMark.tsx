import type { SVGProps } from 'react';

export type MarkVariant = 'color' | 'reversed' | 'mono' | 'mono-light';

// Fill set per variant: the frame + shop bodies, the awnings (teal / amber)
// and the small window/door details cut out of the bodies.
const PALETTE: Record<MarkVariant, { frame: string; teal: string; amber: string; detail: string }> = {
  color: { frame: '#142D36', teal: '#15B8A6', amber: '#F4B544', detail: '#F7F4EC' },
  reversed: { frame: '#F7F4EC', teal: '#15B8A6', amber: '#F4B544', detail: '#142D36' },
  mono: { frame: '#142D36', teal: '#142D36', amber: '#142D36', detail: '#F7F4EC' },
  'mono-light': { frame: '#FFFFFF', teal: '#FFFFFF', amber: '#FFFFFF', detail: '#142D36' },
};

interface Props extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  variant?: MarkVariant;
  /** Inline title for assistive tech; omit when a visible wordmark sits next to it. */
  title?: string;
}

/**
 * The ShopsDoor symbol: an open door frame with three storefronts behind it.
 * ViewBox 132 x 112; scales from 16 px favicon to hero size.
 */
export function ShopsDoorMark({ variant = 'color', title, ...rest }: Props) {
  const c = PALETTE[variant];
  return (
    <svg viewBox="0 0 132 112" xmlns="http://www.w3.org/2000/svg" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...rest}>
      {title ? <title>{title}</title> : null}
      {/* Door frame (open at the bottom) */}
      <path fill={c.frame} d="M10,104 V34 L58,16 V104 H49 V30 L19,41 V104 Z" />
      {/* Door leaf */}
      <path fill={c.teal} d="M21,47 L40,38 V97 H21 Z" />
      <circle cx="35.5" cy="70" r="1.9" fill={c.detail} />
      {/* Storefront 1 */}
      <path fill={c.teal} d="M64,55 V49 a5,5 0 0 1 5,-5 h14 a5,5 0 0 1 5,5 v6 z" />
      <rect x="64" y="58" width="24" height="46" fill={c.frame} />
      <rect x="68" y="64" width="7" height="7" rx="1.4" fill={c.detail} />
      <rect x="77" y="64" width="7" height="7" rx="1.4" fill={c.detail} />
      <rect x="72" y="86" width="8" height="18" rx="1" fill={c.detail} />
      {/* Storefront 2 */}
      <path fill={c.amber} d="M92,66 V61 a4.5,4.5 0 0 1 4.5,-4.5 h7 a4.5,4.5 0 0 1 4.5,4.5 v5 z" />
      <rect x="92" y="69" width="16" height="35" fill={c.frame} />
      <rect x="95.5" y="75" width="9" height="7" rx="1.4" fill={c.detail} />
      {/* Storefront 3 */}
      <path fill={c.teal} d="M112,76 V72 a4,4 0 0 1 4,-4 h4 a4,4 0 0 1 4,4 v4 z" />
      <rect x="112" y="79" width="12" height="25" fill={c.amber} />
      <rect x="115.5" y="84" width="5" height="5" rx="1" fill={c.detail} />
    </svg>
  );
}
