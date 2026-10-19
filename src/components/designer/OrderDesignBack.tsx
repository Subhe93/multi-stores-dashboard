'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  designerFileUrl,
  formatFileSize,
  formatPageMm,
  pdfPrintFile,
  pngPrintFile,
  type OrderDesignAsset,
  type OrderDesignItem,
} from '@/lib/designer/designer.api';
import { ProofFallback, type DesignLibraries } from '@/components/designer/OrderDesignCard';

interface Props {
  item: OrderDesignItem;
  libraries: DesignLibraries;
  busy: string | null;
  onDownload: (format: 'png' | 'pdf') => void;
  onDownloadOriginal: (photo: OrderDesignAsset) => void;
}

/**
 * "Back side" block of a double-sided order line (M5.6): the mode ("same
 * design" or the picked template), the back proof (or the live fallback
 * drawn from the frozen back spec + state), the back texts and photos, and
 * the back print downloads (PNG, and the PDF when the store renders one).
 */
export function OrderDesignBackBlock({ item, libraries, busy, onDownload, onDownloadOriginal }: Props) {
  const t = useTranslations('creator.designer.order');
  const back = item.back;
  if (!back) return null;
  const proof = designerFileUrl(back.proof_url);
  const filesPurged = !!item.files_purged_at || item.print.status === 'PURGED';
  const file = pngPrintFile(item.print.files, 'back');
  const pdf = pdfPrintFile(item.print.files, 'back');
  const photos = back.assets.filter((a) => a.role === 'photo');
  // The fallback proof is drawn from the frozen back spec / state ('same'
  // carries the front's again), reusing the front fallback with those.
  const fallbackItem: OrderDesignItem = {
    ...item,
    template_spec: back.template_spec ?? null,
    state: back.state ?? null,
    text_values: back.text_values,
    assets: back.assets,
  };
  const dlKey = (format: 'png' | 'pdf') => `dl-${format}-back-${item.order_item_id}`;
  return (
    <div className="space-y-3 rounded-md border bg-zinc-50/60 p-3" data-order-design-back>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-muted-foreground">{t('back')}</p>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px]" dir="auto">
          {back.mode === 'same' ? t('backModeSame') : t('backModeOther', { name: back.template_name ?? '—' })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="flex items-start justify-center rounded-md border bg-white p-2">
          {proof ? (
            <a href={proof} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed proof link */}
              <img src={proof} alt={t('backProofAlt')} className="max-h-56 w-auto rounded" />
            </a>
          ) : filesPurged ? (
            <p className="py-6 text-center text-[11px] text-muted-foreground">{t('proofPurged')}</p>
          ) : (
            <ProofFallback item={fallbackItem} libraries={libraries} />
          )}
        </div>

        <div className="space-y-3">
          {back.text_values.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">{t('backTexts')}</p>
              <dl className="divide-y rounded-md border bg-white">
                {back.text_values.map((v) => (
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

          {photos.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">{t('backPhotos')}</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => {
                  const url = designerFileUrl(p.preview_url);
                  const key = `orig-${item.order_item_id}-${p.asset_id}`;
                  return (
                    <div key={`${p.asset_id}-${i}`} className="w-24 space-y-1">
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-white">
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
                      {p.original_available && p.asset_id && (
                        <Button type="button" size="sm" variant="outline" className="h-7 w-full px-1.5 text-[11px] max-sm:min-h-11" disabled={busy === key} onClick={() => onDownloadOriginal(p)}>
                          {busy === key ? <Loader2 className="animate-spin" /> : <Download className="size-3" />} {t('downloadOriginal')}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="font-medium text-muted-foreground">{t('backFile')}</p>
            {file ? (
              <>
                <p className="text-muted-foreground" dir="ltr">
                  PNG · {file.width_px}×{file.height_px} px · {Math.round(file.dpi)} DPI · {formatFileSize(file.bytes)}
                </p>
                {pdf && (
                  <p className="text-muted-foreground" dir="ltr">
                    PDF · {pdf.page_mm ? formatPageMm(pdf.page_mm) : '—'}
                    {pdf.bleed_mm ? ` · ${t('pdfBleed', { mm: pdf.bleed_mm })}` : ''} · {formatFileSize(pdf.bytes)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">{item.print.requested_at ? t('printPending') : t('printWaitingPayment')}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!back.download_path || busy === dlKey('png')} onClick={() => onDownload('png')}>
                {busy === dlKey('png') ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />} {t('downloadPrintBack')}
              </Button>
              {pdf && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!back.pdf_download_path || busy === dlKey('pdf')} onClick={() => onDownload('pdf')}>
                  {busy === dlKey('pdf') ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />} {t('downloadPdfBack')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
