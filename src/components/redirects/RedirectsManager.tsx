'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, ChevronDown, CircleCheck, CircleSlash, Download, FileUp, FlaskConical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { useBulkAction } from '@/components/common/useBulkAction';
import { useApiError } from '@/lib/useApiError';
import {
  REDIRECT_BULK_MAX,
  REDIRECT_STATUS_CODES,
  bulkCreateRedirects,
  createRedirect,
  deleteRedirect,
  listRedirects,
  testRedirect,
  updateRedirect,
  type RedirectBulkResult,
  type RedirectBulkConflict,
  type RedirectBulkRow,
  type RedirectListResponse,
  type RedirectSource,
  type RedirectStatusCode,
  type RedirectTestResult,
  type RedirectView,
} from '@/lib/redirects.api';
import { ConfirmDialog, ErrorBanner, useDateTimeFormat } from '@/components/importer/ImporterBits';
import { toStorePath, useUnknownTarget } from '@/components/redirects/DeleteRedirect';

const PAGE_SIZE = 50;
const PATH_MAX = 1024;

type PathProblem = 'required' | 'slash' | 'scheme' | 'tooLong';

/**
 * Store path of a typed value (a full http(s) link keeps its path and query)
 * plus the client-side check mirroring the API rules (§6.2): absolute path,
 * no other scheme, no `//`.
 */
function normalizePath(value: string): { path: string; problem: PathProblem | null } {
  const raw = value.trim();
  if (!raw) return { path: '', problem: 'required' };
  const { value: v, fromUrl, badUrl } = toStorePath(raw);
  if (badUrl || (!fromUrl && /^[a-z][a-z0-9+.-]*:/i.test(v))) return { path: v, problem: 'scheme' };
  if (!v.startsWith('/') || v.startsWith('//')) return { path: v, problem: 'slash' };
  if (v.length > PATH_MAX) return { path: v, problem: 'tooLong' };
  return { path: v, problem: null };
}

/**
 * Redirects manager (§13), shared by Online store -> Redirects and the
 * importer's Redirects tab: search, source filter, add / edit / delete, CSV
 * import and "Test a URL". `readOnly` keeps listing and deleting only (the
 * importer page while the app is off). `showIntro` hides the intro line when
 * the host page already explains the feature.
 */
export function RedirectsManager({
  token,
  readOnly = false,
  showIntro = true,
}: {
  token: string;
  readOnly?: boolean;
  showIntro?: boolean;
}) {
  const t = useTranslations('creator.redirects');
  const describeError = useApiError();
  const formatDate = useDateTimeFormat();
  const tb = useTranslations('bulk');
  const bulk = useBulkAction();

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

  const openEdit = (r: RedirectView) => {
    setEditing(r);
    setDialogOpen(true);
  };

  // Bulk (de)activation through the same partial update as the edit dialog.
  const bulkSetActive = (rows: RedirectView[], active: boolean, clear: () => void) => {
    const opts = {
      rows: rows.filter((r) => r.is_active !== active),
      fn: (r: RedirectView) => updateRedirect(token, r.id, { is_active: active }),
      done: (count: number) => tb('updatedCount', { count }),
      clear,
      after: load,
    };
    if (active) {
      void bulk.run(opts);
    } else {
      bulk.ask({
        ...opts,
        title: tb('deactivateTitle', { count: opts.rows.length }),
        confirmLabel: tb('deactivate'),
        destructive: true,
      });
    }
  };

  const columns = [
    {
      key: 'paths',
      label: t('columns.paths'),
      render: (r: RedirectView) => {
        // "from -> to" reads left to right as one unit (dir="ltr", no flipped
        // arrow); `w-fit` keeps it at the start side of the cell in RTL.
        const paths = (
          <>
            <span className="min-w-0 break-all">{r.from_path}</span>
            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-all text-muted-foreground">{r.to_path}</span>
          </>
        );
        const cls = 'flex w-fit min-w-0 max-w-xl flex-wrap items-center gap-1.5 font-mono text-xs';
        // Editable rows open the edit dialog from the paths themselves.
        return readOnly ? (
          <div className={cls} dir="ltr">{paths}</div>
        ) : (
          <button type="button" className={`${cls} text-start hover:underline`} dir="ltr" onClick={() => openEdit(r)}>
            {paths}
          </button>
        );
      },
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
          className={
            r.source === 'IMPORT'
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : r.source === 'SLUG_CHANGE'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700'
          }
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
              onClick={() => openEdit(r)}
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
      {showIntro && <p className="max-w-3xl text-sm text-muted-foreground">{t('intro')}</p>}
      <p className="max-w-3xl text-xs text-muted-foreground">{t('propagationNote')}</p>

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
                { value: 'SLUG_CHANGE', label: t('source.SLUG_CHANGE') },
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
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp />
                {t('csvImport.button')}
              </Button>
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
      {bulk.notice}

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
          onRowClick={readOnly ? undefined : openEdit}
          selectable
          bulkActions={(rows, clear) => (
            <>
              {!readOnly && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={bulk.busy || rows.every((r) => r.is_active)}
                    onClick={() => bulkSetActive(rows, true, clear)}
                  >
                    {tb('activate')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={bulk.busy || rows.every((r) => !r.is_active)}
                    onClick={() => bulkSetActive(rows, false, clear)}
                  >
                    {tb('deactivate')}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                disabled={bulk.busy}
                onClick={() => bulk.ask({
                  rows,
                  fn: (r) => deleteRedirect(token, r.id),
                  done: (count) => tb('deletedCount', { count }),
                  clear,
                  after: load,
                  title: tb('deleteTitle', { count: rows.length }),
                  description: tb('deleteDescription'),
                  destructive: true,
                })}
              >
                <Trash2 />
                {tb('deleteCount', { count: rows.length })}
              </Button>
            </>
          )}
        />
      )}

      {bulk.dialog}

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

      {!readOnly && (
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

type CsvLineProblem = 'path' | 'separator' | 'status' | 'same';

interface CsvParse {
  rows: RedirectBulkRow[];
  /** Every line that cannot be imported, with its reason. */
  invalid: { line: number; problem: CsvLineProblem }[];
  tooMany: boolean;
}

const SAMPLE_CSV =
  'from_path,to_path,status\n/old-page,/new-page,301\nhttps://old-shop.com/product/old-name,/products/new-name,\n/sale,/collections/summer,302\n';

/** Cells of one CSV line: `,`, `;` or tab separated; a quoted cell may contain them. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"' && cur.trim() === '') {
      quoted = true;
      cur = '';
    } else if (ch === ',' || ch === ';' || ch === '\t') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * `from_path,to_path[,status]` per line; a header line, blank lines and `#`
 * comments are skipped. Full links keep their path and query. A path that
 * contains `,`, `;` or a tab is refused: the API splits on all three, so it
 * would arrive cut in two.
 */
function parseRedirectCsv(text: string): CsvParse {
  const lines = text.split(/\r\n|\r|\n/);
  const rows: RedirectBulkRow[] = [];
  const invalid: CsvParse['invalid'] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw || raw.startsWith('#')) continue;
    const line = i + 1;
    const cells = splitCsvLine(raw);
    if (rows.length === 0 && invalid.length === 0 && /^from(_path| path)?$/i.test(cells[0] ?? '')) continue;
    const [fromRaw = '', toRaw = '', status = '', ...rest] = cells;
    if (rest.some((c) => c !== '') || /[,;\t]/.test(fromRaw) || /[,;\t]/.test(toRaw)) {
      invalid.push({ line, problem: 'separator' });
      continue;
    }
    const from = normalizePath(fromRaw);
    const to = normalizePath(toRaw);
    if (from.problem || to.problem) {
      invalid.push({ line, problem: 'path' });
      continue;
    }
    if (/[,;\t]/.test(from.path) || /[,;\t]/.test(to.path)) {
      invalid.push({ line, problem: 'separator' });
      continue;
    }
    if (from.path === to.path) {
      invalid.push({ line, problem: 'same' });
      continue;
    }
    let code: RedirectStatusCode | undefined;
    if (status) {
      const n = Number(status);
      if (!(REDIRECT_STATUS_CODES as readonly number[]).includes(n)) {
        invalid.push({ line, problem: 'status' });
        continue;
      }
      code = n as RedirectStatusCode;
    }
    rows.push({ from_path: from.path, to_path: to.path, line, ...(code ? { status_code: code } : {}) });
  }
  return { rows, invalid, tooMany: rows.length > REDIRECT_BULK_MAX };
}

function downloadSampleCsv() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'redirects-sample.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const t = useTranslations('creator.redirects.csvImport');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RedirectBulkRow[] | null>(null);
  const [invalid, setInvalid] = useState<CsvParse['invalid']>([]);
  const [fileName, setFileName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedirectBulkResult | null>(null);

  const reset = () => {
    setRows(null);
    setInvalid([]);
    setFileName('');
    setProblem(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pick = async (file: File | undefined) => {
    setResult(null);
    setProblem(null);
    setRows(null);
    setInvalid([]);
    if (!file) return;
    setFileName(file.name);
    const parsed = parseRedirectCsv(await file.text());
    setInvalid(parsed.invalid);
    if (parsed.tooMany) {
      setProblem(t('tooMany'));
      return;
    }
    if (!parsed.rows.length) {
      if (!parsed.invalid.length) setProblem(t('empty'));
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
      setInvalid([]);
      onImported();
    } catch (err) {
      setProblem(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const lineText = (l: { line: number; problem: CsvLineProblem }) =>
    l.problem === 'path'
      ? t('invalidLine', { line: l.line })
      : l.problem === 'separator'
        ? t('separatorLine', { line: l.line })
        : l.problem === 'status'
          ? t('statusLine', { line: l.line })
          : t('sameLine', { line: l.line });

  const conflictText = (c: RedirectBulkConflict) =>
    c.reason ? describeError({ code: c.reason, message: c.reason }) : '';

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
        <div className="min-w-0 space-y-3">
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={downloadSampleCsv}>
            <Download />
            {t('sample')}
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-csv" className="text-xs">
              {t('file')}
            </Label>
            <Input id="redirect-csv" ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void pick(e.target.files?.[0])} />
            {fileName && rows && (
              <p className="text-[11px] text-muted-foreground">{t('ready', { name: fileName, count: rows.length })}</p>
            )}
          </div>
          {problem && <ErrorBanner message={problem} />}
          {invalid.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">{t('invalidTitle', { count: invalid.length })}</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {invalid.map((l) => (
                  <li key={l.line}>{lineText(l)}</li>
                ))}
              </ul>
            </div>
          )}
          {result && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p>{t('result', { created: result.created, conflicts: result.conflicts?.length ?? 0 })}</p>
              {result.conflicts?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">{t('conflictsTitle')}</p>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                    {result.conflicts.map((c, i) => (
                      <li key={`${c.from_path}:${i}`} className="min-w-0">
                        {c.line ? `${t('lineLabel', { line: c.line })}: ` : ''}
                        <span className="break-all font-mono" dir="ltr">
                          {c.from_path}
                        </span>
                        {conflictText(c) ? ` — ${conflictText(c)}` : ''}
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
              {rows && invalid.length ? t('runValid', { count: rows.length }) : t('run')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test a URL ──────────────────────────────────────────────────────────────

function RedirectTester({ token }: { token: string }) {
  const t = useTranslations('creator.redirects.test');
  const describeError = useApiError();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedirectTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    // Accept a full URL and keep only its path and query (the match ignores the host).
    const value = toStorePath(path).value;
    if (!value) return;
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
                <p>{t('matched', { code: String(result.match.status_code) })}</p>
                <p className="flex w-fit min-w-0 max-w-full flex-wrap items-center gap-1.5 font-mono text-xs" dir="ltr">
                  <span className="min-w-0 break-all">{result.path}</span>
                  <ArrowRight className="size-3 shrink-0" />
                  <span className="min-w-0 break-all font-medium">{result.match.to_path}</span>
                </p>
                {result.match.from_path !== result.path && (
                  <p className="text-xs">
                    {t('viaRule')}{' '}
                    <span className="break-all font-mono" dir="ltr">
                      {result.match.from_path}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p>
                {t('noMatch')}{' '}
                <span className="break-all font-mono text-xs" dir="ltr">
                  {result.path}
                </span>
              </p>
            )}
            {result.live &&
              (result.match ? (
                // The proxy matches redirects before routing: the redirect wins.
                <p className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  {t('liveShadowed', { kind: result.live })}
                </p>
              ) : (
                <p className="mt-1 text-xs">{t('live', { kind: result.live })}</p>
              ))}
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
  const t = useTranslations('creator.redirects.form');
  const tr = useTranslations('creator.redirects');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const editing = !!redirect;
  const [from, setFrom] = useState(redirect?.from_path ?? '');
  const [to, setTo] = useState(redirect?.to_path ?? '');
  const [code, setCode] = useState<RedirectStatusCode>((redirect?.status_code as RedirectStatusCode) ?? 301);
  const [active, setActive] = useState(redirect?.is_active ?? true);
  // 307/308 are rarely needed: they sit behind "Advanced".
  const [advanced, setAdvanced] = useState(code === 307 || code === 308);
  const toCheck = normalizePath(to);
  const unknownTo = useUnknownTarget(toCheck.problem ? null : toCheck.path);
  const [errors, setErrors] = useState<Partial<Record<RedirectField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const focus = (f: RedirectField) => requestAnimationFrame(() => document.getElementById(`redirect-${f}`)?.focus());

  const save = async () => {
    const errs: Partial<Record<RedirectField, string>> = {};
    // Full links are accepted: only their path and query are kept.
    const f = normalizePath(from);
    const tt = normalizePath(to);
    if (f.problem) errs.from_path = t(`errors.${f.problem}`);
    if (tt.problem) errs.to_path = t(`errors.${tt.problem}`);
    if (!f.problem && !tt.problem && f.path === tt.path) errs.to_path = t('errors.same');
    setErrors(errs);
    setFormError(null);
    const first = Object.keys(errs)[0] as RedirectField | undefined;
    if (first) {
      focus(first);
      return;
    }
    setSaving(true);
    try {
      if (f.path !== from.trim()) setFrom(f.path);
      if (tt.path !== to.trim()) setTo(tt.path);
      const body = { from_path: f.path, to_path: tt.path, status_code: code, is_active: active };
      const saved = editing ? await updateRedirect(token, redirect!.id, body) : await createRedirect(token, body);
      onSaved(saved);
    } catch (err) {
      const e = err as { code?: string; errors?: string[]; payload?: { kind?: string } };
      // Each API code belongs to one field: show it there and focus it.
      const field: RedirectField | null =
        e?.code === 'REDIRECT_DUPLICATE' || e?.code === 'REDIRECT_SHADOWS_LIVE'
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
          e?.code === 'REDIRECT_INVALID_PATH'
            ? t('errors.invalidEither')
            : e?.code === 'REDIRECT_SHADOWS_LIVE'
              ? t('errors.shadowsLive', { kind: e.payload?.kind ?? 'other' })
              : e?.code
                ? describeError(err)
                : t(`errors.field.${field}`);
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
            {!errors.to_path && unknownTo && (
              <p className="flex items-start gap-1 text-[11px] text-amber-700">
                <AlertTriangle className="mt-px size-3 shrink-0" />
                {tr('unknownTarget')}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('code')}</Label>
              <SearchableSelect
                options={REDIRECT_STATUS_CODES.filter((c) => advanced || c === 301 || c === 302 || c === code).map((c) => ({
                  value: String(c),
                  label: t(`codes.${c}`),
                }))}
                value={String(code)}
                onChange={(v) => setCode((Number(v) || 301) as RedirectStatusCode)}
              />
            </div>
            <label className="flex items-end justify-between gap-3 pb-1.5 text-sm">
              <span>{t('active')}</span>
              <ToggleSwitch checked={active} onChange={setActive} label={t('active')} />
            </label>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <ChevronDown className={`size-3.5 transition-transform ${advanced ? 'rotate-180' : ''}`} />
            {t('advanced')}
          </button>
          {advanced && <p className="text-[11px] text-muted-foreground">{t('advancedHint')}</p>}
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
