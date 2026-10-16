'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, FileSearch, Loader2, Play, RefreshCw, RotateCcw, SlidersHorizontal, Square, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiError } from '@/lib/useApiError';
import { useImporterRun } from '@/lib/useImporterRun';
import {
  canEditOptions,
  canRollback,
  cancelRun,
  confirmRun,
  deleteRun,
  downloadRunReport,
  isActiveRun,
  parseRunError,
  rollbackRun,
  updateRunOptions,
  type ImportRunView,
} from '@/lib/importer.api';
import {
  ConfirmDialog,
  ErrorBanner,
  RunStatusBadge,
  SpinnerBlock,
  formatBytes,
  runLabel,
  useDateTimeFormat,
  useErrorCodeText,
  useRunErrorText,
} from '@/components/importer/ImporterBits';
import { RunProgress } from '@/components/importer/RunProgress';
import { DryRunReport } from '@/components/importer/DryRunReport';
import { RunLogs } from '@/components/importer/RunLogs';
import { RollbackItems } from '@/components/importer/RollbackItems';

/** Where a run error can be fixed: the page switches tab and focuses the field. */
export type ImporterJump = { tab: 'sources' | 'mapping'; runId?: string; focus?: string };

/** Error codes the merchant fixes in Mapping review or by uploading a new bundle. */
const JUMP_FOR_CODE: Record<string, ImporterJump['tab']> = {
  IMPORT_PLATFORM_CATEGORY_REQUIRED: 'mapping',
  IMPORT_BUNDLE_TOO_LARGE: 'sources',
  IMPORT_BUNDLE_INVALID_ARCHIVE: 'sources',
  IMPORT_BUNDLE_UNEXPECTED_FILE: 'sources',
  IMPORT_BUNDLE_MISSING_FILE: 'sources',
  IMPORT_BUNDLE_BOMB: 'sources',
  IMPORT_BUNDLE_PARSE_FAILED: 'sources',
  IMPORT_SOURCE_CREDENTIALS_INVALID: 'sources',
  IMPORT_SOURCE_HOST_INVALID: 'sources',
  IMPORT_SOURCE_KIND_UNSUPPORTED: 'sources',
  IMPORT_RUN_OPTIONS_INVALID: 'mapping',
};

/** Entities whose CREATE count is listed in the confirm and rollback dialogs. */
const KEY_ENTITIES = ['PRODUCT', 'VARIANT', 'CATEGORY', 'IMAGE', 'MEDIA', 'SHIPPING_PROFILE', 'REDIRECT'] as const;

type Pending = 'confirm' | 'rollback' | 'delete' | null;

interface RunDialogProps {
  token: string;
  runId: string | null;
  sourceNames: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  /** Called after any status change, so the runs list can refresh. */
  onChanged: () => void;
  onJump: (jump: ImporterJump) => void;
  /** App turned off: the run can be viewed, but not confirmed, cancelled, rolled back, edited or deleted. */
  readOnly?: boolean;
}

/**
 * Run detail (§13 "run detail drawer", as a large dialog): phase stepper and
 * live progress, the dry-run / apply report, logs, and the confirm, cancel,
 * roll back and delete actions.
 */
export function RunDialog({ token, runId, sourceNames, onOpenChange, onChanged, onJump, readOnly = false }: RunDialogProps) {
  const t = useTranslations('creator.importer.run');
  const te = useTranslations('creator.importer.entities');
  const locale = useLocale();
  const describeError = useApiError();
  const runErrorText = useRunErrorText();
  const codeText = useErrorCodeText();
  const formatDate = useDateTimeFormat();
  const { run, loading, error: loadError, stalled, refresh, setRun } = useImporterRun(token, runId, onChanged);

  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [view, setView] = useState<'report' | 'logs'>('report');

  const open = !!runId;
  const close = () => {
    setPending(null);
    setActionError(null);
    setStale(false);
    setView('report');
    onOpenChange(false);
  };

  const act = async (key: string, fn: () => Promise<ImportRunView | unknown>, after?: (res: unknown) => void) => {
    setBusy(key);
    setActionError(null);
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'id' in res && 'status' in res) setRun(res as ImportRunView);
      else if (key !== 'delete') await refresh();
      after?.(res);
      onChanged();
      return true;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'IMPORT_PLAN_STALE') {
        setStale(true);
        setPending(null);
      } else if (code === 'IMPORT_PLATFORM_CATEGORY_REQUIRED' && run) {
        // Friendly jump: the missing field lives in Mapping review.
        close();
        onJump({ tab: 'mapping', runId: run.id, focus: 'platform_category_id' });
      } else {
        setActionError(describeError(err));
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  const replan = () => run && act('replan', () => updateRunOptions(token, run.id, run.options ?? {}), () => setStale(false));

  const runError = run ? parseRunError(run.error) : null;
  const jumpTab = !readOnly && runError?.code ? JUMP_FOR_CODE[runError.code] : undefined;
  const summary = run?.summary ?? null;
  const blockers = summary?.plan?.blockers ?? [];
  // Confirm lists what the plan would write.
  const createCounts = KEY_ENTITIES.map((e) => ({ e, n: summary?.counts?.[e]?.CREATE ?? 0, u: summary?.counts?.[e]?.UPDATE ?? 0 })).filter(
    (x) => x.n > 0 || x.u > 0,
  );
  // Rollback lists what the import actually created (apply counts; the plan's when the apply wrote none).
  const createdCounts = KEY_ENTITIES.map((e) => ({
    e,
    n: (summary?.apply?.counts ?? summary?.counts)?.[e]?.CREATE ?? 0,
  })).filter((x) => x.n > 0);
  const nf = new Intl.NumberFormat(locale);
  const active = isActiveRun(run?.status);
  const cancellable = !!run && ['UPLOADED', 'PLANNING', 'QUEUED', 'RUNNING'].includes(run.status) && !run.cancel_requested_at;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t('title', { label: run ? runLabel(run) : '' })}
            {run && <RunStatusBadge status={run.status} />}
          </DialogTitle>
          <DialogDescription>
            {run
              ? t('meta', {
                  source: run.source?.name ?? sourceNames[run.source_id] ?? '—',
                  created: formatDate(run.created_at),
                  size: formatBytes(run.bundle_bytes, locale),
                })
              : ' '}
          </DialogDescription>
        </DialogHeader>

        {!run && loading && <SpinnerBlock />}
        {!run && !!loadError && <ErrorBanner message={describeError(loadError)} />}

        {run && (
          <div className="space-y-4">
            <RunProgress run={run} />

            {stale && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {t('staleBanner')}
                </span>
                <Button size="sm" variant="outline" onClick={replan} disabled={!!busy}>
                  {busy === 'replan' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {t('replan')}
                </Button>
              </div>
            )}

            {runError && (
              <ErrorBanner
                message={runErrorText(run) ?? ''}
                action={
                  jumpTab && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        close();
                        onJump({
                          tab: jumpTab,
                          runId: run.id,
                          focus: runError.code === 'IMPORT_PLATFORM_CATEGORY_REQUIRED' ? 'platform_category_id' : undefined,
                        });
                      }}
                    >
                      {jumpTab === 'mapping' ? t('fixInMapping') : t('fixInSources')}
                    </Button>
                  )
                }
              />
            )}

            {actionError && <ErrorBanner message={actionError} />}

            {stalled && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">{t('stalled')}</span>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  <RefreshCw />
                  {t('checkAgain')}
                </Button>
              </div>
            )}

            {run.status === 'PLANNED' && blockers.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="size-4 shrink-0" />
                  {t('blockersTitle')}
                </p>
                <ul className="list-disc space-y-1 ps-9">
                  {blockers.map((b, i) => (
                    <li key={`${b.code}:${i}`}>
                      {codeText(b.code, b.message)}
                      {!readOnly && b.code === 'IMPORT_PLATFORM_CATEGORY_REQUIRED' && (
                        <Button
                          size="sm"
                          variant="link"
                          className="h-auto px-1.5 py-0 text-red-700"
                          onClick={() => {
                            close();
                            onJump({ tab: 'mapping', runId: run.id, focus: 'platform_category_id' });
                          }}
                        >
                          {t('fixInMapping')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly && run.status === 'PLANNED' && (
                <Button onClick={() => setPending('confirm')} disabled={!run.plan_fingerprint || stale || blockers.length > 0 || !!busy}>
                  <Play className="rtl:-scale-x-100" />
                  {t('confirm')}
                </Button>
              )}
              {!readOnly && canEditOptions(run.status) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    close();
                    onJump({ tab: 'mapping', runId: run.id });
                  }}
                >
                  <SlidersHorizontal />
                  {t('reviewMapping')}
                </Button>
              )}
              {!readOnly && cancellable && (
                <Button variant="outline" onClick={() => act('cancel', () => cancelRun(token, run.id))} disabled={!!busy}>
                  {busy === 'cancel' ? <Loader2 className="animate-spin" /> : <Square />}
                  {t('cancel')}
                </Button>
              )}
              {!readOnly && canRollback(run) && (
                <Button variant="outline" onClick={() => setPending('rollback')} disabled={!!busy}>
                  <RotateCcw />
                  {t('rollback')}
                </Button>
              )}
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {summary && (
                  <Button
                    variant="ghost"
                    onClick={() => act('csv', () => downloadRunReport(token, run.id).then(() => run))}
                    disabled={!!busy}
                  >
                    {busy === 'csv' ? <Loader2 className="animate-spin" /> : <Download />}
                    {t('downloadCsv')}
                  </Button>
                )}
                {!readOnly && !active && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPending('delete')}
                    disabled={!!busy}
                  >
                    <Trash2 />
                    {t('delete')}
                  </Button>
                )}
              </div>
            </div>
            {run.status === 'PLANNED' && !run.plan_fingerprint && <p className="text-xs text-muted-foreground">{t('noFingerprint')}</p>}

            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList variant="line" className="w-full justify-start rounded-none border-b px-0">
                <TabsTrigger value="report" className="flex-none px-3">
                  {t('tabs.report')}
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex-none px-3">
                  {t('tabs.logs')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="report" className="pt-4">
                {summary ? (
                  <div className="space-y-6">
                    <DryRunReport summary={summary} />
                    {(summary.rollback || run.status === 'ROLLED_BACK' || run.status === 'ROLLBACK_FAILED') && (
                      <RollbackItems token={token} runId={run.id} version={run.status} />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <FileSearch className="size-6" />
                    {active ? t('reportPending') : t('noReport')}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="logs" className="pt-4">
                <RunLogs token={token} runId={run.id} version={`${run.status}:${run.progress?.phase ?? ''}`} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Confirm import */}
        <ConfirmDialog
          open={pending === 'confirm'}
          title={t('confirmTitle')}
          description={t('confirmBody')}
          confirmLabel={t('confirm')}
          busy={busy === 'confirm'}
          error={pending === 'confirm' ? actionError : null}
          onOpenChange={(o) => !o && setPending(null)}
          onConfirm={() =>
            run?.plan_fingerprint &&
            act('confirm', () => confirmRun(token, run.id, run.plan_fingerprint!)).then((ok) => ok && setPending(null))
          }
        >
          {createCounts.length > 0 && (
            <ul className="space-y-1 rounded-md border bg-zinc-50/60 p-3 text-sm">
              {createCounts.map(({ e, n, u }) => (
                <li key={e} className="flex justify-between gap-3">
                  <span>{te.has(e) ? te(e) : e}</span>
                  <span className="tabular-nums text-muted-foreground">{t('confirmCounts', { created: nf.format(n), updated: nf.format(u) })}</span>
                </li>
              ))}
            </ul>
          )}
        </ConfirmDialog>

        {/* Roll back */}
        <ConfirmDialog
          open={pending === 'rollback'}
          title={t('rollbackTitle')}
          description={t('rollbackBody')}
          confirmLabel={t('rollback')}
          destructive
          busy={busy === 'rollback'}
          error={pending === 'rollback' ? actionError : null}
          onOpenChange={(o) => !o && setPending(null)}
          onConfirm={() => run && act('rollback', () => rollbackRun(token, run.id)).then((ok) => ok && setPending(null))}
        >
          <div className="space-y-2 text-sm">
            {createdCounts.length > 0 && (
              <ul className="space-y-1 rounded-md border bg-zinc-50/60 p-3">
                {createdCounts.map(({ e, n }) => (
                    <li key={e} className="flex justify-between gap-3">
                      <span>{te.has(e) ? te(e) : e}</span>
                      <span className="tabular-nums text-muted-foreground">{t('rollbackCount', { count: nf.format(n) })}</span>
                    </li>
                  ))}
              </ul>
            )}
            <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
              <li>{t('rollbackArchived')}</li>
              <li>{t('rollbackKept')}</li>
              <li>{t('rollbackRedirects')}</li>
            </ul>
          </div>
        </ConfirmDialog>

        {/* Delete run */}
        <ConfirmDialog
          open={pending === 'delete'}
          title={t('deleteTitle')}
          description={t('deleteBody')}
          confirmLabel={t('delete')}
          destructive
          busy={busy === 'delete'}
          error={pending === 'delete' ? actionError : null}
          onOpenChange={(o) => !o && setPending(null)}
          onConfirm={() =>
            run &&
            act('delete', () => deleteRun(token, run.id).then(() => null)).then((ok) => {
              if (ok) close();
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
