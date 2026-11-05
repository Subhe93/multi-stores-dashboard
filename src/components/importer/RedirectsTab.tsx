'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Info } from 'lucide-react';
import { RedirectsManager } from '@/components/redirects/RedirectsManager';

/**
 * Importer "Redirects" tab: the same manager as Online store -> Redirects
 * (imported rows land there), plus a pointer to its permanent home.
 */
export function RedirectsTab({ token, readOnly = false }: { token: string; readOnly?: boolean }) {
  const t = useTranslations('creator.redirects');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t('importerNote')}
        </span>
        <Link href="/creator/redirects" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          {t('importerNoteLink')}
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>
      <RedirectsManager token={token} readOnly={readOnly} />
    </div>
  );
}
