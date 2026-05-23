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
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type NotificationEvent = 'order_confirmation' | 'password_reset';
const VALID_EVENTS: NotificationEvent[] = ['order_confirmation', 'password_reset'];

interface NotificationTemplate {
  id: string;
  event: NotificationEvent;
  subject: Record<string, string> | null;
  body_html: Record<string, string> | null;
  body_text: Record<string, string> | null;
  enabled: boolean;
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

// Placeholder variables substituted by the backend sender for each event type.
// Keep this in sync with the API's template renderer.
const EVENT_VARIABLES: Record<NotificationEvent, string[]> = {
  password_reset: ['{{reset_url}}'],
  order_confirmation: [
    '{{order_number}}',
    '{{total}}',
    '{{payment_line}}',
    '{{order_button}}',
    '{{order_url_text}}',
  ],
};

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
  const event = params?.event as NotificationEvent;

  if (event && !VALID_EVENTS.includes(event)) {
    notFound();
  }

  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLocale, setActiveLocale] = useState<string>('en');
  const [subjectByLocale, setSubjectByLocale] = useState<Record<string, string>>({});
  const [bodyHtmlByLocale, setBodyHtmlByLocale] = useState<Record<string, string>>({});
  const [bodyTextByLocale, setBodyTextByLocale] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token || !event) return;
    setLoading(true);
    api<NotificationTemplate>(`/notification-templates/admin/${event}`, { token })
      .then((data) => {
        setTemplate(data);
        setSubjectByLocale({ ...(data?.subject || {}) });
        setBodyHtmlByLocale({ ...(data?.body_html || {}) });
        setBodyTextByLocale({ ...(data?.body_text || {}) });
        setEnabled(Boolean(data?.enabled));
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

  const eventLabel = t(`notifEvent_${event}` as any);
  const variables = event ? EVENT_VARIABLES[event] : [];

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
            <Label className="text-xs">{t('notifBodyHtml')}</Label>
            <RichTextEditor
              key={`html-${activeLocale}`}
              content={bodyHtmlByLocale[activeLocale] ?? ''}
              onChange={(html) =>
                setBodyHtmlByLocale((prev) => ({ ...prev, [activeLocale]: html }))
              }
              dir={activeDir}
            />
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
          {variables.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] font-medium text-zinc-700 mb-1">
                {t('notifAvailableVariables')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <code
                    key={v}
                    className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700"
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-[11px] text-muted-foreground">
              {t('notifLastUpdated', { date: new Date(template.updated_at).toLocaleString() })}
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
