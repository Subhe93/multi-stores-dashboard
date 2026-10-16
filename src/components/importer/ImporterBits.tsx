'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isActiveRun, parseRunErrors, type ImportRunStatus, type ImportRunView } from '@/lib/importer.api';
import { isNppImportWarningCode } from '@/lib/designer/designer.api';

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_TONE: Record<ImportRunStatus, string> = {
  UPLOADED: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  PLANNING: 'bg-sky-50 text-sky-700 border-sky-200',
  PLANNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PLAN_FAILED: 'bg-red-50 text-red-700 border-red-200',
  QUEUED: 'bg-sky-50 text-sky-700 border-sky-200',
  RUNNING: 'bg-sky-50 text-sky-700 border-sky-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED_WITH_WARNINGS: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  ROLLBACK_QUEUED: 'bg-orange-50 text-orange-700 border-orange-200',
  ROLLING_BACK: 'bg-orange-50 text-orange-700 border-orange-200',
  ROLLED_BACK: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  ROLLBACK_FAILED: 'bg-red-50 text-red-700 border-red-200',
};

export function RunStatusBadge({ status }: { status: ImportRunStatus }) {
  const t = useTranslations('creator.importer.status');
  return (
    <Badge variant="outline" className={STATUS_TONE[status] ?? STATUS_TONE.UPLOADED}>
      {isActiveRun(status) && <Loader2 className="animate-spin" />}
      {t.has(status) ? t(status) : status}
    </Badge>
  );
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function useDateTimeFormat() {
  const locale = useLocale();
  return (value: string | null | undefined): string => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  };
}

export function formatBytes(bytes: number | null | undefined, locale: string): string {
  if (!bytes || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(v)} ${units[i]}`;
}

/** Short, stable label of a run ("#1a2b3c4d"). */
export const runLabel = (run: Pick<ImportRunView, 'id'>): string => `#${run.id.slice(0, 8)}`;

// ─── Messages ────────────────────────────────────────────────────────────────

/**
 * Readable fallback for a code without a translation ("W_SHIPPING_ZONE_SKIPPED"
 * → "Shipping zone skipped"), so a code added on the API never shows raw.
 */
export function humanizeCode(code: string): string {
  const words = code
    .replace(/^(W|IMPORT|REDIRECT)_/, '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
}

/** Localized text of one error code (`errors.<code>`), else the server text or the humanized code. */
export function useErrorCodeText() {
  const te = useTranslations('errors');
  return (code: string | null | undefined, message?: string | null): string => {
    if (code && te.has(code)) return te(code);
    if (code && message) return `${humanizeCode(code)}: ${message}`;
    if (code) return humanizeCode(code);
    return message || te('generic');
  };
}

/**
 * Localized text of a run's stored error. The error may hold several lines
 * (`CODE: msg\nCODE2: msg2`); each one is translated on its own line.
 */
export function useRunErrorText() {
  const codeText = useErrorCodeText();
  return (run: Pick<ImportRunView, 'error'> | null | undefined): string | null => {
    const entries = parseRunErrors(run?.error);
    if (entries.length === 0) return null;
    return Array.from(new Set(entries.map((e) => codeText(e.code, e.message)))).join('\n');
  };
}

/**
 * Localized label of a warning code (`creator.importer.warnings.<code>`).
 * Designer template warnings (NPP import, M4.2) are logged with their bare
 * code (`BG_SWAPPED`, …) and resolve through `creator.designer.importWarnings`;
 * anything else falls back to the humanized code.
 */
export function useWarningLabel() {
  const t = useTranslations('creator.importer.warnings');
  const td = useTranslations('creator.designer.importWarnings');
  return (code: string): string => {
    if (t.has(code)) return t(code);
    if (isNppImportWarningCode(code) && td.has(code)) return td(code);
    return humanizeCode(code);
  };
}

/** Codes the logs show with a readable label: importer `W_…` codes and designer template warnings. */
export function isLabelledWarningCode(code: string): boolean {
  return code.startsWith('W_') || isNppImportWarningCode(code);
}

/** Fixed English notes the API writes on rollback items → `creator.importer.report.itemMessages.<key>`. */
const ITEM_MESSAGE_KEYS: Record<string, string> = {
  restored: 'restored',
  'changed since the run': 'changedSinceRun',
  'only default profile': 'onlyDefaultProfile',
  'profile kept': 'profileKept',
  'with its profile': 'withItsProfile',
  'has orders': 'hasOrders',
  'still in use': 'stillInUse',
  staged: 'staged',
  'linked to products outside the run': 'linkedOutsideRun',
  'designer keeps its copy': 'designerKeepsCopy',
};

/**
 * Localized text of a run item's `message`: a known note, a warning code
 * (`W_…`) or an error text (`CODE: detail`); anything else is shown as sent.
 */
export function useItemMessage() {
  const t = useTranslations('creator.importer.report.itemMessages');
  const warning = useWarningLabel();
  const codeText = useErrorCodeText();
  return (message: string | null | undefined): string => {
    const m = (message ?? '').trim();
    if (!m) return '';
    const key = ITEM_MESSAGE_KEYS[m];
    if (key && t.has(key)) return t(key);
    if (/^W_[A-Z0-9_]+$/.test(m) || isNppImportWarningCode(m)) return warning(m);
    const err = /^([A-Z][A-Z0-9_]{2,}):\s*([\s\S]*)$/.exec(m);
    if (err) return codeText(err[1], err[2]);
    return m;
  };
}

export function ErrorBanner({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <span className="flex items-start gap-2 whitespace-pre-line">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {message}
      </span>
      {action}
    </div>
  );
}

export function SpinnerBlock() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Small yes/no dialog used for confirm, rollback and delete actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  error,
  children,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const tc = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {error && <ErrorBanner message={error} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Small layout helpers ────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'warn' | 'danger';
}) {
  const toneCls =
    tone === 'danger' ? 'border-red-200 bg-red-50/60' : tone === 'warn' ? 'border-amber-200 bg-amber-50/60' : 'bg-white';
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {aside}
    </div>
  );
}
