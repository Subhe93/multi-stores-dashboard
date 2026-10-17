'use client';

import { useTranslations } from 'next-intl';
import { ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TemplateSpecV1 } from '@/lib/designer/design-renderer';
import type { DesignerAssetView } from '@/lib/designer/designer.api';
import { FieldError, stretchDpi } from '@/components/designer/DesignerBits';
import { areaFieldId } from './specIssues';

type BgKey = 'web' | 'print';

interface BackgroundPanelProps {
  spec: TemplateSpecV1;
  assetById: Map<string, DesignerAssetView>;
  assetUrls: Record<string, string>;
  printPx: { w: number; h: number };
  /** field → message. */
  bgIssues: Record<string, string>;
  onUpdateSpec: (fn: (s: TemplateSpecV1) => TemplateSpecV1) => void;
  onPick: (key: BgKey) => void;
}

/** Background colour, fit and the web / print background images. */
export function BackgroundPanel({ spec, assetById, assetUrls, printPx, bgIssues, onUpdateSpec, onPick }: BackgroundPanelProps) {
  const t = useTranslations('creator.designer.editor');
  const bg = spec.surfaces[0].background;

  const bgAssetBlock = (key: BgKey) => {
    const ref = bg[key];
    const a = ref ? assetById.get(ref.asset_id) : undefined;
    const url = ref ? assetUrls[ref.asset_id] : undefined;
    const target = key === 'print' ? printPx : { w: Math.round(spec.width * 2), h: Math.round(spec.height * 2) };
    const w = a?.width ?? ref?.width ?? 0;
    const h = a?.height ?? ref?.height ?? 0;
    const dpi = ref ? stretchDpi(w, h, spec) : 0;
    const low = !!ref && (w < target.w * 0.8 || h < target.h * 0.8);
    return (
      <div className="space-y-2 rounded-md border p-3" id={areaFieldId('bg', key)} tabIndex={-1}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium">{t(key === 'web' ? 'bgWeb' : 'bgPrint')}</p>
            <p className="text-[11px] text-muted-foreground">{t(key === 'web' ? 'bgWebHint' : 'bgPrintHint', { width: target.w, height: target.h })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-24 w-[4.3rem] shrink-0 items-center justify-center overflow-hidden rounded border bg-zinc-50">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- API-hosted file
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-[11px]">
            {ref ? (
              <>
                <p className="tabular-nums" dir="ltr">
                  {w}×{h} px
                </p>
                <p className={low ? 'text-amber-700' : 'text-muted-foreground'}>{t('dpiLine', { dpi })}</p>
                {low && <p className="text-amber-700">{t('bgLowRes', { width: target.w, height: target.h })}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">{key === 'print' ? t('bgPrintNone') : t('bgWebNone')}</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onPick(key)}>
                {ref ? t('replace') : t('choose')}
              </Button>
              {ref && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-600"
                  onClick={() =>
                    onUpdateSpec((s) => {
                      delete s.surfaces[0].background[key];
                      return s;
                    })
                  }
                >
                  {t('remove')}
                </Button>
              )}
            </div>
          </div>
        </div>
        <FieldError text={bgIssues[key]} />
      </div>
    );
  };

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={areaFieldId('bg', 'color')} className="text-xs">
              {t('bgColor')}
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t('bgColor')}
                className="h-8 w-10 cursor-pointer rounded border bg-white p-0.5"
                value={/^#[0-9a-f]{6}$/i.test(bg.color) ? bg.color : '#ffffff'}
                onChange={(e) =>
                  onUpdateSpec((s) => {
                    s.surfaces[0].background.color = e.target.value;
                    return s;
                  })
                }
              />
              <Input
                id={areaFieldId('bg', 'color')}
                dir="ltr"
                className="h-8 font-mono text-xs"
                value={bg.color}
                onChange={(e) =>
                  onUpdateSpec((s) => {
                    s.surfaces[0].background.color = e.target.value;
                    return s;
                  })
                }
              />
            </div>
            <FieldError text={bgIssues.color} />
          </div>
          <div className="space-y-1">
            <span className="text-xs">{t('bgFit')}</span>
            <div className="inline-flex rounded-md border bg-zinc-50 p-0.5" role="radiogroup" aria-label={t('bgFit')}>
              {(['stretch', 'cover'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={bg.fit === f}
                  onClick={() =>
                    onUpdateSpec((s) => {
                      s.surfaces[0].background.fit = f;
                      return s;
                    })
                  }
                  className={`rounded px-2.5 py-1 text-xs ${bg.fit === f ? 'bg-white font-medium shadow-sm' : 'text-muted-foreground'}`}
                >
                  {t(`fit.${f}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {bgAssetBlock('web')}
        {bgAssetBlock('print')}
        <p className="text-[11px] text-muted-foreground">{t('bgHint')}</p>
      </CardContent>
    </Card>
  );
}
