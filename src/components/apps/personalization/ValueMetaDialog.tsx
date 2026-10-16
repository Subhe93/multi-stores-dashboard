'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveMediaUrl } from '@/lib/media';
import {
  DEFAULT_BADGE_COLOR,
  MAX_VALUE_COUNT,
  isHexColor,
  optionValueCount,
  type ValueMeta,
} from '@/lib/personalization';

/** The option shape this dialog edits (subset of VariantManager's VariantOption). */
export interface ValueMetaOption {
  name: string;
  style: string;
  values: string[];
  valueMeta?: Record<string, ValueMeta>;
  swatchMap?: Record<string, string>;
}

interface ValueMetaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: ValueMetaOption | null;
  /** Receives the new `valueMeta` and `swatchMap` (undefined = remove the key). */
  onSave: (next: { valueMeta?: Record<string, ValueMeta>; swatchMap?: Record<string, string> }) => void;
  onPickImage?: () => Promise<string | null>;
  uploading?: boolean;
}

interface Row {
  label: string;
  sublabel: string;
  badge: string;
  badge_color: string;
  count: string;
  swatch: string;
}

const toRows = (option: ValueMetaOption): Record<string, Row> => {
  const out: Record<string, Row> = {};
  for (const v of option.values) {
    const m = option.valueMeta?.[v] ?? {};
    out[v] = {
      label: m.label ?? '',
      sublabel: m.sublabel ?? '',
      badge: m.badge ?? '',
      badge_color: m.badge_color ?? '',
      count: typeof m.count === 'number' ? String(m.count) : '',
      swatch: option.swatchMap?.[v] ?? '',
    };
  }
  return out;
};

/**
 * Per-value details of a variant option (M4.1 D9, C38): card label, sublabel,
 * badge and colour, repeat count, and the swatch image (`swatchMap`, never the
 * product photo). Keys this dialog does not edit (e.g. `i18n`) are kept.
 */
export function ValueMetaDialog({ open, onOpenChange, option, onSave, onPickImage, uploading }: ValueMetaDialogProps) {
  const t = useTranslations('variant.valueMeta');
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [pending, setPending] = useState<string | null>(null);

  // Seed once per opening so a parent re-render never discards edits in progress.
  useEffect(() => {
    if (open && option) setRows(toRows(option));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  if (!option) return null;

  const set = (value: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [value]: { ...prev[value], ...patch } }));

  const countOf = (r: Row) => (r.count === '' ? undefined : Number(r.count));
  const invalid = Object.values(rows).some((r) => {
    const c = countOf(r);
    const badColor = r.badge_color !== '' && !isHexColor(r.badge_color);
    const badCount = c !== undefined && (!Number.isInteger(c) || c < 0 || c > MAX_VALUE_COUNT);
    return badColor || badCount;
  });

  const handleSave = () => {
    const valueMeta: Record<string, ValueMeta> = {};
    const swatchMap: Record<string, string> = { ...(option.swatchMap ?? {}) };
    for (const v of option.values) {
      const r = rows[v];
      if (!r) continue;
      // Start from the stored entry so unknown keys (i18n, …) survive.
      const meta: ValueMeta = { ...(option.valueMeta?.[v] ?? {}) };
      const text = (key: 'label' | 'sublabel' | 'badge' | 'badge_color', raw: string) => {
        const s = raw.trim();
        if (s) meta[key] = s;
        else delete meta[key];
      };
      text('label', r.label);
      text('sublabel', r.sublabel);
      text('badge', r.badge);
      text('badge_color', r.badge_color);
      const c = countOf(r);
      if (c === undefined) delete meta.count;
      else meta.count = c;
      if (Object.keys(meta).length > 0) valueMeta[v] = meta;
      if (r.swatch) swatchMap[v] = r.swatch;
      else delete swatchMap[v];
    }
    onSave({
      valueMeta: Object.keys(valueMeta).length > 0 ? valueMeta : undefined,
      swatchMap: Object.keys(swatchMap).length > 0 ? swatchMap : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('title', { option: option.name || '—' })}</DialogTitle>
          <p className="text-xs text-muted-foreground">{option.style === 'card' ? t('hintCard') : t('hint')}</p>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-start font-medium">{t('value')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('label')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('sublabel')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('badge')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('badgeColor')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('count')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('swatch')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {option.values.map((v) => {
                const r = rows[v];
                if (!r) return null;
                const c = countOf(r);
                const badCount = c !== undefined && (!Number.isInteger(c) || c < 0 || c > MAX_VALUE_COUNT);
                const badColor = r.badge_color !== '' && !isHexColor(r.badge_color);
                return (
                  <tr key={v} className="align-top">
                    <td className="max-w-32 px-2 py-1.5 font-medium" title={v}>
                      <span className="block truncate">{v}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input className="h-7 min-w-28 text-xs" dir="auto" placeholder={v} value={r.label} onChange={(e) => set(v, { label: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input className="h-7 min-w-28 text-xs" dir="auto" value={r.sublabel} onChange={(e) => set(v, { sublabel: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input className="h-7 min-w-24 text-xs" dir="auto" placeholder={t('badgePlaceholder')} value={r.badge} onChange={(e) => set(v, { badge: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          aria-label={t('badgeColor')}
                          className="h-7 w-8 shrink-0 cursor-pointer rounded border"
                          value={isHexColor(r.badge_color) && r.badge_color.length === 7 ? r.badge_color : DEFAULT_BADGE_COLOR}
                          onChange={(e) => set(v, { badge_color: e.target.value })}
                        />
                        <Input
                          className="h-7 w-24 font-mono text-xs"
                          dir="ltr"
                          placeholder={DEFAULT_BADGE_COLOR}
                          value={r.badge_color}
                          aria-invalid={badColor || undefined}
                          onChange={(e) => set(v, { badge_color: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={MAX_VALUE_COUNT}
                        className="h-7 w-20 text-xs"
                        placeholder={String(optionValueCount({ ...option, valueMeta: undefined }, v))}
                        value={r.count}
                        aria-invalid={badCount || undefined}
                        onChange={(e) => set(v, { count: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {r.swatch ? (
                        <div className="relative size-9 overflow-hidden rounded border bg-zinc-50">
                          {/* eslint-disable-next-line @next/next/no-img-element -- merchant media URL */}
                          <img src={resolveMediaUrl(r.swatch)} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label={t('removeSwatch')}
                            className="absolute end-0 top-0 rounded-bl bg-white/90 p-0.5 text-zinc-500 hover:text-red-600"
                            onClick={() => set(v, { swatch: '' })}
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-9"
                          disabled={!onPickImage || !!pending}
                          title={t('swatch')}
                          onClick={async () => {
                            if (!onPickImage) return;
                            setPending(v);
                            try {
                              const url = await onPickImage();
                              if (url) set(v, { swatch: url });
                            } finally {
                              setPending(null);
                            }
                          }}
                        >
                          {pending === v && uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">{t('countHint', { max: MAX_VALUE_COUNT })}</p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={invalid}>
            {t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
