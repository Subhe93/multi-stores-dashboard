'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Download, FileText, Loader2, Package, Printer } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media';
import { useApiError } from '@/lib/useApiError';
import { downloadCustomerUploadOriginal } from '@/lib/customerUploads.api';
import { downloadPrintFile } from '@/lib/designer/designer.api';
import { cn } from '@/lib/utils';
import { ProductionRouteGuard } from '@/components/production/ProductionRouteGuard';
import {
  productionApi,
  type ProductionCheck,
  type ProductionPrintFile,
  type ProductionWorkspace,
} from '@/components/production/production.api';

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;

/**
 * Printable A4 production sheet of one order (M4.3 §5.6): order header,
 * shipping, notes and, per line, every value in large type with a printed
 * box (☐ / ☑ from the current state). No QR dependency: the workspace URL is
 * printed instead. Direction follows the dashboard locale (RTL-aware).
 */
export default function ProductionSheetPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductionRouteGuard>{(token) => <Sheet orderId={id} token={token} />}</ProductionRouteGuard>;
}

function Sheet({ orderId, token }: { orderId: string; token: string }) {
  const t = useTranslations('creator.production.sheet');
  const tp = useTranslations('creator.production');
  const tc = useTranslations('creator');
  const apiError = useApiError();
  const locale = useLocale();
  const [ws, setWs] = useState<ProductionWorkspace | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [workspaceUrl, setWorkspaceUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    productionApi
      .workspace(token, orderId)
      .then((res) => !cancelled && setWs(res))
      .catch((err) => !cancelled && setError(apiError(err)));
    api<{ name?: string | null }>('/stores/my/store', { token })
      .then((s) => !cancelled && setStoreName(s?.name ?? null))
      .catch(() => {});
    setWorkspaceUrl(`${window.location.origin}/production/orders/${orderId}`);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apiError is a fresh closure each render
  }, [token, orderId]);

  const download = async (c: ProductionCheck) => {
    if (!c.upload_id || downloading) return;
    setDownloading(c.id);
    try {
      await downloadCustomerUploadOriginal(token, c.upload_id, c.value);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDownloading(null);
    }
  };

  // `print_files[].url` is a Bearer-protected route (a plain link answers
  // 401): fetched with the token like OrderDesignCard does.
  const downloadPrint = async (f: ProductionPrintFile) => {
    if (downloading) return;
    setDownloading(`print-${f.order_item_id}`);
    try {
      await downloadPrintFile(token, orderId, f.order_item_id);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDownloading(null);
    }
  };

  if (!ws) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        {error ? <p className="text-sm text-destructive">{error}</p> : <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  const { order } = ws;
  const a = order.shipping_address;
  const status = tc.has(`orderStatus.${order.status}`) ? tc(`orderStatus.${order.status}`) : order.status;

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">
      {/* A4 page box; the toolbar never prints. */}
      <style>{'@page { size: A4; margin: 12mm; }'}</style>

      <div className="sticky top-0 z-10 border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-4 py-2">
          <Link href={`/creator/orders/${orderId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="rtl:rotate-180" />
            {tp('backToOrder')}
          </Link>
          <div className="flex-1" />
          {error && <span className="text-xs text-destructive">{error}</span>}
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer />
            {t('print')}
          </Button>
        </div>
      </div>

      <article className="mx-auto my-6 max-w-[210mm] bg-white p-[12mm] text-zinc-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-zinc-900 pb-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{storeName || t('title')}</p>
            <h1 className="font-mono text-3xl font-bold" dir="ltr">
              {order.order_number}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {new Date(order.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })} · {status}
            </p>
          </div>
          <div className="shrink-0 text-end text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{t('progress')}</p>
            <p className="text-2xl font-bold tabular-nums" dir="ltr">
              {ws.summary.done}/{ws.summary.total}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b py-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('customer')}</p>
            <p className="font-medium">{order.customer_name || '—'}</p>
            {a && (
              <div className="mt-1 text-zinc-700">
                {a.full_name && a.full_name !== order.customer_name && <p>{a.full_name}</p>}
                {a.line1 && <p>{a.line1}</p>}
                {a.line2 && <p>{a.line2}</p>}
                <p>{[a.postal_code, a.city].filter(Boolean).join(' ')}</p>
                {(a.state || a.country_code) && <p>{[a.state, a.country_code].filter(Boolean).join(', ')}</p>}
                {a.phone && <p dir="ltr" className="text-start">{a.phone}</p>}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('shipping')}</p>
            <p>{order.shipping_method_name || '—'}</p>
            {order.market && (
              <p className="mt-1 text-zinc-600">
                {t('market')}: {order.market.name}
              </p>
            )}
            {order.notes && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('notes')}</p>
                <p className="whitespace-pre-line rounded border border-amber-300 bg-amber-50 p-2 print:bg-white">{order.notes}</p>
              </div>
            )}
          </div>
        </section>

        {ws.print_files.length > 0 && (
          <section className="border-b py-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{tp('printFiles')}</p>
            <ul className="space-y-0.5">
              {ws.print_files.map((f) => {
                const busy = downloading === `print-${f.order_item_id}`;
                return (
                  <li key={`${f.order_item_id}-${f.url}`} className="flex flex-wrap items-center gap-2">
                    {/* Printed: the file name only (the URL needs a token). */}
                    <span className="font-medium">{f.label}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="print:hidden"
                      disabled={!!downloading}
                      onClick={() => downloadPrint(f)}
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <Download />}
                      {tp('downloadPrintFile')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="divide-y">
          {ws.lines.map((line) => {
            const checks = [...line.checks].filter((c) => !c.stale).sort((x, y) => x.sort_order - y.sort_order);
            return (
              <div key={line.order_item_id} className="break-inside-avoid py-4">
                <div className="flex items-start gap-4">
                  {line.image_url ? (
                    <img src={resolveMediaUrl(line.image_url)} alt="" className="size-20 shrink-0 rounded border object-cover" />
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded border bg-zinc-50">
                      <Package className="size-6 text-zinc-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold leading-snug">{line.title}</p>
                    {line.variant_label && <p className="text-sm text-zinc-600">{line.variant_label}</p>}
                    <p className="mt-0.5 text-sm font-semibold">{tp('qty', { count: line.quantity })}</p>
                  </div>
                  {line.owned && (
                    <p className="shrink-0 text-sm tabular-nums text-zinc-600" dir="ltr">
                      {line.progress.done}/{line.progress.total}
                    </p>
                  )}
                </div>

                {!line.owned ? (
                  <p className="mt-2 text-sm text-zinc-500">{tp('providerLine')}</p>
                ) : checks.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">{tp('noChecks')}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {checks.map((c) => {
                      const isImage = !!c.file_url && IMAGE_EXT_RE.test(c.file_url);
                      return (
                        <li key={c.id} className="flex items-start gap-3 break-inside-avoid">
                          <span
                            aria-hidden
                            className={cn(
                              'mt-1 flex size-6 shrink-0 items-center justify-center border-2 border-zinc-900 text-base font-bold leading-none',
                              c.done && 'bg-zinc-900 text-white',
                            )}
                          >
                            {c.done ? '✓' : ''}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-600">{c.label}</p>
                            {c.value && <p className="break-words text-2xl font-bold leading-tight">{c.value}</p>}
                            {c.file_url && (
                              <div className="mt-1 flex flex-wrap items-center gap-3">
                                {isImage ? (
                                  <img src={resolveMediaUrl(c.file_url)} alt="" className="h-28 max-w-[60mm] rounded border object-contain" />
                                ) : (
                                  <span className="flex size-16 items-center justify-center rounded border bg-zinc-50">
                                    <FileText className="size-6 text-zinc-400" />
                                  </span>
                                )}
                                {c.file_removed ? (
                                  <span className="text-xs text-zinc-500">{tp('fileRemoved')}</span>
                                ) : c.upload_id ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="print:hidden"
                                    disabled={downloading === c.id}
                                    onClick={() => download(c)}
                                  >
                                    {downloading === c.id ? <Loader2 className="animate-spin" /> : <Download />}
                                    {tp('downloadOriginal')}
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        <footer className="mt-4 border-t pt-3 text-xs text-zinc-500">
          <p>
            {t('workspaceUrl')}: <span dir="ltr" className="break-all">{workspaceUrl}</span>
          </p>
          <p className="mt-0.5">{t('printedAt', { time: new Date().toLocaleString(locale) })}</p>
        </footer>
      </article>
    </div>
  );
}
