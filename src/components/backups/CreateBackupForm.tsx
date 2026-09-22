'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { describeBackupError, type Backup } from '@/lib/backups';

interface CreateBackupFormProps {
  // True while the server reports a backup in progress; only one may run at a time.
  running: boolean;
  // Default for the include-uploads checkbox (mirrors the scheduler setting).
  defaultIncludeUploads: boolean;
  onCreated: (backup: Backup) => void;
}

// "Create backup now": POST /admin/backups { include_uploads, note }.
export function CreateBackupForm({ running, defaultIncludeUploads, onCreated }: CreateBackupFormProps) {
  const t = useTranslations('backups');
  const { token } = useAuth();

  const [includeUploads, setIncludeUploads] = useState(defaultIncludeUploads);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!token || submitting || running) return;
    setSubmitting(true);
    setError('');
    try {
      const body = { include_uploads: includeUploads, note: note.trim() || undefined };
      const created = await api<Backup>('/admin/backups', { method: 'POST', token, body: JSON.stringify(body) });
      setNote('');
      onCreated(created);
    } catch (err) {
      setError(describeBackupError(err, t, t('createFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('createTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[11px] text-muted-foreground">{t('createHint')}</p>

        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="backup-note">{t('note')}</Label>
          <Input
            id="backup-note"
            className="h-8 text-sm"
            value={note}
            maxLength={500}
            placeholder={t('notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="rounded accent-primary"
            checked={includeUploads}
            onChange={(e) => setIncludeUploads(e.target.checked)}
            disabled={submitting}
          />
          <span className="text-xs font-medium">{t('includeUploads')}</span>
        </label>
        <p className="text-[10px] text-muted-foreground">{t('includeUploadsHint')}</p>

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-amber-700">{running ? t('runningNotice') : ''}</p>
          <Button size="sm" onClick={handleCreate} disabled={submitting || running}>
            {submitting || running ? <Loader2 className="size-3.5 animate-spin" /> : <DatabaseBackup className="size-3.5" />}
            {running ? t('runningButton') : t('createButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
