'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { LOCALE_LABELS, RTL_LOCALES } from '@/components/creator/bundles/types';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface StoreTemplate {
  id: string;
  event: string;
  subject: Record<string, string> | null;
  body_html: Record<string, string> | null;
  body_text: Record<string, string> | null;
  enabled: boolean;
  updated_at: string | null;
  /** False means the customer currently receives the platform's template. */
  overridden: boolean;
}

interface EventCatalogEntry {
  event: string;
  variables: string[];
}

interface StoreLanguages {
  language_config?: {
    primary_locale?: string;
    secondary_locales?: string[];
  } | null;
}

// Tag-only or whitespace-only HTML counts as empty, so the per-locale dot
// reflects whether that language actually has content.
function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}

function isStringEmpty(s: string | undefined | null): boolean {
  return !s || !s.trim();
}

export default function CreatorEmailTemplateEditorPage() {
  const t = useTranslations('creator.email');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams<{ event: string }>();
  const event = params?.event as string;

  const [template, setTemplate] = useState<StoreTemplate | null>(null);
  const [eventVariables, setEventVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Only the languages this store actually sells in — a German-only shop has no
  // use for five other tabs, and an email is only ever rendered in one of the
  // store's own locales.
  const [locales, setLocales] = useState<string[]>([]);
  const [activeLocale, setActiveLocale] = useState('en');
  const [subjectByLocale, setSubjectByLocale] = useState<Record<string, string>>({});
  const [bodyHtmlByLocale, setBodyHtmlByLocale] = useState<Record<string, string>>({});
  const [bodyTextByLocale, setBodyTextByLocale] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const applyTemplate = (tpl: StoreTemplate) => {
    setTemplate(tpl);
    setSubjectByLocale({ ...(tpl?.subject || {}) });
    setBodyHtmlByLocale({ ...(tpl?.body_html || {}) });
    setBodyTextByLocale({ ...(tpl?.body_text || {}) });
    // An un-overridden event opens pre-filled with the platform template, so
    // default the switch on — saving is what turns it into an override.
    setEnabled(tpl.overridden ? Boolean(tpl.enabled) : true);
  };

  useEffect(() => {
    if (!token || !event) return;
    setLoading(true);
    Promise.all([
      api<StoreTemplate>(`/notification-templates/store/${event}`, { token }),
      api<EventCatalogEntry[]>('/notification-templates/store/events', { token }),
      api<StoreLanguages>('/stores/my/store', { token }),
    ])
      .then(([tpl, catalog, store]) => {
        applyTemplate(tpl);
        setEventVariables(catalog.find((e) => e.event === event)?.variables ?? []);

        const primary = store.language_config?.primary_locale || 'en';
        const secondary = store.language_config?.secondary_locales ?? [];
        // Primary first, then the secondaries, de-duplicated.
        const list = [primary, ...secondary].filter(
          (code, i, all) => code && all.indexOf(code) === i,
        );
        setLocales(list);
        setActiveLocale(primary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, event]);

  const activeDir = useMemo<'ltr' | 'rtl'>(
    () => (RTL_LOCALES.has(activeLocale) ? 'rtl' : 'ltr'),
    [activeLocale],
  );

  const handleSave = async () => {
    if (!token || !event || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      // Send only the active locale — the API merges it into the stored JSON
      // so the other languages are never dropped.
      const updated = await api<StoreTemplate>(`/notification-templates/store/${event}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          subject: { [activeLocale]: subjectByLocale[activeLocale] ?? '' },
          body_html: { [activeLocale]: bodyHtmlByLocale[activeLocale] ?? '' },
          body_text: { [activeLocale]: bodyTextByLocale[activeLocale] ?? '' },
          enabled,
        }),
      });
      applyTemplate({ ...updated, overridden: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token || !event || resetting) return;
    setResetting(true);
    try {
      await api(`/notification-templates/store/${event}`, { method: 'DELETE', token });
      router.push('/creator/email');
    } catch (err) {
      console.error(err);
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <Link
          href="/creator/email"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {tc('back')}
        </Link>
      </div>
    );
  }

  const eventLabel = t(`events.${event}` as never);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/creator/email"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
          aria-label={tc('back')}
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight truncate">{eventLabel}</h1>
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
              {template.event}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {template.overridden ? t('customised') : t('usingPlatform')}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium transition shrink-0 ${
            enabled
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-zinc-50 border-zinc-300 text-zinc-600'
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              enabled ? 'bg-emerald-500' : 'bg-zinc-400'
            }`}
          />
          {enabled ? t('enabled') : t('disabled')}
        </button>
      </div>

      {!template.overridden && (
        <p className="text-xs rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
          {t('inheritedNotice')}
        </p>
      )}
      {template.overridden && !enabled && (
        <p className="text-xs rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
          {t('disabledNotice')}
        </p>
      )}

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('content')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Locale tabs — the store's own languages only. Hidden entirely for
              a single-language store, where there is nothing to switch between. */}
          {locales.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b pb-3">
              {locales.map((code) => {
                const isActive = activeLocale === code;
                const empty =
                  isStringEmpty(subjectByLocale[code]) &&
                  isHtmlEmpty(bodyHtmlByLocale[code]) &&
                  isStringEmpty(bodyTextByLocale[code]);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveLocale(code)}
                    className={`relative px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                      isActive
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    }`}
                    title={empty ? t('emptyForLocale') : undefined}
                  >
                    <span>{LOCALE_LABELS[code] || code}</span>
                    <span className="ms-1.5 opacity-60 text-[10px] uppercase">{code}</span>
                    {empty && (
                      <span
                        className={`absolute -top-0.5 -inset-e-0.5 w-2 h-2 rounded-full ${
                          isActive ? 'bg-amber-300' : 'bg-amber-500'
                        }`}
                        aria-label={t('emptyForLocale')}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t('subject')}</Label>
            <Input
              className="h-9 text-sm"
              dir={activeDir}
              value={subjectByLocale[activeLocale] ?? ''}
              onChange={(e) =>
                setSubjectByLocale((prev) => ({ ...prev, [activeLocale]: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('bodyHtml')}</Label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    {t('hidePreview')}
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    {t('showPreview')}
                  </>
                )}
              </button>
            </div>
            <RichTextEditor
              key={`html-${activeLocale}`}
              content={bodyHtmlByLocale[activeLocale] ?? ''}
              onChange={(html) =>
                setBodyHtmlByLocale((prev) => ({ ...prev, [activeLocale]: html }))
              }
              dir={activeDir}
            />
            {showPreview && (
              <div className="rounded-md border bg-white p-3" dir={activeDir}>
                <p className="text-[10px] font-medium text-zinc-500 mb-2 uppercase tracking-wide">
                  {t('preview')}
                </p>
                <div
                  className="text-sm text-zinc-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html:
                      bodyHtmlByLocale[activeLocale] ||
                      `<p class="text-zinc-400">${t('emptyForLocale')}</p>`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('bodyText')}</Label>
            <Textarea
              dir={activeDir}
              className="text-sm font-mono min-h-32"
              value={bodyTextByLocale[activeLocale] ?? ''}
              onChange={(e) =>
                setBodyTextByLocale((prev) => ({ ...prev, [activeLocale]: e.target.value }))
              }
            />
          </div>

          {eventVariables.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] font-medium text-zinc-700 mb-1">{t('variables')}</p>
              <div className="flex flex-wrap gap-1.5">
                {eventVariables.map((v) => (
                  <code
                    key={v}
                    className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 cursor-pointer"
                    title={t('clickToCopy')}
                    role="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`{{${v}}}`).catch(() => {});
                    }}
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t gap-3">
            {template.overridden ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={handleReset}
                disabled={resetting}
              >
                <RotateCcw className="w-3.5 h-3.5 me-1" />
                {t('revertToPlatform')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-emerald-600 font-medium">{t('saved')}</span>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? tc('saving') : tc('save')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
