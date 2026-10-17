'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { APPLY_PHASES, type ImportRunView } from '@/lib/importer.api';

const STEPS = ['upload', 'plan', 'review', 'import', 'done'] as const;
type Step = (typeof STEPS)[number];

/** Current macro step of a run and whether it stopped there with an error. */
function stepOf(run: ImportRunView): { step: Step; failed: boolean } {
  switch (run.status) {
    case 'UPLOADED':
      return { step: 'upload', failed: false };
    case 'PLANNING':
      return { step: 'plan', failed: false };
    case 'PLAN_FAILED':
      return { step: 'plan', failed: true };
    case 'PLANNED':
      return { step: 'review', failed: false };
    case 'QUEUED':
    case 'RUNNING':
      return { step: 'import', failed: false };
    case 'FAILED':
    case 'CANCELLED':
      return { step: 'import', failed: true };
    default:
      return { step: 'done', failed: false };
  }
}

/**
 * Phase stepper (upload → plan → review → import → done) plus the progress
 * bar of the current worker phase (§9.1), fed by the 2 s poll.
 */
export function RunProgress({ run }: { run: ImportRunView }) {
  const t = useTranslations('creator.importer.phases');
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const { step, failed } = stepOf(run);
  const current = STEPS.indexOf(step);
  // Only a rollback in progress replaces the stepper; a finished one shows the stepper as done.
  const rollback = run.status === 'ROLLBACK_QUEUED' || run.status === 'ROLLING_BACK';

  const progress = run.progress;
  const total = Number(progress?.total ?? 0);
  const done = Math.min(Number(progress?.done ?? 0), total || Infinity);
  const pct = total > 0 ? Math.round((done / total) * 100) : null;
  const working = ['PLANNING', 'QUEUED', 'RUNNING', 'ROLLBACK_QUEUED', 'ROLLING_BACK'].includes(run.status);
  const phase = progress?.phase;
  const phaseIndex = phase ? (APPLY_PHASES as readonly string[]).indexOf(phase) : -1;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      {!rollback && (
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const isDone = i < current || (s === 'done' && step === 'done');
            const isCurrent = i === current && step !== 'done';
            const isFailed = isCurrent && failed;
            return (
              <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    isFailed
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : isDone
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : isCurrent
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 text-zinc-400'
                  }`}
                >
                  {isFailed ? <X className="size-3.5" /> : isDone ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={`truncate text-xs ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>{t(`steps.${s}`)}</span>
                {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-zinc-200 sm:block" />}
              </li>
            );
          })}
        </ol>
      )}

      {(working || rollback) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium">
              {phase && t.has(phase) ? t(phase) : rollback ? t('rollback') : run.status === 'PLANNING' ? t('planning') : t('waiting')}
            </span>
            {total > 0 && (
              <span className="tabular-nums text-muted-foreground">
                {nf.format(done)} / {nf.format(total)} {pct !== null && `(${pct}%)`}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            {pct !== null ? (
              <div className="h-full rounded-full bg-zinc-900 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            ) : (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-300" />
            )}
          </div>
          {run.status === 'RUNNING' && phaseIndex >= 0 && (
            <div className="flex flex-wrap gap-1">
              {APPLY_PHASES.map((p, i) => (
                <span
                  key={p}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    i < phaseIndex
                      ? 'bg-emerald-50 text-emerald-700'
                      : i === phaseIndex
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-50 text-zinc-400'
                  }`}
                >
                  {t(p)}
                </span>
              ))}
            </div>
          )}
          {run.cancel_requested_at && <p className="text-xs text-amber-700">{t('cancelRequested')}</p>}
        </div>
      )}
    </div>
  );
}
