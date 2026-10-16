'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ImageIcon, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiError } from '@/lib/useApiError';
import {
  designerFileUrl,
  listAssets,
  uploadAsset,
  TEMPLATE_ASSET_MAX_MB,
  type DesignerAssetView,
  type TemplateAssetKind,
  type UploadAssetResult,
} from '@/lib/designer/designer.api';
import { formatBytes } from '@/components/importer/ImporterBits';
import { UploadWarnings } from '@/components/designer/DesignerBits';

interface AssetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  kind: TemplateAssetKind;
  /** Template the file is for: the API checks the resolution against its trim size. */
  templateId?: string | null;
  currentId?: string | null;
  onPick: (asset: DesignerAssetView) => void;
}

/**
 * Chooses a template asset of one kind from the store library, or uploads a
 * new one. Upload warnings (low resolution, aspect, size) are shown before
 * the creator confirms; they never block.
 */
export function AssetPickerDialog({ open, onOpenChange, token, kind, templateId, currentId, onPick }: AssetPickerDialogProps) {
  const t = useTranslations('creator.designer.assets');
  const tk = useTranslations('creator.designer.assets.kinds');
  const tc = useTranslations('creator.designer.common');
  const locale = useLocale();
  const describeError = useApiError();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<DesignerAssetView[] | null>(null);
  const [selected, setSelected] = useState<string | null>(currentId ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadAssetResult | null>(null);

  const load = useCallback(() => {
    setError(null);
    listAssets(token, { kind, limit: 200 })
      .then((res) => setItems(res.items))
      .catch((err) => {
        setItems([]);
        setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kind]);

  useEffect(() => {
    if (!open) return;
    setSelected(currentId ?? null);
    setLastUpload(null);
    load();
  }, [open, currentId, load]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > TEMPLATE_ASSET_MAX_MB * 1024 * 1024) {
      setError(t('tooLarge', { max: TEMPLATE_ASSET_MAX_MB }));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadAsset(token, { file, kind, template_id: templateId ?? null });
      setLastUpload(res);
      setSelected(res.asset.id);
      setItems((prev) => [res.asset, ...(prev ?? []).filter((a) => a.id !== res.asset.id)]);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const chosen = items?.find((a) => a.id === selected) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('pickTitle', { kind: tk(kind) })}</DialogTitle>
          <DialogDescription>{t(`kindHints.${kind}`)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {t('uploadNew')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('uploadLimits', { max: TEMPLATE_ASSET_MAX_MB })}</span>
        </div>

        {error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{error}</p>}
        {lastUpload && (
          <div className="space-y-1">
            {lastUpload.deduped && <p className="text-xs text-muted-foreground">{t('deduped')}</p>}
            <UploadWarnings warnings={lastUpload.warnings} resolution={lastUpload.resolution} />
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto">
          {!items ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">{t('emptyKind')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((a) => {
                const url = designerFileUrl(a.url);
                const active = a.id === selected;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelected(a.id)}
                    className={`group relative overflow-hidden rounded-lg border text-start transition ${
                      active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex aspect-[5/7] items-center justify-center bg-zinc-50">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed / API-hosted file
                        <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <ImageIcon className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-0.5 border-t px-2 py-1.5 text-[11px]">
                      <p className="font-medium tabular-nums" dir="ltr">
                        {a.width}×{a.height}
                      </p>
                      <p className="text-muted-foreground">{formatBytes(a.bytes, locale)}</p>
                    </div>
                    {active && (
                      <span className="absolute end-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            type="button"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onPick(chosen);
              onOpenChange(false);
            }}
          >
            {t('useSelected')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
