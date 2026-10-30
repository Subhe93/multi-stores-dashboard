'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewInStoreButtonProps {
  /** Live storefront URL; null renders the disabled state. */
  href: string | null;
  /** Why the button is disabled (shown as the tooltip). */
  disabledHint?: string;
  /** `icon`: compact table-row button; `label`: header button with text. */
  appearance?: 'icon' | 'label';
  className?: string;
}

/** Opens a product's live storefront page in a new tab. */
export function ViewInStoreButton({ href, disabledHint, appearance = 'label', className }: ViewInStoreButtonProps) {
  const t = useTranslations('product');
  const label = t('viewInStore');
  const isIcon = appearance === 'icon';
  const classes = cn(
    buttonVariants({ variant: isIcon ? 'ghost' : 'outline', size: isIcon ? 'icon-sm' : 'sm' }),
    isIcon ? 'h-7 w-7' : 'gap-1.5',
    className,
  );
  const content = isIcon ? (
    <ExternalLink className="size-3.5" />
  ) : (
    <>
      <ExternalLink className="size-3.5" />
      {label}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        aria-label={label}
        title={t('viewInStoreHint')}
      >
        {content}
      </a>
    );
  }

  // A disabled button gets no pointer events, so the tooltip lives on a
  // wrapper; data-row-click-ignore keeps a table row from opening on it.
  return (
    <span className="inline-flex cursor-not-allowed" title={disabledHint} data-row-click-ignore>
      <Button
        type="button"
        variant={isIcon ? 'ghost' : 'outline'}
        size={isIcon ? 'icon-sm' : 'sm'}
        className={cn(isIcon ? 'h-7 w-7' : 'gap-1.5', className)}
        disabled
        aria-label={disabledHint ? `${label} — ${disabledHint}` : label}
      >
        {content}
      </Button>
    </span>
  );
}
