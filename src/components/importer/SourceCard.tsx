'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, BadgeCheck, Clock, Download, Globe, Loader2, Pencil, Play, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApiError } from '@/lib/useApiError';
import { downloadExportScript, isRunnableKind, verifySource, type ImportRunView, type ImportSourceView } from '@/lib/importer.api';
import { BundleDropzone } from '@/components/importer/BundleDropzone';
import { ErrorBanner, RunStatusBadge, runLabel, useDateTimeFormat } from '@/components/importer/ImporterBits';

interface SourceCardProps {
  token: string;
  source: ImportSourceView;
  latestRun: ImportRunView | null;
  /** A run of this store is already active (one active run per store). */
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onVerified: (source: ImportSourceView) => void;
  onStartRun: (files: File[] | null, onProgress?: (fraction: number) => void) => Promise<void>;
  onOpenRun: (run: ImportRunView) => void;
}

/** One import source: bundle upload or REST verification, plus its latest run (§13 Sources). */
export function SourceCard({ token, source, latestRun, busy, onEdit, onDelete, onVerified, onStartRun, onOpenRun }: SourceCardProps) {
  const t = useTranslations('creator.importer.sources');
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const [working, setWorking] = useState<'verify' | 'script' | 'run' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBundle = source.kind === 'WP_BUNDLE';
  const Icon = isBundle ? Archive : Globe;

  const run = async (key: 'verify' | 'script' | 'run', fn: () => Promise<void>) => {
    setWorking(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setWorking(null);
    }
  };

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 py-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {source.name}
                <Badge variant="outline" className="font-normal">
                  {t(`kind.${source.kind}`)}
                </Badge>
                {!isRunnableKind(source.kind) && (
                  <Badge variant="outline" className="border-zinc-200 bg-zinc-50 font-normal text-zinc-500">
                    {t('later')}
                  </Badge>
                )}
              </p>
              <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                {source.site_host}
                {source.host_aliases.length > 0 && ` · ${source.host_aliases.join(', ')}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t('basesLine', {
                  product: source.settings?.product_base ?? '—',
                  category: source.settings?.category_base ?? '—',
                  locale: (source.settings?.locale ?? '—').toUpperCase(),
                  currency: source.settings?.currency ?? '—',
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-9 max-sm:size-11" onClick={onEdit} aria-label={t('edit')} title={t('edit')}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-destructive hover:text-destructive max-sm:size-11"
              onClick={onDelete}
              disabled={busy}
              aria-label={t('delete')}
              title={t('delete')}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        {isBundle ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <ol className="space-y-2 text-sm">
                {(['step1', 'step2', 'step3'] as const).map((s, i) => (
                  <li key={s} className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{t(`bundle.${s}`)}</span>
                  </li>
                ))}
              </ol>
              <Button variant="outline" size="sm" onClick={() => run('script', () => downloadExportScript(token))} disabled={!!working}>
                {working === 'script' ? <Loader2 className="animate-spin" /> : <Download />}
                {t('bundle.downloadScript')}
              </Button>
            </div>
            <BundleDropzone
              disabled={busy}
              describeError={describeError}
              onUpload={(files, onProgress) => onStartRun(files, onProgress)}
            />
          </div>
        ) : !isRunnableKind(source.kind) ? (
          // E4: REST sources cannot run yet. No key fields, no verify, no
          // dry run: a plain "coming later" note until the API supports them.
          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-zinc-50/40 p-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>{t('rest.comingLater')}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-zinc-50/40 p-3 text-sm">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-muted-foreground" />
              {source.has_credentials ? t('rest.keysSaved') : t('rest.keysMissing')}
            </span>
            {source.last_verified_at ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <BadgeCheck />
                {t('rest.verifiedAt', { date: formatDate(source.last_verified_at) })}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                {t('rest.notVerified')}
              </Badge>
            )}
            <div className="ms-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => run('verify', () => verifySource(token, source.id).then(onVerified))}
                disabled={!!working || !source.has_credentials}
              >
                {working === 'verify' ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
                {t('rest.verify')}
              </Button>
              <Button size="sm" onClick={() => run('run', () => onStartRun(null))} disabled={!!working || busy || !source.has_credentials}>
                {working === 'run' ? <Loader2 className="animate-spin" /> : <Play className="rtl:-scale-x-100" />}
                {t('rest.startDryRun')}
              </Button>
            </div>
          </div>
        )}

        {busy && <p className="text-xs text-muted-foreground">{t('busyHint')}</p>}
        {error && <ErrorBanner message={error} />}

        {latestRun && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span>{t('latestRun')}</span>
            <button type="button" className="font-mono font-medium text-primary hover:underline" dir="ltr" onClick={() => onOpenRun(latestRun)}>
              {runLabel(latestRun)}
            </button>
            <RunStatusBadge status={latestRun.status} />
            <span>{formatDate(latestRun.created_at)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
