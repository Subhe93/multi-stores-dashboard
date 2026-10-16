'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRun, isActiveRun, type ImportRunView } from '@/lib/importer.api';

/** Poll interval while a run is being planned, applied or rolled back (§13). */
export const RUN_POLL_MS = 2000;
/** Slower poll once the worker looks stuck, so an idle dialog does not hammer the API. */
export const RUN_POLL_STALLED_MS = 15000;
/** A run waiting this long for a worker (UPLOADED / QUEUED / ROLLBACK_QUEUED) counts as stalled. */
export const RUN_STALL_MS = 2 * 60 * 1000;

/** Statuses that only change once a worker picks the run up. */
const WAITING_FOR_WORKER = new Set<string>(['UPLOADED', 'QUEUED', 'ROLLBACK_QUEUED']);

interface UseImporterRunResult {
  run: ImportRunView | null;
  loading: boolean;
  /** Last fetch error; polling keeps going so a transient failure recovers. */
  error: unknown;
  refresh: () => Promise<void>;
  /** Replace the local copy (e.g. with the response of confirm/cancel). */
  setRun: (run: ImportRunView) => void;
  /** The run has waited for a worker for over 2 minutes; polling has slowed down. */
  stalled: boolean;
}

/**
 * Loads one import run and polls it every 2 s while it is active
 * (UPLOADED / PLANNING / QUEUED / RUNNING / ROLLBACK_QUEUED / ROLLING_BACK).
 * Polling pauses while the tab is hidden and resumes when it is visible again.
 * `onSettled` fires once whenever an active run reaches a resting status, so
 * callers can refresh their lists. A run that sits in a waiting status for
 * over 2 minutes is reported as `stalled` (the worker may be down) and is
 * then polled every 15 s instead of every 2 s.
 */
export function useImporterRun(
  token: string | null,
  runId: string | null,
  onSettled?: (run: ImportRunView) => void,
): UseImporterRunResult {
  // State is keyed by run id, so switching runs never shows the previous one.
  const [state, setState] = useState<{ id: string; run: ImportRunView } | null>(null);
  const [failure, setFailure] = useState<{ id: string; error: unknown } | null>(null);
  const wasActive = useRef<Record<string, boolean>>({});
  // When the run entered its current status (per run id), to detect a stuck worker.
  const statusSince = useRef<Record<string, { status: string; since: number }>>({});
  const [stalledId, setStalledId] = useState<string | null>(null);
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  const apply = useCallback((next: ImportRunView) => {
    setState({ id: next.id, run: next });
    setFailure((f) => (f?.id === next.id ? null : f));
    const active = isActiveRun(next.status);
    if (wasActive.current[next.id] && !active) settledRef.current?.(next);
    wasActive.current[next.id] = active;

    const now = Date.now();
    const prev = statusSince.current[next.id];
    if (!prev || prev.status !== next.status) {
      // Measure from the server's last update when it is older (a reopened dialog).
      const updated = next.updated_at ? Date.parse(next.updated_at) : NaN;
      const since = Number.isFinite(updated) && updated < now ? updated : now;
      statusSince.current[next.id] = { status: next.status, since };
    }
    const waited = now - statusSince.current[next.id]!.since;
    const isStalled = WAITING_FOR_WORKER.has(next.status) && waited > RUN_STALL_MS;
    setStalledId((cur) => (isStalled ? next.id : cur === next.id ? null : cur));
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !runId) return;
    try {
      apply(await getRun(token, runId));
    } catch (err) {
      setFailure({ id: runId, error: err });
    }
  }, [token, runId, apply]);

  // Initial load whenever the selected run changes.
  useEffect(() => {
    if (!token || !runId) return;
    let cancelled = false;
    getRun(token, runId)
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure({ id: runId, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [token, runId, apply]);

  const run = runId && state?.id === runId ? state.run : null;
  const error = runId && failure?.id === runId ? failure.error : null;
  const stalled = !!run && stalledId === run.id && isActiveRun(run.status);

  // Poll while active. A timeout chain (not an interval) so a slow response
  // never stacks requests.
  const active = isActiveRun(run?.status);
  useEffect(() => {
    if (!active || !token || !runId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible') await refresh();
      if (!stopped) timer = setTimeout(tick, stalled ? RUN_POLL_STALLED_MS : RUN_POLL_MS);
    };
    timer = setTimeout(tick, stalled ? RUN_POLL_STALLED_MS : RUN_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, stalled, token, runId, refresh]);

  return { run, loading: !!runId && !run && !error, error, refresh, setRun: apply, stalled };
}
