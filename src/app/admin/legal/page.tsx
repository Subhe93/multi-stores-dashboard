'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type LegalSlug = 'privacy' | 'terms' | 'refund' | 'shipping';

interface LegalPage {
  id: string;
  slug: LegalSlug;
  title: Record<string, string> | null;
  content: Record<string, string> | null;
  updated_at: string;
}

const SLUG_ORDER: LegalSlug[] = ['privacy', 'terms', 'refund', 'shipping'];

// Pick a display title: prefer English, fall back to first non-empty translation, then slug.
function pickDisplayTitle(page: LegalPage, fallback: string): string {
  const titles = page.title || {};
  if (titles.en && titles.en.trim()) return titles.en;
  for (const locale of Object.keys(titles)) {
    if (titles[locale] && titles[locale].trim()) return titles[locale];
  }
  return fallback;
}

export default function AdminLegalListPage() {
  const t = useTranslations('admin');
  const { token } = useAuth();
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<LegalPage[]>('/legal/admin', { token })
      .then((data) => setPages(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  // Sort by canonical slug order so the list is stable regardless of API order.
  const sortedPages = [...pages].sort(
    (a, b) => SLUG_ORDER.indexOf(a.slug) - SLUG_ORDER.indexOf(b.slug),
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('legalPages')}</h1>
        <p className="text-sm text-muted-foreground">{t('legalPagesSubtitle')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{t('loading')}</p>
      ) : sortedPages.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('noLegalPagesYet')}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardContent className="p-0">
            <ul className="divide-y">
              {sortedPages.map((page) => {
                const slugLabel = t(`legalSlug_${page.slug}` as any);
                const displayTitle = pickDisplayTitle(page, slugLabel);
                return (
                  <li key={page.id}>
                    <Link
                      href={`/admin/legal/${page.slug}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition group"
                    >
                      <div className="w-9 h-9 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-zinc-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{displayTitle}</p>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {page.slug}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t('legalLastUpdated', {
                            date: new Date(page.updated_at).toLocaleString(),
                          })}
                        </p>
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
