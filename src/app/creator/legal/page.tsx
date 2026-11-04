'use client';

import { useTranslations } from 'next-intl';
import { LegalPagesCard } from '@/components/creator/LegalPagesCard';

/** Online store → Legal pages: the store's /legal/* pages (plans/store-legal-pages). */
export default function CreatorLegalPages() {
  const tn = useTranslations('nav');
  const t = useTranslations('creator.storePages.legal');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{tn('legalPages')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>
      <LegalPagesCard />
    </div>
  );
}
