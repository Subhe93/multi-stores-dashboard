'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type LegalSlug = 'privacy' | 'terms' | 'refund' | 'shipping';
const VALID_SLUGS: LegalSlug[] = ['privacy', 'terms', 'refund', 'shipping'];

interface LegalPage {
  id: string;
  slug: LegalSlug;
  title: Record<string, string> | null;
  content: Record<string, string> | null;
  updated_at: string;
}

const LOCALES: { code: string; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'sv', label: 'Svenska', dir: 'ltr' },
];

// Strip whitespace/empty HTML so dot indicator reflects real emptiness.
function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length === 0;
}

export default function AdminLegalEditorPage() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as LegalSlug;

  if (slug && !VALID_SLUGS.includes(slug)) {
    notFound();
  }

  const [page, setPage] = useState<LegalPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLocale, setActiveLocale] = useState<string>('en');
  const [titleByLocale, setTitleByLocale] = useState<Record<string, string>>({});
  const [contentByLocale, setContentByLocale] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token || !slug) return;
    setLoading(true);
    api<LegalPage>(`/legal/admin/${slug}`, { token })
      .then((data) => {
        setPage(data);
        setTitleByLocale({ ...(data?.title || {}) });
        setContentByLocale({ ...(data?.content || {}) });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, slug]);

  const activeDir = useMemo(
    () => LOCALES.find((l) => l.code === activeLocale)?.dir || 'ltr',
    [activeLocale],
  );

  const handleSave = async () => {
    if (!token || !slug || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      // Only send the active locale — the API merges into the stored JSON.
      const updated = await api<LegalPage>(`/legal/admin/${slug}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          title: { [activeLocale]: titleByLocale[activeLocale] ?? '' },
          content: { [activeLocale]: contentByLocale[activeLocale] ?? '' },
        }),
      });
      setPage(updated);
      // Refresh the local copies so any server-side merges (e.g. other locales kept)
      // are reflected without losing the value the admin just typed.
      setTitleByLocale({ ...(updated?.title || {}) });
      setContentByLocale({ ...(updated?.content || {}) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const slugLabel = t(`legalSlug_${slug}` as any);
  const titleHeading = page ? slugLabel : '';

  if (loading) {
    return <p className="text-sm text-muted-foreground py-12 text-center">{t('loading')}</p>;
  }

  if (!page) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/legal"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('back')}
        </Link>
        <p className="text-sm text-muted-foreground py-12 text-center">{t('noLegalPagesYet')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/legal"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
          aria-label={t('back')}
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{t('editLegalPage')}</h1>
            <Badge variant="outline" className="text-[10px] font-mono">{page.slug}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{titleHeading}</p>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('legalContentLabel')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Locale tabs */}
          <div className="flex flex-wrap gap-1.5 border-b pb-3">
            {LOCALES.map((locale) => {
              const isActive = activeLocale === locale.code;
              const empty =
                isHtmlEmpty(contentByLocale[locale.code]) &&
                !(titleByLocale[locale.code] && titleByLocale[locale.code].trim());
              return (
                <button
                  key={locale.code}
                  type="button"
                  onClick={() => setActiveLocale(locale.code)}
                  className={`relative px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                    isActive
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                  title={empty ? t('legalEmptyForLocale') : undefined}
                >
                  <span>{locale.label}</span>
                  <span className="ml-1.5 opacity-60 text-[10px] uppercase">{locale.code}</span>
                  {empty && (
                    <span
                      className={`absolute -top-0.5 -inset-e-0.5 w-2 h-2 rounded-full ${
                        isActive ? 'bg-amber-300' : 'bg-amber-500'
                      }`}
                      aria-label={t('legalEmptyForLocale')}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('legalTitleLabel')}</Label>
            <Input
              className="h-9 text-sm"
              dir={activeDir}
              value={titleByLocale[activeLocale] ?? ''}
              onChange={(e) =>
                setTitleByLocale((prev) => ({ ...prev, [activeLocale]: e.target.value }))
              }
              placeholder={slugLabel}
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('legalContentLabel')}</Label>
            <RichTextEditor
              key={activeLocale}
              content={contentByLocale[activeLocale] ?? ''}
              onChange={(html) =>
                setContentByLocale((prev) => ({ ...prev, [activeLocale]: html }))
              }
              dir={activeDir}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-[11px] text-muted-foreground">
              {t('legalLastUpdated', { date: new Date(page.updated_at).toLocaleString() })}
            </p>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-emerald-600 font-medium">
                  {t('settingsSavedSuccessfully')}
                </span>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('saveSettings')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
