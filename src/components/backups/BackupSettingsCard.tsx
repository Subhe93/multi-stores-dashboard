'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { describeBackupError, weekdayOptions, type BackupFrequency, type BackupSettings, type BackupSettingsInput, type BackupTools } from '@/lib/backups';

interface BackupSettingsCardProps {
  settings: BackupSettings | null;
  loading: boolean;
  error: string;
  // Called with the server response after a successful PUT.
  onSaved: (settings: BackupSettings) => void;
}

const TOOL_NAMES: (keyof BackupTools)[] = ['pg_dump', 'pg_restore', 'tar'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function toInput(s: BackupSettings): BackupSettingsInput {
  return {
    backup_enabled: s.backup_enabled,
    backup_frequency: s.backup_frequency === 'WEEKLY' ? 'WEEKLY' : 'DAILY',
    backup_time: s.backup_time || '03:00',
    backup_weekday: Number.isInteger(s.backup_weekday) ? s.backup_weekday : 0,
    backup_retention: Number.isInteger(s.backup_retention) ? s.backup_retention : 14,
    backup_include_uploads: !!s.backup_include_uploads,
  };
}

// Scheduler settings (GET/PUT /admin/backups/settings): enable toggle,
// frequency, time, weekday (weekly only), retention, include uploads, plus the
// computed next run and server tool availability.
export function BackupSettingsCard({ settings, loading, error, onSaved }: BackupSettingsCardProps) {
  const t = useTranslations('backups');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { token } = useAuth();

  const [form, setForm] = useState<BackupSettingsInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reset the form whenever fresh settings arrive from the server.
  useEffect(() => {
    setForm(settings ? toInput(settings) : null);
  }, [settings]);

  const saved = useMemo(() => (settings ? toInput(settings) : null), [settings]);
  const dirty =
    !!form &&
    !!saved &&
    (Object.keys(form) as (keyof BackupSettingsInput)[]).some((key) => form[key] !== saved[key]);

  const timeValid = !!form && TIME_PATTERN.test(form.backup_time);
  const retentionValid = !!form && form.backup_retention >= 1 && form.backup_retention <= 365;
  const canSave = dirty && timeValid && retentionValid && !saving;

  const weekdays = useMemo(() => weekdayOptions(locale), [locale]);
  const frequencies: { value: BackupFrequency; label: string }[] = [
    { value: 'DAILY', label: t('frequencyDaily') },
    { value: 'WEEKLY', label: t('frequencyWeekly') },
  ];

  const handleSave = async () => {
    if (!token || !form || !canSave) return;
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api<BackupSettings>('/admin/backups/settings', { method: 'PUT', token, body: JSON.stringify(form) });
      onSaved(updated);
      setMsg({ type: 'success', text: t('settingsSaved') });
    } catch (err) {
      setMsg({ type: 'error', text: describeBackupError(err, t, t('settingsSaveFailed')) });
    } finally {
      setSaving(false);
    }
  };

  const missingTool = settings ? TOOL_NAMES.some((name) => !settings.tools?.[name]) : false;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('settingsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading || !form ? (
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
            {!loading && error && <p className="text-[11px] text-red-600">{error}</p>}
          </div>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">{t('settingsHint')}</p>

            {/* Enable scheduler */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('enabled')}</p>
                <p className="text-[11px] text-muted-foreground">{t('enabledHint')}</p>
              </div>
              <ToggleSwitch checked={form.backup_enabled} onChange={(v) => setForm({ ...form, backup_enabled: v })} label={t('enabled')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Frequency */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('frequency')}</Label>
                <SearchableSelect
                  value={form.backup_frequency}
                  onChange={(v) => setForm({ ...form, backup_frequency: v === 'WEEKLY' ? 'WEEKLY' : 'DAILY' })}
                  options={frequencies}
                />
              </div>

              {/* Time (server local) */}
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="backup-time">{t('time')}</Label>
                <Input
                  id="backup-time"
                  type="time"
                  className="h-8 w-36 text-sm"
                  value={form.backup_time}
                  onChange={(e) => setForm({ ...form, backup_time: e.target.value })}
                  aria-invalid={!timeValid}
                />
                <p className="text-[10px] text-muted-foreground">{t('timeHint')}</p>
              </div>

              {/* Weekday (weekly only) */}
              {form.backup_frequency === 'WEEKLY' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('weekday')}</Label>
                  <SearchableSelect
                    value={String(form.backup_weekday)}
                    onChange={(v) => setForm({ ...form, backup_weekday: Math.min(6, Math.max(0, Number(v) || 0)) })}
                    options={weekdays}
                  />
                </div>
              )}

              {/* Retention */}
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="backup-retention">{t('retention')}</Label>
                <Input
                  id="backup-retention"
                  type="number"
                  min={1}
                  max={365}
                  className="h-8 w-28 text-sm"
                  value={form.backup_retention}
                  onChange={(e) => setForm({ ...form, backup_retention: Number(e.target.value) })}
                  aria-invalid={!retentionValid}
                />
                <p className="text-[10px] text-muted-foreground">{t('retentionHint')}</p>
              </div>
            </div>

            {/* Include uploads */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('includeUploads')}</p>
                <p className="text-[11px] text-muted-foreground">{t('includeUploadsScheduledHint')}</p>
              </div>
              <ToggleSwitch
                checked={form.backup_include_uploads}
                onChange={(v) => setForm({ ...form, backup_include_uploads: v })}
                label={t('includeUploads')}
              />
            </div>

            {/* Next / last run */}
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p>
                {t('nextRun')}:{' '}
                <span className="font-medium text-foreground">
                  {settings?.backup_enabled && settings.next_run_at ? new Date(settings.next_run_at).toLocaleString(locale) : t('nextRunNone')}
                </span>
              </p>
              <p>
                {t('lastRun')}:{' '}
                <span className="font-medium text-foreground">
                  {settings?.backup_last_run_at ? new Date(settings.backup_last_run_at).toLocaleString(locale) : t('never')}
                </span>
              </p>
            </div>

            {/* Server tools */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium">{t('tools')}</p>
              <div className="flex flex-wrap gap-1.5">
                {TOOL_NAMES.map((name) => {
                  const ok = !!settings?.tools?.[name];
                  return (
                    <Badge
                      key={name}
                      variant="outline"
                      className={`font-mono text-[10px] ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
                    >
                      {ok ? <CheckCircle2 /> : <XCircle />}
                      {name}
                    </Badge>
                  );
                })}
              </div>
              {missingTool && <p className="text-[11px] text-red-600">{t('toolsMissingHint')}</p>}
            </div>

            {msg && <p className={`text-[11px] ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
            {!timeValid && <p className="text-[11px] text-red-600">{t('timeInvalid')}</p>}
            {!retentionValid && <p className="text-[11px] text-red-600">{t('retentionInvalid')}</p>}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={!canSave}>
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {saving ? tc('saving') : tc('save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
