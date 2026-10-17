'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { TemplateDetail } from '@/lib/designer/designer.api';

interface VersionsPanelProps {
  versions: TemplateDetail['versions'];
  busy: boolean;
  loadingVersion: string | null;
  formatDate: (iso: string) => string;
  onLoad: (versionId: string) => void;
  onPublish: (versionId: string) => void;
}

/** Version list of the template: load one into the editor, or make it live. */
export function VersionsPanel({ versions, busy, loadingVersion, formatDate, onLoad, onPublish }: VersionsPanelProps) {
  const t = useTranslations('creator.designer.editor');
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-2 pt-4">
        <p className="text-[11px] text-muted-foreground">{t('versionsHint')}</p>
        <ul className="divide-y rounded-md border">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
              <span className="font-medium">{t('versionLabel', { version: v.version })}</span>
              {v.current && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">{t('live')}</Badge>}
              <span className="text-muted-foreground">{formatDate(v.created_at)}</span>
              <span className="text-muted-foreground">{t('designCount', { count: v.design_count })}</span>
              <span className="ms-auto flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" disabled={loadingVersion === v.id} onClick={() => onLoad(v.id)}>
                  {loadingVersion === v.id ? <Loader2 className="animate-spin" /> : null}
                  {t('loadVersion')}
                </Button>
                {!v.current && (
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => onPublish(v.id)}>
                    {t('makeLive')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
