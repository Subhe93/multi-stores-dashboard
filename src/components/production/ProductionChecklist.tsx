'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media';
import { useApiError } from '@/lib/useApiError';
import { downloadCustomerUploadOriginal } from '@/lib/customerUploads.api';
import { downloadPrintFile } from '@/lib/designer/designer.api';
import { cn } from '@/lib/utils';
import { ProductionProgressBar } from './ProductionProgressBar';
import { ProductionActivityLog } from './ProductionActivityLog';
import {
  CLOSED_ORDER_STATUSES,
  PRODUCTION_LIMITS,
  productionApi,
  type ProductionCheck,
  type ProductionLine,
  type ProductionPrintFile,
  type ProductionSummary,
  type ProductionWorkspace,
  type ProductionWriteResult,
} from './production.api';

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;

/** How long the "moved automatically (print files ready)" notice stays on the order. */
const AUTO_NOTICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface AutoMovedNotice {
  status: string;
  /** `print_ready` (M5.4 worker step) or null (checklist automation). */
  reason: string | null;
}

interface ProductionChecklistProps {
  orderId: string;
  token: string;
  /**
   * `card`: order-detail card (compact, links to the workspace and sheet).
   * `workspace`: full-screen mobile workshop view (bigger type, no card chrome).
   */
  mode?: 'card' | 'workspace';
  /** Called after the order status changed (automation or the suggestion banner). */
  onOrderStatusChanged?: (status: string) => void;
  /**
   * Order status known to the parent (E3). When it changes to something the
   * card has not seen (e.g. the status card next to it moved the order), the
   * workspace is reloaded quietly instead of remounting the card, so the
   * "moved automatically" notice stays until dismissed.
   */
  orderStatus?: string | null;
  /** Lets the parent show the order header (status, number) from the same payload. */
  onLoaded?: (workspace: ProductionWorkspace) => void;
}

/** Progress of the checks that count (stale checks never count). */
function progressOf(checks: ProductionCheck[]) {
  const live = checks.filter((c) => !c.stale);
  return { total: live.length, done: live.filter((c) => c.done).length };
}

function summaryOf(lines: ProductionLine[], prev: ProductionSummary): ProductionSummary {
  let total = 0;
  let done = 0;
  for (const l of lines) {
    if (!l.owned) continue;
    const p = progressOf(l.checks);
    total += p.total;
    done += p.done;
  }
  const state = total === 0 ? 'NONE' : done === 0 ? 'NOT_STARTED' : done >= total ? 'READY' : 'IN_PROGRESS';
  return { ...prev, total, done, state };
}

/** Applies `patch` to the checks matching `match` and recomputes progress locally. */
function patchChecks(
  ws: ProductionWorkspace,
  match: (c: ProductionCheck) => boolean,
  patch: (c: ProductionCheck) => ProductionCheck,
): ProductionWorkspace {
  const lines = ws.lines.map((l) => {
    const checks = l.checks.map((c) => (match(c) ? patch(c) : c));
    return { ...l, checks, progress: progressOf(checks) };
  });
  return { ...ws, lines, summary: summaryOf(lines, ws.summary) };
}

/**
 * Production checklist of one order (M4.3): one check per personalization
 * value, variant option, design and custom item, per order line. Writes are
 * optimistic (reverted with an inline error), the server summary is adopted
 * after every write, and the status automation (suggestion banner,
 * auto-advance notice) follows the write result.
 */
export function ProductionChecklist({ orderId, token, mode = 'card', onOrderStatusChanged, onLoaded, orderStatus }: ProductionChecklistProps) {
  const t = useTranslations('creator.production');
  const tc = useTranslations('creator');
  const tCommon = useTranslations('common');
  const apiError = useApiError();
  const locale = useLocale();
  const workspace = mode === 'workspace';

  const [ws, setWs] = useState<ProductionWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [autoMoved, setAutoMoved] = useState<AutoMovedNotice | null>(null);
  // Ship prompt of the SHIPPED suggestion (M5.4 `ship_prompt`).
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [logVersion, setLogVersion] = useState(0);
  const onLoadedRef = useRef(onLoaded);
  // Last status the parent was told about (detects automation moves).
  const statusRef = useRef<string | null>(null);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const STATUS = (s: string) => (tc.has(`orderStatus.${s}`) ? tc(`orderStatus.${s}`) : s);

  const adopt = useCallback((next: ProductionWorkspace) => {
    setWs(next);
    statusRef.current = next.order.status;
    onLoadedRef.current?.(next);
    // The print-ready step runs in the worker: a recent move the order still
    // sits in is announced on load (the banner is dismissable).
    const auto = next.auto_advanced;
    if (
      auto?.reason === 'print_ready' &&
      auto.to === next.order.status &&
      Date.now() - new Date(auto.at).getTime() < AUTO_NOTICE_MAX_AGE_MS
    ) {
      setAutoMoved((prev) => prev ?? { status: auto.to, reason: auto.reason });
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        adopt(await productionApi.workspace(token, orderId));
        setLoadError(null);
      } catch (err) {
        if (!silent) setLoadError(apiError(err));
        else setError(apiError(err));
      } finally {
        if (!silent) setLoading(false);
        setLogVersion((v) => v + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apiError is a fresh closure each render
    [token, orderId, adopt],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // E3: the parent's status moved (status card, automation elsewhere) → refresh
  // the checklist in place; `statusRef` holds the last status this card saw.
  useEffect(() => {
    if (!orderStatus || !statusRef.current || orderStatus === statusRef.current) return;
    statusRef.current = orderStatus;
    void load(true);
  }, [orderStatus, load]);

  const closed = !!ws && CLOSED_ORDER_STATUSES.includes(ws.order.status);

  // Server answer of a write: adopt summary, suggestion, status and the
  // stored check (who/when), then tell the parent when the status moved.
  const applyResult = (res: ProductionWriteResult) => {
    setWs((prev) => {
      if (!prev) return prev;
      let next = prev;
      if (res.check) {
        const stored = res.check;
        next = patchChecks(next, (c) => c.id === stored.id, () => stored);
      }
      return {
        ...next,
        summary: res.summary,
        suggestion: res.suggestion,
        order: res.order_status ? { ...next.order, status: res.order_status } : next.order,
      };
    });
    if (res.auto_advanced_to) setAutoMoved({ status: res.auto_advanced_to, reason: null });
    if (res.order_status && res.order_status !== statusRef.current) {
      statusRef.current = res.order_status;
      onOrderStatusChanged?.(res.order_status);
    }
    setLogVersion((v) => v + 1);
  };

  const toggle = async (check: ProductionCheck) => {
    // No single toggles while a bulk write runs: its error revert restores the
    // pre-bulk state and would otherwise discard them.
    if (!ws || closed || bulkBusy || check.stale || pending.has(check.id)) return;
    const done = !check.done;
    const before = ws;
    setError(null);
    setPending((p) => new Set(p).add(check.id));
    setWs((prev) => (prev ? patchChecks(prev, (c) => c.id === check.id, (c) => ({ ...c, done })) : prev));
    try {
      applyResult(await productionApi.setCheck(token, check.id, done));
    } catch (err) {
      // Revert only this check; other writes may have landed meanwhile.
      setWs((prev) => (prev ? patchChecks(prev, (c) => c.id === check.id, () => before.lines.flatMap((l) => l.checks).find((c) => c.id === check.id) ?? check) : prev));
      setError(apiError(err));
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(check.id);
        return next;
      });
    }
  };

  const bulk = async (done: boolean, line?: ProductionLine) => {
    if (!ws || closed || bulkBusy) return;
    const key = `${line?.order_item_id ?? 'all'}:${done}`;
    const before = ws;
    setError(null);
    setBulkBusy(key);
    const ownedIds = new Set(ws.lines.filter((l) => l.owned).map((l) => l.order_item_id));
    setWs(
      patchChecks(
        ws,
        (c) => !c.stale && ownedIds.has(c.order_item_id) && (!line || c.order_item_id === line.order_item_id),
        (c) => ({ ...c, done }),
      ),
    );
    try {
      const res = await productionApi.bulk(token, orderId, done, line?.order_item_id);
      applyResult(res);
      // Bulk results carry no per-check rows: reload for who/when.
      await load(true);
    } catch (err) {
      setWs(before);
      setError(apiError(err));
    } finally {
      setBulkBusy(null);
    }
  };

  const addCustom = async (line: ProductionLine) => {
    const label = addLabel.trim();
    if (!label || addBusy) return;
    setAddBusy(true);
    setError(null);
    try {
      await productionApi.addCustom(token, orderId, line.order_item_id, label);
      setAddLabel('');
      setAddingFor(null);
      await load(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setAddBusy(false);
    }
  };

  const removeCustom = async (check: ProductionCheck) => {
    if (removing) return;
    setRemoving(check.id);
    setError(null);
    try {
      await productionApi.removeCustom(token, check.id);
      await load(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setRemoving(null);
    }
  };

  const downloadOriginal = async (check: ProductionCheck) => {
    if (!check.upload_id || downloading) return;
    setDownloading(check.id);
    try {
      await downloadCustomerUploadOriginal(token, check.upload_id, check.value);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDownloading(null);
    }
  };

  // `print_files[].url` is a Bearer-protected route (a plain link answers
  // 401): fetched with the token and saved like OrderDesignCard does.
  const downloadPrint = async (file: ProductionPrintFile) => {
    if (downloading) return;
    setDownloading(`print-${file.order_item_id}`);
    try {
      // M5.6: the back file of a double-sided line is a second link.
      await downloadPrintFile(token, orderId, file.order_item_id, 'png', file.url.includes('side=back') ? 'back' : 'front');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDownloading(null);
    }
  };

  // "All done — move to X?" uses the normal status endpoint (timeline,
  // emails and payment capture behave exactly like a manual change). The
  // SHIPPED prompt (M5.4) adds carrier + tracking number to the same call.
  const shipPrompt = !!ws?.suggestion && ws.suggestion.next_status === 'SHIPPED' && ws.suggestion.ask_tracking;
  const trackingMissing = !!ws?.suggestion?.requires_tracking && !trackingNumber.trim();

  const applySuggestion = async () => {
    if (!ws?.suggestion || applying || trackingMissing) return;
    const status = ws.suggestion.next_status;
    setApplying(true);
    setError(null);
    try {
      const tracking = shipPrompt
        ? {
            ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
            ...(trackingNumber.trim() ? { tracking_number: trackingNumber.trim() } : {}),
          }
        : {};
      await api(`/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status, note: t('suggestion.note'), ...tracking }),
      });
      setConfirmOpen(false);
      setCarrier('');
      setTrackingNumber('');
      await load(true);
      onOrderStatusChanged?.(status);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setApplying(false);
    }
  };

  // ── Rendering ──────────────────────────────────────────────────────────

  const doneByTitle = (c: ProductionCheck) =>
    c.done && c.done_at
      ? t('doneBy', { name: c.done_by_name || t('someone'), time: new Date(c.done_at).toLocaleString(locale) })
      : undefined;

  const renderCheck = (c: ProductionCheck, line: ProductionLine) => {
    const busy = pending.has(c.id);
    const disabled = closed || c.stale || !line.owned || !!bulkBusy;
    const isImage = !!c.file_url && IMAGE_EXT_RE.test(c.file_url);
    return (
      <li
        key={c.id}
        className={cn(
          'group flex items-start gap-3 rounded-lg border px-2 py-1.5 transition-colors',
          c.done && !c.stale ? 'border-emerald-200 bg-emerald-50/50' : 'border-transparent hover:bg-muted/50',
          c.stale && 'opacity-60',
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={c.done}
          aria-label={[c.label, c.value].filter(Boolean).join(': ')}
          title={doneByTitle(c)}
          disabled={disabled}
          onClick={() => toggle(c)}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
        >
          <span
            className={cn(
              'flex items-center justify-center rounded-md border-2 transition-colors',
              workspace ? 'size-8' : 'size-6',
              c.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 bg-white',
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : c.done ? <Check className={workspace ? 'size-5' : 'size-4'} strokeWidth={3} /> : null}
          </span>
        </button>

        <div className="min-w-0 flex-1 py-1.5" title={doneByTitle(c)}>
          <p className={cn('break-words leading-snug', workspace ? 'text-base' : 'text-sm', c.stale && 'line-through')}>
            <span className={cn(c.value ? 'text-muted-foreground' : 'font-medium')}>{c.label}</span>
            {c.value && (
              <>
                <span className="text-muted-foreground">: </span>
                <span className={cn('font-semibold', workspace && 'text-lg')}>{c.value}</span>
              </>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {c.stale && (
              <Badge variant="outline" className="border-zinc-200 bg-zinc-100 text-[11px] text-zinc-600">
                {t('stale')}
              </Badge>
            )}
            {c.custom && <span>{t('customItem')}</span>}
            {c.done && c.done_at && (
              <span>
                ✓ {c.done_by_name || t('someone')}, {new Date(c.done_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </div>
          {c.file_url && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <a href={resolveMediaUrl(c.file_url)} target="_blank" rel="noreferrer" className="shrink-0">
                {isImage ? (
                  <img
                    src={resolveMediaUrl(c.file_url)}
                    alt={c.label}
                    className={cn('rounded-md border object-cover', workspace ? 'size-20' : 'size-14')}
                  />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-md border bg-muted">
                    <FileText className="size-5 text-muted-foreground" />
                  </span>
                )}
              </a>
              {c.file_removed ? (
                <span className="text-xs text-muted-foreground">{t('fileRemoved')}</span>
              ) : c.upload_id ? (
                <Button type="button" variant="outline" size="sm" disabled={downloading === c.id} onClick={() => downloadOriginal(c)}>
                  {downloading === c.id ? <Loader2 className="animate-spin" /> : <Download />}
                  {t('downloadOriginal')}
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {c.custom && !closed && line.owned && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={t('removeItem')}
            title={t('removeItem')}
            disabled={removing === c.id}
            onClick={() => removeCustom(c)}
          >
            {removing === c.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        )}
      </li>
    );
  };

  const renderLine = (line: ProductionLine) => {
    const sorted = [...line.checks].sort((a, b) => Number(a.stale) - Number(b.stale) || a.sort_order - b.sort_order);
    const lineDone = line.progress.total > 0 && line.progress.done >= line.progress.total;
    const busyKey = (done: boolean) => bulkBusy === `${line.order_item_id}:${done}`;
    return (
      <section key={line.order_item_id} className={cn('space-y-2', workspace ? 'rounded-xl border bg-white p-3' : 'py-3')}>
        <div className="flex items-start gap-3">
          {line.image_url ? (
            <img src={resolveMediaUrl(line.image_url)} alt={line.title} className="size-12 shrink-0 rounded-lg border object-cover" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Package className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('font-medium leading-snug', workspace ? 'text-base' : 'text-sm')}>{line.title}</p>
            <p className="text-xs text-muted-foreground">
              {line.variant_label ? `${line.variant_label} · ` : ''}
              {t('qty', { count: line.quantity })}
            </p>
            {line.owned && <ProductionProgressBar className="mt-1.5 max-w-xs" done={line.progress.done} total={line.progress.total} showReady={false} />}
          </div>
        </div>

        {!line.owned ? (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t('providerLine')}</p>
        ) : (
          <>
            {sorted.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">{t('noChecks')}</p>
            ) : (
              <ul className="space-y-1">{sorted.map((c) => renderCheck(c, line))}</ul>
            )}

            {!closed && (
              <div className="flex flex-wrap items-center gap-1.5">
                {sorted.some((c) => !c.stale) && (
                  <Button
                    type="button"
                    variant="outline"
                    size={workspace ? 'lg' : 'sm'}
                    disabled={!!bulkBusy}
                    onClick={() => bulk(!lineDone, line)}
                  >
                    {busyKey(!lineDone) ? <Loader2 className="animate-spin" /> : lineDone ? <RotateCcw /> : <CheckCheck />}
                    {lineDone ? t('uncheckAll') : t('checkAll')}
                  </Button>
                )}
                {addingFor === line.order_item_id ? (
                  <form
                    className="flex w-full items-center gap-1.5 sm:w-auto sm:flex-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addCustom(line);
                    }}
                  >
                    <Input
                      autoFocus
                      value={addLabel}
                      maxLength={PRODUCTION_LIMITS.label}
                      placeholder={t('addItemPlaceholder')}
                      onChange={(e) => setAddLabel(e.target.value)}
                      aria-label={t('addItem')}
                      className="h-11"
                    />
                    <Button type="submit" size={workspace ? 'lg' : 'sm'} className="h-11" disabled={addBusy || !addLabel.trim()}>
                      {addBusy ? <Loader2 className="animate-spin" /> : <Plus />}
                      {t('add')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size={workspace ? 'icon-lg' : 'icon-sm'}
                      className="size-11"
                      aria-label={tCommon('cancel')}
                      onClick={() => {
                        setAddingFor(null);
                        setAddLabel('');
                      }}
                    >
                      <X />
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size={workspace ? 'lg' : 'sm'}
                    onClick={() => {
                      setAddingFor(line.order_item_id);
                      setAddLabel('');
                    }}
                  >
                    <Plus />
                    {t('addItem')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    );
  };

  if (loading) {
    return (
      <Wrapper workspace={workspace} title={t('checklistTitle')}>
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </Wrapper>
    );
  }

  if (!ws) {
    return (
      <Wrapper workspace={workspace} title={t('checklistTitle')}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-destructive">{loadError ?? t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => load()}>
            {t('retry')}
          </Button>
        </div>
      </Wrapper>
    );
  }

  const owned = ws.lines.filter((l) => l.owned);
  const anyLive = owned.some((l) => l.checks.some((c) => !c.stale));
  const allDone = ws.summary.total > 0 && ws.summary.done >= ws.summary.total;

  const actions = (
    <div className="flex flex-wrap items-center gap-1.5">
      {!workspace && (
        <Link href={`/production/orders/${ws.order.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Smartphone />
          {t('openWorkspace')}
        </Link>
      )}
      <a
        href={`/production/orders/${ws.order.id}/sheet`}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: 'outline', size: workspace ? 'lg' : 'sm' })}
      >
        <Printer />
        {t('printSheet')}
      </a>
    </div>
  );

  return (
    <Wrapper workspace={workspace} title={t('checklistTitle')} actions={actions}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <ProductionProgressBar className="min-w-48 flex-1" size={workspace ? 'md' : 'sm'} done={ws.summary.done} total={ws.summary.total} />
          {!closed && anyLive && (
            <Button type="button" variant="ghost" size="sm" disabled={!!bulkBusy} onClick={() => bulk(!allDone)}>
              {bulkBusy?.startsWith('all:') ? <Loader2 className="animate-spin" /> : allDone ? <RotateCcw /> : <CheckCheck />}
              {allDone ? t('uncheckEverything') : t('checkEverything')}
            </Button>
          )}
        </div>

        {closed && (
          <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {t('closedNotice')}
          </div>
        )}

        {autoMoved && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            <span className="flex-1">
              {autoMoved.reason === 'print_ready'
                ? t('autoMovedPrintReady', { status: STATUS(autoMoved.status) })
                : t('autoMoved', { status: STATUS(autoMoved.status) })}
            </span>
            <button
              type="button"
              aria-label={tCommon('close')}
              onClick={() => setAutoMoved(null)}
              className="-my-3 -me-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-blue-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {ws.suggestion && !closed && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <CheckCheck className="size-4 shrink-0 text-emerald-700" />
            <p className="min-w-0 flex-1 text-sm font-medium text-emerald-800">
              {t('suggestion.text', { status: STATUS(ws.suggestion.next_status) })}
            </p>
            <Button type="button" size={workspace ? 'lg' : 'sm'} onClick={() => setConfirmOpen(true)}>
              {t('suggestion.action', { status: STATUS(ws.suggestion.next_status) })}
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              aria-label={tCommon('close')}
              onClick={() => setError(null)}
              className="-my-3 -me-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-destructive/10"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {ws.print_files.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('printFiles')}:</span>
            {ws.print_files.map((f) => {
              const busy = downloading === `print-${f.order_item_id}`;
              return (
                <button
                  key={`${f.order_item_id}-${f.url}`}
                  type="button"
                  disabled={!!downloading}
                  onClick={() => downloadPrint(f)}
                  className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        <div className={cn(workspace ? 'space-y-3' : 'divide-y')}>{ws.lines.map(renderLine)}</div>

        <ProductionActivityLog token={token} orderId={orderId} version={logVersion} />
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('suggestion.confirmTitle', { status: ws.suggestion ? STATUS(ws.suggestion.next_status) : '' })}</DialogTitle>
            <DialogDescription>
              {ws.suggestion?.next_status === 'SHIPPED' ? t('suggestion.confirmShipped') : t('suggestion.confirmBody')}
            </DialogDescription>
          </DialogHeader>
          {shipPrompt && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${orderId}-ship-carrier`} className="text-sm font-normal">{t('suggestion.carrier')}</Label>
                <Input
                  id={`${orderId}-ship-carrier`}
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder={t('suggestion.carrierPlaceholder')}
                  maxLength={80}
                  disabled={applying}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${orderId}-ship-tracking`} className="text-sm font-normal">
                  {t('suggestion.trackingNumber')}
                  {ws.suggestion?.requires_tracking && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  id={`${orderId}-ship-tracking`}
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder={t('suggestion.trackingPlaceholder')}
                  maxLength={120}
                  required={ws.suggestion?.requires_tracking}
                  disabled={applying}
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {ws.suggestion?.requires_tracking ? t('suggestion.trackingRequiredHint') : t('suggestion.trackingOptionalHint')}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="button" disabled={applying || trackingMissing} onClick={applySuggestion}>
              {applying && <Loader2 className="animate-spin" />}
              {ws.suggestion ? t('suggestion.action', { status: STATUS(ws.suggestion.next_status) }) : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}

/** Card chrome on the order page; plain section in the full-screen workspace. */
function Wrapper({
  workspace,
  title,
  actions,
  children,
}: {
  workspace: boolean;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (workspace) {
    return (
      <div className="space-y-3">
        {actions && <div className="flex justify-end">{actions}</div>}
        {children}
      </div>
    );
  }
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
