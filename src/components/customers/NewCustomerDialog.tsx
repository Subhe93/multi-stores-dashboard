'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/customers';
import { createCustomer, type CustomerScope } from '@/lib/customers.api';
import { useCustomerError } from './useCustomerError';
import { locales as uiLocales } from '@/i18n/config';

// Native language names for the email language picker.
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
  es: 'Español',
  it: 'Italiano',
  nl: 'Nederlands',
  da: 'Dansk',
  no: 'Norsk',
  nb: 'Norsk bokmål',
  fi: 'Suomi',
  pl: 'Polski',
  pt: 'Português',
};

export interface StoreOption {
  id: string;
  name: string;
  slug: string;
}

interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  scope: CustomerScope;
  /** Admin only: stores to pick from (the customer belongs to exactly one). */
  stores?: StoreOption[];
  /** Admin only: preselected store (the list's store filter). */
  defaultStoreId?: string;
  onCreated: (customerId: string | null) => void;
}

interface LanguageConfig {
  primary_locale?: string | null;
  secondary_locales?: string[] | null;
}

const emptyForm = { email: '', first_name: '', last_name: '', phone: '', send_credentials: true, locale: '', store_id: '' };

export function NewCustomerDialog({
  open,
  onOpenChange,
  token,
  scope,
  stores = [],
  defaultStoreId = '',
  onCreated,
}: NewCustomerDialogProps) {
  const t = useTranslations('creator.customers');
  const tc = useTranslations('common');
  const uiLocale = useLocale();
  const describeError = useCustomerError();
  const [form, setForm] = useState(emptyForm);
  const [storeLocales, setStoreLocales] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);

  // Creator: the email goes out in one of the store's languages, the
  // primary one by default. Admin: any dashboard language.
  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyForm, store_id: defaultStoreId });
    setError(null);
    setEmailError(false);
    if (scope === 'admin') {
      const list = [...uiLocales];
      setStoreLocales(list);
      setForm((f) => ({ ...f, locale: (list as string[]).includes(uiLocale) ? uiLocale : 'en' }));
      return;
    }
    let cancelled = false;
    api<{ language_config?: LanguageConfig | null }>('/stores/my/store', { token })
      .then((store) => {
        if (cancelled) return;
        const primary = store?.language_config?.primary_locale || 'en';
        const secondary = store?.language_config?.secondary_locales ?? [];
        const list = [primary, ...secondary.filter((l) => l && l !== primary)];
        setStoreLocales(list);
        setForm((f) => ({ ...f, locale: primary }));
      })
      .catch(() => {
        if (cancelled) return;
        setStoreLocales(['en']);
        setForm((f) => ({ ...f, locale: 'en' }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, scope, token, uiLocale, defaultStoreId]);

  const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError(null);
    const email = form.email.trim();
    if (!isValidEmail(email)) {
      setEmailError(true);
      return;
    }
    if (scope === 'admin' && !form.store_id) {
      setError(t('new.storeRequired'));
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer(token, scope, {
        email,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        send_credentials: form.send_credentials,
        locale: form.send_credentials && form.locale ? form.locale : undefined,
        store_id: scope === 'admin' ? form.store_id : undefined,
      });
      onOpenChange(false);
      onCreated(created?.id ?? null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('new.title')}</DialogTitle>
          <DialogDescription>{t('new.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {scope === 'admin' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('new.store')} *</Label>
              <SearchableSelect
                value={form.store_id}
                onChange={(v) => set('store_id', v)}
                placeholder={t('new.storePlaceholder')}
                options={stores.map((s) => ({ value: s.id, label: s.name, description: s.slug }))}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-customer-email" className="text-xs">{t('fields.email')} *</Label>
            <Input
              id="new-customer-email"
              type="email"
              autoComplete="off"
              className="h-9 text-sm"
              value={form.email}
              aria-invalid={emailError || undefined}
              onChange={(e) => {
                set('email', e.target.value);
                setEmailError(false);
              }}
            />
            {emailError && <p className="text-[11px] text-red-600">{t('new.invalidEmail')}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-customer-first" className="text-xs">{t('fields.firstName')}</Label>
              <Input id="new-customer-first" className="h-9 text-sm" value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-customer-last" className="text-xs">{t('fields.lastName')}</Label>
              <Input id="new-customer-last" className="h-9 text-sm" value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-customer-phone" className="text-xs">{t('fields.phone')}</Label>
            <Input id="new-customer-phone" type="tel" className="h-9 text-sm" value={form.phone}
              onChange={(e) => set('phone', e.target.value)} />
          </div>

          <div className="rounded-lg border bg-zinc-50/60 p-3 space-y-3">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.send_credentials}
                onChange={(e) => set('send_credentials', e.target.checked)}
              />
              <span>
                <span className="font-medium">{t('new.sendCredentials')}</span>
                <span className="block text-[11px] text-muted-foreground">{t('new.sendCredentialsHint')}</span>
              </span>
            </label>
            {form.send_credentials && storeLocales.length > 0 && (
              <div className="space-y-1.5 sm:w-1/2">
                <Label className="text-xs">{t('new.emailLanguage')}</Label>
                <SearchableSelect
                  value={form.locale}
                  onChange={(v) => set('locale', v)}
                  options={storeLocales.map((l) => ({ value: l, label: LOCALE_LABELS[l] ?? l.toUpperCase() }))}
                />
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('new.creating') : t('new.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
