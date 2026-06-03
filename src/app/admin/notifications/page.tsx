'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, ChevronRight } from 'lucide-react';
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

export default function AdminNotificationsListPage() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    // The API returns rows for ALL catalog events (placeholder for ones never
    // saved), in canonical order — we don't need to fetch /events here.
    api<NotificationTemplate[]>('/notification-templates/admin', { token })
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('notificationTemplates')}</h1>
        <p className="text-sm text-muted-foreground">{t('notificationTemplatesSubtitle')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{t('loading')}</p>
      ) : templates.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('noNotificationTemplatesYet')}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardContent className="p-0">
            <ul className="divide-y">
              {templates.map((tpl) => {
                // Falls back to the raw event key when no translation exists yet —
                // safer than throwing for an event added on the backend before
                // the dashboard's locale files were updated.
                const labelKey = `notifEvent_${tpl.event}` as const;
                const eventLabel = (t.has(labelKey) ? t(labelKey) : tpl.event) as string;
                const neverSaved = !tpl.id;
                return (
                  <li key={tpl.event}>
                    <Link
                      href={`/admin/notifications/${tpl.event}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition group"
                    >
                      <div className="w-9 h-9 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-zinc-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{eventLabel}</p>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {tpl.event}
                          </Badge>
                          {neverSaved ? (
                            <Badge variant="outline" className="text-[10px] text-zinc-600 border-zinc-300 bg-zinc-50">
                              {t('notifNeverSaved')}
                            </Badge>
                          ) : tpl.enabled ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                              {t('notifEnabled')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                              {t('notifDisabled')}
                            </Badge>
                          )}
                        </div>
                        {!neverSaved && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t('notifLastUpdated', {
                              date: new Date(tpl.updated_at).toLocaleString(),
                            })}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition">
                        {t('edit')}
                        <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
