'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ArrowLeft, Languages, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français',
};
const RTL_LOCALES = ['ar'];

const TEMPLATE_OPTIONS = [
  { value: 'custom', label: 'Custom Page', description: 'Blank page — build with Page Builder' },
  { value: 'about', label: 'About Page', description: 'Tell customers about you and your brand' },
  { value: 'faq', label: 'FAQ', description: 'Frequently asked questions' },
  { value: 'contact', label: 'Contact', description: 'Contact information' },
  { value: 'shipping', label: 'Shipping Policy', description: 'Shipping terms and delivery info' },
  { value: 'returns', label: 'Return Policy', description: 'Returns and refund policy' },
  { value: 'privacy', label: 'Privacy Policy', description: 'Privacy and data policy' },
  { value: 'terms', label: 'Terms & Conditions', description: 'Terms of service' },
];

type LocaleTranslation = { title: string };

export default function NewPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [templateType, setTemplateType] = useState('custom');
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Language config
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');
  const [translations, setTranslations] = useState<Record<string, LocaleTranslation>>({
    en: { title: '' },
  });
  const [translatingLocale, setTranslatingLocale] = useState('');

  const setTransField = (locale: string, value: string) => {
    setTranslations(prev => ({ ...prev, [locale]: { title: value } }));
  };

  // Fetch store id + language config
  useEffect(() => {
    if (!token) return;
    api<any>('/stores/my/store', { token })
      .then(s => {
        setStoreId(s?.id || null);
        const primary: string = s.language_config?.primary_locale || 'en';
        const secondary: string[] = s.language_config?.secondary_locales || [];
        const all = [primary, ...secondary.filter((l: string) => l !== primary)];
        setPrimaryLocale(primary);
        setAllLocales(all);
        setActiveLocale(primary);
        const init: Record<string, LocaleTranslation> = {};
        all.forEach(l => { init[l] = { title: '' }; });
        setTranslations(init);
      })
      .catch(() => setStoreId(null));
  }, [token]);

  const autoSlug = (title: string) =>
    title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handlePrimaryTitleChange = (v: string) => {
    setTransField(primaryLocale, v);
    // Auto-slug from primary locale title
    if (activeLocale === primaryLocale) setSlug(autoSlug(v));
  };

  const handleTranslateTo = async (targetLocale: string) => {
    const sourceTitle = translations[primaryLocale]?.title || '';
    if (!sourceTitle.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      const res = await api<{ translated: string }>('/translations/translate-text', {
        method: 'POST', token: token ?? undefined,
        body: JSON.stringify({ text: sourceTitle, source_locale: primaryLocale, target_locale: targetLocale }),
      });
      if (res.translated) setTransField(targetLocale, res.translated);
    } catch (err) {
      console.error(err);
    } finally {
      setTranslatingLocale('');
    }
  };

  const handleSave = async () => {
    if (!token || !storeId) return;
    const primaryTitle = translations[primaryLocale]?.title?.trim() || '';
    if (!primaryTitle) { setError('Title is required'); return; }
    if (!slug.trim()) { setError('Slug is required'); return; }
    setSaving(true);
    setError('');
    try {
      const translationsPayload = Object.entries(translations)
        .filter(([, t]) => t.title.trim())
        .map(([locale, t]) => ({ locale, title: t.title }));

      await api(`/stores/${storeId}/pages`, {
        method: 'POST', token: token ?? undefined,
        body: JSON.stringify({
          slug,
          template_type: templateType,
          is_published: isPublished,
          translations: translationsPayload,
        }),
      });
      router.push('/creator/pages');
    } catch (err: any) {
      setError(err?.message || 'Failed to create page');
    } finally {
      setSaving(false);
    }
  };

  if (!storeId) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">You need to set up your store first.</p>
            <Button size="sm" onClick={() => router.push('/creator/store')}>Set Up Store</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasMultipleLocales = allLocales.length > 1;
  const isRtl = RTL_LOCALES.includes(activeLocale);
  const primaryTitle = translations[primaryLocale]?.title || '';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Page</h1>
          <p className="text-sm text-muted-foreground">Create a static page for your store</p>
        </div>
      </div>

      {/* Page type */}
      <Card className="shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Page Type</CardTitle></CardHeader>
        <CardContent>
          <SearchableSelect value={templateType} onChange={setTemplateType}
            placeholder="Select template..." options={TEMPLATE_OPTIONS} />
        </CardContent>
      </Card>

      {/* Page details with language tabs */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Page Details</CardTitle>
        </CardHeader>

        {/* Language tabs */}
        {hasMultipleLocales && (
          <div className="flex items-center gap-0 border-b px-6">
            {allLocales.map(locale => {
              const isDone = !!translations[locale]?.title?.trim();
              const isActive = locale === activeLocale;
              return (
                <button key={locale} type="button" onClick={() => setActiveLocale(locale)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
                    isActive ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {LOCALE_LABELS[locale] || locale.toUpperCase()}
                  {locale !== primaryLocale && isDone && <Check className="w-3 h-3 text-emerald-500" />}
                  {locale === primaryLocale && <span className="text-[9px] text-zinc-400">(primary)</span>}
                </button>
              );
            })}
          </div>
        )}

        <CardContent className="pt-4 space-y-4">
          {/* Auto-translate banner */}
          {activeLocale !== primaryLocale && (
            <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-dashed">
              <span className="text-xs text-muted-foreground">
                Auto-translate from <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                {primaryTitle ? `: "${primaryTitle.substring(0, 40)}${primaryTitle.length > 40 ? '…' : ''}"` : ''}
              </span>
              <button type="button" onClick={() => handleTranslateTo(activeLocale)}
                disabled={!!translatingLocale || !primaryTitle.trim()}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
              >
                {translatingLocale === activeLocale
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Translating...</>
                  : <><Languages className="w-3 h-3" /> Auto-translate</>}
              </button>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Title {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
            </Label>
            <Input
              dir={isRtl ? 'rtl' : 'ltr'}
              className="h-8 text-sm"
              placeholder={activeLocale === primaryLocale ? 'About Us' : `Title in ${LOCALE_LABELS[activeLocale] || activeLocale}...`}
              value={translations[activeLocale]?.title || ''}
              onChange={e => {
                if (activeLocale === primaryLocale) {
                  handlePrimaryTitleChange(e.target.value);
                } else {
                  setTransField(activeLocale, e.target.value);
                }
              }}
            />
          </div>

          {/* Slug (always shown) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Slug (URL) *</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">/</span>
              <Input className="h-8 text-sm font-mono flex-1" placeholder="about-us"
                value={slug} onChange={e => setSlug(autoSlug(e.target.value))} />
            </div>
          </div>

          {/* Publish toggle */}
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Publish immediately</p>
              <p className="text-xs text-muted-foreground">Make this page visible in your store</p>
            </div>
            <button type="button" role="switch" aria-checked={isPublished}
              onClick={() => setIsPublished(!isPublished)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${isPublished ? 'bg-zinc-900' : 'bg-zinc-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isPublished ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </label>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>Cancel</Button>
        <Button size="sm" onClick={handleSave}
          disabled={saving || !translations[primaryLocale]?.title?.trim() || !slug}>
          {saving ? 'Creating...' : 'Create Page'}
        </Button>
      </div>
    </div>
  );
}
