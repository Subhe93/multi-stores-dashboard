'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { runBulk } from '@/lib/bulk';

/** Summary of the last bulk run, shown as an inline notice above the table. */
interface BulkOutcome {
  ok: number;
  failed: number;
  /** Success text built by the caller, e.g. "3 deleted". */
  message: string;
  firstError?: string;
}

interface BulkRunOptions<T> {
  rows: T[];
  fn: (row: T) => Promise<unknown>;
  /** Builds the success text from the number of rows that succeeded. */
  done: (ok: number) => string;
  /** Clears the table selection (the `clear` argument of DataTable.bulkActions). */
  clear?: () => void;
  /** Refreshes the list after the run (called even when some rows failed). */
  after?: () => void;
  /** Parallel requests (default 4; use 1 for downloads or throttled endpoints). */
  concurrency?: number;
}

interface BulkAskOptions<T> extends BulkRunOptions<T> {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  destructive?: boolean;
}

/**
 * Shared plumbing for DataTable bulk actions: runs a single-item endpoint over
 * the selected rows (via runBulk), optionally behind a ConfirmDialog, then
 * refreshes, clears the selection and exposes an inline result notice.
 *
 * Render `dialog` anywhere in the page and `notice` above the table.
 */
export function useBulkAction() {
  const t = useTranslations('bulk');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  // Stored untyped: the pending request is only ever handed back to `run`.
  const [pending, setPending] = useState<BulkAskOptions<unknown> | null>(null);

  const run = async <T,>({ rows, fn, done, clear, after, concurrency }: BulkRunOptions<T>) => {
    if (rows.length === 0 || busy) return;
    setBusy(true);
    setOutcome(null);
    const res = await runBulk(rows, fn, concurrency);
    setBusy(false);
    setPending(null);
    setOutcome({
      ok: res.ok.length,
      failed: res.failed.length,
      message: done(res.ok.length),
      firstError: res.failed[0]?.error,
    });
    // Keep the failed rows selected only when nothing went through; otherwise
    // the list changes and a fresh selection is clearer.
    if (res.ok.length > 0) clear?.();
    after?.();
  };

  const ask = <T,>(opts: BulkAskOptions<T>) => {
    setOutcome(null);
    setPending(opts as BulkAskOptions<unknown>);
  };

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => { if (!o) setPending(null); }}
      title={pending?.title}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      destructive={pending?.destructive}
      busy={busy}
      busyLabel={t('working')}
      onConfirm={() => { if (pending) void run(pending); }}
    />
  );

  const notice = outcome ? (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
        outcome.failed > 0
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      <span>
        {outcome.ok > 0 && outcome.message}
        {outcome.ok > 0 && outcome.failed > 0 && ' · '}
        {outcome.failed > 0 && t('failedCount', { count: outcome.failed })}
        {outcome.firstError && `: ${outcome.firstError}`}
      </span>
      <button
        type="button"
        onClick={() => setOutcome(null)}
        className="shrink-0 opacity-70 hover:opacity-100"
        aria-label={t('dismiss')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  ) : null;

  return { run, ask, busy, dialog, notice, dismiss: () => setOutcome(null) };
}
