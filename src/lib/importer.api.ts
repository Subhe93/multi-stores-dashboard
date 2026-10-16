// Typed client for the importer app endpoints (M4.4 §10, `importer/my`).
// The API is built in parallel (WP-C); the shapes below follow the design and
// the WP-B dry-run summary (`model/dry-run-summary.ts`). Every field the UI
// does not strictly need is optional, so a slightly different payload degrades
// to "not shown" instead of crashing. Keep in sync with
// multi-stores-api/src/modules/importer/importer-creator.controller.ts.

import { api, API_URL, ApiError } from '@/lib/api';
import { parseContentDispositionFilename } from '@/lib/backups';

// ─── Enums ───────────────────────────────────────────────────────────────────

export type ImportSourceKind = 'WP_BUNDLE' | 'WC_REST';

/** Kinds that can start a run today. WC_REST sources can be saved, but their runs come later (IMPORT_SOURCE_KIND_UNSUPPORTED). */
export const RUNNABLE_SOURCE_KINDS: readonly ImportSourceKind[] = ['WP_BUNDLE'];
export const isRunnableKind = (kind: ImportSourceKind | string | null | undefined): boolean =>
  !!kind && (RUNNABLE_SOURCE_KINDS as readonly string[]).includes(kind);

export type ImportRunStatus =
  | 'UPLOADED'
  | 'PLANNING'
  | 'PLANNED'
  | 'PLAN_FAILED'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLBACK_QUEUED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED';

export const IMPORT_RUN_STATUSES: readonly ImportRunStatus[] = [
  'UPLOADED',
  'PLANNING',
  'PLANNED',
  'PLAN_FAILED',
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'FAILED',
  'CANCELLED',
  'ROLLBACK_QUEUED',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'ROLLBACK_FAILED',
];

/** Statuses a worker is (or will be) working on: the UI polls while in one. */
export const ACTIVE_RUN_STATUSES: readonly ImportRunStatus[] = [
  'UPLOADED',
  'PLANNING',
  'QUEUED',
  'RUNNING',
  'ROLLBACK_QUEUED',
  'ROLLING_BACK',
];

export const isActiveRun = (status: ImportRunStatus | string | undefined | null): boolean =>
  !!status && (ACTIVE_RUN_STATUSES as readonly string[]).includes(status);

/**
 * Runs that can be rolled back (§10): completed, failed or cancelled runs, and
 * a failed rollback (it may be retried). The run must have started applying,
 * otherwise there is nothing to undo.
 */
export const canRollback = (run: Pick<ImportRunView, 'status' | 'started_at'> | null | undefined): boolean =>
  !!run?.started_at &&
  (run.status === 'COMPLETED' ||
    run.status === 'COMPLETED_WITH_WARNINGS' ||
    run.status === 'FAILED' ||
    run.status === 'CANCELLED' ||
    run.status === 'ROLLBACK_FAILED');

/** Mapping review edits are allowed only on a finished plan (§10 `PUT runs/:id/options`). */
export const canEditOptions = (status: ImportRunStatus | string | undefined | null): boolean =>
  status === 'PLANNED' || status === 'PLAN_FAILED';

export type ImportItemPhase = 'PLAN' | 'APPLY' | 'ROLLBACK';
export type ImportItemAction =
  | 'CREATE'
  | 'UPDATE'
  | 'UNCHANGED'
  | 'SKIP'
  | 'CONFLICT'
  | 'ERROR'
  | 'DELETE'
  | 'ARCHIVE'
  | 'STAGE';
export type ImportLogLevel = 'INFO' | 'WARN' | 'ERROR';

/** Apply phases in execution order (§9.1). */
export const APPLY_PHASES = [
  'media',
  'categories',
  'shipping',
  'products',
  'templates',
  'redirects',
  'finalize',
] as const;
export type ApplyPhase = (typeof APPLY_PHASES)[number];

// ─── Sources ─────────────────────────────────────────────────────────────────

export interface ImportSourceSettings {
  product_base?: string;
  category_base?: string;
  tag_base?: string;
  locale?: string;
  currency?: string;
  uploads_path?: string;
}

export interface ImportSourceView {
  id: string;
  kind: ImportSourceKind;
  name: string;
  site_host: string;
  host_aliases: string[];
  settings: ImportSourceSettings;
  /** REST key/secret are write-only; the API only says whether they are saved. */
  has_credentials?: boolean;
  last_verified_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ImportSourceInput {
  kind: ImportSourceKind;
  name: string;
  site_url: string;
  host_aliases?: string[];
  settings?: ImportSourceSettings;
  consumer_key?: string;
  consumer_secret?: string;
}

// ─── Run options (§12.2) ─────────────────────────────────────────────────────

export type ImportScope =
  | 'categories'
  | 'products'
  | 'media'
  | 'shipping'
  | 'personalization'
  | 'templates'
  | 'redirects';
export const IMPORT_SCOPES: readonly ImportScope[] = [
  'categories',
  'products',
  'media',
  'shipping',
  'personalization',
  'templates',
  'redirects',
];

export type SourceProductStatus = 'publish' | 'draft' | 'private' | 'pending' | 'future';
export const SOURCE_PRODUCT_STATUSES: readonly SourceProductStatus[] = ['publish', 'draft', 'private', 'pending', 'future'];
/** Target statuses the options API accepts (ARCHIVED is not an import target). */
export type TargetProductStatus = 'PUBLISHED' | 'DRAFT';
export const TARGET_PRODUCT_STATUSES: readonly TargetProductStatus[] = ['PUBLISHED', 'DRAFT'];

export type ConflictPolicy = 'SKIP_MODIFIED' | 'OVERWRITE';
export type OnSourceRemoved = 'keep' | 'draft' | 'archive';
/** Stock of an already imported product on a re-import: keep the platform's or take the source's. */
export type StockOnUpdate = 'keep' | 'overwrite';

export interface CustomizationTypeRule {
  mechanisms?: string[];
  designer?: boolean;
  type: string;
}

export interface ImportRunOptions {
  scopes?: Partial<Record<ImportScope, boolean>>;
  platform_category_id?: string | null;
  skip_ext_ids?: string[];
  include_drafts?: boolean;
  status_map?: Partial<Record<SourceProductStatus, TargetProductStatus>>;
  conflict_policy?: ConflictPolicy;
  on_source_removed?: OnSourceRemoved;
  /** Products are never matched by slug (only by their import identity). */
  match_existing?: { categories?: 'slug' | 'none'; products?: 'none' };
  customization_type_rules?: CustomizationTypeRule[];
  term_cleanup?: { strip_price_suffix?: boolean; strip_trailing_colon?: boolean; unicode?: boolean };
  label_overrides?: Record<string, string>;
  faq_labels?: Record<string, string>;
  shipping?: {
    method_names?: Record<string, string>;
    default_days?: { min?: number; max?: number };
    free_shipping_as_threshold?: boolean;
  };
  designer_fallback_fields?: boolean;
  redirect_skipped?: boolean;
  verify_media?: boolean;
  stock_on_update?: StockOnUpdate;
  /** Help images per preset key (`names_equal_length: {name_1, name_2, model_text}`); no editor, kept as stored. */
  preset_help_images?: Record<string, Record<string, string>>;
  // The API rejects unknown option keys (IMPORT_RUN_OPTIONS_INVALID). Saving
  // spreads the stored options, so keys this UI has no editor for are sent
  // back unchanged; the index signature only lets them be spread generically.
  [key: string]: unknown;
}

/** Defaults for a first run of a source (the generic half of §12.2). */
export const DEFAULT_RUN_OPTIONS: ImportRunOptions = {
  scopes: {
    categories: true,
    products: true,
    media: true,
    shipping: true,
    personalization: true,
    templates: true,
    redirects: true,
  },
  platform_category_id: null,
  skip_ext_ids: [],
  include_drafts: true,
  status_map: { publish: 'PUBLISHED', draft: 'DRAFT', private: 'DRAFT', pending: 'DRAFT', future: 'DRAFT' },
  conflict_policy: 'SKIP_MODIFIED',
  on_source_removed: 'keep',
  match_existing: { categories: 'slug', products: 'none' },
  term_cleanup: { strip_price_suffix: true, strip_trailing_colon: true, unicode: true },
  label_overrides: {},
  faq_labels: {},
  shipping: { method_names: {}, default_days: { min: 2, max: 4 }, free_shipping_as_threshold: true },
  designer_fallback_fields: true,
  redirect_skipped: true,
  // Same default as the API (`defaultRunOptions`): HEAD-checking every image is opt-in.
  verify_media: false,
  stock_on_update: 'keep',
};

// ─── Dry-run summary (`ImportRun.summary`, WP-B `DryRunSummary`) ─────────────

export type SummaryAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'SKIP' | 'CONFLICT' | 'STAGE' | 'ERROR' | 'DELETE' | 'ARCHIVE';
export const SUMMARY_ACTIONS: readonly SummaryAction[] = [
  'CREATE',
  'UPDATE',
  'UNCHANGED',
  'SKIP',
  'CONFLICT',
  'STAGE',
  'ERROR',
  'DELETE',
  'ARCHIVE',
];

export const SUMMARY_ENTITY_TYPES = [
  'PRODUCT',
  'VARIANT',
  'CATEGORY',
  'PRODUCT_CATEGORY',
  'TAG',
  'IMAGE',
  'FAQ',
  'OPTION_CONFIG',
  'PERSONALIZATION',
  'FALLBACK_FIELD',
  'DESIGN_TEMPLATE',
  'MEDIA',
  'SHIPPING_PROFILE',
  'SHIPPING_ZONE',
  'SHIPPING_METHOD',
  'REDIRECT',
] as const;
export type SummaryEntityType = (typeof SUMMARY_ENTITY_TYPES)[number];

export interface WarningSample {
  external_ref?: string;
  title?: string;
  message: string;
}

export interface RedirectCandidate {
  from: string;
  to: string;
  rule: string;
  external_ref?: string;
}

export interface TermCleanupRow {
  taxonomy: string;
  slug: string;
  before: string;
  after: string;
  rules: string[];
}

/** A plan problem that blocks Confirm (e.g. currency mismatch, missing platform category). */
export interface PlanBlocker {
  code: string;
  message?: string;
}

/** Entity a rollback archived or kept because the merchant edited it after the import. */
export interface RollbackEditedEntity {
  entity_type?: string;
  external_ref?: string;
  target_id?: string | null;
  title?: string | null;
}

export interface DryRunSummary {
  /** Plan facts (planner `ImportRunSummary.plan`). */
  plan?: {
    items?: number;
    blockers?: PlanBlocker[];
    /** `plain_text_fallback` when the API has no HTML sanitizer: descriptions become plain text. */
    sanitizer?: string;
    personalization_available?: boolean;
    designer_available?: boolean;
  };
  /** Written by the apply phase: counts per entity × action, error items, redirect result. */
  apply?: {
    counts?: Partial<Record<string, Partial<Record<string, number>>>>;
    errors?: number;
    redirects?: Record<string, unknown> | null;
    /** Set when entity errors passed the run limits: the run ends FAILED with these reasons (`CODE:detail`). */
    outcome?: { failed: boolean; reasons: string[] };
  };
  /** Written by a rollback (numbers per kind of change, plus the edited entities it left alone). */
  rollback?: Record<string, unknown> & {
    archived_edited?: RollbackEditedEntity[];
    skipped_edited?: RollbackEditedEntity[];
  };
  source?: { kind: string; format_version: number; site_host: string };
  counts?: Partial<Record<string, Partial<Record<string, number>>>>;
  products?: {
    in_source: number;
    imported: number;
    skipped: number;
    by_status?: Record<string, number>;
    by_target_status?: Record<string, number>;
    by_type?: Record<string, number>;
    traditional?: number;
    customizable?: number;
    by_customization_type?: Record<string, number>;
  };
  variants?: {
    in_source: number;
    imported: number;
    dropped_any?: number;
    expanded_any?: number;
    inactive?: number;
    per_product?: Record<string, number>;
  };
  option_configs?: { total: number; color_maps?: number; swatch_maps?: number; value_meta?: Record<string, number> };
  images?: { rows: number; distinct: number; missing_in_bundle?: number };
  categories?: {
    total: number;
    roots?: number;
    by_depth?: Record<string, number>;
    with_published_products?: number;
    empty?: number;
    with_description?: number;
    with_seo?: number;
    with_thumbnail?: number;
  };
  product_category_links?: { total: number };
  tags?: { terms: number; links: number };
  faqs?: { items: number; products: number };
  personalization?: { presets: number; products: number; by_key?: Record<string, number>; broken?: number; staged?: boolean };
  designer?: {
    products_linked?: number;
    fallback_fields?: number;
    templates?: number;
    templates_linked?: number;
    template_assets?: number;
    template_thumbnails?: number;
  };
  media?: { public_distinct: number; private_distinct: number; missing_in_bundle: number };
  shipping?: { zones_available: boolean; classes_used?: string[]; zones?: number; methods_enabled?: number };
  redirects?: { total: number; by_rule?: Record<string, number>; preview?: RedirectCandidate[] };
  old_slugs?: {
    total: number;
    redirected: number;
    excluded?: { external_ref: string; slug: string; reason: string }[];
  };
  term_cleanup?: TermCleanupRow[];
  warnings?: Record<string, { count: number; samples?: WarningSample[] }>;
  skipped?: { external_ref: string; title: string; reason: string }[];
  unmapped_meta_prefixes?: Record<string, number>;
}

// ─── Runs ────────────────────────────────────────────────────────────────────

export interface ImportRunProgress {
  phase?: string;
  done?: number;
  total?: number;
  cursor?: unknown;
}

export interface ImportRunView {
  id: string;
  source_id: string;
  source?: Pick<ImportSourceView, 'id' | 'name' | 'kind' | 'site_host'> | null;
  status: ImportRunStatus;
  bundle_bytes?: number | null;
  bundle_sha256?: string | null;
  options?: ImportRunOptions | null;
  plan_fingerprint?: string | null;
  summary?: DryRunSummary | null;
  progress?: ImportRunProgress | null;
  /** "CODE: message" or `{code, message}` (≤2 KB). */
  error?: string | { code?: string; message?: string } | null;
  attempt?: number;
  created_by?: string | null;
  /** The owner's email when the store owner started the run; always null for anyone else. */
  created_by_name?: string | null;
  /** `OWNER` (the store owner), `ADMIN` (anyone else, shown as "Platform admin"), null when unknown. */
  created_by_role?: 'OWNER' | 'ADMIN' | null;
  /** Small per-run totals on list items: PRODUCT / CATEGORY / REDIRECT → action → n. */
  counts?: Partial<Record<string, Partial<Record<string, number>>>> | null;
  /** Which phase `counts` comes from: the import (APPLY) or the dry run (PLAN). */
  counts_phase?: 'APPLY' | 'PLAN' | null;
  cancel_requested_at?: string | null;
  planned_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ImportRunItemView {
  id: string;
  phase: ImportItemPhase;
  entity_type: string;
  external_ref: string;
  action: ImportItemAction;
  target_id?: string | null;
  /** Field summary; `title` is used as a display name when present. */
  diff?: Record<string, unknown> | null;
  message?: string | null;
  title?: string | null;
  created_at?: string;
}

export interface ImportRunLogView {
  id: string;
  level: ImportLogLevel;
  code: string;
  entity_type?: string | null;
  external_ref?: string | null;
  message: string;
  data?: unknown;
  created_at: string;
}

export interface ParsedRunError {
  code: string | null;
  message: string;
}

function parseErrorLine(line: string): ParsedRunError {
  const m = /^([A-Z][A-Z0-9_]{2,})(?::\s*|\s+-\s+|\s+|$)([\s\S]*)$/.exec(line.trim());
  return m ? { code: m[1]!, message: m[2] ?? '' } : { code: null, message: line.trim() };
}

/**
 * Splits the run error into its entries. The stored text may hold several
 * lines (`"CODE: msg\nCODE2: msg2"`, e.g. every plan blocker); each line is
 * one entry. An object error is a single entry.
 */
export function parseRunErrors(error: ImportRunView['error']): ParsedRunError[] {
  if (!error) return [];
  if (typeof error === 'object') return [{ code: error.code ?? null, message: error.message ?? '' }];
  return error
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseErrorLine);
}

/**
 * Validator messages of an options error. `IMPORT_RUN_OPTIONS_INVALID` sends
 * them as a top-level `errors[]` (strings); class-validator errors arrive as a
 * `message` array, which `api()` already copies to `err.errors`.
 */
export function optionErrorsOf(err: unknown): string[] | undefined {
  const e = err as { errors?: unknown; payload?: Record<string, unknown> } | null | undefined;
  const list = e?.payload?.errors ?? e?.errors;
  if (!Array.isArray(list)) return undefined;
  const strings = list.filter((x): x is string => typeof x === 'string');
  return strings.length ? strings : undefined;
}

/** First entry of the run error (its code decides the "fix it" jump). */
export function parseRunError(error: ImportRunView['error']): ParsedRunError | null {
  return parseRunErrors(error)[0] ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const enc = encodeURIComponent;

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Lists come either as a bare array or as `{items}`; both are accepted. */
function asArray<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(res)) return res;
  return res?.items ?? [];
}

/** Error with `code`/`status` like `api()`, for the non-JSON helpers below. */
async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  const err = new ApiError(fallback);
  err.status = res.status;
  try {
    const json = await res.json();
    if (json?.message) err.message = Array.isArray(json.message) ? json.message.join(' · ') : json.message;
    if (Array.isArray(json?.message)) err.errors = json.message;
    if (typeof json?.code === 'string') err.code = json.code;
    if (json && typeof json === 'object') err.payload = json;
  } catch {
    // Non-JSON body; keep the fallback message.
  }
  return err;
}

async function downloadAuthed(endpoint: string, token: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await toApiError(res, 'Download failed');
  const filename = parseContentDispositionFilename(res.headers.get('content-disposition')) || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─── Sources endpoints ───────────────────────────────────────────────────────

export async function listSources(token: string): Promise<ImportSourceView[]> {
  const res = await api<ImportSourceView[] | { items?: ImportSourceView[] }>('/importer/my/sources', { token });
  return asArray(res);
}

export function createSource(token: string, input: ImportSourceInput): Promise<ImportSourceView> {
  return api<ImportSourceView>('/importer/my/sources', { method: 'POST', token, body: JSON.stringify(input) });
}

/** The kind of a source is fixed at creation; the API rejects `kind` on update. */
export type ImportSourceUpdate = Partial<Omit<ImportSourceInput, 'kind'>>;

export function updateSource(token: string, id: string, input: ImportSourceUpdate): Promise<ImportSourceView> {
  return api<ImportSourceView>(`/importer/my/sources/${enc(id)}`, { method: 'PUT', token, body: JSON.stringify(input) });
}

export function deleteSource(token: string, id: string): Promise<unknown> {
  return api<unknown>(`/importer/my/sources/${enc(id)}`, { method: 'DELETE', token });
}

export function verifySource(token: string, id: string): Promise<ImportSourceView> {
  return api<ImportSourceView>(`/importer/my/sources/${enc(id)}/verify`, { method: 'POST', token });
}

/** The read-only WordPress export script (§2.1). */
export function downloadExportScript(token: string): Promise<void> {
  return downloadAuthed('/importer/my/export-script', token, 'wp-export.sh');
}

// ─── Runs endpoints ──────────────────────────────────────────────────────────

/** Bundle upload limit: all files together (§9.3, multer limits). */
export const MAX_BUNDLE_BYTES = 50 * 1024 * 1024;
/** At most this many files per upload (multer `files` limit). */
export const MAX_BUNDLE_FILES = 64;

/**
 * File names a bundle may contain (lower-cased basenames). Mirrors
 * `BUNDLE_FILE_ALLOWLIST` in
 * multi-stores-api/src/modules/importer/adapters/wp-bundle/bundle-schema.ts;
 * any other file in the chosen folder is left out of the upload.
 */
export const BUNDLE_FILE_ALLOWLIST: readonly string[] = [
  'manifest.json',
  'posts.tsv',
  'postmeta.tsv',
  'terms.tsv',
  'term_taxonomy.tsv',
  'termmeta.tsv',
  'term_relationships.tsv',
  'attribute_taxonomies.tsv',
  'attachments.tsv',
  'options.tsv',
  'ppom_meta.tsv',
  'shipping_zones.tsv',
  'shipping_zone_locations.tsv',
  'shipping_zone_methods.tsv',
  'tax_rates.tsv',
  'tax_rate_locations.tsv',
  'plugins.csv',
  'versions.txt',
];

/** Files every bundle must contain. */
export const REQUIRED_BUNDLE_FILES: readonly string[] = ['posts.tsv', 'postmeta.tsv'];

/** Archive extensions: the upload takes the extracted folder, never the archive itself. */
export const ARCHIVE_EXTENSIONS: readonly string[] = ['.tgz', '.tar.gz', '.tar', '.gz', '.zip'];

/**
 * Starts a run (→ UPLOADED; the worker parses and plans it). Multipart:
 * `source_id`, `options` (JSON) and, for a bundle source, every extracted
 * bundle file as a `files` part (the API refuses an archive in `file`).
 * Upload progress is reported through XHR, since fetch has no upload events.
 */
export function createRun(
  token: string,
  input: { source_id: string; options: ImportRunOptions; files?: File[] | null },
  onProgress?: (fraction: number) => void,
): Promise<ImportRunView> {
  const form = new FormData();
  form.append('source_id', input.source_id);
  form.append('options', JSON.stringify(input.options));
  for (const file of input.files ?? []) form.append('files', file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/importer/my/runs`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }
    xhr.onerror = () => reject(new ApiError('Network error'));
    xhr.onload = () => {
      let json: { data?: ImportRunView; message?: string | string[]; code?: string; errors?: unknown } | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && json?.data) {
        resolve(json.data);
        return;
      }
      const msg = json?.message;
      const err = new ApiError(Array.isArray(msg) ? msg.join(' · ') : msg || 'Upload failed');
      err.status = xhr.status;
      // IMPORT_RUN_OPTIONS_INVALID carries its list as a top-level `errors[]`.
      err.errors = Array.isArray(msg) ? msg : optionErrorsOf({ payload: json ?? undefined });
      err.code = typeof json?.code === 'string' ? json.code : xhr.status === 413 ? 'IMPORT_BUNDLE_TOO_LARGE' : undefined;
      err.payload = json && typeof json === 'object' ? (json as Record<string, unknown>) : undefined;
      reject(err);
    };
    xhr.send(form);
  });
}

export function listRuns(token: string, query: { page?: number; limit?: number; source_id?: string } = {}): Promise<Paged<ImportRunView>> {
  return api<Paged<ImportRunView>>(`/importer/my/runs${qs(query)}`, { token });
}

export function getRun(token: string, id: string): Promise<ImportRunView> {
  return api<ImportRunView>(`/importer/my/runs/${enc(id)}`, { token });
}

export function listRunItems(
  token: string,
  id: string,
  query: { phase?: ImportItemPhase; entity_type?: string; action?: string; page?: number; limit?: number } = {},
): Promise<Paged<ImportRunItemView>> {
  return api<Paged<ImportRunItemView>>(`/importer/my/runs/${enc(id)}/items${qs(query)}`, { token });
}

export function listRunLogs(
  token: string,
  id: string,
  query: { level?: ImportLogLevel; code?: string; page?: number; limit?: number } = {},
): Promise<Paged<ImportRunLogView>> {
  return api<Paged<ImportRunLogView>>(`/importer/my/runs/${enc(id)}/logs${qs(query)}`, { token });
}

export function downloadRunReport(token: string, id: string): Promise<void> {
  return downloadAuthed(`/importer/my/runs/${enc(id)}/report.csv`, token, `import-${id.slice(0, 8)}.csv`);
}

/** Mapping review edits: the run goes back to UPLOADED and is planned again. */
export function updateRunOptions(token: string, id: string, options: ImportRunOptions): Promise<ImportRunView> {
  return api<ImportRunView>(`/importer/my/runs/${enc(id)}/options`, {
    method: 'PUT',
    token,
    body: JSON.stringify(options),
  });
}

/** PLANNED → QUEUED. 409 IMPORT_PLAN_STALE when the plan changed since the dry run. */
export function confirmRun(token: string, id: string, planFingerprint: string): Promise<ImportRunView> {
  return api<ImportRunView>(`/importer/my/runs/${enc(id)}/confirm`, {
    method: 'POST',
    token,
    body: JSON.stringify({ plan_fingerprint: planFingerprint }),
  });
}

export function cancelRun(token: string, id: string): Promise<ImportRunView> {
  return api<ImportRunView>(`/importer/my/runs/${enc(id)}/cancel`, { method: 'POST', token });
}

export function rollbackRun(token: string, id: string): Promise<ImportRunView> {
  return api<ImportRunView>(`/importer/my/runs/${enc(id)}/rollback`, { method: 'POST', token });
}

export function deleteRun(token: string, id: string): Promise<unknown> {
  return api<unknown>(`/importer/my/runs/${enc(id)}`, { method: 'DELETE', token });
}
