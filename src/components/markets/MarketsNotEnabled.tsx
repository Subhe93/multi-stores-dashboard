'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Guard content for the markets pages while the app is not enabled. */
export function MarketsNotEnabled() {
  const t = useTranslations('creator.markets');
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Globe className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('notEnabled')}</p>
        <Link href="/creator/apps" className="text-sm font-medium text-primary underline underline-offset-2">
          {t('notEnabledLink')}
        </Link>
      </CardContent>
    </Card>
  );
}
