'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ArrowLeft, Languages, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska',
};
const RTL_LOCALES = ['ar'];

type Translator = ReturnType<typeof useTranslations>;

const buildTemplateOptions = (t: Translator) => [
  { value: 'CUSTOM', label: t('newPage.templateCustom'), description: t('newPage.templateCustomDesc') },
  { value: 'ABOUT', label: t('newPage.templateAbout'), description: t('newPage.templateAboutDesc') },
  { value: 'FAQ', label: t('newPage.templateFaq'), description: t('newPage.templateFaqDesc') },
  { value: 'CONTACT', label: t('newPage.templateContact'), description: t('newPage.templateContactDesc') },
  { value: 'SHIPPING_POLICY', label: t('newPage.templateShipping'), description: t('newPage.templateShippingDesc') },
  { value: 'RETURN_POLICY', label: t('newPage.templateReturn'), description: t('newPage.templateReturnDesc') },
  { value: 'PRIVACY_POLICY', label: t('newPage.templatePrivacy'), description: t('newPage.templatePrivacyDesc') },
  { value: 'TERMS', label: t('newPage.templateTerms'), description: t('newPage.templateTermsDesc') },
];

type LocaleTranslation = { title: string };

export default function NewPage() {
  const router = useRouter();
  const { token } = useAuth();
  const t = useTranslations('creator');
  const tc = useTranslations('common');
  const TEMPLATE_OPTIONS = buildTemplateOptions(t);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [templateType, setTemplateType] = useState('CUSTOM');
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
    if (!primaryTitle) { setError(t('newPage.titleRequired')); return; }
    if (!slug.trim()) { setError(t('newPage.slugRequired')); return; }
    setSaving(true);
    setError('');
    try {
      const translationsPayload = Object.entries(translations)
        .filter(([, t]) => t.title.trim())
        .map(([locale, t]) => ({ locale, title: t.title }));

      const created = await api<{ id: string }>(`/stores/${storeId}/pages`, {
        method: 'POST', token: token ?? undefined,
        body: JSON.stringify({
          slug,
          type: templateType,
          translations: translationsPayload,
        }),
      });
      if (isPublished && created?.id) {
        await api(`/pages/${created.id}`, {
          method: 'PUT', token: token ?? undefined,
          body: JSON.stringify({ status: 'PUBLISHED' }),
        });
      }
      router.push('/creator/pages');
    } catch (err: any) {
      setError(err?.message || t('newPage.failedCreate'));
    } finally {
      setSaving(false);
    }
  };

  if (!storeId) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {tc('back')}
        </Button>
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">{t('newPage.setUpStoreFirst')}</p>
            <Button size="sm" onClick={() => router.push('/creator/store')}>{t('newPage.setUpStore')}</Button>
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
          <ArrowLeft className="w-4 h-4 mr-1" /> {tc('back')}
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('newPage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('newPage.subtitle')}</p>
        </div>
      </div>

      {/* Page type */}
      <Card className="shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('newPage.pageType')}</CardTitle></CardHeader>
        <CardContent>
          <SearchableSelect value={templateType} onChange={setTemplateType}
            placeholder={t('newPage.selectTemplate')} options={TEMPLATE_OPTIONS} />
        </CardContent>
      </Card>

      {/* Page details with language tabs */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('newPage.pageDetails')}</CardTitle>
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
                  {locale === primaryLocale && <span className="text-[9px] text-zinc-400">{t('newPage.primaryParen')}</span>}
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
                {t('newPage.autoTranslateFrom')} <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
                {primaryTitle ? `: "${primaryTitle.substring(0, 40)}${primaryTitle.length > 40 ? '…' : ''}"` : ''}
              </span>
              <button type="button" onClick={() => handleTranslateTo(activeLocale)}
                disabled={!!translatingLocale || !primaryTitle.trim()}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
              >
                {translatingLocale === activeLocale
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('newPage.translating')}</>
                  : <><Languages className="w-3 h-3" /> {t('newPage.autoTranslate')}</>}
              </button>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('newPage.titleLabel')} {activeLocale === primaryLocale && <span className="text-red-500">*</span>}
            </Label>
            <Input
              dir={isRtl ? 'rtl' : 'ltr'}
              className="h-8 text-sm"
              placeholder={activeLocale === primaryLocale ? t('newPage.titlePlaceholder') : t('newPage.titleInLocale', { locale: LOCALE_LABELS[activeLocale] || activeLocale })}
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
            <Label className="text-xs">{t('newPage.slugLabel')}</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">/</span>
              <Input className="h-8 text-sm font-mono flex-1" placeholder="about-us"
                value={slug} onChange={e => setSlug(autoSlug(e.target.value))} />
            </div>
          </div>

          {/* Publish toggle */}
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-sm font-medium">{t('newPage.publishImmediately')}</p>
              <p className="text-xs text-muted-foreground">{t('newPage.publishImmediatelyDesc')}</p>
            </div>
            <button type="button" role="switch" aria-checked={isPublished}
              onClick={() => setIsPublished(!isPublished)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${isPublished ? 'bg-zinc-900' : 'bg-zinc-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isPublished ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'}`} />
            </button>
          </label>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>{tc('cancel')}</Button>
        <Button size="sm" onClick={handleSave}
          disabled={saving || !translations[primaryLocale]?.title?.trim() || !slug}>
          {saving ? t('newPage.creating') : t('newPage.createPage')}
        </Button>
      </div>
    </div>
  );
}
