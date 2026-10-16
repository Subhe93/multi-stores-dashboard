'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Import, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApiError } from '@/lib/useApiError';
import {
  DEFAULT_RUN_OPTIONS,
  createRun,
  deleteSource,
  isActiveRun,
  listRuns,
  listSources,
  type ImportRunView,
  type ImportSourceView,
} from '@/lib/importer.api';
import { ConfirmDialog, ErrorBanner, SpinnerBlock } from '@/components/importer/ImporterBits';
import { SourceCard } from '@/components/importer/SourceCard';
import { SourceDialog } from '@/components/importer/SourceDialog';

interface SourcesTabProps {
  token: string;
  /** Bumped by the page when runs change, so the "latest run" lines refresh. */
  version: number;
  onSourcesLoaded: (sources: ImportSourceView[]) => void;
  onRunStarted: (run: ImportRunView) => void;
  onOpenRun: (run: ImportRunView) => void;
}

/** Sources tab (§13): one card per WordPress bundle or WooCommerce REST source. */
export function SourcesTab({ token, version, onSourcesLoaded, onRunStarted, onOpenRun }: SourcesTabProps) {
  const t = useTranslations('creator.importer.sources');
  const describeError = useApiError();
  const [sources, setSources] = useState<ImportSourceView[] | null>(null);
  const [runs, setRuns] = useState<ImportRunView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<ImportSourceView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ImportSourceView | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSources(token)
      .then((list) => {
        if (cancelled) return;
        setSources(list);
        setError(null);
        onSourcesLoaded(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
    // describeError and onSourcesLoaded are stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, attempt]);

  const loadRuns = useCallback(() => {
    listRuns(token, { page: 1, limit: 50 })
      .then((res) => setRuns(res.items ?? []))
      .catch(() => setRuns([]));
  }, [token]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns, version]);

  // Newest run per source (the list is newest first).
  const latestBySource = useMemo(() => {
    const map: Record<string, ImportRunView> = {};
    for (const r of runs) if (!map[r.source_id]) map[r.source_id] = r;
    return map;
  }, [runs]);
  const anyActive = runs.some((r) => isActiveRun(r.status));

  const replaceSource = (next: ImportSourceView) => {
    const list = sources ?? [];
    const updated = list.some((s) => s.id === next.id) ? list.map((s) => (s.id === next.id ? next : s)) : [...list, next];
    setSources(updated);
    onSourcesLoaded(updated);
  };

  /**
   * Starts a dry run. Options come from the newest run of the same source,
   * so re-runs keep the merchant's mapping; a first run uses the defaults.
   */
  const startRun = async (source: ImportSourceView, files: File[] | null, onProgress?: (fraction: number) => void) => {
    let options = latestBySource[source.id]?.options ?? null;
    if (!options) {
      try {
        const res = await listRuns(token, { source_id: source.id, page: 1, limit: 1 });
        options = res.items?.find((r) => r.source_id === source.id)?.options ?? null;
      } catch {
        options = null;
      }
    }
    const run = await createRun(token, { source_id: source.id, options: options ?? DEFAULT_RUN_OPTIONS, files }, onProgress);
    loadRuns();
    onRunStarted(run);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteSource(token, deleting.id);
      const next = (sources ?? []).filter((s) => s.id !== deleting.id);
      setSources(next);
      onSourcesLoaded(next);
      setDeleting(null);
    } catch (err) {
      setDeleteError(describeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!sources && !error) return <SpinnerBlock />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('intro')}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          {t('add')}
        </Button>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw /> {t('retry')}
            </Button>
          }
        />
      )}

      {sources && sources.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Import className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus />
              {t('add')}
            </Button>
          </CardContent>
        </Card>
      )}

      {(sources ?? []).map((source) => (
        <SourceCard
          key={source.id}
          token={token}
          source={source}
          latestRun={latestBySource[source.id] ?? null}
          busy={anyActive}
          onEdit={() => {
            setEditing(source);
            setDialogOpen(true);
          }}
          onDelete={() => {
            setDeleteError(null);
            setDeleting(source);
          }}
          onVerified={replaceSource}
          onStartRun={(files, onProgress) => startRun(source, files, onProgress)}
          onOpenRun={onOpenRun}
        />
      ))}

      <SourceDialog token={token} open={dialogOpen} source={editing} onOpenChange={setDialogOpen} onSaved={replaceSource} />

      <ConfirmDialog
        open={!!deleting}
        title={t('deleteTitle')}
        description={t('deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('delete')}
        destructive
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </div>
  );
}
