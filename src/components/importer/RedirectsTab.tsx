'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, CircleCheck, CircleSlash, FileUp, FlaskConical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { useApiError } from '@/lib/useApiError';
import {
  REDIRECT_BULK_MAX,
  REDIRECT_STATUS_CODES,
  bulkCreateRedirects,
  createRedirect,
  deleteRedirect,
  listRedirects,
  probeRedirectBulk,
  testRedirect,
  updateRedirect,
  type RedirectBulkResult,
  type RedirectBulkRow,
  type RedirectListResponse,
  type RedirectSource,
  type RedirectStatusCode,
  type RedirectTestResult,
  type RedirectView,
} from '@/lib/redirects.api';
import { ConfirmDialog, ErrorBanner, useDateTimeFormat } from '@/components/importer/ImporterBits';

const PAGE_SIZE = 50;
const PATH_MAX = 1024;

/** Client-side check mirroring the API rules (§6.2): absolute path, no scheme, no `//`. */
function pathProblem(value: string): 'required' | 'slash' | 'scheme' | 'tooLong' | null {
  const v = value.trim();
  if (!v) return 'required';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return 'scheme';
  if (!v.startsWith('/') || v.startsWith('//')) return 'slash';
  if (v.length > PATH_MAX) return 'tooLong';
  return null;
}

/**
 * Redirects manager (§13): search, source filter, add / edit / delete, CSV
 * import and "Test a URL". With the importer app off (`readOnly`) only
 * listing and deleting stay available, like the API.
 */
export function RedirectsTab({ token, readOnly = false }: { token: string; readOnly?: boolean }) {
  const t = useTranslations('creator.importer.redirects');
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'all' | RedirectSource>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RedirectListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RedirectView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<RedirectView | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // CSV import (W1-B bulk route): hidden until one probe says the route exists.
  const [bulkAvailable, setBulkAvailable] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Debounce the search so typing doesn't fire a request per key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    listRedirects(token, { q: q || undefined, source: source === 'all' ? undefined : source, page, limit: PAGE_SIZE })
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => setError(describeError(err)))
      .finally(() => setLoading(false));
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, q, source, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    probeRedirectBulk(token).then((ok) => {
      if (!cancelled) setBulkAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [token, readOnly]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteRedirect(token, deleting.id);
      setDeleting(null);
      load();
    } catch (err) {
      setDeleteError(describeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns = [
    {
      key: 'paths',
      label: t('columns.paths'),
      render: (r: RedirectView) => (
        <div className="flex min-w-0 max-w-xl flex-wrap items-center gap-1.5 font-mono text-xs" dir="ltr">
          <span className="break-all">{r.from_path}</span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
          <span className="break-all text-muted-foreground">{r.to_path}</span>
        </div>
      ),
    },
    {
      key: 'status_code',
      label: t('columns.code'),
      render: (r: RedirectView) => <span className="font-mono text-xs tabular-nums">{r.status_code}</span>,
    },
    {
      key: 'source',
      label: t('columns.source'),
      render: (r: RedirectView) => (
        <Badge
          variant="outline"
          className={r.source === 'IMPORT' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}
        >
          {t(`source.${r.source}`)}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: t('columns.active'),
      render: (r: RedirectView) =>
        r.is_active ? (
          <CircleCheck className="size-4 text-emerald-600" aria-label={t('active')} />
        ) : (
          <CircleSlash className="size-4 text-zinc-400" aria-label={t('inactive')} />
        ),
    },
    {
      key: 'updated_at',
      label: t('columns.updated'),
      render: (r: RedirectView) => <span className="whitespace-nowrap text-xs">{formatDate(r.updated_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (r: RedirectView) => (
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 max-sm:size-11"
              onClick={() => {
                setEditing(r);
                setDialogOpen(true);
              }}
              aria-label={t('edit')}
              title={t('edit')}
            >
              <Pencil />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-destructive hover:text-destructive max-sm:size-11"
            onClick={() => {
              setDeleteError(null);
              setDeleting(r);
            }}
            aria-label={t('delete')}
            title={t('delete')}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">{t('intro')}</p>

      {!readOnly && <RedirectTester token={token} />}

      <Card className="shadow-none">
        <CardContent
          className={`grid gap-3 py-4 sm:items-end ${readOnly ? 'sm:grid-cols-[minmax(0,1fr)_12rem]' : 'sm:grid-cols-[minmax(0,1fr)_12rem_auto]'}`}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">{t('search')}</Label>
            <Input
              type="search"
              dir="ltr"
              className="h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('sourceFilter')}</Label>
            <SearchableSelect
              options={[
                { value: 'all', label: t('allSources') },
                { value: 'IMPORT', label: t('source.IMPORT') },
                { value: 'MANUAL', label: t('source.MANUAL') },
              ]}
              value={source}
              onChange={(v) => {
                setSource((v || 'all') as typeof source);
                setPage(1);
              }}
            />
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {bulkAvailable && (
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <FileUp />
                  {t('csvImport.button')}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus />
                {t('add')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyMessage={q || source !== 'all' ? t('emptyFiltered') : t('empty')}
          pagination={
            data
              ? { total: data.total, page: data.page, limit: data.limit, totalPages: Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) }
              : undefined
          }
          onPageChange={setPage}
        />
      )}

      <RedirectDialog
        token={token}
        open={dialogOpen}
        redirect={editing}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />

      {bulkAvailable && (
        <CsvImportDialog
          token={token}
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => {
            setPage(1);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('deleteTitle')}
        description={deleting ? t('deleteBody', { from: deleting.from_path }) : undefined}
        confirmLabel={t('delete')}
        destructive
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </div>
  );
}

// ─── CSV import ──────────────────────────────────────────────────────────────

type CsvParse = { rows: RedirectBulkRow[] } | { error: 'tooMany' | 'empty' } | { error: 'invalidLine'; line: number };

/** `from_path,to_path[,status]` per line; a header line and blank lines are skipped. */
function parseRedirectCsv(text: string): CsvParse {
  const lines = text.split(/\r?\n/);
  const rows: RedirectBulkRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw) continue;
    const cells = raw.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /^from[_ ]?path$/i.test(cells[0] ?? '')) continue;
    const [from, to, status] = cells;
    if (!from || !to || pathProblem(from) || pathProblem(to) || from === to) return { error: 'invalidLine', line: i + 1 };
    let code: RedirectStatusCode | undefined;
    if (status) {
      const n = Number(status);
      if (!(REDIRECT_STATUS_CODES as readonly number[]).includes(n)) return { error: 'invalidLine', line: i + 1 };
      code = n as RedirectStatusCode;
    }
    rows.push(code ? { from_path: from, to_path: to, status_code: code } : { from_path: from, to_path: to });
    if (rows.length > REDIRECT_BULK_MAX) return { error: 'tooMany' };
  }
  return rows.length ? { rows } : { error: 'empty' };
}

function CsvImportDialog({
  token,
  open,
  onOpenChange,
  onImported,
}: {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const t = useTranslations('creator.importer.redirects.csvImport');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RedirectBulkRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedirectBulkResult | null>(null);

  const reset = () => {
    setRows(null);
    setFileName('');
    setProblem(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pick = async (file: File | undefined) => {
    setResult(null);
    setProblem(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);
    const parsed = parseRedirectCsv(await file.text());
    if ('error' in parsed) {
      setProblem(parsed.error === 'invalidLine' ? t('invalidLine', { line: parsed.line }) : t(parsed.error));
      return;
    }
    setRows(parsed.rows);
  };

  const run = async () => {
    if (!rows || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await bulkCreateRedirects(token, rows);
      setResult(res);
      setRows(null);
      onImported();
    } catch (err) {
      setProblem(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('body')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="redirect-csv" className="text-xs">
              {t('file')}
            </Label>
            <Input id="redirect-csv" ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void pick(e.target.files?.[0])} />
            {fileName && rows && (
              <p className="text-[11px] text-muted-foreground">
                {fileName} · {rows.length}
              </p>
            )}
          </div>
          {problem && <ErrorBanner message={problem} />}
          {result && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p>{t('result', { created: result.created, conflicts: result.conflicts?.length ?? 0 })}</p>
              {result.conflicts?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">{t('conflictsTitle')}</p>
                  <ul className="max-h-40 overflow-y-auto font-mono text-xs" dir="ltr">
                    {result.conflicts.map((c, i) => (
                      <li key={`${c.from_path}:${i}`} className="break-all">
                        {c.from_path}
                        {c.reason ? ` — ${c.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {result ? tc('close') : tc('cancel')}
          </Button>
          {!result && (
            <Button onClick={run} disabled={busy || !rows}>
              {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
              {t('run')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test a URL ──────────────────────────────────────────────────────────────

function RedirectTester({ token }: { token: string }) {
  const t = useTranslations('creator.importer.redirects.test');
  const describeError = useApiError();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedirectTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    let value = path.trim();
    if (!value) return;
    // Accept a full URL and keep only its path (the match ignores the host).
    try {
      if (/^https?:\/\//i.test(value)) {
        const u = new URL(value);
        value = u.pathname + u.search;
      }
    } catch {
      // Not a URL; send as typed and let the API validate it.
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await testRedirect(token, value));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">{t('title')}</p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Input dir="ltr" className="h-8 min-w-60 flex-1 font-mono text-sm" value={path} onChange={(e) => setPath(e.target.value)} placeholder={t('placeholder')} />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !path.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            {t('run')}
          </Button>
        </form>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div
            className={`rounded-md border p-3 text-sm ${result.match ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}
          >
            {result.match ? (
              <div className="space-y-1">
                <p>{t('matched', { code: result.match.status_code })}</p>
                <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs" dir="ltr">
                  <span className="break-all">{result.path}</span>
                  <ArrowRight className="size-3 shrink-0" />
                  <span className="break-all font-medium">{result.match.to_path}</span>
                </p>
                {result.match.from_path !== result.path && (
                  <p className="text-xs">
                    {t('viaRule')}{' '}
                    <span className="font-mono" dir="ltr">
                      {result.match.from_path}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p>
                {t('noMatch')}{' '}
                <span className="font-mono text-xs" dir="ltr">
                  {result.path}
                </span>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add / edit dialog ───────────────────────────────────────────────────────

type RedirectField = 'from_path' | 'to_path';

interface RedirectDialogProps {
  token: string;
  open: boolean;
  redirect: RedirectView | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (redirect: RedirectView) => void;
}

function RedirectDialog(props: RedirectDialogProps) {
  // Remount per opened row so the form starts from its values.
  return props.open ? <RedirectForm key={props.redirect?.id ?? 'new'} {...props} /> : null;
}

function RedirectForm({ token, open, redirect, onOpenChange, onSaved }: RedirectDialogProps) {
  const t = useTranslations('creator.importer.redirects.form');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const editing = !!redirect;
  const [from, setFrom] = useState(redirect?.from_path ?? '');
  const [to, setTo] = useState(redirect?.to_path ?? '');
  const [code, setCode] = useState<RedirectStatusCode>((redirect?.status_code as RedirectStatusCode) ?? 301);
  const [active, setActive] = useState(redirect?.is_active ?? true);
  const [errors, setErrors] = useState<Partial<Record<RedirectField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const focus = (f: RedirectField) => requestAnimationFrame(() => document.getElementById(`redirect-${f}`)?.focus());

  const save = async () => {
    const errs: Partial<Record<RedirectField, string>> = {};
    const fp = pathProblem(from);
    const tp = pathProblem(to);
    if (fp) errs.from_path = t(`errors.${fp}`);
    if (tp) errs.to_path = t(`errors.${tp}`);
    if (!fp && !tp && from.trim() === to.trim()) errs.to_path = t('errors.same');
    setErrors(errs);
    setFormError(null);
    const first = Object.keys(errs)[0] as RedirectField | undefined;
    if (first) {
      focus(first);
      return;
    }
    setSaving(true);
    try {
      const body = { from_path: from.trim(), to_path: to.trim(), status_code: code, is_active: active };
      const saved = editing ? await updateRedirect(token, redirect!.id, body) : await createRedirect(token, body);
      onSaved(saved);
    } catch (err) {
      const e = err as { code?: string; errors?: string[] };
      // Each API code belongs to one field: show it there and focus it.
      const field: RedirectField | null =
        e?.code === 'REDIRECT_DUPLICATE'
          ? 'from_path'
          : e?.code === 'REDIRECT_LOOP'
            ? 'to_path'
            : e?.code === 'REDIRECT_INVALID_PATH'
              ? 'from_path'
              : Array.isArray(e?.errors)
                ? e.errors.some((m) => m.startsWith('from_path'))
                  ? 'from_path'
                  : e.errors.some((m) => m.startsWith('to_path'))
                    ? 'to_path'
                    : null
                : null;
      if (field) {
        const message =
          e?.code === 'REDIRECT_INVALID_PATH' ? t('errors.invalidEither') : e?.code ? describeError(err) : t(`errors.field.${field}`);
        setErrors({ [field]: message });
        focus(field);
      } else {
        setFormError(describeError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const errCls = (f: RedirectField) => (errors[f] ? 'border-red-400 focus-visible:ring-red-400' : '');

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{editing && redirect?.source === 'IMPORT' ? t('importedHint') : t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="redirect-from_path" className="text-xs">
              {t('from')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="redirect-from_path"
              dir="ltr"
              className={`font-mono text-sm ${errCls('from_path')}`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="/product/old-name"
            />
            {errors.from_path ? (
              <p className="text-[11px] text-red-600">{errors.from_path}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('fromHint')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-to_path" className="text-xs">
              {t('to')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="redirect-to_path"
              dir="ltr"
              className={`font-mono text-sm ${errCls('to_path')}`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="/products/new-name"
            />
            {errors.to_path ? (
              <p className="text-[11px] text-red-600">{errors.to_path}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('toHint')}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('code')}</Label>
              <SearchableSelect
                options={REDIRECT_STATUS_CODES.map((c) => ({ value: String(c), label: t(`codes.${c}`) }))}
                value={String(code)}
                onChange={(v) => setCode((Number(v) || 301) as RedirectStatusCode)}
              />
            </div>
            <label className="flex items-end justify-between gap-3 pb-1.5 text-sm">
              <span>{t('active')}</span>
              <ToggleSwitch checked={active} onChange={setActive} label={t('active')} />
            </label>
          </div>
          {formError && <ErrorBanner message={formError} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tc('cancel')}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {editing ? tc('save') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
