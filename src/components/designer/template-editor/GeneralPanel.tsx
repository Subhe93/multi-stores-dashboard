'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TemplateDetail } from '@/lib/designer/designer.api';
import { FieldError } from '@/components/designer/DesignerBits';
import { areaFieldId, type Issue } from './specIssues';
import type { SizeKey } from './useTemplateEditorState';

interface GeneralPanelProps {
  detail: TemplateDetail;
  name: string;
  sizeDrafts: Record<SizeKey, string>;
  printPx: { w: number; h: number };
  generalIssues: Issue[];
  issueText: (i: Issue) => string;
  primaryLocale: string;
  busy: boolean;
  onName: (value: string) => void;
  onSize: (key: SizeKey, value: string) => void;
  onStatus: (status: 'ARCHIVED' | 'PUBLISHED' | 'DRAFT') => void;
  onDelete: () => void;
  /** E9: in-app links ask before leaving with unsaved changes. */
  onLeave: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}

/** Name, trim size (E21: string drafts), linked products and archive / delete. */
export function GeneralPanel({
  detail, name, sizeDrafts, printPx, generalIssues, issueText, primaryLocale, busy, onName, onSize, onStatus, onDelete, onLeave,
}: GeneralPanelProps) {
  const t = useTranslations('creator.designer.editor');
  const tr = useTranslations('creator.designer.editor.rules');
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <Label htmlFor={areaFieldId('general', 'name')} className="text-xs">
            {t('name')}
          </Label>
          <Input
            id={areaFieldId('general', 'name')}
            className="h-9"
            maxLength={160}
            value={name}
            aria-invalid={generalIssues.some((i) => i.rule === 'name_required') || undefined}
            onChange={(e) => onName(e.target.value)}
          />
          <FieldError text={generalIssues.find((i) => i.rule === 'name_required') ? tr('name_required') : null} />
        </div>
        <div className="space-y-2 rounded-md border bg-zinc-50/60 p-3 text-xs">
          <p className="font-medium">{t('trimSize')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['width', 'height', 'bleed_mm'] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={areaFieldId('general', k)} className="text-[11px] font-normal text-muted-foreground">
                  {t(`size.${k}`)}
                </Label>
                <Input
                  id={areaFieldId('general', k)}
                  type="number"
                  dir="ltr"
                  min={k === 'bleed_mm' ? 0 : 1}
                  className="h-8 text-xs tabular-nums"
                  value={sizeDrafts[k]}
                  onChange={(e) => onSize(k, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">{t('printOutput', { width: printPx.w, height: printPx.h })}</p>
          {generalIssues
            .filter((i) => i.rule !== 'name_required')
            .map((i, n) => (
              <FieldError key={n} text={`${i.path ? `${i.path}: ` : ''}${issueText(i)}`} />
            ))}
        </div>

        <div id={areaFieldId('general', 'products')} className="scroll-mt-4 space-y-2">
          <p className="text-xs font-medium">{t('productsTitle', { count: detail.products.length })}</p>
          {detail.products.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('productsEmpty')}</p>
          ) : (
            <ul className="divide-y rounded-md border text-xs">
              {detail.products.map((p) => {
                const href = `/creator/products/own/${p.product_id}?tab=designer`;
                return (
                  <li key={p.product_id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Link href={href} onClick={(e) => onLeave(e, href)} className="min-w-0 truncate hover:underline">
                      {p.titles[primaryLocale] || Object.values(p.titles)[0] || p.product_id.slice(0, 8)}
                    </Link>
                    <Badge variant="outline" className={p.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                      {p.enabled ? t('linkOn') : t('linkOff')}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          {detail.status === 'ARCHIVED' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onStatus(detail.current_version_id ? 'PUBLISHED' : 'DRAFT')}
            >
              <ArchiveRestore /> {t('unarchive')}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onStatus('ARCHIVED')}>
              <Archive /> {t('archive')}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={onDelete}>
            <Trash2 /> {t('delete')}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{t('archiveHint')}</p>
      </CardContent>
    </Card>
  );
}
