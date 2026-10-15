'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Guard content of a store-app page opened while the app is switched off. */
export function AppTurnedOff({ icon: Icon }: { icon: LucideIcon }) {
  const t = useTranslations('creator.apps.turnedOff');
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Icon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t('title')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t('body')}</p>
        <Link href="/creator/apps" className="mt-2">
          <Button size="sm" variant="outline">{t('link')}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
