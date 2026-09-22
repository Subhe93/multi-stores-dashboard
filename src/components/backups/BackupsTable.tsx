'use client';

import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Database, FolderArchive, HardDrive, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  describeBackupError,
  downloadBackupFile,
  formatBytes,
  isBackupInFlight,
  type Backup,
  type BackupDiskInfo,
  type BackupFile,
  type BackupKind,
  type BackupStatus,
} from '@/lib/backups';
import { RestoreBackupDialog } from '@/components/backups/RestoreBackupDialog';

interface BackupsTableProps {
  items: Backup[];
  loading: boolean;
  error: string;
  running: boolean;
  disk: BackupDiskInfo | null;
  // Called after any mutation (delete / restore) so the parent refetches.
  onChanged: () => void;
}

const STATUS_CLASSES: Record<BackupStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  RUNNING: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-red-200 bg-red-50 text-red-700',
};

const KIND_CLASSES: Record<BackupKind, string> = {
  MANUAL: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  SCHEDULED: 'border-sky-200 bg-sky-50 text-sky-700',
  PRE_RESTORE: 'border-purple-200 bg-purple-50 text-purple-700',
};

// Backup rows with download / restore / delete actions, expandable error
// lines for FAILED rows, and the disk free-space line.
export function BackupsTable({ items, loading, error, running, disk, onChanged }: BackupsTableProps) {
  const t = useTranslations('backups');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null); // `${id}:${file}`
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const setRowError = (id: string, message: string) => setRowErrors((prev) => ({ ...prev, [id]: message }));
  const clearRowError = (id: string) =>
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const toggleError = (id: string) =>
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDownload = async (backup: Backup, file: BackupFile) => {
    if (!token || downloading) return;
    const key = `${backup.id}:${file}`;
    setDownloading(key);
    clearRowError(backup.id);
    try {
      await downloadBackupFile(backup, file, token);
    } catch (err) {
      setRowError(backup.id, describeBackupError(err, t, t('downloadFailed')));
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (backup: Backup) => {
    if (!token || deletingId) return;
    setDeletingId(backup.id);
    clearRowError(backup.id);
    try {
      await api<{ deleted: boolean }>(`/admin/backups/${backup.id}`, { method: 'DELETE', token });
      setConfirmDeleteId(null);
      onChanged();
    } catch (err) {
      setRowError(backup.id, describeBackupError(err, t, t('deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  };

  const kindLabel = (kind: BackupKind) =>
    kind === 'MANUAL' ? t('kindManual') : kind === 'SCHEDULED' ? t('kindScheduled') : t('kindPreRestore');
  const statusLabel = (status: BackupStatus) =>
    status === 'PENDING'
      ? t('statusPending')
      : status === 'RUNNING'
        ? t('statusRunning')
        : status === 'COMPLETED'
          ? t('statusCompleted')
          : t('statusFailed');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('listTitle')}</h2>
        {disk && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title={disk.dir}>
            <HardDrive className="size-3.5" />
            {t('diskFree', { size: formatBytes(disk.free_bytes, locale) })}
            <span className="hidden font-mono text-[10px] sm:inline">({disk.dir})</span>
          </p>
        )}
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colDate')}</TableHead>
                <TableHead>{t('colKind')}</TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead className="text-end">{t('colDbSize')}</TableHead>
                <TableHead className="text-end">{t('colUploadsSize')}</TableHead>
                <TableHead>{t('note')}</TableHead>
                <TableHead className="text-end">{tc('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">{tc('loading')}</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">{t('noBackups')}</TableCell>
                </TableRow>
              ) : (
                items.map((backup) => {
                  const inFlight = isBackupInFlight(backup);
                  const completed = backup.status === 'COMPLETED';
                  const errorOpen = expandedErrors.has(backup.id);
                  const confirming = confirmDeleteId === backup.id;
                  const deleting = deletingId === backup.id;
                  const rowError = rowErrors[backup.id];
                  return (
                    <Fragment key={backup.id}>
                      <TableRow>
                        <TableCell className="text-xs whitespace-nowrap">
                          <div>{new Date(backup.created_at).toLocaleString(locale)}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{backup.id.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${KIND_CLASSES[backup.kind] || ''}`}>
                            {kindLabel(backup.kind)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_CLASSES[backup.status] || ''}`}>
                              {inFlight && <Loader2 className="animate-spin" />}
                              {statusLabel(backup.status)}
                            </Badge>
                            {backup.status === 'FAILED' && backup.error && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-6"
                                onClick={() => toggleError(backup.id)}
                                aria-expanded={errorOpen}
                                aria-label={t('showError')}
                                title={t('showError')}
                              >
                                {errorOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-end tabular-nums whitespace-nowrap">{formatBytes(backup.db_size_bytes, locale)}</TableCell>
                        <TableCell className="text-xs text-end tabular-nums whitespace-nowrap">
                          {backup.includes_uploads ? formatBytes(backup.uploads_size_bytes, locale) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-xs" title={backup.note || undefined}>
                          {backup.note || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-end">
                          {confirming ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[11px] text-red-700">{t('deleteConfirm')}</span>
                              <Button variant="destructive" size="sm" className="h-7" onClick={() => handleDelete(backup)} disabled={deleting}>
                                {deleting && <Loader2 className="size-3.5 animate-spin" />}
                                {tc('delete')}
                              </Button>
                              <Button variant="outline" size="sm" className="h-7" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
                                {tc('cancel')}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title={t('downloadDb')}
                                aria-label={t('downloadDb')}
                                disabled={!completed || !backup.db_file || !!downloading}
                                onClick={() => handleDownload(backup, 'db')}
                              >
                                {downloading === `${backup.id}:db` ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
                              </Button>
                              {backup.uploads_file && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title={t('downloadUploads')}
                                  aria-label={t('downloadUploads')}
                                  disabled={!completed || !!downloading}
                                  onClick={() => handleDownload(backup, 'uploads')}
                                >
                                  {downloading === `${backup.id}:uploads` ? <Loader2 className="size-3.5 animate-spin" /> : <FolderArchive className="size-3.5" />}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title={t('restore')}
                                aria-label={t('restore')}
                                disabled={!completed || !backup.db_file || running}
                                onClick={() => setRestoreTarget(backup)}
                              >
                                <RotateCcw className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-red-600 hover:text-red-700"
                                title={tc('delete')}
                                aria-label={tc('delete')}
                                disabled={backup.status === 'RUNNING' || !!deletingId}
                                onClick={() => setConfirmDeleteId(backup.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {(rowError || (errorOpen && backup.error)) && (
                        <TableRow className="bg-red-50/60 hover:bg-red-50/60">
                          <TableCell colSpan={7} className="py-2">
                            {rowError && <p className="text-[11px] text-red-600">{rowError}</p>}
                            {errorOpen && backup.error && (
                              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-red-700">{backup.error}</pre>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RestoreBackupDialog backup={restoreTarget} onClose={() => setRestoreTarget(null)} onRestored={() => onChanged()} />
    </div>
  );
}
