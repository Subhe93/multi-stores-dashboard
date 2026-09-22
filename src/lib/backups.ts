// Types and helpers for the admin backups section
// (see plans/backups/API-CONTRACT.md). The API is built concurrently, so
// everything here codes against the contract, not a running server.
import { API_URL, ApiError } from '@/lib/api';

export type BackupKind = 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
export type BackupStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type BackupFrequency = 'DAILY' | 'WEEKLY';
export type BackupFile = 'db' | 'uploads';

export interface Backup {
  id: string;
  kind: BackupKind;
  status: BackupStatus;
  db_file: string | null;
  // BigInt columns are serialised as plain numbers by the API.
  db_size_bytes: number | null;
  uploads_file: string | null;
  uploads_size_bytes: number | null;
  includes_uploads: boolean;
  note: string | null;
  error: string | null;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface BackupDiskInfo {
  free_bytes: number;
  dir: string;
}

// GET /admin/backups
export interface BackupListResponse {
  items: Backup[];
  running: boolean;
  disk: BackupDiskInfo;
}

export interface BackupTools {
  pg_dump: boolean;
  pg_restore: boolean;
  tar: boolean;
}

// GET/PUT /admin/backups/settings
export interface BackupSettings {
  backup_enabled: boolean;
  backup_frequency: BackupFrequency;
  backup_time: string; // HH:mm, server local time
  backup_weekday: number; // 0=Sunday … 6, used when WEEKLY
  backup_retention: number; // 1-365
  backup_include_uploads: boolean;
  backup_last_run_at: string | null;
  next_run_at: string | null;
  tools: BackupTools;
}

// PUT /admin/backups/settings accepts any subset of the editable fields.
export type BackupSettingsInput = Pick<
  BackupSettings,
  'backup_enabled' | 'backup_frequency' | 'backup_time' | 'backup_weekday' | 'backup_retention' | 'backup_include_uploads'
>;

// POST /admin/backups/:id/restore
export interface RestoreBackupResponse {
  restored: boolean;
  pre_restore_backup_id: string;
}

export const BACKUP_IN_FLIGHT_STATUSES: BackupStatus[] = ['PENDING', 'RUNNING'];

export function isBackupInFlight(backup: Pick<Backup, 'status'>): boolean {
  return BACKUP_IN_FLIGHT_STATUSES.includes(backup.status);
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

// Human-readable size in binary units ("12.4 MB"), formatted for the locale.
export function formatBytes(bytes: number | null | undefined, locale?: string): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${BYTE_UNITS[unit]}`;
}

// Extracts the filename from a Content-Disposition header, preferring the
// RFC 5987 `filename*=UTF-8''...` form over the plain quoted one.
export function parseContentDispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null;
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Malformed percent-encoding; fall through to the plain form.
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header);
  return plain?.[1]?.trim() || null;
}

// Default filename when the server does not expose Content-Disposition
// (e.g. CORS without Access-Control-Expose-Headers).
export function defaultBackupFilename(backup: Pick<Backup, 'id' | 'created_at'>, file: BackupFile): string {
  const stamp = backup.created_at.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return file === 'db' ? `db-${stamp}-${backup.id.slice(0, 8)}.dump` : `uploads-${stamp}-${backup.id.slice(0, 8)}.tar.gz`;
}

// Authenticated download: GET /admin/backups/:id/download?file=db|uploads with
// a Bearer token, saved through a blob URL. Throws ApiError on failure so the
// caller can translate `code` the same way as JSON requests.
export async function downloadBackupFile(backup: Pick<Backup, 'id' | 'created_at'>, file: BackupFile, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/backups/${backup.id}/download?file=${file}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new ApiError('Download failed');
    err.status = res.status;
    try {
      const json = await res.json();
      if (json?.message) err.message = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
      if (typeof json?.code === 'string') err.code = json.code;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw err;
  }
  const filename = parseContentDispositionFilename(res.headers.get('content-disposition')) || defaultBackupFilename(backup, file);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Minimal translator shape shared by next-intl's `t` (namespace-bound).
interface CodeTranslator {
  (key: string): string;
  has(key: string): boolean;
}

// Prefers a translated `backups.errors.<code>` message, then the API message,
// then the given fallback.
export function describeBackupError(err: unknown, t: CodeTranslator, fallback: string): string {
  if (err instanceof ApiError && err.code && t.has(`errors.${err.code}`)) return t(`errors.${err.code}`);
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// Localised weekday names (Sunday first) built from a known Sunday so no
// translation keys are needed.
export function weekdayOptions(locale: string): { value: string; label: string }[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  const sunday = new Date(Date.UTC(2023, 0, 1)); // 2023-01-01 is a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setUTCDate(sunday.getUTCDate() + i);
    return { value: String(i), label: formatter.format(day) };
  });
}
