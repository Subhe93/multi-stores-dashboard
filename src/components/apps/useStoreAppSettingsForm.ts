'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { sanitizeStoreApps, setCachedStoreApps } from '@/lib/useStoreApps';
import type { MyStoreAppView } from '@/lib/storeApps.registry';

// Main line plus an optional detail (the API message naming the bad field).
export interface SettingsSaveError {
  text: string;
  detail?: string;
}

interface Options<T> {
  app: MyStoreAppView;
  token: string;
  normalize: (raw: unknown) => T;
  same: (a: T, b: T) => boolean;
  // Normalises the form right before sending; the form adopts the result so
  // it is not left dirty after saving.
  prepare?: (form: T) => T;
  // Shown when the failure carries no usable code or message.
  fallbackError: string;
}

/**
 * Form state of one store app's `settings` object. Saves the whole object
 * through PUT /stores/my/apps/:key `{ settings }` (validated server-side,
 * STORE_APP_SETTINGS_INVALID); the API returns the full refreshed app list,
 * which is pushed to the shared cache so the nav and every page update.
 */
export function useStoreAppSettingsForm<T extends object>({ app, token, normalize, same, prepare, fallbackError }: Options<T>) {
  const tErrors = useTranslations('errors');
  const [form, setForm] = useState<T>(() => normalize(app.settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SettingsSaveError | null>(null);
  const [saved, flashSaved] = useTransientFlag();

  const persisted = normalize(app.settings);
  const dirty = !same(form, persisted);

  // Re-seed only when the normalised server copy actually changed (every
  // refresh hands us a new `settings` object) and never over unsaved edits.
  const lastSeeded = useRef<T>(persisted);
  useEffect(() => {
    if (same(persisted, lastSeeded.current)) return;
    lastSeeded.current = persisted;
    if (!dirty) setForm(persisted);
  }, [persisted, dirty, same]);

  const update = <K extends keyof T>(key: K, value: T[K]) => {
    setError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Known codes resolve through `errors.<code>`; STORE_APP_SETTINGS_INVALID
  // also keeps the server message because it names the offending field.
  const describeSaveError = (err: unknown): SettingsSaveError => {
    if (err instanceof ApiError) {
      const message = Array.isArray(err.errors) && err.errors.length > 0 ? err.errors.join(' · ') : err.message;
      if (err.code === 'STORE_APP_SETTINGS_INVALID') return { text: tErrors(err.code), detail: message || undefined };
      if (err.code && tErrors.has(err.code)) return { text: tErrors(err.code) };
      if (message) return { text: message };
    } else if (err instanceof Error && err.message) {
      return { text: err.message };
    }
    return { text: fallbackError };
  };

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    const payload = prepare ? prepare(form) : form;
    try {
      const result = await api<MyStoreAppView[]>(`/stores/my/apps/${app.key}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ settings: payload }),
      });
      setForm(payload);
      const refreshed = sanitizeStoreApps(result);
      if (refreshed) setCachedStoreApps(refreshed);
      flashSaved();
    } catch (err) {
      setError(describeSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  return { form, update, saving, dirty, save, error, saved };
}
