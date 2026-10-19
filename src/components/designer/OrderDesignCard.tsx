'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, ImageIcon, Loader2, PenTool, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import type { DesignStateV1 } from '@/lib/designer/design-renderer';
import {
  designerFileUrl,
  downloadOriginalFile,
  downloadPrintFile,
  formatFileSize,
  formatPageMm,
  getOrderDesigns,
  isAppDisabledError,
  listAssets,
  listFonts,
  pdfPrintFile,
  pngPrintFile,
  purgeOrderItemFiles,
  regeneratePrint,
  type DesignerAssetView,
  type DesignerFontView,
  type OrderDesignAsset,
  type OrderDesignItem,
  type OrderDesigns,
} from '@/lib/designer/designer.api';
import { useDateTimeFormat } from '@/components/importer/ImporterBits';
import { DesignPreviewCanvas, type PreviewFont } from '@/components/designer/DesignPreviewCanvas';
import { PrintStatusBadge, usePrintErrorText } from '@/components/designer/DesignerBits';
import { OrderDesignAddons } from '@/components/designer/OrderDesignAddons';

interface OrderDesignCardProps {
  orderId: string;
  token: string;
  /**
   * Whether the designer app is on. Switched off, the card stays readable
   * (designs, print and original downloads) but hides regenerate / purge.
   */
  appEnabled: boolean;
  /** order_item_id → product title, for the item headings. */
  itemTitles?: Record<string, string>;
}

/**
 * Proof fallback when the server proof is missing (render engine off or not
 * rendered yet): the line's frozen `template_spec` drawn by the renderer
 * mirror with the frozen state (texts and each photo's `adj` crop). Fonts and
 * template images come from the libraries; when those refuse (app off) the
 * preview still draws with fallback fonts and without template images.
 */
interface DesignLibraries {
  fonts: DesignerFontView[];
  assets: DesignerAssetView[];
}

/** Fonts and template images of the store, loaded once per card (E10) and shared by every fallback proof. */
function useDesignLibraries(token: string, needed: boolean): DesignLibraries {
  const [libs, setLibs] = useState<DesignLibraries>({ fonts: [], assets: [] });
  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    Promise.all([
      listFonts(token).catch(() => [] as DesignerFontView[]),
      listAssets(token, { limit: 200 }).catch(() => ({ items: [] as DesignerAssetView[] })),
    ]).then(([f, lib]) => {
      if (cancelled) return;
      setLibs({ fonts: Array.isArray(f) ? f : [], assets: lib.items });
    });
    return () => {
      cancelled = true;
    };
  }, [token, needed]);
  return libs;
}

function ProofFallback({ item, libraries }: { item: OrderDesignItem; libraries: DesignLibraries }) {
  const t = useTranslations('creator.designer.order');
  const spec = item.template_spec ?? null;
  const { fonts, assets: library } = libraries;

  const exactCrop = !!item.state?.photos && Object.keys(item.state.photos).length > 0;

  const state: DesignStateV1 = useMemo(() => {
    const texts: Record<string, string> = {};
    for (const v of item.text_values ?? []) texts[v.element_id] = v.value;
    for (const [k, v] of Object.entries(item.state?.texts ?? {})) if (typeof v === 'string') texts[k] = v;
    const photos: DesignStateV1['photos'] = {};
    const slots = new Map((spec?.surfaces[0]?.elements ?? []).filter((e) => e.type === 'image_slot').map((e) => [e.id, e]));
    for (const a of item.assets) {
      if (a.role !== 'photo' || !a.asset_id || !a.element_id || !a.preview_url) continue;
      const slot = slots.get(a.element_id);
      const frozen = item.state?.photos?.[a.element_id];
      const fallbackAdj = slot && slot.type === 'image_slot' ? { ...slot.default_adj } : { zoom: 1, rot: 0, panX: 0.5, panY: 0.5 };
      photos[a.element_id] = {
        asset_id: a.asset_id,
        width: frozen?.width ?? a.width ?? 1,
        height: frozen?.height ?? a.height ?? 1,
        adj: frozen?.adj ? { ...frozen.adj } : fallbackAdj,
      };
    }
    return { v: 1, texts, photos };
  }, [item, spec]);

  const assetUrls = useMemo(() => {
    // Template backgrounds / decorations from the library, photos from their signed previews.
    const map: Record<string, string> = {};
    for (const a of library) {
      const u = designerFileUrl(a.url);
      if (u) map[a.id] = u;
    }
    for (const a of item.assets) {
      const u = designerFileUrl(a.preview_url);
      if (a.asset_id && u) map[a.asset_id] = u;
    }
    return map;
  }, [item, library]);

  const previewFonts: PreviewFont[] = useMemo(() => {
    if (!spec) return [];
    const byId = new Map(fonts.map((f) => [f.id, f]));
    return spec.fonts
      .map((f) => {
        const url = designerFileUrl(byId.get(f.asset_id)?.url);
        return url ? { family: f.family, weight: f.weight, style: f.style || 'normal', url } : null;
      })
      .filter((x): x is PreviewFont => !!x);
  }, [spec, fonts]);

  if (!spec) return <p className="py-6 text-center text-[11px] text-muted-foreground">{t('noProof')}</p>;
  return (
    <div className="space-y-1">
      <DesignPreviewCanvas spec={spec} state={state} mode="proof" assetUrls={assetUrls} fonts={previewFonts} maxWidth={220} />
      <p className="text-center text-[11px] text-muted-foreground">{exactCrop ? t('livePreview') : t('liveFallback')}</p>
    </div>
  );
}

/**
 * "Designs" card of the creator order page (M4.2 §8.4): per designed item
 * the proof, the customer's texts and photos, the print status with download
 * / regenerate, and the retention dates. Read-only while the app is off
 * (downloads keep working); hidden on a 404/403 or when the order has no
 * designs.
 */
export function OrderDesignCard({ orderId, token, appEnabled, itemTitles }: OrderDesignCardProps) {
  const t = useTranslations('creator.designer.order');
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const printError = usePrintErrorText();
  const [data, setData] = useState<OrderDesigns | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string; ok?: boolean } | null>(null);
  const [purging, setPurging] = useState<OrderDesignItem | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  // The API refused a write because the app is off (stale app list).
  const [refused, setRefused] = useState(false);
  const readOnly = !appEnabled || refused;

  const load = useCallback(() => {
    getOrderDesigns(token, orderId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        // No designer data for this order (404) or no access (403): no card.
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setHidden(true);
        else setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Libraries are fetched once per card, and only when some line needs the
  // client-side proof fallback (no server proof yet).
  const needsFallback = !!data?.items.some((item) => !item.proof_url && !!item.template_spec);
  const libraries = useDesignLibraries(token, needsFallback);

  if (hidden) return null;
  if (!data && !error) return null;
  if (data && data.items.length === 0) return null;

  const download = async (item: OrderDesignItem, format: 'png' | 'pdf' = 'png') => {
    setBusy(`dl-${format}-${item.order_item_id}`);
    setRowMsg(null);
    try {
      await downloadPrintFile(token, orderId, item.order_item_id, format);
    } catch (err) {
      setRowMsg({ id: item.order_item_id, text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  const downloadOriginal = async (item: OrderDesignItem, photo: OrderDesignAsset) => {
    if (!photo.asset_id) return;
    setBusy(`orig-${item.order_item_id}-${photo.asset_id}`);
    setRowMsg(null);
    try {
      await downloadOriginalFile(token, orderId, item.order_item_id, photo.asset_id);
    } catch (err) {
      const purged = err instanceof ApiError && (err.code === 'DESIGNER_FILES_PURGED' || err.status === 410);
      setRowMsg({ id: item.order_item_id, text: purged ? t('originalPurged') : describeError(err) });
      if (purged) load();
    } finally {
      setBusy(null);
    }
  };

  /** A write refused because the app is off switches the card to read-only. */
  const refusedText = (err: unknown): string | null => {
    if (!isAppDisabledError(err)) return null;
    setRefused(true);
    return t('readOnlyRefused');
  };

  const regenerate = async (item: OrderDesignItem) => {
    setBusy(`regen-${item.order_item_id}`);
    setRowMsg(null);
    try {
      const res = await regeneratePrint(token, orderId, item.order_item_id);
      setRowMsg({ id: item.order_item_id, text: res.queued ? t('regenerateQueued') : t('alreadyRendering'), ok: true });
      load();
    } catch (err) {
      setRowMsg({ id: item.order_item_id, text: refusedText(err) ?? describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  const confirmPurge = async () => {
    if (!purging) return;
    const item = purging;
    setBusy(`purge-${item.order_item_id}`);
    setPurgeError(null);
    try {
      await purgeOrderItemFiles(token, orderId, item.order_item_id);
      setPurging(null);
      setRowMsg({ id: item.order_item_id, text: t('purgeDone'), ok: true });
      load();
    } catch (err) {
      const refusedMsg = refusedText(err);
      if (refusedMsg) {
        setPurging(null);
        setRowMsg({ id: item.order_item_id, text: refusedMsg });
        return;
      }
      setPurgeError(err instanceof ApiError && err.code === 'DESIGNER_PRINT_NOT_READY' ? t('purgeWhileRendering') : describeError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="shadow-none" id="designs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <PenTool className="size-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">{error}</p>}
        {readOnly && data && data.items.length > 0 && (
          <p className="rounded-md border bg-zinc-50 p-2.5 text-muted-foreground">{t('readOnly')}</p>
        )}
        {data?.items.map((item, n) => {
          const proof = designerFileUrl(item.proof_url);
          const photos = item.assets.filter((a) => a.role === 'photo');
          const filesPurged = !!item.files_purged_at || item.print.status === 'PURGED';
          const file = pngPrintFile(item.print.files);
          const pdf = pdfPrintFile(item.print.files);
          const title = itemTitles?.[item.order_item_id];
          return (
            <div key={item.order_item_design_id} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {t('itemHeading', { n: n + 1 })}
                  {title ? ` · ${title}` : ''}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </p>
                <PrintStatusBadge status={item.print.status} waiting={!item.print.requested_at} />
              </div>

              <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className="flex items-start justify-center rounded-md border bg-zinc-50 p-2">
                  {proof ? (
                    <a href={proof} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed proof link */}
                      <img src={proof} alt={t('proofAlt')} className="max-h-72 w-auto rounded" />
                    </a>
                  ) : filesPurged ? (
                    <p className="py-6 text-center text-[11px] text-muted-foreground">{t('proofPurged')}</p>
                  ) : (
                    <ProofFallback item={item} libraries={libraries} />
                  )}
                </div>

                <div className="space-y-3">
                  {(item.text_values ?? []).length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground">{t('texts')}</p>
                      <dl className="divide-y rounded-md border">
                        {(item.text_values ?? []).map((v) => (
                          <div key={v.element_id} className="flex gap-3 px-2.5 py-1.5">
                            <dt className="w-24 shrink-0 text-muted-foreground">{v.label || v.element_id}</dt>
                            <dd className="min-w-0 break-words font-medium" dir="auto">
                              {v.value || '—'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* M5.5: chosen add-ons (separate from the print-file block). */}
                  <OrderDesignAddons item={item} />

                  {photos.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground">{t('photos')}</p>
                      <div className="flex flex-wrap gap-2">
                        {photos.map((p, i) => {
                          const url = designerFileUrl(p.preview_url);
                          return (
                            <div key={`${p.asset_id}-${i}`} className="w-28 space-y-1">
                              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-zinc-50">
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- signed preview link */}
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                  </a>
                                ) : (
                                  <ImageIcon className="size-5 text-muted-foreground" />
                                )}
                              </div>
                              {p.width && p.height ? (
                                <p className="text-[11px] text-muted-foreground" dir="ltr">
                                  {p.width}×{p.height}
                                  {p.effective_dpi ? ` · ${Math.round(p.effective_dpi)} DPI` : ''}
                                </p>
                              ) : null}
                              {p.low_res && (
                                <p className="flex items-center gap-1 text-[11px] text-amber-700">
                                  <AlertTriangle className="size-3" /> {t('lowRes')}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {p.original_available ? t('originalKept') : t('originalGone')}
                              </p>
                              {p.original_available && p.asset_id && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-full px-1.5 text-[11px] max-sm:min-h-11"
                                  disabled={busy === `orig-${item.order_item_id}-${p.asset_id}`}
                                  onClick={() => downloadOriginal(item, p)}
                                >
                                  {busy === `orig-${item.order_item_id}-${p.asset_id}` ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Download className="size-3" />
                                  )}{' '}
                                  {t('downloadOriginal')}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">{t('printFile')}</p>
                    {file ? (
                      <>
                        <p className="text-muted-foreground" dir="ltr">
                          PNG · {file.width_px}×{file.height_px} px · {Math.round(file.dpi)} DPI · {formatFileSize(file.bytes)}
                        </p>
                        {pdf && (
                          <p className="text-muted-foreground" dir="ltr">
                            PDF · {pdf.page_mm ? formatPageMm(pdf.page_mm) : '—'}
                            {pdf.bleed_mm ? ` · ${t('pdfBleed', { mm: pdf.bleed_mm })}` : ''}
                            {pdf.crop_marks ? ` · ${t('pdfCropMarks')}` : ''} · {formatFileSize(pdf.bytes)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">{item.print.requested_at ? t('printPending') : t('printWaitingPayment')}</p>
                    )}
                    {item.print.error && (
                      <p className="break-words text-red-600" title={item.print.error}>
                        {printError(item.print.error)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!item.print.download_path || busy === `dl-png-${item.order_item_id}`}
                        onClick={() => download(item)}
                      >
                        {busy === `dl-png-${item.order_item_id}` ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />}{' '}
                        {t('downloadPrint')}
                      </Button>
                      {pdf && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!item.print.pdf_download_path || busy === `dl-pdf-${item.order_item_id}`}
                          onClick={() => download(item, 'pdf')}
                        >
                          {busy === `dl-pdf-${item.order_item_id}` ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />}{' '}
                          {t('downloadPdf')}
                        </Button>
                      )}
                      {!readOnly && (
                        <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={filesPurged || item.print.status === 'RENDERING' || busy === `regen-${item.order_item_id}`}
                        title={pdf ? t('regenerateBoth') : undefined}
                        onClick={() => regenerate(item)}
                      >
                        {busy === `regen-${item.order_item_id}` ? <Loader2 className="animate-spin" /> : <RotateCcw className="size-3.5" />}{' '}
                        {t('regenerate')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-600"
                        disabled={(filesPurged && !!item.originals_purged_at) || item.print.status === 'RENDERING' || !!busy}
                        onClick={() => {
                          setPurgeError(null);
                          setPurging(item);
                        }}
                      >
                        <Trash2 className="size-3.5" /> {t('purge')}
                      </Button>
                        </>
                      )}
                    </div>
                    {rowMsg?.id === item.order_item_id && <p className={rowMsg.ok ? 'text-emerald-700' : 'text-red-600'}>{rowMsg.text}</p>}
                  </div>

                  <div className="space-y-0.5 rounded-md bg-zinc-50 p-2 text-[11px] text-muted-foreground">
                    <p>
                      {item.originals_purged_at
                        ? t('originalsPurged', { date: formatDate(item.originals_purged_at) })
                        : item.originals_purge_at
                          ? t('originalsPurgeAt', { date: formatDate(item.originals_purge_at) })
                          : t('originalsNoDate')}
                    </p>
                    <p>
                      {item.files_purged_at
                        ? t('filesPurged', { date: formatDate(item.files_purged_at) })
                        : item.files_purge_at
                          ? t('filesPurgeAt', { date: formatDate(item.files_purge_at) })
                          : t('filesNoDate')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!purging} onOpenChange={(o) => !o && setPurging(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('purgeTitle')}</DialogTitle>
            <DialogDescription>{t('purgeBody')}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 rounded-md border border-red-200 bg-red-50 p-3 ps-7 text-xs text-red-800">
            <li>{t('purgeWhatPhotos')}</li>
            <li>{t('purgeWhatPrint')}</li>
            <li>{t('purgeWhatKept')}</li>
          </ul>
          {purgeError && <p className="text-xs text-red-600">{purgeError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPurging(null)}>
              {t('purgeCancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={!!busy} onClick={confirmPurge}>
              {busy?.startsWith('purge-') ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('purgeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
