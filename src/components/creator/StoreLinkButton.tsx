'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Store as StoreIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

function storeUrl(slug: string): string {
  const u = new URL(WEB_ORIGIN);
  return `${u.protocol}//${slug}.${u.host}`;
}

interface MyStore {
  slug: string;
  name: string;
  is_active: boolean;
  custom_domain?: string | null;
}

export function StoreLinkButton() {
  const { token } = useAuth();
  const t = useTranslations('components');
  const [store, setStore] = useState<MyStore | null>(null);

  useEffect(() => {
    if (!token) return;
    api<MyStore>('/stores/my/store', { token })
      .then(setStore)
      .catch(() => setStore(null));
  }, [token]);

  if (!store?.slug) return null;

  const href = store.custom_domain
    ? `https://${store.custom_domain}`
    : storeUrl(store.slug);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={t('openStore', { name: store.name })}>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
        <StoreIcon className="size-3.5" />
        <span className="hidden sm:inline">{t('visitStore')}</span>
        <ExternalLink className="size-3 opacity-60" />
      </Button>
    </a>
  );
}
