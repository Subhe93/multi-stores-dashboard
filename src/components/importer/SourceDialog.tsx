'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, Globe, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagInput } from '@/components/common/TagInput';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useApiError } from '@/lib/useApiError';
import {
  createSource,
  isRunnableKind,
  updateSource,
  type ImportSourceInput,
  type ImportSourceKind,
  type ImportSourceView,
} from '@/lib/importer.api';
import { ErrorBanner } from '@/components/importer/ImporterBits';

type Field =
  | 'name'
  | 'site_url'
  | 'host_aliases'
  | 'product_base'
  | 'category_base'
  | 'tag_base'
  | 'locale'
  | 'currency'
  | 'consumer_key'
  | 'consumer_secret';

const LOCALES = ['sv', 'en', 'ar', 'de', 'fr', 'tr'];
const DEFAULT_BASES = { product_base: 'product', category_base: 'product-category', tag_base: 'product-tag' };

/** Host of a site URL ("https://shop.example/" → "shop.example"), or null when not a bare site URL. */
export function hostOf(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || url.port) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    const host = url.hostname.toLowerCase();
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

const BASE_RE = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;

/** Maps a class-validator message ("site_url must be …") to the field it is about. */
function fieldOfMessage(message: string): Field | null {
  const m = /^(?:settings\.)?([a-z_]+)/.exec(message.trim());
  const key = m?.[1] as Field | undefined;
  const fields: Field[] = [
    'name',
    'site_url',
    'host_aliases',
    'product_base',
    'category_base',
    'tag_base',
    'locale',
    'currency',
    'consumer_key',
    'consumer_secret',
  ];
  return key && fields.includes(key) ? key : null;
}

interface SourceDialogProps {
  token: string;
  open: boolean;
  /** Source to edit; null creates a new one. */
  source: ImportSourceView | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (source: ImportSourceView) => void;
}

/** Create or edit a source (§13 Sources): kind, site, host aliases, permalink bases and REST keys. */
export function SourceDialog(props: SourceDialogProps) {
  // Remount per opened source so the form starts from its values.
  return props.open ? <SourceForm key={props.source?.id ?? 'new'} {...props} /> : null;
}

function SourceForm({ token, open, source, onOpenChange, onSaved }: SourceDialogProps) {
  const t = useTranslations('creator.importer.sources.form');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const editing = !!source;

  const [kind, setKind] = useState<ImportSourceKind>(source?.kind ?? 'WP_BUNDLE');
  const [name, setName] = useState(source?.name ?? '');
  const [siteUrl, setSiteUrl] = useState(source ? `https://${source.site_host}` : '');
  const [aliases, setAliases] = useState<string[]>(source?.host_aliases ?? []);
  const [productBase, setProductBase] = useState(source?.settings?.product_base ?? DEFAULT_BASES.product_base);
  const [categoryBase, setCategoryBase] = useState(source?.settings?.category_base ?? DEFAULT_BASES.category_base);
  const [tagBase, setTagBase] = useState(source?.settings?.tag_base ?? DEFAULT_BASES.tag_base);
  const [locale, setLocale] = useState(source?.settings?.locale ?? 'sv');
  const [currency, setCurrency] = useState(source?.settings?.currency ?? 'SEK');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): Partial<Record<Field, string>> => {
    const errs: Partial<Record<Field, string>> = {};
    if (!name.trim()) errs.name = t('errors.nameRequired');
    if (!siteUrl.trim()) errs.site_url = t('errors.siteRequired');
    else if (!hostOf(siteUrl)) errs.site_url = t('errors.siteInvalid');
    const badAlias = aliases.find((a) => !hostOf(a));
    if (badAlias) errs.host_aliases = t('errors.aliasInvalid', { alias: badAlias });
    for (const [field, value] of [
      ['product_base', productBase],
      ['category_base', categoryBase],
      ['tag_base', tagBase],
    ] as const) {
      if (!BASE_RE.test(value.trim().replace(/^\/+|\/+$/g, ''))) errs[field] = t('errors.baseInvalid');
    }
    if (currency.trim() && !/^[A-Za-z]{3}$/.test(currency.trim())) errs.currency = t('errors.currencyInvalid');
    if (kind === 'WC_REST' && !(editing && source?.has_credentials)) {
      if (!consumerKey.trim()) errs.consumer_key = t('errors.keyRequired');
      if (!consumerSecret.trim()) errs.consumer_secret = t('errors.secretRequired');
    }
    if (kind === 'WC_REST' && (consumerKey.trim() || consumerSecret.trim()) && !(consumerKey.trim() && consumerSecret.trim())) {
      if (!consumerKey.trim()) errs.consumer_key = t('errors.keyRequired');
      if (!consumerSecret.trim()) errs.consumer_secret = t('errors.secretRequired');
    }
    return errs;
  };

  const focusField = (field: Field) => {
    // Next frame: the error state must render before the field can scroll.
    requestAnimationFrame(() => document.getElementById(`importer-source-${field}`)?.focus());
  };

  const save = async () => {
    const errs = validate();
    setErrors(errs);
    setFormError(null);
    const first = Object.keys(errs)[0] as Field | undefined;
    if (first) {
      focusField(first);
      return;
    }
    const input: ImportSourceInput = {
      kind,
      name: name.trim(),
      site_url: `https://${hostOf(siteUrl)}`,
      host_aliases: aliases.map((a) => hostOf(a)!).filter(Boolean),
      settings: {
        ...(source?.settings ?? {}),
        product_base: productBase.trim().replace(/^\/+|\/+$/g, ''),
        category_base: categoryBase.trim().replace(/^\/+|\/+$/g, ''),
        tag_base: tagBase.trim().replace(/^\/+|\/+$/g, ''),
        locale,
        currency: currency.trim().toUpperCase(),
      },
      // Secrets are write-only: omitted = keep the saved ones.
      ...(kind === 'WC_REST' && consumerKey.trim() ? { consumer_key: consumerKey.trim(), consumer_secret: consumerSecret.trim() } : {}),
    };
    setSaving(true);
    try {
      let saved: ImportSourceView;
      if (editing) {
        // The kind is fixed at creation; the update endpoint rejects it.
        const { kind: _kind, ...update } = input;
        void _kind;
        saved = await updateSource(token, source!.id, update);
      } else {
        saved = await createSource(token, input);
      }
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const e = err as { code?: string; errors?: string[] };
      const serverErrs: Partial<Record<Field, string>> = {};
      if (e?.code === 'IMPORT_SOURCE_HOST_INVALID' || e?.code === 'IMPORT_SOURCE_DUPLICATE') serverErrs.site_url = describeError(err);
      else if (e?.code === 'IMPORT_SOURCE_CREDENTIALS_INVALID') serverErrs.consumer_key = describeError(err);
      else if (Array.isArray(e?.errors)) {
        // Translate raw validator output into the field's own friendly text.
        for (const msg of e.errors) {
          const f = fieldOfMessage(msg);
          if (f && !serverErrs[f]) serverErrs[f] = t(`errors.field.${f}`);
        }
      }
      const firstServer = Object.keys(serverErrs)[0] as Field | undefined;
      if (firstServer) {
        setErrors(serverErrs);
        focusField(firstServer);
      } else {
        setFormError(describeError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (f: Field) => errors[f] && <p className="text-[11px] text-red-600">{errors[f]}</p>;
  const errCls = (f: Field) => (errors[f] ? 'border-red-400 focus-visible:ring-red-400' : '');

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Kind */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('kind')}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['WP_BUNDLE', 'WC_REST'] as const).map((k) => {
                const Icon = k === 'WP_BUNDLE' ? Archive : Globe;
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={editing}
                    onClick={() => setKind(k)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-start transition disabled:cursor-not-allowed ${
                      selected ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50/60 disabled:opacity-50'
                    }`}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {t(`kinds.${k}.title`)}
                        {!isRunnableKind(k) && (
                          <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-px text-[10px] font-normal text-zinc-500">
                            {t('later')}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">{t(`kinds.${k}.body`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="importer-source-name" className="text-xs">
                {t('name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="importer-source-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className={errCls('name')}
              />
              {fieldError('name')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="importer-source-site_url" className="text-xs">
                {t('siteUrl')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="importer-source-site_url"
                dir="ltr"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                className={errCls('site_url')}
              />
              {fieldError('site_url') ?? <p className="text-[11px] text-muted-foreground">{t('siteUrlHint')}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="importer-source-host_aliases" className="text-xs">
              {t('aliases')}
            </Label>
            <TagInput id="importer-source-host_aliases" tags={aliases} onChange={setAliases} placeholder={t('aliasesPlaceholder')} />
            {fieldError('host_aliases') ?? <p className="text-[11px] text-muted-foreground">{t('aliasesHint')}</p>}
          </div>

          {/* Permalink bases and content settings */}
          <div className="space-y-3 rounded-lg border bg-zinc-50/40 p-3">
            <div>
              <p className="text-sm font-medium">{t('settingsTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('settingsHint')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['product_base', productBase, setProductBase],
                  ['category_base', categoryBase, setCategoryBase],
                  ['tag_base', tagBase, setTagBase],
                ] as const
              ).map(([field, value, setter]) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`importer-source-${field}`} className="text-xs">
                    {t(field)}
                  </Label>
                  <Input
                    id={`importer-source-${field}`}
                    dir="ltr"
                    className={`h-8 font-mono text-sm ${errCls(field)}`}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                  />
                  {fieldError(field)}
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="importer-source-locale" className="text-xs">
                  {t('locale')}
                </Label>
                <SearchableSelect
                  id="importer-source-locale"
                  options={LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
                  value={locale}
                  onChange={(v) => setLocale(v || 'sv')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="importer-source-currency" className="text-xs">
                  {t('currency')}
                </Label>
                <Input
                  id="importer-source-currency"
                  dir="ltr"
                  maxLength={3}
                  className={`h-8 font-mono text-sm uppercase ${errCls('currency')}`}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
                {fieldError('currency') ?? <p className="text-[11px] text-muted-foreground">{t('currencyHint')}</p>}
              </div>
            </div>
          </div>

          {kind === 'WC_REST' && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('restTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('restHint')}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="importer-source-consumer_key" className="text-xs">
                    {t('consumerKey')}
                  </Label>
                  <Input
                    id="importer-source-consumer_key"
                    dir="ltr"
                    autoComplete="off"
                    className={`font-mono text-sm ${errCls('consumer_key')}`}
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    placeholder={source?.has_credentials ? t('savedSecret') : 'ck_…'}
                  />
                  {fieldError('consumer_key')}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="importer-source-consumer_secret" className="text-xs">
                    {t('consumerSecret')}
                  </Label>
                  <Input
                    id="importer-source-consumer_secret"
                    dir="ltr"
                    type="password"
                    autoComplete="new-password"
                    className={`font-mono text-sm ${errCls('consumer_secret')}`}
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    placeholder={source?.has_credentials ? t('savedSecret') : 'cs_…'}
                  />
                  {fieldError('consumer_secret')}
                </div>
              </div>
              {source?.has_credentials && <p className="text-[11px] text-muted-foreground">{t('secretKeepHint')}</p>}
            </div>
          )}

          {formError && <ErrorBanner message={formError} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tc('cancel')}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {editing ? tc('save') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
