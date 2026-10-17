// Creator API of the `designer` store app (M4.2 WP9). Routes and shapes
// follow plans/namez-store-apps/M4.2-CONTRACTS.md ("Creator routes").
// Every route lives under `/designer/my/*` (creator JWT, app enabled).

import { api, API_URL, ApiError } from '@/lib/api';
import { downloadAuthed, qs, type Paged } from '@/lib/http';
import type { TemplateSpecV1 } from '@/lib/designer/design-renderer';

export type { Paged } from '@/lib/http';

// ─── Shared shapes ──────────────────────────────────────────────────────────

export type DesignTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type TemplateAssetKind = 'TEMPLATE_BG_WEB' | 'TEMPLATE_BG_PRINT' | 'TEMPLATE_DECO' | 'TEMPLATE_THUMB';
export type PrintStatus = 'PENDING' | 'RENDERING' | 'READY' | 'FAILED' | 'PURGED';

export const TEMPLATE_ASSET_KINDS: readonly TemplateAssetKind[] = [
  'TEMPLATE_BG_WEB',
  'TEMPLATE_BG_PRINT',
  'TEMPLATE_DECO',
  'TEMPLATE_THUMB',
];
export const PRINT_STATUSES: readonly PrintStatus[] = ['PENDING', 'RENDERING', 'READY', 'FAILED', 'PURGED'];

/** Upload caps of the creator routes (API: TEMPLATE_ASSET_MAX_BYTES, FONT_MAX_BYTES). */
export const TEMPLATE_ASSET_MAX_MB = 40;
export const FONT_MAX_MB = 10;

// ─── Assets ─────────────────────────────────────────────────────────────────

export interface DesignerAssetView {
  id: string;
  kind: TemplateAssetKind | 'FONT' | 'CUSTOMER_PHOTO';
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  created_at: string;
  /** True when `url` is a stable public path; false = signed, short-lived. */
  public: boolean;
  /** Path relative to the API origin (`/api/designer/...`), null when purged. */
  url: string | null;
  meta: Record<string, unknown>;
}

export interface AssetWarning {
  code: string;
  params?: Record<string, number | string>;
}

export interface AssetResolution {
  template_mm: { width: number; height: number };
  template_size_source: 'template' | 'default';
  target_px: { width: number; height: number };
  effective_dpi: number;
}

export interface UploadAssetResult {
  asset: DesignerAssetView;
  deduped: boolean;
  warnings: AssetWarning[];
  resolution: AssetResolution | null;
  replaces: string | null;
}

export interface AssetReferences {
  template_versions: number;
  order_items: number;
}

// ─── Fonts ──────────────────────────────────────────────────────────────────

export interface DesignerFontView {
  id: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  format: 'woff2' | 'ttf' | 'otf';
  bytes: number;
  sha256: string;
  url: string;
  created_at: string;
  /** A newer upload of the same face exists (kept for old versions). */
  superseded: boolean;
}

export interface UploadFontResult {
  font: DesignerFontView;
  deduped: boolean;
  replaced: string[];
}

// ─── Templates ──────────────────────────────────────────────────────────────

export interface TemplateListItem {
  id: string;
  name: string;
  status: DesignTemplateStatus;
  source: string;
  external_ref: string | null;
  current_version_id: string | null;
  current_version: { id: string; version: number } | null;
  thumbnail_url: string | null;
  product_count: number;
  version_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersionSummary {
  id: string;
  version: number;
  spec_sha256: string;
  thumbnail_url: string | null;
  created_by: string | null;
  created_at: string;
  design_count: number;
  current: boolean;
}

export interface TemplateDetail {
  id: string;
  name: string;
  status: DesignTemplateStatus;
  source: string;
  external_ref: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  versions: TemplateVersionSummary[];
  latest_version: { id: string; version: number; spec: TemplateSpecV1 } | null;
  current_spec: TemplateSpecV1 | null;
  products: { product_id: string; enabled: boolean; status: string; titles: Record<string, string> }[];
}

export interface TemplateVersionFull {
  id: string;
  template_id: string;
  version: number;
  spec: TemplateSpecV1;
  spec_sha256: string;
  created_at: string;
}

/** One issue of 400 DESIGNER_TEMPLATE_INVALID (`{errors:[{path, rule}]}`). */
export interface SpecIssue {
  path: string;
  rule: string;
}

// ─── Product link ───────────────────────────────────────────────────────────

export interface ProductDesignerView {
  product_id: string;
  link: {
    enabled: boolean;
    template_id: string;
    template: { id: string; name: string; status: DesignTemplateStatus } | null;
    addons: unknown;
    updated_at: string;
  } | null;
  fallback_field_count: number;
  required_field_count: number;
  /** Only on PUT: launch fields deleted by enabling. */
  removed_fallback_fields?: number;
}

// ─── Orders / print queue ───────────────────────────────────────────────────

export interface PrintFileInfo {
  surface: string;
  format: string;
  width_px: number;
  height_px: number;
  dpi: number;
  bytes: number;
}

export interface OrderDesignAsset {
  asset_id?: string;
  role?: string;
  element_id?: string;
  width?: number;
  height?: number;
  low_res?: boolean;
  effective_dpi?: number;
  preview_url?: string | null;
  original_available?: boolean;
}

/**
 * Frozen customer state of a designed order line (photo `adj` per slot).
 * Mirrors DesignStateV1; kept loose because older rows may lack fields.
 */
export interface OrderDesignState {
  v?: number;
  texts?: Record<string, string>;
  photos?: Record<string, { asset_id?: string; width?: number; height?: number; adj?: { zoom: number; rot: number; panX: number; panY: number } }>;
  choices?: Record<string, string>;
}

export interface OrderDesignItem {
  order_item_id: string;
  order_item_design_id: string;
  design_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  template_id: string;
  template_version_id: string;
  renderer_version: string;
  /** Frozen design state of the line (photo crops); null on old rows. */
  state?: OrderDesignState | null;
  /** Frozen template spec of the line, so the fallback proof needs no version fetch. */
  template_spec?: TemplateSpecV1 | null;
  proof_url: string | null;
  text_values: { element_id: string; label: string; value: string }[] | null;
  assets: OrderDesignAsset[];
  low_res: boolean;
  print: {
    status: PrintStatus;
    attempts: number;
    error: string | null;
    requested_at: string | null;
    rendered_at: string | null;
    files: PrintFileInfo[];
    download_path: string | null;
  };
  shipped_at: string | null;
  terminal_at: string | null;
  originals_purged_at: string | null;
  files_purged_at: string | null;
  originals_purge_at: string | null;
  files_purge_at: string | null;
}

export interface OrderDesigns {
  order_id: string;
  order_number: string;
  items: OrderDesignItem[];
}

export interface PrintQueueRow {
  id: string;
  order_id: string;
  order_item_id: string;
  order_number: string | null;
  order_status: string | null;
  quantity: number | null;
  /** Product title of the line, when the API sends it (not in M4.2 payloads). */
  product_title?: string | null;
  print_status: PrintStatus;
  print_attempts: number;
  max_attempts: number;
  print_error: string | null;
  print_requested_at: string | null;
  print_rendered_at: string | null;
  print_next_attempt_at: string | null;
  files_purged_at: string | null;
  low_res: boolean;
  print_files: PrintFileInfo[];
  proof_url: string | null;
  created_at: string;
}

// ─── URLs ───────────────────────────────────────────────────────────────────

/** Origin of the API (API_URL without its trailing `/api`). */
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * Absolute URL of a designer file path. The API returns paths relative to its
 * origin (`/api/designer/assets/<id>.png`, signed `/api/designer/files/<t>`).
 */
export function designerFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

// ─── Calls ──────────────────────────────────────────────────────────────────

const BASE = '/designer/my';

/**
 * Multipart POST through fetch (the JSON `api()` helper forces a JSON
 * content type). Errors become ApiError with the API `code` and payload.
 */
async function postForm<T>(endpoint: string, token: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.message;
    const err = new ApiError(Array.isArray(msg) ? msg.join(' · ') : typeof msg === 'string' ? msg : 'Upload failed');
    err.status = res.status;
    err.errors = Array.isArray(msg) ? (msg as string[]) : undefined;
    err.code = typeof json?.code === 'string' ? json.code : res.status === 413 ? 'DESIGNER_UPLOAD_TOO_LARGE' : undefined;
    err.payload = json ?? undefined;
    throw err;
  }
  return (json?.data ?? null) as T;
}

export const listAssets = (token: string, q: { kind?: TemplateAssetKind; page?: number; limit?: number } = {}) =>
  api<Paged<DesignerAssetView>>(`${BASE}/assets${qs(q)}`, { token });

export const getAsset = (token: string, id: string) =>
  api<DesignerAssetView & { references: AssetReferences }>(`${BASE}/assets/${encodeURIComponent(id)}`, { token });

export function uploadAsset(
  token: string,
  input: { file: File; kind: TemplateAssetKind; template_id?: string | null; replaces_asset_id?: string | null },
): Promise<UploadAssetResult> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('kind', input.kind);
  if (input.template_id) form.append('template_id', input.template_id);
  if (input.replaces_asset_id) form.append('replaces_asset_id', input.replaces_asset_id);
  return postForm<UploadAssetResult>(`${BASE}/assets`, token, form);
}

export const deleteAsset = (token: string, id: string) =>
  api<{ deleted: true }>(`${BASE}/assets/${encodeURIComponent(id)}`, { method: 'DELETE', token });

export const listFonts = (token: string) => api<DesignerFontView[]>(`${BASE}/fonts`, { token });

export function uploadFont(
  token: string,
  input: { file: File; family?: string; weight?: number; style?: 'normal' | 'italic' },
): Promise<UploadFontResult> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.family) form.append('family', input.family);
  if (input.weight) form.append('weight', String(input.weight));
  if (input.style) form.append('style', input.style);
  return postForm<UploadFontResult>(`${BASE}/fonts`, token, form);
}

export const deleteFont = (token: string, id: string) =>
  api<{ deleted: true }>(`${BASE}/fonts/${encodeURIComponent(id)}`, { method: 'DELETE', token });

export const listTemplates = (token: string, q: { status?: DesignTemplateStatus; page?: number; limit?: number } = {}) =>
  api<Paged<TemplateListItem>>(`${BASE}/templates${qs(q)}`, { token });

export const createTemplate = (token: string, body: { name: string; spec?: TemplateSpecV1 }) =>
  api<TemplateDetail>(`${BASE}/templates`, { method: 'POST', token, body: JSON.stringify(body) });

export const getTemplate = (token: string, id: string) =>
  api<TemplateDetail>(`${BASE}/templates/${encodeURIComponent(id)}`, { token });

export const updateTemplate = (token: string, id: string, body: { name?: string; status?: DesignTemplateStatus }) =>
  api<TemplateDetail>(`${BASE}/templates/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: JSON.stringify(body) });

export const deleteTemplate = (token: string, id: string) =>
  api<{ deleted: true }>(`${BASE}/templates/${encodeURIComponent(id)}`, { method: 'DELETE', token });

export const addTemplateVersion = (token: string, id: string, spec: TemplateSpecV1) =>
  api<TemplateVersionFull>(`${BASE}/templates/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    token,
    body: JSON.stringify({ spec }),
  });

export const getTemplateVersion = (token: string, id: string, versionId: string) =>
  api<TemplateVersionFull>(`${BASE}/templates/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, { token });

export const publishTemplate = (token: string, id: string, versionId: string) =>
  api<TemplateDetail>(`${BASE}/templates/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    token,
    body: JSON.stringify({ version_id: versionId }),
  });

export const getProductDesigner = (token: string, productId: string) =>
  api<ProductDesignerView>(`${BASE}/products/${encodeURIComponent(productId)}`, { token });

export const putProductDesigner = (token: string, productId: string, body: { enabled: boolean; template_id: string }) =>
  api<ProductDesignerView>(`${BASE}/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(body),
  });

/** Unlinks the template from the product (the storefront shows the normal product page). */
export const deleteProductDesigner = (token: string, productId: string) =>
  api<unknown>(`${BASE}/products/${encodeURIComponent(productId)}`, { method: 'DELETE', token });

export const getOrderDesigns = (token: string, orderId: string) =>
  api<OrderDesigns>(`${BASE}/orders/${encodeURIComponent(orderId)}/designs`, { token });

export const listPrintQueue = (token: string, q: { status?: PrintStatus; page?: number; limit?: number } = {}) =>
  api<Paged<PrintQueueRow>>(`${BASE}/print-queue${qs(q)}`, { token });

export const retryFailedPrints = (token: string) =>
  api<{ count: number }>(`${BASE}/print-queue/retry-failed`, { method: 'POST', token });

export const regeneratePrint = (token: string, orderId: string, itemId: string) =>
  api<{ queued: boolean; print_status: PrintStatus }>(
    `${BASE}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/regenerate`,
    { method: 'POST', token },
  );

/**
 * Immediate erasure (GDPR) of one order item's photos, proof and print files,
 * whatever the order status. 409 DESIGNER_PRINT_NOT_READY while a print is
 * rendering; idempotent afterwards. Not in M4.2-CONTRACTS.md (added later).
 */
export const purgeOrderItemFiles = (token: string, orderId: string, itemId: string) =>
  api<unknown>(`${BASE}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/purge`, {
    method: 'POST',
    token,
  });

/**
 * Authenticated GET of a designer file saved through a temporary link. 409
 * DESIGNER_PRINT_NOT_READY, 410 DESIGNER_FILES_PURGED become ApiError codes.
 */
function downloadDesignerFile(token: string, endpoint: string, fallbackName: string): Promise<void> {
  return downloadAuthed(endpoint, token, fallbackName, {
    statusCodes: { 409: 'DESIGNER_PRINT_NOT_READY', 410: 'DESIGNER_FILES_PURGED' },
  });
}

/** Downloads the print PNG (`<order_number>-<n>-front.png`). */
export function downloadPrintFile(token: string, orderId: string, itemId: string): Promise<void> {
  return downloadDesignerFile(
    token,
    `${BASE}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/print`,
    `print-${itemId.slice(0, 8)}-front.png`,
  );
}

/** Downloads the customer's original photo of a line (410 DESIGNER_FILES_PURGED once deleted). */
export function downloadOriginalFile(token: string, orderId: string, itemId: string, assetId: string): Promise<void> {
  return downloadDesignerFile(
    token,
    `${BASE}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/originals/${encodeURIComponent(assetId)}`,
    `original-${assetId.slice(0, 8)}`,
  );
}

/** True when the API refused a write because the designer app is switched off. */
export function isAppDisabledError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'STORE_APP_NOT_ENABLED' || err.code === 'DESIGNER_NOT_ENABLED');
}

/** Issues of a DESIGNER_TEMPLATE_INVALID error body (`errors:[{path, rule}]`). */
export function specIssuesFromError(err: unknown): SpecIssue[] {
  if (!(err instanceof ApiError) || err.code !== 'DESIGNER_TEMPLATE_INVALID') return [];
  const raw = err.payload?.errors;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is { path: unknown; rule: unknown } => !!e && typeof e === 'object')
    .map((e) => ({ path: String(e.path ?? ''), rule: String(e.rule ?? '') }));
}

/** `params` of a designer error body (`{code, message, params?}`). */
export function errorParams(err: unknown): Record<string, unknown> {
  if (!(err instanceof ApiError)) return {};
  const p = err.payload?.params;
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

/** NPP import warning codes (API `NPP_IMPORT_WARNING_CODES`), translated under `creator.designer.importWarnings`. */
export const NPP_IMPORT_WARNING_CODES = [
  'INPUT_UNRECOGNIZED',
  'TEMPLATE_NO_ELEMENTS',
  'TEMPLATE_CONFLICT',
  'TEMPLATE_UNLINKED',
  'NAME_REVIEW',
  'UNKNOWN_SIZE_MODE',
  'PREMIUM_ASSUMED_BLEED',
  'NO_BACKGROUND',
  'PRINT_BG_FROM_WEB',
  'PRINT_BG_SAME_AS_WEB',
  'BG_SCALED_FALLBACK',
  'BG_SWAPPED',
  'BG_SWAP_UNDECIDED',
  'PRINT_BG_LOW_RES',
  'LABEL_NORMALIZED',
  'LABEL_NOT_NORMALIZED',
  'FONT_UNDECLARED',
  'FONT_WEIGHT_SUBSTITUTED',
  'FONT_WEIGHTS_UNKNOWN',
  'FONT_CUSTOM_UNSUPPORTED',
  'UNSUPPORTED_ELEMENT',
  'ELEMENT_NO_IMAGE',
  'ID_REWRITTEN',
  'PRODUCT_SKIPPED',
  'WEB_BG_LOW_RES',
  'ASPECT_MISMATCH',
  'WEB_BG_LARGE',
  'COLOR_CONVERTED',
  'MEDIA_SKIPPED',
  'ASSET_FETCH_FAILED',
  'ASSET_INVALID',
  'ASSET_REUSED',
  'FONTS_MISSING',
  'PRODUCT_NOT_FOUND',
  'PRODUCT_LINK_KEPT',
] as const;

export type NppImportWarningCode = (typeof NPP_IMPORT_WARNING_CODES)[number];

export function isNppImportWarningCode(code: string): code is NppImportWarningCode {
  return (NPP_IMPORT_WARNING_CODES as readonly string[]).includes(code);
}
