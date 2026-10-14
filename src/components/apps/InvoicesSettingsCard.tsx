'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { api, ApiError } from '@/lib/api';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { sanitizeStoreApps } from '@/lib/useStoreApps';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import {
  COD_ISSUE_ON,
  normalizeInvoiceSettings,
  sameInvoiceSettings,
  type CodIssueOn,
  type InvoiceSettings,
} from '@/lib/invoices';

interface InvoicesSettingsCardProps {
  app: MyStoreAppView;
  token: string;
  // Called with the refreshed app list the API returns after a successful save.
  onSaved: (apps: MyStoreAppView[]) => void;
}

/**
 * Behaviour flags of the "invoices" app, shown under its card on the Apps
 * page while the app is enabled. Saves the whole object through
 * PUT /stores/my/apps/invoices `{ settings }` (validated server-side,
 * STORE_APP_SETTINGS_INVALID) and receives the full refreshed app list.
 * Seller identity and numbering live on the Invoices page instead.
 */
export function InvoicesSettingsCard({ app, token, onSaved }: InvoicesSettingsCardProps) {
  const t = useTranslations('creator.apps.invoices.settings');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [form, setForm] = useState<InvoiceSettings>(() => normalizeInvoiceSettings(app.settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null);
  const [saved, flashSaved] = useTransientFlag();

  const persisted = normalizeInvoiceSettings(app.settings);
  const dirty = !sameInvoiceSettings(form, persisted);

  // Re-seed only when the normalised server copy changed and never over
  // unsaved edits (same rule as the B2B card).
  const lastSeeded = useRef<InvoiceSettings>(persisted);
  useEffect(() => {
    if (sameInvoiceSettings(persisted, lastSeeded.current)) return;
    lastSeeded.current = persisted;
    if (!dirty) setForm(persisted);
  }, [persisted, dirty]);

  const update = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const describeSaveError = (err: unknown): { text: string; detail?: string } => {
    if (err instanceof ApiError) {
      const message = Array.isArray(err.errors) && err.errors.length > 0 ? err.errors.join(' · ') : err.message;
      if (err.code === 'STORE_APP_SETTINGS_INVALID') return { text: tErrors(err.code), detail: message || undefined };
      if (err.code && tErrors.has(err.code)) return { text: tErrors(err.code) };
      if (message) return { text: message };
    } else if (err instanceof Error && err.message) {
      return { text: err.message };
    }
    return { text: t('saveFailed') };
  };

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api<MyStoreAppView[]>(`/stores/my/apps/${app.key}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ settings: form }),
      });
      const refreshed = sanitizeStoreApps(result);
      if (refreshed) onSaved(refreshed);
      flashSaved();
    } catch (err) {
      setError(describeSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  const codOptions = COD_ISSUE_ON.map((value) => ({
    value,
    label: value === 'delivered' ? t('codDelivered') : t('codCreated'),
  }));

  const toggleRow = (key: 'auto_issue' | 'attach_pdf_to_email' | 'credit_on_cancel', label: string, hint: string) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <Label className="text-xs font-normal">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <ToggleSwitch checked={form[key]} disabled={saving} onChange={(next) => update(key, next)} label={label} />
    </div>
  );

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{t('title')}</p>
        <Link
          href="/creator/invoices?tab=profile"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {t('openInvoices')}
          <ArrowUpRight className="size-3 rtl:-scale-x-100" />
        </Link>
      </div>

      {toggleRow('auto_issue', t('autoIssue'), t('autoIssueHint'))}

      <div className="space-y-1.5">
        <Label className="text-xs font-normal">{t('codIssueOn')}</Label>
        <SearchableSelect
          value={form.cod_issue_on}
          onChange={(value) => update('cod_issue_on', value as CodIssueOn)}
          options={codOptions}
        />
        <p className="text-[11px] text-muted-foreground">{t('codIssueOnHint')}</p>
      </div>

      {toggleRow('attach_pdf_to_email', t('attachPdf'), t('attachPdfHint'))}
      {toggleRow('credit_on_cancel', t('creditOnCancel'), t('creditOnCancelHint'))}

      {error && (
        <div className="space-y-0.5 text-[11px] text-red-600">
          <p>{error.text}</p>
          {error.detail && <p className="text-red-500">{error.detail}</p>}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs font-medium text-emerald-600">{t('saved')}</span>}
        <Button type="button" size="sm" disabled={saving || !dirty} onClick={handleSave}>
          {saving ? <Loader2 className="animate-spin" /> : null} {tc('save')}
        </Button>
      </div>
    </div>
  );
}
