'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

interface ListEmptyStateProps {
  icon: ReactNode;
  title: string;
  hint: string;
  /** One primary call to action (internal route). */
  cta?: { label: string; href: string };
  /** Secondary slot rendered under the CTA (e.g. an outline button). */
  children?: ReactNode;
}

/** Zero-rows state of a list page: title, one line, one primary CTA. */
export function ListEmptyState({ icon, title, hint, cta, children }: ListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 [&_svg]:size-6" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
      {cta && (
        <Link href={cta.href} className={buttonVariants({ size: 'sm', className: 'mt-1' })}>
          {cta.label}
        </Link>
      )}
      {children}
    </div>
  );
}
