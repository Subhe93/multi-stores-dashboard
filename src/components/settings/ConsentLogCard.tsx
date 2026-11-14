'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Download, Loader2, Minus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { downloadAuthed } from '@/lib/http';
import { useApiError } from '@/lib/useApiError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  consentLogActionKey,
  consentLogShares,
  consentLogSummaryPath,
  defaultExportRange,
  exportConsentLog,
  loadConsentLogPage,
  normalizeConsentId,
  shortConsentId,
  type ConsentLogItem,
  type ConsentLogPage,
  type ConsentLogSummary,
} from '@/lib/consentLog';

// ── Consent log card (consent v2, plans/consent-v2/CONTRACT.md §6) ──────────
// Store settings → Store tab, directly below the tracking card. Read-only
// view of the cookie decisions visitors made (banner, settings dialog, video
// and map facades): a 30-day summary, a paged table ("Load more" through the
// `next_before` cursor), a search by the full consent id a visitor sees in
// their cookie settings, and a CSV export of a date range. The API never
// returns the IP prefix or the user-agent hash, so nothing personal is shown.
// The export is a bearer-authenticated blob download (downloadAuthed).

interface Props {
  token: string;
}

function Flag({ value, label }: { value: boolean | null; label: string }) {
  // null = the category was not offered / not part of this decision.
  const Icon = value === true ? Check : value === false ? X : Minus;
  const tone = value === true ? 'text-emerald-600' : value === false ? 'text-red-600' : 'text-muted-foreground';
  return (
    <span className={`inline-flex ${tone}`} title={label} aria-label={label}>
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

export function ConsentLogCard({ token }: Props) {
  const t = useTranslations('consentLog');
  const locale = useLocale();
  const describeError = useApiError();
  // useApiError returns a new function every render; keep the first-load
  // callback stable so the mount effect runs once per token.
  const describeRef = useRef(describeError);
  useEffect(() => {
    describeRef.current = describeError;
  });

  const [summary, setSummary] = useState<ConsentLogSummary | null>(null);
  const [rows, setRows] = useState<ConsentLogItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [searchInvalid, setSearchInvalid] = useState(false);

  const [range, setRange] = useState(() => defaultExportRange());
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const get = useCallback((path: string) => api<ConsentLogPage>(path, { token }), [token]);

  // First page (and every new search) replaces the rows.
  const loadFirst = useCallback(
    async (consentId: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await loadConsentLogPage(get, [], { consentId });
        setRows(res.items);
        setNextBefore(res.nextBefore);
      } catch (err) {
        setError(describeRef.current(err));
      } finally {
        setLoading(false);
      }
    },
    [get],
  );

  useEffect(() => {
    let cancelled = false;
    api<ConsentLogSummary>(consentLogSummaryPath(), { token })
      .then((s) => {
        if (!cancelled) setSummary(s ?? null);
      })
      .catch(() => {
        // The table shows the error; the summary just stays empty.
      });
    void loadFirst(null);
    return () => {
      cancelled = true;
    };
  }, [token, loadFirst]);

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await loadConsentLogPage(get, rows, { before: nextBefore, consentId: activeSearch });
      setRows(res.items);
      setNextBefore(res.nextBefore);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const runSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = search.trim();
    if (raw === '') {
      setSearchInvalid(false);
      setActiveSearch(null);
      void loadFirst(null);
      return;
    }
    const id = normalizeConsentId(raw);
    if (!id) {
      setSearchInvalid(true);
      return;
    }
    setSearchInvalid(false);
    setActiveSearch(id);
    void loadFirst(id);
  };

  const clearSearch = () => {
    setSearch('');
    setSearchInvalid(false);
    setActiveSearch(null);
    void loadFirst(null);
  };

  const runExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const err = await exportConsentLog(
        (path, fallbackName) => downloadAuthed(path, token, fallbackName),
        range.from,
        range.to,
      );
      if (err) setExportMsg(t(`export.invalid.${err}`));
    } catch (err) {
      setExportMsg(describeError(err));
    } finally {
      setExporting(false);
    }
  };

  const shares = consentLogShares(summary);
  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return iso;
    }
  };
  const flagLabel = (category: string, value: boolean | null) =>
    `${t(`columns.${category}`)}: ${t(value === true ? 'flag.granted' : value === false ? 'flag.denied' : 'flag.notOffered')}`;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('help')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary of the last 30 days. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: t('summary.total'), value: String(shares.total) },
            { label: t('summary.acceptAll'), value: `${shares.acceptPct}%` },
            { label: t('summary.rejectAll'), value: `${shares.rejectPct}%` },
            { label: t('summary.custom'), value: `${shares.customPct}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-base font-semibold tabular-nums">{summary ? s.value : '–'}</p>
            </div>
          ))}
        </div>
        <p className="-mt-3 text-[11px] text-muted-foreground">{t('summary.window', { days: summary?.days ?? 30 })}</p>

        {/* Search by full consent id. */}
        <form onSubmit={runSearch} className="space-y-1">
          <Label htmlFor="consent_log_search">{t('search.label')}</Label>
          <div className="flex gap-2">
            <Input
              id="consent_log_search"
              value={search}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              className="font-mono"
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchInvalid(false);
              }}
              aria-invalid={searchInvalid || undefined}
            />
            <Button type="submit" variant="outline" size="default">
              <Search className="size-3.5" aria-hidden />
              {t('search.button')}
            </Button>
            {activeSearch && (
              <Button type="button" variant="ghost" size="default" onClick={clearSearch}>
                {t('search.clear')}
              </Button>
            )}
          </div>
          <p className={`text-[11px] ${searchInvalid ? 'text-red-600' : 'text-muted-foreground'}`}>
            {searchInvalid ? t('search.invalid') : t('search.hint')}
          </p>
        </form>

        {/* Decisions table. */}
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t('loading')}
          </div>
        ) : error && rows.length === 0 ? (
          <p className="text-[11px] text-red-600" role="alert">
            {t('error')} {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{activeSearch ? t('emptySearch') : t('empty')}</p>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.date')}</TableHead>
                    <TableHead>{t('columns.consentId')}</TableHead>
                    <TableHead>{t('columns.action')}</TableHead>
                    <TableHead className="text-center">{t('columns.analytics')}</TableHead>
                    <TableHead className="text-center">{t('columns.marketing')}</TableHead>
                    <TableHead className="text-center">{t('columns.externalMedia')}</TableHead>
                    <TableHead>{t('columns.locale')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="font-mono" dir="ltr" title={r.consent_id}>
                        {shortConsentId(r.consent_id)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{t(`actions.${consentLogActionKey(r.action)}`)}</TableCell>
                      <TableCell className="text-center">
                        <Flag value={r.analytics} label={flagLabel('analytics', r.analytics)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Flag value={r.marketing} label={flagLabel('marketing', r.marketing)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Flag value={r.external_media} label={flagLabel('externalMedia', r.external_media)} />
                      </TableCell>
                      <TableCell className="uppercase">{r.locale}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {error && (
              <p className="text-[11px] text-red-600" role="alert">
                {t('error')} {error}
              </p>
            )}
            {nextBefore && (
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {t('loadMore')}
              </Button>
            )}
          </div>
        )}

        {/* CSV export of a date range. */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">{t('export.title')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="consent_log_from">{t('export.from')}</Label>
              <Input
                id="consent_log_from"
                type="date"
                value={range.from}
                onChange={(e) => {
                  setExportMsg(null);
                  setRange((r) => ({ ...r, from: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="consent_log_to">{t('export.to')}</Label>
              <Input
                id="consent_log_to"
                type="date"
                value={range.to}
                onChange={(e) => {
                  setExportMsg(null);
                  setRange((r) => ({ ...r, to: e.target.value }));
                }}
              />
            </div>
            <Button size="default" onClick={runExport} disabled={exporting}>
              {exporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
              {t('export.button')}
            </Button>
          </div>
          {exportMsg ? (
            <p className="text-[11px] text-red-600" role="alert">
              {exportMsg}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t('export.hint')}</p>
          )}
        </div>

        <p className="border-t pt-3 text-[11px] text-muted-foreground">{t('proof')}</p>
      </CardContent>
    </Card>
  );
}
