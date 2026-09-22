'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BackupSettingsCard } from '@/components/backups/BackupSettingsCard';
import { BackupsTable } from '@/components/backups/BackupsTable';
import { CreateBackupForm } from '@/components/backups/CreateBackupForm';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { describeBackupError, isBackupInFlight, type Backup, type BackupDiskInfo, type BackupListResponse, type BackupSettings } from '@/lib/backups';

const POLL_INTERVAL_MS = 5000;

// Admin backups hub: scheduler settings, manual "create now", and the backup
// list with download / restore / delete (see plans/backups/API-CONTRACT.md).
export default function AdminBackupsPage() {
  const t = useTranslations('backups');
  const { token } = useAuth();

  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');

  const [items, setItems] = useState<Backup[]>([]);
  const [running, setRunning] = useState(false);
  const [disk, setDisk] = useState<BackupDiskInfo | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const s = await api<BackupSettings>('/admin/backups/settings', { token });
      setSettings(s);
    } catch (err) {
      setSettingsError(describeBackupError(err, t, t('loadFailed')));
    } finally {
      setSettingsLoading(false);
    }
  }, [token, t]);

  // `silent` skips the loading state for background polls.
  const fetchList = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setListLoading(true);
      try {
        const res = await api<BackupListResponse>('/admin/backups', { token });
        setItems(Array.isArray(res?.items) ? res.items : []);
        setRunning(!!res?.running);
        setDisk(res?.disk ?? null);
        setListError('');
      } catch (err) {
        setListError(describeBackupError(err, t, t('loadFailed')));
      } finally {
        if (!silent) setListLoading(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    void fetchSettings();
    void fetchList();
  }, [fetchSettings, fetchList]);

  // Poll every 5 s while the server reports a backup in progress or any row is
  // still PENDING / RUNNING.
  const inFlight = running || items.some(isBackupInFlight);
  useEffect(() => {
    if (!inFlight || !token) return;
    const id = setInterval(() => void fetchList(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [inFlight, token, fetchList]);

  const handleCreated = (backup: Backup) => {
    // Show the new PENDING row immediately; polling picks up the real state.
    setItems((prev) => [backup, ...prev.filter((b) => b.id !== backup.id)]);
    setRunning(true);
  };

  const handleChanged = () => {
    void fetchList(true);
    // A restore updates backup_last_run_at / next_run_at indirectly; keep the card fresh.
    void fetchSettings();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BackupSettingsCard settings={settings} loading={settingsLoading} error={settingsError} onSaved={setSettings} />
        <CreateBackupForm
          key={settings ? String(settings.backup_include_uploads) : 'default'}
          running={running}
          defaultIncludeUploads={settings?.backup_include_uploads ?? true}
          onCreated={handleCreated}
        />
      </div>

      <BackupsTable items={items} loading={listLoading} error={listError} running={running} disk={disk} onChanged={handleChanged} />
    </div>
  );
}
