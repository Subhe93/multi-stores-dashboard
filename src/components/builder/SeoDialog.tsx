'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { PageTranslationRow } from './types';

interface SeoDialogProps {
  pageId: string;
  pageType: string;
  initialSeo: Record<string, unknown>;
  initialTranslations: PageTranslationRow[];
  primaryLocale: string;
  secondaryLocales: string[];
  activeLocale: string;
  onSaved: () => Promise<void> | void;
}

interface SeoState {
  og_image: string;
  canonical: string;
  robots: string;
  twitter_card: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const ROBOTS_OPTIONS = ['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow'];
const TWITTER_CARDS = ['summary', 'summary_large_image'];

export function SeoDialog({
  pageId,
  pageType,
  initialSeo,
  initialTranslations,
  primaryLocale,
  secondaryLocales,
  activeLocale,
  onSaved,
}: SeoDialogProps) {
  const t = useTranslations();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Page-level SEO settings (shared across locales).
  const [seo, setSeo] = useState<SeoState>(() => ({
    og_image: (initialSeo.og_image as string) || '',
    canonical: (initialSeo.canonical as string) || '',
    robots: (initialSeo.robots as string) || 'index, follow',
    twitter_card: (initialSeo.twitter_card as string) || 'summary_large_image',
  }));

  // Per-locale meta. The active locale defaults to the builder's current tab
  // so creators don't have to switch twice.
  const [editLocale, setEditLocale] = useState(activeLocale);
  const allLocales = Array.from(new Set([primaryLocale, ...secondaryLocales]));

  const [translations, setTranslations] = useState<Record<string, PageTranslationRow>>(() => {
    const map: Record<string, PageTranslationRow> = {};
    for (const l of allLocales) {
      const existing = initialTranslations.find((t) => t.locale === l);
      map[l] = existing || { locale: l };
    }
    return map;
  });

  // Reset state every time the dialog re-opens so it reflects the latest server data.
  useEffect(() => {
    if (!open) return;
    setSeo({
      og_image: (initialSeo.og_image as string) || '',
      canonical: (initialSeo.canonical as string) || '',
      robots: (initialSeo.robots as string) || 'index, follow',
      twitter_card: (initialSeo.twitter_card as string) || 'summary_large_image',
    });
    const map: Record<string, PageTranslationRow> = {};
    for (const l of allLocales) {
      const existing = initialTranslations.find((t) => t.locale === l);
      map[l] = existing || { locale: l };
    }
    setTranslations(map);
    setEditLocale(activeLocale);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = translations[editLocale] || { locale: editLocale };

  function patchTranslation(partial: Partial<PageTranslationRow>) {
    setTranslations((prev) => ({
      ...prev,
      [editLocale]: { ...(prev[editLocale] || { locale: editLocale }), ...partial },
    }));
  }

  async function uploadImage(file: File) {
    if (!token) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/uploads?folder=page-seo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error(t('builder.uploadFailed'));
    const json = await res.json();
    return (json.data?.url || json.url) as string;
  }

  async function handleSave() {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const cleanedSeo: Record<string, unknown> = {};
      if (seo.og_image) cleanedSeo.og_image = seo.og_image;
      if (seo.canonical) cleanedSeo.canonical = seo.canonical;
      if (seo.robots) cleanedSeo.robots = seo.robots;
      if (seo.twitter_card) cleanedSeo.twitter_card = seo.twitter_card;

      // Only send rows that actually carry SEO fields — empty rows would
      // overwrite the title set elsewhere with null.
      const translationsToSend = Object.values(translations).filter(
        (t) => t.title || t.meta_title || t.meta_description,
      );

      await api(`/v2/pages/${pageId}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          seo: cleanedSeo,
          translations: translationsToSend,
        }),
      });
      await onSaved();
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('builder.failedToSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" title={t('builder.seoSettings')}>
            <Search className="w-3.5 h-3.5" />
            {t('builder.seo')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('builder.seoAndSharing')}</DialogTitle>
          <DialogDescription>
            {t('builder.seoDesc', { pageType: pageType.toLowerCase() })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {/* Per-locale meta */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t('builder.meta')} ({editLocale})
              </Label>
              {allLocales.length > 1 && (
                <div className="flex gap-1">
                  {allLocales.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setEditLocale(l)}
                      className={
                        l === editLocale
                          ? 'px-2 py-0.5 text-[11px] rounded bg-zinc-900 text-white'
                          : 'px-2 py-0.5 text-[11px] rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                      }
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('builder.metaTitle')}</Label>
              <Input
                value={current.meta_title || ''}
                onChange={(e) => patchTranslation({ meta_title: e.target.value })}
                maxLength={70}
                placeholder={current.title || t('builder.metaTitlePlaceholder')}
              />
              <p className="text-[10px] text-muted-foreground">
                {t('builder.metaTitleHint', { count: (current.meta_title || '').length })}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('builder.metaDescription')}</Label>
              <Textarea
                rows={3}
                value={current.meta_description || ''}
                onChange={(e) => patchTranslation({ meta_description: e.target.value })}
                maxLength={160}
              />
              <p className="text-[10px] text-muted-foreground">
                {(current.meta_description || '').length}/160
              </p>
            </div>
          </section>

          {/* Sharing */}
          <section className="space-y-3 border-t pt-5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('builder.sharing')}
            </Label>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('builder.ogImage')}</Label>
              <div className="flex items-start gap-3">
                <label
                  className="relative flex items-center justify-center w-24 h-16 border-2 border-dashed border-zinc-200 rounded-md cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 overflow-hidden shrink-0"
                >
                  {seo.og_image ? (
                    <img
                      src={
                        seo.og_image.startsWith('http')
                          ? seo.og_image
                          : `${API_BASE.replace(/\/api$/, '')}${seo.og_image}`
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-4 h-4 text-zinc-400" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadImage(f);
                      if (url) setSeo((prev) => ({ ...prev, og_image: url }));
                    }}
                  />
                </label>
                <div className="flex-1 space-y-1.5">
                  <Input
                    className="h-8 text-xs"
                    value={seo.og_image}
                    onChange={(e) => setSeo((prev) => ({ ...prev, og_image: e.target.value }))}
                    placeholder={t('builder.ogImagePlaceholder')}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t('builder.ogImageHint')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('builder.twitterCardStyle')}</Label>
              <select
                value={seo.twitter_card}
                onChange={(e) => setSeo((prev) => ({ ...prev, twitter_card: e.target.value }))}
                className="w-full h-8 rounded-md border border-zinc-200 px-2 text-xs bg-white"
              >
                {TWITTER_CARDS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Indexing */}
          <section className="space-y-3 border-t pt-5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('builder.indexing')}
            </Label>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('builder.robotsDirective')}</Label>
              <select
                value={seo.robots}
                onChange={(e) => setSeo((prev) => ({ ...prev, robots: e.target.value }))}
                className="w-full h-8 rounded-md border border-zinc-200 px-2 text-xs bg-white"
              >
                {ROBOTS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {t('builder.robotsHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('builder.canonicalOverride')}</Label>
              <Input
                value={seo.canonical}
                onChange={(e) => setSeo((prev) => ({ ...prev, canonical: e.target.value }))}
                placeholder={t('builder.canonicalPlaceholder')}
              />
            </div>
          </section>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('builder.savingEllipsis')}
              </>
            ) : (
              t('builder.saveSeo')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
