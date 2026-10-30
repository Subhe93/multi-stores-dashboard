'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ImageIcon, Loader2, RefreshCw, Replace, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  deleteAsset,
  designerFileUrl,
  errorParams,
  getAsset,
  listAssets,
  uploadAsset,
  TEMPLATE_ASSET_KINDS,
  TEMPLATE_ASSET_MAX_MB,
  type AssetReferences,
  type DesignerAssetView,
  type TemplateAssetKind,
  type UploadAssetResult,
} from '@/lib/designer/designer.api';
import { formatBytes, useDateTimeFormat } from '@/components/importer/ImporterBits';
import { UploadWarnings, stretchDpi } from '@/components/designer/DesignerBits';
import { runBulk } from '@/lib/bulk';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useTableSelection } from '@/components/common/useTableSelection';
import {
  BulkNotice,
  SelectAllCheckbox,
  SelectRowCheckbox,
  TableSelectionBar,
  useBulkSummary,
  type BulkNoticeValue,
} from '@/components/common/TableSelectionBar';

const ALL = '__all__';
/** NPP budget size: the DPI column assumes it when the asset is not tied to a template. */
const DEFAULT_MM = { width: 500, height: 700 };

/**
 * Template asset library of the "Assets & fonts" tab: upload by kind (with
 * the API's friendly `warnings[]`), DPI info for backgrounds, replace (a new
 * asset that supersedes the old one, never an in-place overwrite) and delete
 * with in-use protection (usage is checked before the confirm dialog).
 */
export function AssetsPanel({ token }: { token: string }) {
  const t = useTranslations('creator.designer.assets');
  const tk = useTranslations('creator.designer.assets.kinds');
  const tc = useTranslations('creator.designer.common');
  const locale = useLocale();
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const [uploadKind, setUploadKind] = useState<TemplateAssetKind>('TEMPLATE_BG_WEB');
  const [items, setItems] = useState<DesignerAssetView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadAssetResult | null>(null);
  const [replacing, setReplacing] = useState<DesignerAssetView | null>(null);
  const [deleting, setDeleting] = useState<{ asset: DesignerAssetView; refs: AssetReferences | null; checking: boolean } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const tb = useTranslations('bulk');
  const bulkSummary = useBulkSummary();
  const selection = useTableSelection(items ?? [], (a) => a.id);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<BulkNoticeValue | null>(null);

  const load = useCallback(() => {
    setError(null);
    listAssets(token, { kind: filter === ALL ? undefined : (filter as TemplateAssetKind), limit: 200 })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setItems([]);
        setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const doUpload = async (file: File | undefined, kind: TemplateAssetKind, replaces?: DesignerAssetView | null) => {
    if (!file) return;
    if (file.size > TEMPLATE_ASSET_MAX_MB * 1024 * 1024) {
      setError(t('tooLarge', { max: TEMPLATE_ASSET_MAX_MB }));
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadAsset(token, { file, kind, replaces_asset_id: replaces?.id ?? null });
      setResult(res);
      load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
      setReplacing(null);
      if (fileRef.current) fileRef.current.value = '';
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const askDelete = async (asset: DesignerAssetView) => {
    setDeleteError(null);
    setDeleting({ asset, refs: null, checking: true });
    try {
      const full = await getAsset(token, asset.id);
      setDeleting({ asset, refs: full.references, checking: false });
    } catch (err) {
      setDeleting({ asset, refs: null, checking: false });
      setDeleteError(describeError(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAsset(token, deleting.asset.id);
      setDeleting(null);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DESIGNER_ASSET_IN_USE') {
        const p = errorParams(err);
        setDeleting({
          ...deleting,
          refs: { template_versions: Number(p.template_versions ?? 0), order_items: Number(p.order_items ?? 0) },
        });
      } else {
        setDeleteError(describeError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // Assets still used by a template version or an order are rejected by the
  // API (DESIGNER_ASSET_IN_USE) and reported as failures.
  const handleBulkDelete = async () => {
    setBusy(true);
    const result = await runBulk(selection.selectedRows, (asset) =>
      deleteAsset(token, asset.id).catch((err: unknown) => {
        throw new Error(describeError(err));
      }),
    );
    setBusy(false);
    setBulkDeleteOpen(false);
    selection.clear();
    setBulkNotice(bulkSummary(result));
    load();
  };

  const inUse = !!deleting?.refs && (deleting.refs.template_versions > 0 || deleting.refs.order_items > 0);
  const kindOptions = TEMPLATE_ASSET_KINDS.map((k) => ({ value: k, label: tk(k), description: t(`kindHints.${k}`) }));

  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t('uploadTitle')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('uploadIntro', { max: TEMPLATE_ASSET_MAX_MB })}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-72 space-y-1">
              <span className="text-[11px] text-muted-foreground">{t('kind')}</span>
              <SearchableSelect value={uploadKind} onChange={(v) => setUploadKind(v as TemplateAssetKind)} options={kindOptions} />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => doUpload(e.target.files?.[0], uploadKind)}
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy && !replacing ? <Loader2 className="animate-spin" /> : <Upload />} {t('upload')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('dpiExplainer')}</p>
          {error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{error}</p>}
          {result && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium">
                {result.deduped ? t('deduped') : result.replaces ? t('replacedOk') : t('uploadedOk')}{' '}
                <span className="font-normal text-muted-foreground" dir="ltr">
                  {result.asset.width}×{result.asset.height}
                </span>
              </p>
              <UploadWarnings warnings={result.warnings} resolution={result.resolution} />
              {result.warnings.length === 0 && <p className="text-xs text-emerald-700">{t('noWarnings')}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{t('libraryTitle', { count: total })}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-56">
              <SearchableSelect value={filter} onChange={setFilter} options={[{ value: ALL, label: t('allKinds') }, ...kindOptions]} />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={load} aria-label={tc('refresh')}>
              <RefreshCw />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={replaceRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => replacing && doUpload(e.target.files?.[0], replacing.kind as TemplateAssetKind, replacing)}
          />
          <BulkNotice notice={bulkNotice} onDismiss={() => setBulkNotice(null)} className="mb-3" />
          {!items ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <TableSelectionBar selection={selection}>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" /> {t('delete')}
                </Button>
              </TableSelectionBar>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="w-10 py-2 pe-3">
                      <SelectAllCheckbox selection={selection} />
                    </th>
                    <th className="py-2 pe-3 text-start font-medium">{t('colPreview')}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t('kind')}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t('colSize')}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t('colDpi')}</th>
                    <th className="py-2 pe-3 text-start font-medium">{t('colAdded')}</th>
                    <th className="py-2 text-end font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const url = designerFileUrl(a.url);
                    const isBg = a.kind === 'TEMPLATE_BG_WEB' || a.kind === 'TEMPLATE_BG_PRINT';
                    const dpi = isBg ? stretchDpi(a.width, a.height, DEFAULT_MM) : null;
                    const target = a.kind === 'TEMPLATE_BG_PRINT' ? 3000 : 1000;
                    const low = isBg && a.width < target * 0.8;
                    const warnings = Array.isArray(a.meta?.warnings) ? (a.meta.warnings as string[]) : [];
                    return (
                      <tr
                        key={a.id}
                        data-state={selection.isSelected(a.id) ? 'selected' : undefined}
                        className={`border-b align-middle last:border-0 ${selection.isSelected(a.id) ? 'bg-zinc-50' : ''}`}
                      >
                        <td className="w-10 py-2 pe-3">
                          <SelectRowCheckbox selection={selection} id={a.id} />
                        </td>
                        <td className="py-2 pe-3">
                          <div className="flex h-14 w-10 items-center justify-center overflow-hidden rounded border bg-zinc-50">
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- API-hosted file
                              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <ImageIcon className="size-4 text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="py-2 pe-3">
                          <span className="block">{tk.has(a.kind) ? tk(a.kind) : a.kind}</span>
                          {warnings.length > 0 && (
                            <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-[11px] text-amber-700">
                              {t('warningsBadge', { count: warnings.length })}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pe-3 tabular-nums">
                          <span className="block" dir="ltr">
                            {a.width}×{a.height}
                          </span>
                          <span className="text-muted-foreground">{formatBytes(a.bytes, locale)}</span>
                        </td>
                        <td className={`py-2 pe-3 tabular-nums ${low ? 'text-amber-700' : ''}`}>{dpi !== null ? t('dpiValue', { dpi }) : '—'}</td>
                        <td className="py-2 pe-3 text-muted-foreground">{formatDate(a.created_at)}</td>
                        <td className="py-2 text-end">
                          <div className="inline-flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={busy}
                              onClick={() => {
                                setReplacing(a);
                                replaceRef.current?.click();
                              }}
                            >
                              <Replace className="size-3.5" /> {t('replace')}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-9 text-red-600 max-sm:size-11"
                              disabled={busy}
                              aria-label={t('delete')}
                              title={t('delete')}
                              onClick={() => askDelete(a)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">{t('replaceHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        destructive
        title={tb('deleteTitle', { count: selection.count })}
        description={tb('deleteDescription')}
        busy={busy}
        busyLabel={tb('working')}
        onConfirm={handleBulkDelete}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{inUse ? t('inUseBody') : t('deleteBody')}</DialogDescription>
          </DialogHeader>
          {deleting?.checking ? (
            <div className="flex justify-center py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : inUse && deleting?.refs ? (
            <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {deleting.refs.template_versions > 0 && <li>{t('usedByVersions', { count: deleting.refs.template_versions })}</li>}
              {deleting.refs.order_items > 0 && <li>{t('usedByOrders', { count: deleting.refs.order_items })}</li>}
            </ul>
          ) : null}
          {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {tc('cancel')}
            </Button>
            {!inUse && (
              <Button type="button" variant="destructive" disabled={busy || deleting?.checking} onClick={confirmDelete}>
                {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('delete')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
