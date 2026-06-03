'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface NotificationTemplate {
  id: string;
  event: string;
  subject: Record<string, string> | null;
  body_html: Record<string, string> | null;
  body_text: Record<string, string> | null;
  enabled: boolean;
  updated_at: string;
}

interface EventCatalogEntry {
  event: string;
  variables: string[];
}

const LOCALES: { code: string; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'sv', label: 'Svenska', dir: 'ltr' },
];

// Treat whitespace-only / tag-only HTML as empty so the dot indicator reflects real emptiness.
function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length === 0;
}

function isStringEmpty(s: string | undefined | null): boolean {
  return !s || !s.trim();
}

export default function AdminNotificationTemplateEditorPage() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const params = useParams<{ event: string }>();
  const event = params?.event as string;

  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [eventVariables, setEventVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocale, setActiveLocale] = useState<string>('en');
  const [subjectByLocale, setSubjectByLocale] = useState<Record<string, string>>({});
  const [bodyHtmlByLocale, setBodyHtmlByLocale] = useState<Record<string, string>>({});
  const [bodyTextByLocale, setBodyTextByLocale] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!token || !event) return;
    setLoading(true);
    // Load template + event catalog in parallel; catalog returns the variables
    // available for THIS event so we render the right hint chips.
    Promise.all([
      api<NotificationTemplate>(`/notification-templates/admin/${event}`, { token }),
      api<EventCatalogEntry[]>('/notification-templates/admin/events', { token }),
    ])
      .then(([tpl, catalog]) => {
        setTemplate(tpl);
        setSubjectByLocale({ ...(tpl?.subject || {}) });
        setBodyHtmlByLocale({ ...(tpl?.body_html || {}) });
        setBodyTextByLocale({ ...(tpl?.body_text || {}) });
        setEnabled(Boolean(tpl?.enabled));
        const found = catalog.find((e) => e.event === event);
        setEventVariables(found?.variables ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, event]);

  const activeDir = useMemo(
    () => LOCALES.find((l) => l.code === activeLocale)?.dir || 'ltr',
    [activeLocale],
  );

  const handleSave = async () => {
    if (!token || !event || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      // Only send the active locale fields — the API merges into the stored JSON.
      const updated = await api<NotificationTemplate>(
        `/notification-templates/admin/${event}`,
        {
          method: 'PUT',
          token,
          body: JSON.stringify({
            subject: { [activeLocale]: subjectByLocale[activeLocale] ?? '' },
            body_html: { [activeLocale]: bodyHtmlByLocale[activeLocale] ?? '' },
            body_text: { [activeLocale]: bodyTextByLocale[activeLocale] ?? '' },
            enabled,
          }),
        },
      );
      setTemplate(updated);
      // Refresh local copies so server-side merges (other locales kept) are reflected
      // without losing the value the admin just typed.
      setSubjectByLocale({ ...(updated?.subject || {}) });
      setBodyHtmlByLocale({ ...(updated?.body_html || {}) });
      setBodyTextByLocale({ ...(updated?.body_text || {}) });
      setEnabled(Boolean(updated?.enabled));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const labelKey = `notifEvent_${event}` as const;
  const eventLabel = (t.has(labelKey) ? t(labelKey) : event) as string;

  if (loading) {
    return <p className="text-sm text-muted-foreground py-12 text-center">{t('loading')}</p>;
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/notifications"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('back')}
        </Link>
        <p className="text-sm text-muted-foreground py-12 text-center">
          {t('noNotificationTemplatesYet')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/notifications"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
          aria-label={t('back')}
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{t('editNotificationTemplate')}</h1>
            <Badge variant="outline" className="text-[10px] font-mono">{template.event}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{eventLabel}</p>
        </div>

        {/* Enabled toggle — sent on every save. */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium transition ${
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
          {enabled ? t('notifEnabled') : t('notifDisabled')}
        </button>
      </div>

      {!enabled && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-xs">{t('notifDisabledWarning')}</p>
        </div>
      )}

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{eventLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Locale tabs */}
          <div className="flex flex-wrap gap-1.5 border-b pb-3">
            {LOCALES.map((locale) => {
              const isActive = activeLocale === locale.code;
              const empty =
                isStringEmpty(subjectByLocale[locale.code]) &&
                isHtmlEmpty(bodyHtmlByLocale[locale.code]) &&
                isStringEmpty(bodyTextByLocale[locale.code]);
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
                  title={empty ? t('notifEmptyForLocale') : undefined}
                >
                  <span>{locale.label}</span>
                  <span className="ml-1.5 opacity-60 text-[10px] uppercase">{locale.code}</span>
                  {empty && (
                    <span
                      className={`absolute -top-0.5 -inset-e-0.5 w-2 h-2 rounded-full ${
                        isActive ? 'bg-amber-300' : 'bg-amber-500'
                      }`}
                      aria-label={t('notifEmptyForLocale')}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('notifSubject')}</Label>
            <Input
              className="h-9 text-sm"
              dir={activeDir}
              value={subjectByLocale[activeLocale] ?? ''}
              onChange={(e) =>
                setSubjectByLocale((prev) => ({ ...prev, [activeLocale]: e.target.value }))
              }
            />
          </div>

          {/* Body HTML */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('notifBodyHtml')}</Label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    {t('notifHidePreview')}
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    {t('notifShowPreview')}
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
                  {t('notifPreview')}
                </p>
                <div
                  className="text-sm text-zinc-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: bodyHtmlByLocale[activeLocale] || `<p class="text-zinc-400">${t('notifEmptyForLocale')}</p>`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Body Text */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('notifBodyText')}</Label>
            <Textarea
              dir={activeDir}
              className="text-sm font-mono min-h-32"
              value={bodyTextByLocale[activeLocale] ?? ''}
              onChange={(e) =>
                setBodyTextByLocale((prev) => ({ ...prev, [activeLocale]: e.target.value }))
              }
            />
          </div>

          {/* Available variables hint */}
          {eventVariables.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] font-medium text-zinc-700 mb-1">
                {t('notifAvailableVariables')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {eventVariables.map((v) => (
                  <code
                    key={v}
                    className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700"
                    title={t('notifClickToCopy')}
                    onClick={() => {
                      navigator.clipboard?.writeText(`{{${v}}}`).catch(() => {});
                    }}
                    role="button"
                    style={{ cursor: 'pointer' }}
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-[11px] text-muted-foreground">
              {template.id
                ? t('notifLastUpdated', { date: new Date(template.updated_at).toLocaleString() })
                : t('notifNeverSavedYet')}
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
