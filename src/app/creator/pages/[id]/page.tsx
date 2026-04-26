'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Trash2, Languages, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { RichTextEditor } from '@/components/common/RichTextEditor';

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français',
};
const RTL_LOCALES = ['ar'];

type LocaleTranslation = { title: string; content: string };

interface StorePage {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  template_type: string;
  type: string;
  translations: { locale: string; title: string; content?: string }[];
}

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [page, setPage] = useState<StorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Language config
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [allLocales, setAllLocales] = useState<string[]>(['en']);
  const [activeLocale, setActiveLocale] = useState('en');
  const [translations, setTranslations] = useState<Record<string, LocaleTranslation>>({
    en: { title: '', content: '' },
  });
  const [translatingLocale, setTranslatingLocale] = useState('');
  const [translatingContent, setTranslatingContent] = useState(false);

  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  const setTransField = (locale: string, field: keyof LocaleTranslation, value: string) => {
    setTranslations(prev => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
  };

  // Fetch store language config
  useEffect(() => {
    if (!token) return;
    api<any>('/stores/my/store', { token })
      .then(store => {
        const primary: string = store.language_config?.primary_locale || 'en';
        const secondary: string[] = store.language_config?.secondary_locales || [];
        const all = [primary, ...secondary.filter((l: string) => l !== primary)];
        setPrimaryLocale(primary);
        setAllLocales(all);
        setActiveLocale(primary);
        setTranslations(prev => {
          const next: Record<string, LocaleTranslation> = {};
          all.forEach(l => { next[l] = prev[l] || { title: '', content: '' }; });
          return next;
        });
      })
      .catch(() => {});
  }, [token]);

  // Fetch page data
  useEffect(() => {
    if (!token) return;
    api<StorePage>(`/pages/${id}`, { token })
      .then(p => {
        setPage(p);
        setSlug(p.slug);
        setStatus(p.status);
        setTranslations(prev => {
          const next = { ...prev };
          (p.translations || []).forEach(t => {
            next[t.locale] = { title: t.title || '', content: t.content || '' };
          });
          return next;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleTranslateTo = async (targetLocale: string) => {
    const sourceTitle = translations[primaryLocale]?.title || '';
    if (!sourceTitle.trim() || translatingLocale) return;
    setTranslatingLocale(targetLocale);
    try {
      const res = await api<{ translated: string }>('/translations/translate-text', {
        method: 'POST', token: token ?? undefined,
        body: JSON.stringify({ text: sourceTitle, source_locale: primaryLocale, target_locale: targetLocale }),
      });
      if (res.translated) setTransField(targetLocale, 'title', res.translated);
    } catch (err) {
      console.error(err);
    } finally {
      setTranslatingLocale('');
    }
  };

  const handleTranslateContent = async () => {
    const sourceHtml = translations[primaryLocale]?.content || '';
    if (!sourceHtml.trim() || translatingContent) return;
    setTranslatingContent(true);
    try {
      // Translate paragraph by paragraph to preserve basic structure
      const paragraphs = sourceHtml
        .split(/<\/?p[^>]*>/i)
        .map(s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      if (paragraphs.length === 0) return;

      const translatedParagraphs: string[] = [];
      for (const para of paragraphs) {
        const res = await api<{ translated: string }>('/translations/translate-text', {
          method: 'POST', token: token ?? undefined,
          body: JSON.stringify({ text: para, source_locale: primaryLocale, target_locale: activeLocale }),
        });
        translatedParagraphs.push(res.translated || para);
      }

      const translatedHtml = translatedParagraphs.map(p => `<p>${p}</p>`).join('');
      setTransField(activeLocale, 'content', translatedHtml);
    } catch (err) {
      console.error('Content translation failed:', err);
    } finally {
      setTranslatingContent(false);
    }
  };

  const handleSave = async () => {
    if (!token || !page) return;
    setSaving(true);
    try {
      const translationsPayload = Object.entries(translations)
        .filter(([, t]) => t.title.trim())
        .map(([locale, t]) => ({ locale, title: t.title, content: t.content || '' }));

      await api(`/pages/${id}`, {
        method: 'PUT', token,
        body: JSON.stringify({ slug, status, translations: translationsPayload }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !page) return;
    await api(`/pages/${id}`, { method: 'DELETE', token });
    router.push('/creator/pages');
  };

  if (loading) return <p className="text-sm text-muted-foreground p-6">Loading...</p>;
  if (!page) return <p className="text-sm text-muted-foreground p-6">Page not found.</p>;

  const isPublished = status === 'PUBLISHED';
  const hasMultipleLocales = allLocales.length > 1;
  const isRtl = RTL_LOCALES.includes(activeLocale);
  const primaryTitle = translations[primaryLocale]?.title || '';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Edit Page</h1>
          <p className="text-muted-foreground font-mono text-xs">/{page.slug}</p>
        </div>
        <Badge variant="secondary" className={`text-[10px] ${isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
          {isPublished ? 'Published' : 'Draft'}
        </Badge>
      </div>

      {/* Page metadata */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Page Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Slug (URL)</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">/</span>
              <Input className="h-8 text-sm font-mono flex-1" value={slug} onChange={e => setSlug(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Template Type</Label>
            <Input className="h-8 text-sm" value={page.type || page.template_type || ''} disabled />
          </div>
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Published</p>
              <p className="text-xs text-muted-foreground">Visible to store visitors</p>
            </div>
            <button type="button" role="switch" aria-checked={isPublished}
              onClick={() => setStatus(isPublished ? 'DRAFT' : 'PUBLISHED')}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${isPublished ? 'bg-zinc-900' : 'bg-zinc-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isPublished ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </label>
        </CardContent>
      </Card>

      {/* Content card with language tabs */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Page Content</CardTitle>
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
                Auto-translate title from <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
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
              onChange={e => setTransField(activeLocale, 'title', e.target.value)}
            />
          </div>

          {/* Content editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Content</Label>
              {activeLocale !== primaryLocale && (
                <button
                  type="button"
                  onClick={handleTranslateContent}
                  disabled={translatingContent || !translations[primaryLocale]?.content?.trim()}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {translatingContent
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Translating content...</>
                    : <><Languages className="w-3 h-3" /> Translate Content</>}
                </button>
              )}
            </div>
            <div dir={isRtl ? 'rtl' : 'ltr'}>
              <RichTextEditor
                content={translations[activeLocale]?.content || ''}
                onChange={val => setTransField(activeLocale, 'content', val)}
                placeholder={
                  activeLocale === primaryLocale
                    ? 'Write your page content...'
                    : `Content in ${LOCALE_LABELS[activeLocale] || activeLocale}...`
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50"
          onClick={() => setDeleteConfirm(true)}>
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Page
        </Button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-600 font-medium">Saved!</span>}
          <Button size="sm" onClick={handleSave}
            disabled={saving || !translations[primaryLocale]?.title?.trim() || !slug}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Page</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently delete "{primaryTitle}" from your store.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
