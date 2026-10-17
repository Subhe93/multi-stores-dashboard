'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Import, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppPageHeader } from '@/components/apps/AppPageHeader';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { SourcesTab } from '@/components/importer/SourcesTab';
import { RunsTab } from '@/components/importer/RunsTab';
import { RunDialog, type ImporterJump } from '@/components/importer/RunDialog';
import { MappingReviewTab } from '@/components/importer/MappingReviewTab';
import { RedirectsTab } from '@/components/importer/RedirectsTab';
import { ConfirmDialog, TechDetailsProvider, TechDetailsToggle } from '@/components/importer/ImporterBits';
import { useAuth } from '@/lib/auth';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';
import { listSources, type ImportRunView, type ImportSourceView } from '@/lib/importer.api';

const TABS = ['sources', 'runs', 'mapping', 'redirects'] as const;
/** Tabs shown while the app is turned off (read-only history and redirects). */
const READ_ONLY_TABS = ['runs', 'redirects'] as const;

/**
 * Page of the "importer" store app (M4.4 §13): sources and bundle upload,
 * import runs (dry-run report, live progress, confirm, rollback), mapping
 * review and the store's redirects.
 */
export default function CreatorImporterPage() {
  const t = useTranslations('creator.importer');
  const tm = useTranslations('creator.importer.mapping');
  const { token } = useAuth();
  const { apps, loading: appsLoading } = useStoreApps();
  const enabled = isAppEnabled(apps, 'importer');
  const [tab, changeTab] = useUrlTab(TABS, 'sources');

  // Run shown in the detail dialog.
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  // Run reviewed in the Mapping tab, and the field a jump asked to highlight.
  const [mappingRunId, setMappingRunId] = useState<string | null>(null);
  const [mappingFocus, setMappingFocus] = useState<string | null>(null);
  // E1: the mapping panel stays mounted once visited (`keepMounted`), so
  // unsaved edits survive a tab switch; leaving while dirty asks first.
  const [mappingVisited, setMappingVisited] = useState(false);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  // Bumped whenever a run starts or changes, so the lists reload.
  const [runsVersion, setRunsVersion] = useState(0);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});

  const bumpRuns = useCallback(() => setRunsVersion((v) => v + 1), []);
  const onSourcesLoaded = useCallback((list: ImportSourceView[]) => {
    setSourceNames(Object.fromEntries(list.map((s) => [s.id, s.name])));
  }, []);
  const openRun = useCallback((run: ImportRunView) => setOpenRunId(run.id), []);

  // Derived during render (no effect): the first visit mounts the panel for good.
  if (tab === 'mapping' && !mappingVisited) setMappingVisited(true);

  // Browser navigation / reload while the mapping has unsaved edits.
  useEffect(() => {
    if (!mappingDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [mappingDirty]);

  /** Runs `action` now, or after a confirm when the mapping has unsaved edits. */
  const guarded = useCallback(
    (action: () => void) => {
      if (mappingDirty) setPendingLeave(() => action);
      else action();
    },
    [mappingDirty],
  );

  const requestTab = useCallback(
    (next: string) => {
      if (next === tab) return;
      if (tab === 'mapping') guarded(() => changeTab(next));
      else changeTab(next);
    },
    [tab, guarded, changeTab],
  );

  // App off: the Sources tab is not mounted, so load the names for the runs list here.
  const appOff = !!apps && !enabled;
  useEffect(() => {
    if (!token || !appOff) return;
    let cancelled = false;
    listSources(token)
      .then((list) => !cancelled && onSourcesLoaded(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, appOff, onSourcesLoaded]);

  const selectMappingRun = useCallback(
    (id: string | null) => {
      const apply = () => {
        setMappingRunId(id);
        setMappingFocus(null);
        setMappingDirty(false);
      };
      if (id !== mappingRunId) guarded(apply);
      else apply();
    },
    [mappingRunId, guarded],
  );

  const jump = useCallback(
    (to: ImporterJump) => {
      const apply = () => {
        if (to.tab === 'mapping') {
          setMappingRunId(to.runId ?? null);
          setMappingFocus(to.focus ?? null);
          if ((to.runId ?? null) !== mappingRunId) setMappingDirty(false);
        }
        changeTab(to.tab);
      };
      const switchesRun = to.tab === 'mapping' && !!to.runId && to.runId !== mappingRunId;
      if (switchesRun) guarded(apply);
      else apply();
    },
    [changeTab, guarded, mappingRunId],
  );

  if (!token) return null;

  const header = <AppPageHeader icon={Import} title={t('title')} subtitle={t('subtitle')} />;

  if (appsLoading && !apps) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!enabled) {
    // App off: past runs and redirects stay viewable (redirects can still be
    // deleted); sources, mapping and every run action need the app.
    const readTab = (READ_ONLY_TABS as readonly string[]).includes(tab) ? tab : 'runs';
    return (
      <TechDetailsProvider>
        <div className="space-y-5">
          {header}
          <AppTurnedOff icon={Import} />

          <Tabs value={readTab} onValueChange={(v) => changeTab(String(v))}>
            <div className="flex items-center gap-2 border-b">
              <TabsList variant="line" className="flex-1 justify-start rounded-none px-0">
                {READ_ONLY_TABS.map((key) => (
                  <TabsTrigger key={key} value={key} className="flex-none px-3">
                    {t(`tabs.${key}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TechDetailsToggle />
            </div>
            <TabsContent value="runs" className="pt-4">
              {readTab === 'runs' && <RunsTab token={token} version={runsVersion} sourceNames={sourceNames} onOpen={openRun} />}
            </TabsContent>
            <TabsContent value="redirects" className="pt-4">
              {readTab === 'redirects' && <RedirectsTab token={token} readOnly />}
            </TabsContent>
          </Tabs>

          <RunDialog
            token={token}
            runId={openRunId}
            sourceNames={sourceNames}
            onOpenChange={(o) => !o && setOpenRunId(null)}
            onChanged={bumpRuns}
            onJump={jump}
            readOnly
          />
        </div>
      </TechDetailsProvider>
    );
  }

  return (
    <TechDetailsProvider>
      <div className="space-y-5">
        {header}

        <Tabs value={tab} onValueChange={(v) => requestTab(String(v))}>
          <div className="flex items-center gap-2 border-b">
            <TabsList variant="line" className="flex-1 justify-start rounded-none px-0">
              {TABS.map((key) => (
                <TabsTrigger key={key} value={key} className="flex-none px-3">
                  {t(`tabs.${key}`)}
                  {key === 'mapping' && mappingDirty && <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />}
                </TabsTrigger>
              ))}
            </TabsList>
            <TechDetailsToggle />
          </div>

          <TabsContent value="sources" className="pt-4">
            <SourcesTab
              token={token}
              version={runsVersion}
              onSourcesLoaded={onSourcesLoaded}
              onOpenRun={openRun}
              onRunStarted={(run) => {
                bumpRuns();
                changeTab('runs');
                setOpenRunId(run.id);
              }}
            />
          </TabsContent>

          <TabsContent value="runs" className="pt-4">
            <RunsTab token={token} version={runsVersion} sourceNames={sourceNames} onOpen={openRun} />
          </TabsContent>

          {/* keepMounted: the review form (and its unsaved edits) survives tab switches. */}
          <TabsContent value="mapping" className="pt-4" keepMounted>
            {mappingVisited && (
              <MappingReviewTab
                token={token}
                runId={mappingRunId}
                focus={mappingFocus}
                onSelectRun={selectMappingRun}
                onOpenRun={openRun}
                onChanged={bumpRuns}
                onDirtyChange={setMappingDirty}
              />
            )}
          </TabsContent>

          <TabsContent value="redirects" className="pt-4">
            {tab === 'redirects' && <RedirectsTab token={token} />}
          </TabsContent>
        </Tabs>

        <RunDialog
          token={token}
          runId={openRunId}
          sourceNames={sourceNames}
          onOpenChange={(o) => !o && setOpenRunId(null)}
          onChanged={bumpRuns}
          onJump={jump}
        />

        <ConfirmDialog
          open={!!pendingLeave}
          title={tm('unsavedTitle')}
          description={tm('unsavedBody')}
          confirmLabel={tm('unsavedLeave')}
          destructive
          onConfirm={() => {
            const action = pendingLeave;
            setPendingLeave(null);
            action?.();
          }}
          onOpenChange={(o) => !o && setPendingLeave(null)}
        />
      </div>
    </TechDetailsProvider>
  );
}
