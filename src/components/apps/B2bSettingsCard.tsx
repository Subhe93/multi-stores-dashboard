'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CountryMultiSelect } from '@/components/common/CountryMultiSelect';
import { api, ApiError } from '@/lib/api';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { sanitizeStoreApps } from '@/lib/useStoreApps';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import { BUYER_TYPES, normalizeB2bSettings, type B2bSettings, type BuyerType } from '@/lib/b2b';

interface B2bSettingsCardProps {
  app: MyStoreAppView;
  token: string;
  // Called with the refreshed app list the API returns after a successful save.
  onSaved: (apps: MyStoreAppView[]) => void;
}

function sameSettings(a: B2bSettings, b: B2bSettings): boolean {
  return (
    a.allow_company === b.allow_company &&
    a.default_buyer_type === b.default_buyer_type &&
    a.require_vat_number === b.require_vat_number &&
    a.org_number_countries.join(',') === b.org_number_countries.join(',')
  );
}

/**
 * Settings of the "b2b" app, shown under its card on the Apps page while the
 * app is enabled. Saves the whole object through PUT /stores/my/apps/b2b
 * `{ settings }`; the API validates it (STORE_APP_SETTINGS_INVALID) and
 * returns the full refreshed app list.
 */
export function B2bSettingsCard({ app, token, onSaved }: B2bSettingsCardProps) {
  const t = useTranslations('creator.apps.b2b.settings');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [form, setForm] = useState<B2bSettings>(() => normalizeB2bSettings(app.settings));
  const [saving, setSaving] = useState(false);
  // Main line plus an optional detail (the API message naming the bad field).
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null);
  const [saved, flashSaved] = useTransientFlag();

  const persisted = normalizeB2bSettings(app.settings);
  const dirty = !sameSettings(form, persisted);

  // Re-seed only when the normalised server copy actually changed (every
  // Apps-page refresh hands us a new `settings` object, e.g. after a sibling
  // app toggles) and never over unsaved edits.
  const lastSeeded = useRef<B2bSettings>(persisted);
  useEffect(() => {
    if (sameSettings(persisted, lastSeeded.current)) return;
    lastSeeded.current = persisted;
    if (!dirty) setForm(persisted);
  }, [persisted, dirty]);

  const update = <K extends keyof B2bSettings>(key: K, value: B2bSettings[K]) => {
    setError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
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

  // Known codes resolve through `errors.<code>`; STORE_APP_SETTINGS_INVALID
  // also keeps the server message because it names the offending field.
  const describeSaveError = (err: unknown): { text: string; detail?: string } => {
    if (err instanceof ApiError) {
      const message = Array.isArray(err.errors) && err.errors.length > 0 ? err.errors.join(' · ') : err.message;
      if (err.code === 'STORE_APP_SETTINGS_INVALID') {
        return { text: tErrors(err.code), detail: message || undefined };
      }
      if (err.code && tErrors.has(err.code)) return { text: tErrors(err.code) };
      if (message) return { text: message };
    } else if (err instanceof Error && err.message) {
      return { text: err.message };
    }
    return { text: t('saveFailed') };
  };

  const buyerTypeOptions = BUYER_TYPES.map((value) => ({
    value,
    label: value === 'COMPANY' ? t('company') : t('person'),
  }));

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs font-semibold">{t('title')}</p>

      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-normal">{t('allowCompany')}</Label>
        <ToggleSwitch
          checked={form.allow_company}
          disabled={saving}
          onChange={(next) => update('allow_company', next)}
          label={t('allowCompany')}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-normal">{t('defaultBuyerType')}</Label>
        <SearchableSelect
          value={form.default_buyer_type}
          onChange={(value) => update('default_buyer_type', value as BuyerType)}
          options={buyerTypeOptions}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-normal">{t('requireVat')}</Label>
        <ToggleSwitch
          checked={form.require_vat_number}
          disabled={saving}
          onChange={(next) => update('require_vat_number', next)}
          label={t('requireVat')}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-normal">{t('orgCountries')}</Label>
        <CountryMultiSelect
          value={form.org_number_countries}
          onChange={(codes) => update('org_number_countries', codes)}
        />
        <p className="text-[11px] text-muted-foreground">{t('orgCountriesHint')}</p>
      </div>

      {/* Kustom collects organisation data in its own iframe; that only works
          when the merchant account has organisation purchases switched on. */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{t('kustomNote')}</span>
      </div>

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
