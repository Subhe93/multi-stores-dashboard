'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  isPresetKey,
  listPresets,
  mergePresetSummaries,
  PRESET_CATALOG,
  type PresetFieldPreview,
  type PresetSummary,
} from '@/lib/personalization';
import { ApplyPresetDialog } from './ApplyPresetDialog';

interface PresetsPanelProps {
  token: string;
  primaryLocale: string;
  /** Store content locales (primary first), for locale params. */
  locales?: string[];
}

/** Field preview list of a preset card (children indented). */
function FieldPreview({ fields, typeLabel }: { fields: PresetFieldPreview[]; typeLabel: (type: string) => string }) {
  return (
    <ul className="space-y-1">
      {fields.map((f) => (
        <li key={f.name} className="text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-zinc-700" dir="ltr">{f.name}</span>
            <Badge variant="secondary" className="text-[9px]">{typeLabel(f.type)}</Badge>
          </div>
          {f.children && f.children.length > 0 && (
            <ul className="ms-3 mt-1 space-y-1 border-s ps-3">
              {f.children.map((c) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="font-mono text-zinc-600" dir="ltr">{c.name}</span>
                  <Badge variant="outline" className="text-[9px]">{typeLabel(c.type)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Presets" tab: one card per code preset (§4.6), the four Namez templates
 * first. "Apply to product…" opens the apply dialog with a product picker.
 */
export function PresetsPanel({ token, primaryLocale, locales }: PresetsPanelProps) {
  const t = useTranslations('creator.personalization.presets');
  const tf = useTranslations('customField');
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ productId: string; key: string; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPresets(token)
      .then((list) => !cancelled && setPresets(mergePresetSummaries(list)))
      .catch(() => !cancelled && setPresets(mergePresetSummaries(null)));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const typeLabel = (type: string) => {
    const key = `type${type
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')}`;
    return tf.has(key) ? tf(key) : type;
  };

  if (presets === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applied && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            {t('appliedNotice', { count: applied.count })}
          </span>
          <Link href={`/creator/products/own/${applied.productId}`} className="inline-flex items-center gap-1 font-medium hover:underline">
            {t('openProduct')} <ChevronRight className="size-3 rtl:rotate-180" />
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((p) => {
          const catalog = isPresetKey(p.key) ? PRESET_CATALOG[p.key] : null;
          const fields = catalog?.fields ?? [];
          return (
            <Card key={p.key} className="flex flex-col shadow-none">
              <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-white">
                      <Sparkles className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.has(`items.${p.key}.name`) ? t(`items.${p.key}.name`) : p.key}</p>
                      {t.has(`items.${p.key}.description`) && (
                        <p className="text-xs text-muted-foreground">{t(`items.${p.key}.description`)}</p>
                      )}
                    </div>
                  </div>
                  {catalog?.namez && (
                    <Badge variant="outline" className="shrink-0 text-[9px]">{t('namezBadge')}</Badge>
                  )}
                </div>
                {fields.length > 0 && (
                  <div className="rounded-md border bg-zinc-50 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('createsFields')}</p>
                    <FieldPreview fields={fields} typeLabel={typeLabel} />
                  </div>
                )}
                <div className="mt-auto flex justify-end">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setActive(p.key)}>
                    {t('applyToProduct')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ApplyPresetDialog
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
        token={token}
        primaryLocale={primaryLocale}
        locales={locales}
        presetKey={active ?? undefined}
        presets={presets}
        onApplied={(productId, fields) => setApplied({ productId, key: active ?? '', count: fields.length })}
      />
    </div>
  );
}
