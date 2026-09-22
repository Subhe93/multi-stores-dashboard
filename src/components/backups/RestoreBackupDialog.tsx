'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { describeBackupError, type Backup, type RestoreBackupResponse } from '@/lib/backups';

interface RestoreBackupDialogProps {
  backup: Backup | null;
  onClose: () => void;
  // Called after a successful restore so the list can show the PRE_RESTORE row.
  onRestored: (result: RestoreBackupResponse) => void;
}

const CONFIRM_PHRASE = 'RESTORE';

// Restore dialog: typed confirmation, optional uploads restore, then
// POST /admin/backups/:id/restore { confirm: 'RESTORE', restore_uploads }.
// The request is synchronous on the server (up to 10 minutes).
export function RestoreBackupDialog({ backup, onClose, onRestored }: RestoreBackupDialogProps) {
  const t = useTranslations('backups');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [phrase, setPhrase] = useState('');
  const [restoreUploads, setRestoreUploads] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RestoreBackupResponse | null>(null);

  // Reset the form each time a different backup is opened.
  useEffect(() => {
    setPhrase('');
    setRestoreUploads(false);
    setError('');
    setResult(null);
  }, [backup?.id]);

  const hasUploads = !!backup?.uploads_file;
  const confirmed = phrase.trim() === CONFIRM_PHRASE;

  const handleRestore = async () => {
    if (!token || !backup || !confirmed || restoring) return;
    setRestoring(true);
    setError('');
    try {
      const body = { confirm: CONFIRM_PHRASE, restore_uploads: hasUploads && restoreUploads };
      const res = await api<RestoreBackupResponse>(`/admin/backups/${backup.id}/restore`, { method: 'POST', token, body: JSON.stringify(body) });
      setResult(res);
      onRestored(res);
    } catch (err) {
      setError(describeBackupError(err, t, t('restoreFailed')));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={!!backup} onOpenChange={(open) => !open && !restoring && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!restoring}>
        <DialogHeader>
          <DialogTitle>{t('restoreTitle')}</DialogTitle>
          {backup && (
            <DialogDescription>
              {t('restoreOf', { date: new Date(backup.created_at).toLocaleString(locale) })}
            </DialogDescription>
          )}
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1 text-xs">
                <p className="font-medium">{t('restoreDone')}</p>
                <p>
                  {t('preRestoreBackupId')}: <code className="font-mono text-[11px]">{result.pre_restore_backup_id}</code>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('restoreReloadNote')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold">{t('restoreWarningTitle')}</p>
                <p>{t('restoreWarningReplace')}</p>
                <p>{t('restoreWarningPreBackup')}</p>
                <p>{t('restoreWarningDuration')}</p>
              </div>
            </div>

            <label className={`flex items-center gap-2 ${hasUploads ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
              <input
                type="checkbox"
                className="rounded accent-primary"
                checked={hasUploads && restoreUploads}
                disabled={!hasUploads || restoring}
                onChange={(e) => setRestoreUploads(e.target.checked)}
              />
              <span className="text-xs font-medium">{t('restoreUploads')}</span>
            </label>
            <p className="text-[10px] text-muted-foreground">{hasUploads ? t('restoreUploadsHint') : t('restoreUploadsUnavailable')}</p>

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="restore-confirm">{t('restoreTypeToConfirm', { phrase: CONFIRM_PHRASE })}</Label>
              <Input
                id="restore-confirm"
                className="h-8 font-mono text-sm"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                disabled={restoring}
              />
            </div>

            {restoring && (
              <p className="flex items-center gap-2 text-[11px] text-amber-700">
                <Loader2 className="size-3.5 animate-spin" />
                {t('restoreInProgress')}
              </p>
            )}
            {error && <p className="text-[11px] text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button size="sm" onClick={onClose}>{tc('close')}</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={restoring}>{tc('cancel')}</Button>
              <Button variant="destructive" size="sm" onClick={handleRestore} disabled={!confirmed || restoring}>
                {restoring && <Loader2 className="size-3.5 animate-spin" />}
                {t('restoreButton')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
