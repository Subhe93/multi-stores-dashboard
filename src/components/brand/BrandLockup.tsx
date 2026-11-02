import { cn } from '@/lib/utils';
import { ShopsDoorMark, type MarkVariant } from './ShopsDoorMark';

export const DEFAULT_BRAND_NAME = 'ShopsDoor';

/** Rounded tile that holds the mark: navy with the reversed mark, or ivory with the colour mark. */
export function BrandTile({
  tone = 'navy',
  className,
  markClassName,
}: {
  tone?: 'navy' | 'ivory';
  className?: string;
  markClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
        tone === 'navy'
          ? 'bg-[#142D36] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_16px_-6px_rgba(20,45,54,0.6)]'
          : 'bg-[#F7F4EC] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_-6px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <ShopsDoorMark variant={tone === 'navy' ? 'reversed' : 'color'} className={cn('h-[62%] w-auto', markClassName)} />
    </span>
  );
}

interface LockupProps {
  /** Admin-configured platform name; falls back to the ShopsDoor wordmark. */
  platformName?: string;
  /** Tile tone: `navy` on light surfaces, `ivory` on dark ones. */
  tone?: 'navy' | 'ivory';
  /** Variant used when the mark is rendered bare (no tile). */
  markVariant?: MarkVariant;
  /** Wrap the mark in a tile (default) or render it bare. */
  tile?: boolean;
  className?: string;
  tileClassName?: string;
  textClassName?: string;
}

/**
 * Horizontal lockup: mark + platform name set in the brand font (Manrope).
 * The name text follows the admin-configured platform name so renaming still works.
 */
export function BrandLockup({
  platformName,
  tone = 'navy',
  markVariant,
  tile = true,
  className,
  tileClassName,
  textClassName,
}: LockupProps) {
  const name = platformName?.trim() || DEFAULT_BRAND_NAME;
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      {tile ? (
        <BrandTile tone={tone} className={tileClassName} />
      ) : (
        <ShopsDoorMark variant={markVariant ?? (tone === 'navy' ? 'color' : 'reversed')} className={cn('h-8 w-auto shrink-0', tileClassName)} />
      )}
      <span className={cn('font-brand text-[17px] font-extrabold tracking-[-0.03em]', textClassName)}>
        <bdi>{name}</bdi>
      </span>
    </span>
  );
}
