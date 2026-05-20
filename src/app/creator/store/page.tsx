'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import {
  ExternalLink,
  Loader2,
  Link2,
  Languages,
  Check,
  Palette,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DEFAULT_THEME_KEY } from '@/lib/themes-catalog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoreLanguageConfig {
  primary_locale: string;
  secondary_locales: string[];
  auto_translate: boolean;
}

interface TypographyStyle {
  fontFamily?: string;
  color?: string;
  fontSize?: number;
}

interface StoreTypography {
  heading?: TypographyStyle;
  body?: TypographyStyle;
  button?: TypographyStyle;
  link?: TypographyStyle;
  header?: TypographyStyle;
}

interface StoreHeaderConfig {
  showStoreName?: boolean;
  logoSize?: number;
}

interface StoreThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  typography?: StoreTypography;
  header?: StoreHeaderConfig;
  templateId?: string;
  socials?: { instagram?: string; facebook?: string; twitter?: string; tiktok?: string; youtube?: string };
  contact?: { email?: string; phone?: string; whatsapp?: string; address?: string };
  seo?: { metaTitle?: string; metaDescription?: string };
  translations?: Record<string, TranslatableFields>;
}

interface Store {
  id: string | number;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  favicon_url: string;
  custom_domain: string;
  is_active: boolean;
  theme_key?: string;
  theme_customizations?: Record<string, unknown>;
  language_config: StoreLanguageConfig | null;
  theme_config: StoreThemeConfig | null;
}

// Translatable text fields per locale
interface TranslatableFields {
  name: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français',
};

const RTL_LOCALES = ['ar'];

// Typography defaults are stored as part of `theme_config` and edited in the
// builder's Design panel; this page still ships them through the form state so
// concurrent saves here don't wipe the values, but the editor UI lives elsewhere.
const DEFAULT_TYPOGRAPHY: StoreTypography = {
  heading: { fontFamily: '', color: '', fontSize: undefined },
  body:    { fontFamily: '', color: '', fontSize: undefined },
  button:  { fontFamily: '', color: '', fontSize: undefined },
  link:    { fontFamily: '', color: '', fontSize: undefined },
  header:  { fontFamily: '', color: '', fontSize: undefined },
};

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

// Hostname suffix shown next to the store slug input, derived from the web
// origin so dev shows ".localhost:3003" and prod shows the real platform host.
const PLATFORM_DOMAIN_SUFFIX = (() => {
  try {
    return `.${new URL(WEB_ORIGIN).host}`;
  } catch {
    return '.localhost:3003';
  }
})();

const EMPTY_TRANSLATABLE: TranslatableFields = { name: '', description: '', metaTitle: '', metaDescription: '' };

function storeUrl(slug: string): string {
  const u = new URL(WEB_ORIGIN);
  return `${u.protocol}//${slug}.${u.host}`;
}

// ---------------------------------------------------------------------------
// Default form state (non-translatable fields only)
// ---------------------------------------------------------------------------

const DEFAULT_FORM = {
  slug: '',
  logo_url: '',
  favicon_url: '',
  custom_domain: '',
  is_active: true,
  theme_key: DEFAULT_THEME_KEY,
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  fontFamily: 'Inter',
  typography: { ...DEFAULT_TYPOGRAPHY },
  showStoreName: true,
  logoSize: 32,
  templateId: 'default',
  socials: { instagram: '', facebook: '', twitter: '', tiktok: '', youtube: '' },
  contact: { email: '', phone: '', whatsapp: '', address: '' },
  primary_locale: 'en',
  secondary_locales: ['en'] as string[],
  auto_translate: false,
};

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-zinc-900' : 'bg-zinc-200'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CreatorStorePage() {
  const { token } = useAuth();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState(DEFAULT_FORM);

  // Translation state: { locale: { name, description, metaTitle, metaDescription } }
  const [translations, setTranslations] = useState<Record<string, TranslatableFields>>({ en: { ...EMPTY_TRANSLATABLE } });
  const [activeLocale, setActiveLocale] = useState('en');
  const [translatingLocale, setTranslatingLocale] = useState('');

  // All locales for the language tabs (primary + secondary)
  const allLocales = [form.primary_locale, ...form.secondary_locales.filter(l => l !== form.primary_locale)];
  const hasMultipleLocales = allLocales.length > 1;
  const isRtl = RTL_LOCALES.includes(activeLocale);

  // ---------------------------------------------------------------------------
  // Load store
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!token) return;
    api<Store>('/stores/my/store', { token })
      .then((s) => {
        setStore(s);
        const tc = s.theme_config ?? {};
        const primary = s.language_config?.primary_locale ?? 'en';
        const secondary = s.language_config?.secondary_locales ?? [];
        const all = [primary, ...secondary.filter(l => l !== primary)];

        const typo = tc.typography ?? {};
        const hdr = tc.header ?? {};

        setForm({
          slug: s.slug ?? '',
          logo_url: s.logo_url ?? '',
          favicon_url: s.favicon_url ?? '',
          custom_domain: s.custom_domain ?? '',
          is_active: s.is_active ?? true,
          theme_key: s.theme_key ?? DEFAULT_THEME_KEY,
          primaryColor: tc.primaryColor ?? '#2563eb',
          secondaryColor: tc.secondaryColor ?? '#1e40af',
          fontFamily: tc.fontFamily ?? 'Inter',
          typography: {
            heading: { fontFamily: typo.heading?.fontFamily ?? '', color: typo.heading?.color ?? '', fontSize: typo.heading?.fontSize },
            body:    { fontFamily: typo.body?.fontFamily    ?? '', color: typo.body?.color    ?? '', fontSize: typo.body?.fontSize },
            button:  { fontFamily: typo.button?.fontFamily  ?? '', color: typo.button?.color  ?? '', fontSize: typo.button?.fontSize },
            link:    { fontFamily: typo.link?.fontFamily    ?? '', color: typo.link?.color    ?? '', fontSize: typo.link?.fontSize },
            header:  { fontFamily: typo.header?.fontFamily  ?? '', color: typo.header?.color  ?? '', fontSize: typo.header?.fontSize },
          },
          showStoreName: hdr.showStoreName !== false,
          logoSize: typeof hdr.logoSize === 'number' && hdr.logoSize > 0 ? hdr.logoSize : 32,
          templateId: tc.templateId ?? 'default',
          socials: {
            instagram: tc.socials?.instagram ?? '', facebook: tc.socials?.facebook ?? '',
            twitter: tc.socials?.twitter ?? '', tiktok: tc.socials?.tiktok ?? '', youtube: tc.socials?.youtube ?? '',
          },
          contact: {
            email: tc.contact?.email ?? '', phone: tc.contact?.phone ?? '',
            whatsapp: tc.contact?.whatsapp ?? '', address: tc.contact?.address ?? '',
          },
          primary_locale: primary,
          secondary_locales: secondary.length ? secondary : [primary],
          auto_translate: s.language_config?.auto_translate ?? false,
        });

        // Build translations from theme_config.translations or fallback to top-level fields
        const savedTrans = tc.translations ?? {};
        const merged: Record<string, TranslatableFields> = {};
        all.forEach(l => {
          merged[l] = savedTrans[l]
            ? { ...EMPTY_TRANSLATABLE, ...savedTrans[l] }
            : { ...EMPTY_TRANSLATABLE };
        });
        // Ensure primary locale has the store-level name/description
        if (!merged[primary]?.name && s.name) merged[primary] = { ...merged[primary], name: s.name };
        if (!merged[primary]?.description && s.description) merged[primary] = { ...merged[primary], description: s.description };
        if (!merged[primary]?.metaTitle && tc.seo?.metaTitle) merged[primary] = { ...merged[primary], metaTitle: tc.seo.metaTitle };
        if (!merged[primary]?.metaDescription && tc.seo?.metaDescription) merged[primary] = { ...merged[primary], metaDescription: tc.seo.metaDescription };

        setTranslations(merged);
        setActiveLocale(primary);
      })
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [token]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const setField = <K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setNested = <G extends 'socials' | 'contact', K extends keyof (typeof DEFAULT_FORM)[G]>(group: G, key: K, value: string) =>
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));

  const setTransField = (locale: string, field: keyof TranslatableFields, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: { ...(prev[locale] || EMPTY_TRANSLATABLE), [field]: value },
    }));
  };

  const toggleSecondaryLocale = (code: string) => {
    setForm((prev) => {
      const next = prev.secondary_locales.includes(code)
        ? prev.secondary_locales.filter((l) => l !== code)
        : [...prev.secondary_locales, code];
      return { ...prev, secondary_locales: next };
    });
    // Ensure locale has a translations entry
    setTranslations(prev => prev[code] ? prev : { ...prev, [code]: { ...EMPTY_TRANSLATABLE } });
  };

  // Auto-translate from primary locale
  const handleTranslateTo = async (targetLocale: string) => {
    const source = translations[form.primary_locale];
    if (!source?.name?.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      // Translate all text fields in parallel
      const fields: (keyof TranslatableFields)[] = ['name', 'description', 'metaTitle', 'metaDescription'];
      const results = await Promise.all(
        fields.map(async (field) => {
          const text = source[field];
          if (!text?.trim()) return { field, translated: '' };
          const res = await api<{ translated: string }>('/translations/translate-text', {
            method: 'POST', token: token ?? undefined,
            body: JSON.stringify({ text, source_locale: form.primary_locale, target_locale: targetLocale }),
          });
          return { field, translated: res.translated || '' };
        })
      );
      setTranslations(prev => {
        const updated = { ...(prev[targetLocale] || EMPTY_TRANSLATABLE) };
        results.forEach(({ field, translated }) => { if (translated) updated[field] = translated; });
        return { ...prev, [targetLocale]: updated };
      });
    } catch (err) { console.error('Translation failed:', err); }
    finally { setTranslatingLocale(''); }
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaved(false);

    // Use primary locale translation for top-level store fields
    const primaryTrans = translations[form.primary_locale] || EMPTY_TRANSLATABLE;

    try {
      await Promise.all([
        api('/stores/my/store', {
          method: 'PUT', token,
          body: JSON.stringify({
            ...(form.slug && form.slug !== store?.slug ? { slug: form.slug } : {}),
            name: primaryTrans.name || '',
            description: primaryTrans.description || '',
            logo_url: form.logo_url,
            favicon_url: form.favicon_url,
            custom_domain: form.custom_domain,
            is_active: form.is_active,
          }),
        }),
        api('/stores/my/theme', {
          method: 'PUT', token,
          body: JSON.stringify({
            theme_config: {
              primaryColor: form.primaryColor,
              secondaryColor: form.secondaryColor,
              fontFamily: form.fontFamily,
              typography: form.typography,
              header: {
                showStoreName: form.showStoreName,
                logoSize: form.logoSize,
              },
              templateId: form.templateId,
              socials: form.socials,
              contact: form.contact,
              seo: {
                metaTitle: primaryTrans.metaTitle || '',
                metaDescription: primaryTrans.metaDescription || '',
              },
              translations,
            },
          }),
        }),
        api('/stores/my/languages', {
          method: 'PUT', token,
          body: JSON.stringify({
            primary_locale: form.primary_locale,
            secondary_locales: form.secondary_locales,
            auto_translate: form.auto_translate,
          }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error('Save error:', err); }
    finally { setSaving(false); }
  };

  // ---------------------------------------------------------------------------
  // Language tabs component
  // ---------------------------------------------------------------------------

  const LanguageTabs = () => {
    if (!hasMultipleLocales) return null;
    return (
      <div className="flex items-center gap-0 border-b px-6">
        {allLocales.map(locale => {
          const isDone = !!(translations[locale]?.name?.trim());
          const isActive = locale === activeLocale;
          const isPrimary = locale === form.primary_locale;
          return (
            <button key={locale} type="button" onClick={() => setActiveLocale(locale)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
                isActive ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {LOCALE_LABELS[locale] || locale.toUpperCase()}
              {!isPrimary && isDone && <Check className="w-3 h-3 text-emerald-500" />}
              {isPrimary && <span className="text-[9px] text-zinc-400">(primary)</span>}
            </button>
          );
        })}
      </div>
    );
  };

  // Auto-translate banner for secondary locales
  const TranslateBanner = () => {
    if (activeLocale === form.primary_locale) return null;
    const primaryName = translations[form.primary_locale]?.name || '';
    return (
      <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
        <span className="text-xs text-muted-foreground">
          Auto-translate from <strong>{LOCALE_LABELS[form.primary_locale] || form.primary_locale}</strong>
          {primaryName ? `: "${primaryName.substring(0, 35)}${primaryName.length > 35 ? '…' : ''}"` : ''}
        </span>
        <button type="button" onClick={() => handleTranslateTo(activeLocale)}
          disabled={!!translatingLocale || !primaryName.trim()}
          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
        >
          {translatingLocale === activeLocale
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Translating...</>
            : <><Languages className="w-3 h-3" /> Auto-translate</>}
        </button>
      </div>
    );
  };

  // Current locale's translatable data
  const trans = translations[activeLocale] || EMPTY_TRANSLATABLE;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!store) {
    return (
      <CreateStoreForm
        token={token ?? ''}
        onCreated={(s) => {
          setStore(s);
          const tc = s.theme_config ?? {};
          const primary = s.language_config?.primary_locale ?? 'en';
          const secondary = s.language_config?.secondary_locales ?? [];
          setForm({
            ...DEFAULT_FORM,
            slug: s.slug ?? '',
            primary_locale: primary,
            secondary_locales: secondary.length ? secondary : [primary],
          });
          setTranslations({ [primary]: { ...EMPTY_TRANSLATABLE, name: s.name ?? '', description: s.description ?? '' } });
          setActiveLocale(primary);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Store</h1>
          <p className="text-sm text-muted-foreground">Manage your storefront settings</p>
        </div>
        <a href={storeUrl(store.slug)} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Visit Store
          </Button>
        </a>
      </div>

      {/* ── Design moved to Builder ──────────────────────────── */}
      <Card className="shadow-none border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Palette className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900">
                Theme, colors & typography are now in the Builder
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                Templates, brand colors, fonts, per-element typography, header layout, logo
                and favicon all live alongside your pages — open any page in the builder and
                switch to the <strong>Design</strong> tab in the left panel.
              </p>
            </div>
            <Link href="/creator/pages">
              <Button size="sm" className="shrink-0">
                Open Builder
                <ArrowRight className="size-3.5 ms-1.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ── Store Information (translatable) ──────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Store Information</CardTitle></CardHeader>
        <LanguageTabs />
        <CardContent className="space-y-4 pt-4">
          <TranslateBanner />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Store Name {activeLocale === form.primary_locale && <span className="text-red-500">*</span>}</Label>
              <Input
                dir={isRtl ? 'rtl' : 'ltr'}
                className="h-8 text-sm"
                value={trans.name}
                onChange={(e) => setTransField(activeLocale, 'name', e.target.value)}
                placeholder={activeLocale === form.primary_locale ? 'My Store' : `Store name in ${LOCALE_LABELS[activeLocale] || activeLocale}...`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <div className="flex items-center">
                <Input
                  className="h-8 text-sm rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={form.slug}
                  onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
                <span className="h-8 px-3 flex items-center bg-zinc-50 border border-zinc-200 rounded-r-md text-xs text-muted-foreground whitespace-nowrap">{PLATFORM_DOMAIN_SUFFIX}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <RichTextEditor
              content={trans.description}
              onChange={(val) => setTransField(activeLocale, 'description', val)}
              placeholder={activeLocale === form.primary_locale ? 'Tell customers about your store...' : `Description in ${LOCALE_LABELS[activeLocale] || activeLocale}...`}
            />
          </div>

          {/* Non-translatable fields only on primary tab */}
          {activeLocale === form.primary_locale && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Custom Domain</Label>
                <Input className="h-8 text-sm" value={form.custom_domain} onChange={(e) => setField('custom_domain', e.target.value)} placeholder="yourdomain.com (optional)" />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Store Active</p>
                  <p className="text-[11px] text-muted-foreground">Customers can browse and purchase from your store</p>
                </div>
                <Toggle checked={form.is_active} onChange={(v) => setField('is_active', v)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Contact & Social ──────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Contact & Social</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="h-8 text-sm" type="email" value={form.contact.email} onChange={(e) => setNested('contact', 'email', e.target.value)} placeholder="hello@yourstore.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input className="h-8 text-sm" type="tel" value={form.contact.phone} onChange={(e) => setNested('contact', 'phone', e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp</Label>
              <Input className="h-8 text-sm" value={form.contact.whatsapp} onChange={(e) => setNested('contact', 'whatsapp', e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Textarea className="text-sm resize-none" rows={2} value={form.contact.address} onChange={(e) => setNested('contact', 'address', e.target.value)} placeholder="123 Main St, City, Country" />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Social Links</Label>
            <div className="space-y-2">
              {([
                { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/yourstore' },
                { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourstore' },
                { key: 'twitter', label: 'X / Twitter', placeholder: 'x.com/yourstore' },
                { key: 'tiktok', label: 'TikTok', placeholder: 'tiktok.com/@yourstore' },
                { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@yourstore' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-zinc-500 shrink-0 flex items-center gap-1"><Link2 className="w-3 h-3" /> {label}</span>
                  <Input className="h-8 text-sm" value={form.socials[key]} onChange={(e) => setNested('socials', key, e.target.value)} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Languages ─────────────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Languages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Primary Language</Label>
            <SearchableSelect
              value={form.primary_locale}
              onChange={(v) => {
                setForm((prev) => ({
                  ...prev, primary_locale: v,
                  secondary_locales: prev.secondary_locales.includes(v) ? prev.secondary_locales : [...prev.secondary_locales, v],
                }));
                setTranslations(prev => prev[v] ? prev : { ...prev, [v]: { ...EMPTY_TRANSLATABLE } });
                setActiveLocale(v);
              }}
              placeholder="Select language..."
              options={LOCALES}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Secondary Languages</Label>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((locale) => {
                const isSelected = form.secondary_locales.includes(locale.value);
                const isPrimary = form.primary_locale === locale.value;
                return (
                  <button key={locale.value} type="button"
                    onClick={() => { if (!isPrimary) toggleSecondaryLocale(locale.value); }}
                    disabled={isPrimary}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-colors ${isSelected ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'} ${isPrimary ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                  >
                    {locale.label}
                    {isPrimary && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-auto">primary</Badge>}
                  </button>
                );
              })}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Auto-translate with AI</p>
              <p className="text-[11px] text-muted-foreground">Automatically translate your content into secondary languages</p>
            </div>
            <Toggle checked={form.auto_translate} onChange={(v) => setField('auto_translate', v)} />
          </div>
        </CardContent>
      </Card>

      {/* ── SEO (translatable) ────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">SEO</CardTitle></CardHeader>
        <LanguageTabs />
        <CardContent className="space-y-4 pt-4">
          {activeLocale !== form.primary_locale && <TranslateBanner />}
          <p className="text-xs text-muted-foreground">Used in search engine results</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Meta Title</Label>
            <Input
              dir={isRtl ? 'rtl' : 'ltr'}
              className="h-8 text-sm"
              value={trans.metaTitle}
              onChange={(e) => setTransField(activeLocale, 'metaTitle', e.target.value)}
              placeholder={activeLocale === form.primary_locale ? 'My Store — Best Products Online' : `Meta title in ${LOCALE_LABELS[activeLocale] || activeLocale}...`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Meta Description</Label>
            <Textarea
              dir={isRtl ? 'rtl' : 'ltr'}
              className="text-sm resize-none" rows={2}
              value={trans.metaDescription}
              onChange={(e) => setTransField(activeLocale, 'metaDescription', e.target.value)}
              placeholder={activeLocale === form.primary_locale ? 'Shop the best products at unbeatable prices...' : `Meta description in ${LOCALE_LABELS[activeLocale] || activeLocale}...`}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Save row ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-8">
        <a href={storeUrl(store.slug)} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" type="button">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Visit Store
          </Button>
        </a>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-600 font-medium">Saved!</span>}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Store form (shown when creator has no store yet)
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function CreateStoreForm({ token, onCreated }: { token: string; onCreated: (store: Store) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) setSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;
    setError('');
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api<Store>('/stores', {
        method: 'POST', token,
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          primary_locale: primaryLocale,
          secondary_locales: [primaryLocale],
        }),
      });
      onCreated(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Store</h1>
        <p className="text-sm text-muted-foreground">Set up your storefront to start selling</p>
      </div>
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Create your store</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Store Name <span className="text-red-500">*</span></Label>
              <Input className="h-9 text-sm" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="My Store" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug <span className="text-red-500">*</span></Label>
              <div className="flex items-center">
                <Input
                  className="h-9 text-sm rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                  placeholder="my-store"
                  required
                />
                <span className="h-9 px-3 flex items-center bg-zinc-50 border border-zinc-200 rounded-r-md text-xs text-muted-foreground whitespace-nowrap">{PLATFORM_DOMAIN_SUFFIX}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Lowercase letters, digits and hyphens only.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea className="text-sm resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell customers about your store..." />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Primary Language</Label>
              <SearchableSelect value={primaryLocale} onChange={setPrimaryLocale} options={LOCALES} placeholder="Select language..." />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="pt-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Creating...</> : 'Create Store'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
