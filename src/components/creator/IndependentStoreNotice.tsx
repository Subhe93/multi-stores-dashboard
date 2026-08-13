'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Friendly empty state shown when an independent-store creator opens a page
 * that only applies to marketplace stores (provider catalog, imports).
 */
export function IndependentStoreNotice({ description }: { description: string }) {
  const t = useTranslations('creator');

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-zinc-100">
          <Store className="size-6 text-zinc-500" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t('independent.notAvailableTitle')}</p>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
        </div>
        <Link href="/creator/products/own/new">
          <Button size="sm">{t('independent.goToAddProduct')}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
