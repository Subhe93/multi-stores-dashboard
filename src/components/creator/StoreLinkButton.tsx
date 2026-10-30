'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, Store as StoreIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorefrontUrl } from '@/lib/useStorefrontUrl';

export function StoreLinkButton() {
  const t = useTranslations('components');
  const { store, baseUrl } = useStorefrontUrl();

  if (!store?.slug || !baseUrl) return null;

  return (
    <a href={baseUrl} target="_blank" rel="noopener noreferrer" title={t('openStore', { name: store.name })}>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
        <StoreIcon className="size-3.5" />
        <span className="hidden sm:inline">{t('visitStore')}</span>
        <ExternalLink className="size-3 opacity-60" />
      </Button>
    </a>
  );
}
