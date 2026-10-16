/**
 * Dashboard helpers of the "personalization" store app (M4.1 WP-E).
 *
 * Part 1 — CONTRACT TYPES. Field config shapes of M4.1-DESIGN §3.1 as the
 * dashboard edits them (`conditions`, `pricing`, `repeat`, `ui`, the new
 * translation columns) and the option-config extension `valueMeta` (C38).
 *
 * Part 2 — DISPLAY MIRROR. `buildPersonalizationGroups` and
 * `snapshotGroupLabel` follow multi-stores-shared/src/personalization/display.ts
 * (§3.5, C18). The shared file is written concurrently by WP 4.1-A; until it
 * lands this is a thin re-implementation of the contract. When display.ts
 * exists, diff this block against it and keep the two in sync.
 *
 * Part 3 — THIN API CLIENT for the creator endpoints of §4.4 (C33) and the
 * app settings normaliser (§3.9 settings, C23).
 */

import { api } from '@/lib/api';
import { isPlainObject, type LocaleMap, type OrderFieldValueRow } from '@/lib/customFields';

// ===========================================================================
// Part 1 — contract types
// ===========================================================================

/** Field types added by the app; never shown or accepted while it is off (D10). */
export const APP_ONLY_FIELD_TYPES = ['CHECKBOX_GROUP', 'COLOR_PALETTE', 'REPEATER'] as const;
export type AppOnlyFieldType = (typeof APP_ONLY_FIELD_TYPES)[number];

export function isAppOnlyType(type: string | null | undefined): boolean {
  return !!type && (APP_ONLY_FIELD_TYPES as readonly string[]).includes(type);
}

/** Types a REPEATER child may have (D5). */
export const REPEATER_CHILD_TYPES = ['TEXT', 'COLOR_PALETTE', 'SELECT', 'CHECKBOX_GROUP'] as const;

export const CONDITION_OPS = ['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'set', 'unset'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

/** Ops that compare a number (`optionCount()` for options, `Number(v)` for fields). */
export const NUMERIC_OPS: readonly ConditionOp[] = ['gt', 'gte', 'lt', 'lte'];
/** Ops that take a list of values. */
export const LIST_OPS: readonly ConditionOp[] = ['in', 'nin'];
/** Ops without a value. */
export const VALUELESS_OPS: readonly ConditionOp[] = ['set', 'unset'];

export interface PConditionRule {
  source: 'option' | 'field';
  /** Option name, or the `name` of an earlier top-level field. */
  key: string;
  op: ConditionOp;
  value?: string | number | string[];
}

export interface PConditions {
  match: 'all' | 'any';
  rules: PConditionRule[];
}

export const PRICING_MODES = ['fixed', 'per_option', 'per_char', 'per_item'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

/** Price modifier, per unit, base currency, always ≥ 0 (D4, Q6). */
export interface PPricing {
  mode: PricingMode;
  amount?: number;
  option_prices?: Record<string, number>;
}

export interface PRepeat {
  count: { option: string; map?: Record<string, number> };
  start_index: number;
  max: number;
  lead?: { fields: string[]; options: string[] };
}

export interface PUi {
  placement?: 'before_variants' | 'after_variants';
  transform?: 'uppercase' | 'none';
  counter?: boolean | 'linked';
  insert_char?: string;
  limit_to_target?: boolean;
  default_checked?: string[];
  palette_from_option?: string;
  palette_hex?: Record<string, string>;
  validation_summary?: boolean;
  font_family?: string;
  // Unknown keys written by newer versions are kept as-is.
  [key: string]: unknown;
}

/** Translation columns added by M4.1 (C6). */
export const TRANSLATION_EXTRA_KEYS = [
  'display_label',
  'sublabel',
  'note',
  'help_text',
  'help_image_url',
  'messages',
] as const;
export type TranslationExtraKey = (typeof TRANSLATION_EXTRA_KEYS)[number];

/** Text keys of the extras (everything but `messages`). */
export const TRANSLATION_TEXT_EXTRA_KEYS = [
  'display_label',
  'sublabel',
  'note',
  'help_text',
  'help_image_url',
] as const;
export type TranslationTextExtraKey = (typeof TRANSLATION_TEXT_EXTRA_KEYS)[number];

/** Keys of `translation.messages` (C34; "{i}" = item index). */
export const MESSAGE_KEYS = [
  'required',
  'pattern',
  'allowed_chars',
  'equal_length',
  'max_length',
  'min_checked',
  'max_checked',
] as const;
export type MessageKey = (typeof MESSAGE_KEYS)[number];

/** Field-level keys added by M4.1 that the custom-field DTO accepts. */
export const FIELD_EXTRA_KEYS = ['parent_id', 'conditions', 'pricing', 'repeat', 'ui'] as const;
export type FieldExtraKey = (typeof FIELD_EXTRA_KEYS)[number];

/**
 * Per-value display data of a variant option (C38): cards and repeat count.
 * The swatch image is NOT here; it is `swatchMap[value]` on the option.
 */
export interface ValueMeta {
  label?: string;
  sublabel?: string;
  badge?: string;
  badge_color?: string;
  count?: number;
  i18n?: Record<string, { label?: string; sublabel?: string; badge?: string }>;
}

export const DEFAULT_BADGE_COLOR = '#fbde31';
export const MAX_REPEAT = 20;
export const MAX_VALUE_COUNT = 100;
export const MAX_CHECKED_LIMIT = 50;

/** Variant option as far as personalization pickers need it. */
export interface OptionConfigLike {
  name: string;
  style?: string;
  values: string[];
  colorMap?: Record<string, string>;
  valueMeta?: Record<string, ValueMeta>;
}

/**
 * Count of an option value (D6): explicit map, else `valueMeta.count`, else the
 * leading integer of the value ("3 produkter" → 3), else 0.
 */
export function optionValueCount(
  option: OptionConfigLike | undefined,
  value: string,
  map?: Record<string, number>,
): number {
  if (map && typeof map[value] === 'number') return map[value];
  const meta = option?.valueMeta?.[value]?.count;
  if (typeof meta === 'number') return meta;
  const m = /^\s*(\d+)/.exec(value);
  return m ? parseInt(m[1], 10) : 0;
}

/** `#rgb` / `#rrggbb` (case-insensitive). */
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

/** Minimal field row shape the helpers below need. */
interface FieldRowLike {
  id?: string;
  type: string;
  parent_id?: string | null;
  sort_order?: number;
  children?: FieldRowLike[] | null;
  conditions?: unknown;
  pricing?: unknown;
  repeat?: unknown;
  ui?: unknown;
  translations?: readonly unknown[] | null;
}

/**
 * Flattens a field list that may come as a tree (`children` nested, storefront
 * style) or flat (`parent_id` set, `findByProduct` style) into one flat list.
 * `children` is removed from every row so it is never sent back.
 */
export function flattenFieldTree<T extends FieldRowLike>(fields: readonly T[] | null | undefined): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const walk = (list: readonly T[], parentId: string | null) => {
    for (const f of list) {
      if (f.id && seen.has(f.id)) continue;
      if (f.id) seen.add(f.id);
      const { children, ...rest } = f;
      // Rows nested under a parent get its id; top-level rows stay untouched.
      const row = (parentId !== null ? { ...rest, parent_id: rest.parent_id ?? parentId } : rest) as T;
      out.push(row);
      if (Array.isArray(children) && children.length > 0 && f.id) walk(children as T[], f.id);
    }
  };
  walk(fields ?? [], null);
  return out;
}

/** True when a field uses anything that needs the app (D10 "advanced"). */
export function hasAdvancedConfig(field: FieldRowLike): boolean {
  if (isAppOnlyType(field.type) || field.parent_id) return true;
  if ([field.conditions, field.pricing, field.repeat, field.ui].some((v) => v !== null && v !== undefined)) {
    return true;
  }
  return (field.translations ?? []).some((tr) =>
    isPlainObject(tr) && TRANSLATION_EXTRA_KEYS.some((k) => {
      const v = tr[k];
      if (v === null || v === undefined || v === '') return false;
      return !(isPlainObject(v) && Object.keys(v).length === 0);
    }),
  );
}

// ===========================================================================
// Part 2 — display mirror (shared display.ts, §3.5 / C18)
// ===========================================================================

/** Order snapshot row with the M4.1 columns (C1). */
export interface PersonalizationOrderRow extends OrderFieldValueRow {
  group_key?: string | null;
  group_index?: number | null;
  group_label?: LocaleMap | string | null;
  source?: 'FIELD' | 'OPTION' | 'DESIGN' | string | null;
  price_delta?: string | number | null;
  meta?: { hex?: string | null; option_name?: string | null } | null;
}

/** Same chain as `pickFromMap` in customFields.ts (locale → primary → en → first). */
function pickLocale(map: unknown, locale: string, primary: string): string | null {
  if (typeof map === 'string') return map || null;
  if (!isPlainObject(map)) return null;
  const ok = (v: unknown): v is string => typeof v === 'string' && v !== '';
  for (const key of [locale, primary, 'en']) if (key && ok(map[key])) return map[key];
  for (const v of Object.values(map)) if (ok(v)) return v;
  return null;
}

/**
 * Heading of a repeater group, e.g. "Artikel 2" (C18 `snapshotGroupLabel`).
 * Falls back to `fallback` with `{i}` replaced, then to "#<index>".
 */
export function snapshotGroupLabel(
  row: Pick<PersonalizationOrderRow, 'group_label' | 'group_index'>,
  locale: string,
  primary: string,
  fallback?: string,
): string {
  const picked = pickLocale(row.group_label, locale, primary);
  if (picked) return picked;
  const index = row.group_index ?? '';
  if (fallback) return fallback.replace('{i}', String(index));
  return `#${index}`;
}

export interface PersonalizationGroupEntry<R> {
  row: R;
  label: string;
  value: string;
  hex?: string;
}

export interface PersonalizationGroup<R> {
  key: string;
  index: number;
  label: string;
  entries: PersonalizationGroupEntry<R>[];
}

/**
 * Splits rows into repeater groups (rows with `group_index`, sorted by index)
 * and flat rows (§3.5). `source='OPTION'` rows outside a group are skipped
 * (the variant line already shows them). Rows keep their order inside a
 * group (callers sort by `sort_order` first).
 */
export function buildPersonalizationGroups<R extends PersonalizationOrderRow>(
  rows: readonly R[],
  read: (row: R) => { label: string; value: string },
  groupLabel: (row: R) => string,
): { groups: PersonalizationGroup<R>[]; flat: R[] } {
  const byKey = new Map<string, PersonalizationGroup<R>>();
  const flat: R[] = [];
  for (const row of rows) {
    const index = typeof row.group_index === 'number' ? row.group_index : null;
    if (index === null) {
      if (row.source === 'OPTION') continue;
      flat.push(row);
      continue;
    }
    const key = `${row.group_key ?? ''}:${index}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, index, label: groupLabel(row), entries: [] };
      byKey.set(key, group);
    }
    const { label, value } = read(row);
    const hex = isHexColor(row.meta?.hex) ? row.meta?.hex ?? undefined : undefined;
    group.entries.push({ row, label, value, hex });
  }
  const groups = Array.from(byKey.values()).sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return a.key.localeCompare(b.key);
  });
  return { groups, flat };
}

/** True when any row belongs to a repeater group (only written in app mode). */
export function hasGroupedRows(rows: readonly PersonalizationOrderRow[] | null | undefined): boolean {
  return (rows ?? []).some((r) => typeof r.group_index === 'number');
}

// ===========================================================================
// Part 3 — settings and API client
// ===========================================================================

export type CardPriceMode = 'selection' | 'from';
export type ListingCta = 'personalize' | 'none';

/** `StoreApp.settings` of the app (§3.9 + C23). */
export interface PersonalizationSettings {
  free_shipping_badge: boolean;
  /** ISO2; null = market country → store tax country → platform. */
  free_shipping_country: string | null;
  card_price_mode: CardPriceMode;
  validation_summary: boolean;
  /** URL param → field name, or `option:<Option name>`. */
  url_prefill: Record<string, string>;
  listing_cta: ListingCta;
  /** Customer-upload retention, 7–730 days (private, C23). */
  retention_days: number;
}

export const DEFAULT_PERSONALIZATION_SETTINGS: PersonalizationSettings = {
  free_shipping_badge: true,
  free_shipping_country: null,
  card_price_mode: 'selection',
  validation_summary: true,
  url_prefill: {},
  listing_cta: 'personalize',
  retention_days: 60,
};

export const RETENTION_MIN_DAYS = 7;
export const RETENTION_MAX_DAYS = 730;
/** Same rules as the API settings validator (WP-B). */
export const URL_PARAM_RE = /^[A-Za-z0-9_\-[\].]{1,40}$/;
export const URL_PREFILL_MAX_ENTRIES = 20;
export const URL_PREFILL_TARGET_MAX = 120;

/** Lenient read: unknown or invalid values fall back to the defaults. */
export function normalizePersonalizationSettings(raw: unknown): PersonalizationSettings {
  const src = isPlainObject(raw) ? raw : {};
  const d = DEFAULT_PERSONALIZATION_SETTINGS;
  const prefill: Record<string, string> = {};
  if (isPlainObject(src.url_prefill)) {
    for (const [k, v] of Object.entries(src.url_prefill)) {
      if (typeof v === 'string' && v.trim() !== '') prefill[k] = v;
    }
  }
  const days = typeof src.retention_days === 'number' && Number.isInteger(src.retention_days)
    ? src.retention_days
    : d.retention_days;
  return {
    free_shipping_badge: typeof src.free_shipping_badge === 'boolean' ? src.free_shipping_badge : d.free_shipping_badge,
    free_shipping_country:
      typeof src.free_shipping_country === 'string' && /^[A-Za-z]{2}$/.test(src.free_shipping_country)
        ? src.free_shipping_country.toUpperCase()
        : null,
    card_price_mode: src.card_price_mode === 'from' ? 'from' : 'selection',
    validation_summary: typeof src.validation_summary === 'boolean' ? src.validation_summary : d.validation_summary,
    url_prefill: prefill,
    listing_cta: src.listing_cta === 'none' ? 'none' : 'personalize',
    retention_days: Math.min(RETENTION_MAX_DAYS, Math.max(RETENTION_MIN_DAYS, days)),
  };
}

export function samePersonalizationSettings(a: PersonalizationSettings, b: PersonalizationSettings): boolean {
  const prefillKey = (m: Record<string, string>) =>
    JSON.stringify(Object.entries(m).sort(([x], [y]) => x.localeCompare(y)));
  return (
    a.free_shipping_badge === b.free_shipping_badge &&
    a.free_shipping_country === b.free_shipping_country &&
    a.card_price_mode === b.card_price_mode &&
    a.validation_summary === b.validation_summary &&
    a.listing_cta === b.listing_cta &&
    a.retention_days === b.retention_days &&
    prefillKey(a.url_prefill) === prefillKey(b.url_prefill)
  );
}

// ---------------------------------------------------------------------------
// Presets (§4.4 / §4.5)
// ---------------------------------------------------------------------------

export const PRESET_KEYS = [
  'names_equal_length',
  'single_name',
  'name_color_per_item',
  'engravings',
  'checkbox_group',
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export const PRESET_MODES = ['skip_if_exists', 'append', 'replace_preset'] as const;
export type PresetMode = (typeof PRESET_MODES)[number];

/**
 * Param kinds the params form can render. `option` = a variant option name of
 * the product; `option_value_map` = a number per value of the option named by
 * `ref`; `checked_list` = a subset of the string list param named by `ref`
 * (or "all"); `image_map` = one image URL per entry of `keys`.
 */
export type PresetParamType =
  | 'option'
  | 'number'
  | 'boolean'
  | 'string'
  | 'string_list'
  | 'enum'
  | 'option_value_map'
  | 'checked_list'
  | 'image_map';

export interface PresetParam {
  key: string;
  type: PresetParamType;
  required?: boolean;
  default?: unknown;
  /** enum values */
  values?: string[];
  /** number bounds */
  min?: number;
  max?: number;
  /** option_value_map / checked_list: the param this one depends on */
  ref?: string;
  /** image_map keys */
  keys?: string[];
}

export interface PresetSummary {
  key: string;
  version: number;
  params: PresetParam[];
}

/** One field a preset creates, for the preview list on the card. */
export interface PresetFieldPreview {
  name: string;
  type: string;
  children?: PresetFieldPreview[];
}

/**
 * Local catalogue of the five code presets (§4.6): the param schema used when
 * the API summary omits it, and the field preview shown on each card. The
 * first four reproduce the Namez templates 1:1 (mechanisms A, B, C, D); the
 * fifth is the PPOM checkbox group (E). The API stays authoritative.
 */
export const PRESET_CATALOG: Record<PresetKey, { params: PresetParam[]; fields: PresetFieldPreview[]; namez: boolean }> = {
  names_equal_length: {
    namez: true,
    params: [
      { key: 'placement', type: 'enum', values: ['before_variants', 'after_variants'], default: 'before_variants' },
      { key: 'name_max', type: 'number', min: 1, max: 50, default: 11 },
      { key: 'model_text', type: 'boolean', default: true },
      { key: 'model_text_max', type: 'number', min: 1, max: 200, default: 25 },
      { key: 'help_images', type: 'image_map', keys: ['name_1', 'name_2', 'model_text'] },
    ],
    fields: [
      { name: 'name_1', type: 'TEXT' },
      { name: 'name_2', type: 'TEXT' },
      { name: 'model_text', type: 'TEXT' },
    ],
  },
  single_name: {
    namez: true,
    params: [],
    fields: [{ name: 'custom_name_v3', type: 'TEXT' }],
  },
  name_color_per_item: {
    namez: true,
    params: [
      { key: 'quantity_option', type: 'option', required: true },
      { key: 'count_map', type: 'option_value_map', ref: 'quantity_option' },
      { key: 'start_index', type: 'number', min: 1, max: MAX_REPEAT, default: 2 },
      { key: 'max', type: 'number', min: 1, max: MAX_REPEAT, default: 6 },
      { key: 'palette_option', type: 'option', default: 'Färg' },
      { key: 'lead', type: 'boolean', default: true },
    ],
    fields: [
      { name: 'custom_name_v3', type: 'TEXT' },
      {
        name: 'dnc_items',
        type: 'REPEATER',
        children: [
          { name: 'color', type: 'COLOR_PALETTE' },
          { name: 'name', type: 'TEXT' },
        ],
      },
    ],
  },
  engravings: {
    namez: true,
    params: [
      { key: 'count_option', type: 'option', default: 'Antal inskriptioner' },
      { key: 'count', type: 'number', min: 1, max: 4, default: 4 },
      { key: 'max_length', type: 'number', min: 1, max: 200, default: 15 },
    ],
    fields: [
      { name: 'field_1_v2', type: 'TEXT' },
      { name: 'field_2_v2', type: 'TEXT' },
      { name: 'field_3_v2', type: 'TEXT' },
      { name: 'field_4_v2', type: 'TEXT' },
    ],
  },
  checkbox_group: {
    namez: false,
    params: [
      { key: 'name', type: 'string', default: 'ppom_details' },
      { key: 'label', type: 'string', required: true },
      { key: 'options', type: 'string_list', required: true },
      { key: 'default_checked', type: 'checked_list', ref: 'options', default: 'all' },
      // Locale the label is written in; empty = the store's primary locale.
      { key: 'locale', type: 'string' },
    ],
    fields: [{ name: 'ppom_details', type: 'CHECKBOX_GROUP' }],
  },
};

export function isPresetKey(key: string): key is PresetKey {
  return (PRESET_KEYS as readonly string[]).includes(key);
}

/** API summary when present, else the local catalogue (keys the API lists win). */
export function mergePresetSummaries(remote: PresetSummary[] | null): PresetSummary[] {
  const list = remote && remote.length > 0
    ? remote
    : PRESET_KEYS.map((key) => ({ key, version: 1, params: PRESET_CATALOG[key].params }));
  return list.map((p) => ({
    ...p,
    params: Array.isArray(p.params) && p.params.length > 0
      ? p.params
      : isPresetKey(p.key) ? PRESET_CATALOG[p.key].params : [],
  }));
}

/** Initial params of the form: declared defaults. */
export function defaultPresetParams(params: PresetParam[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of params) if (p.default !== undefined) out[p.key] = p.default;
  return out;
}

/** Drops empty values so the API applies its own defaults. */
export function cleanPresetParams(params: PresetParam[], values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of params) {
    const v = values[p.key];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0 && p.type !== 'checked_list') continue;
    if (isPlainObject(v) && Object.keys(v).length === 0) continue;
    out[p.key] = v;
  }
  return out;
}

export function listPresets(token: string): Promise<PresetSummary[]> {
  return api<PresetSummary[]>('/personalization/my/presets', { token });
}

export function applyPreset<T = unknown>(
  token: string,
  productId: string,
  key: string,
  body: { params: Record<string, unknown>; mode: PresetMode },
): Promise<T[]> {
  return api<T[]>(`/personalization/my/products/${productId}/presets/${encodeURIComponent(key)}`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Field library (§4.4, D13)
// ---------------------------------------------------------------------------

/** A field without ids, as stored in `PersonalizationFieldTemplate.definition`. */
export interface FieldDraft {
  name: string;
  type: string;
  is_required?: boolean;
  options?: string[] | null;
  validation_rules?: Record<string, unknown> | null;
  linked_validation?: Record<string, unknown> | null;
  conditions?: PConditions | null;
  pricing?: PPricing | null;
  repeat?: PRepeat | null;
  ui?: PUi | null;
  translations?: Record<string, unknown>[];
}

export interface PersonalizationTemplate {
  id: string;
  name: string;
  definition: { field: FieldDraft; children?: FieldDraft[] };
  created_at?: string;
  updated_at?: string;
}

export const TEMPLATE_NAME_MAX = 120;

export function listTemplates(token: string): Promise<PersonalizationTemplate[]> {
  return api<PersonalizationTemplate[]>('/personalization/my/library', { token });
}

export function saveFieldToLibrary(token: string, fieldId: string, name: string): Promise<PersonalizationTemplate> {
  return api<PersonalizationTemplate>('/personalization/my/library', {
    method: 'POST',
    token,
    body: JSON.stringify({ from_field_id: fieldId, name }),
  });
}

export function renameTemplate(token: string, id: string, name: string): Promise<PersonalizationTemplate> {
  return api<PersonalizationTemplate>(`/personalization/my/library/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ name }),
  });
}

export function deleteTemplate(token: string, id: string): Promise<unknown> {
  return api<unknown>(`/personalization/my/library/${id}`, { method: 'DELETE', token });
}

export function insertTemplate<T = unknown>(token: string, productId: string, templateId: string): Promise<T[]> {
  return api<T[]>(`/personalization/my/products/${productId}/library/${templateId}`, {
    method: 'POST',
    token,
  });
}

// ---------------------------------------------------------------------------
// Product picker data (own products only, D2)
// ---------------------------------------------------------------------------

export interface PickerProduct {
  id: string;
  title: string;
}

interface ProductListRow {
  id: string;
  translations?: { locale: string; title?: string | null }[];
}

/** First page of the creator's own products (`GET /products/mine`). */
export async function listOwnProducts(token: string, primaryLocale: string, search = ''): Promise<PickerProduct[]> {
  const params = new URLSearchParams({ page: '1', limit: '100' });
  if (search.trim()) params.set('search', search.trim());
  const res = await api<{ data?: ProductListRow[] } | ProductListRow[]>(`/products/mine?${params.toString()}`, { token });
  const rows = Array.isArray(res) ? res : res?.data ?? [];
  return rows.map((p) => {
    const tr = p.translations?.find((x) => x.locale === primaryLocale) ?? p.translations?.[0];
    return { id: p.id, title: tr?.title || p.id };
  });
}

/** Option config of one product (`GET /products/:id`), for option pickers. */
export async function loadProductOptions(token: string, productId: string): Promise<OptionConfigLike[]> {
  const p = await api<{ variant_option_config?: OptionConfigLike[] | null }>(`/products/${productId}`, { token });
  return Array.isArray(p?.variant_option_config) ? p.variant_option_config.filter((o) => o && o.name) : [];
}

/** Error codes of §4.3 whose `errors[]` carry `{path, code}` (config validator). */
export interface ConfigIssue {
  path?: string;
  code?: string;
}

/** Reads `errors` of a PERSONALIZATION_CONFIG_INVALID body (top level or under `message`). */
export function readConfigIssues(payload: Record<string, unknown> | undefined): ConfigIssue[] {
  if (!payload) return [];
  const direct = payload.errors;
  const nested = isPlainObject(payload.message) ? payload.message.errors : undefined;
  const list = Array.isArray(direct) ? direct : Array.isArray(nested) ? nested : [];
  return list.filter(isPlainObject).map((e) => ({
    path: typeof e.path === 'string' ? e.path : undefined,
    code: typeof e.code === 'string' ? e.code : undefined,
  }));
}

// Path → UI location mapping lives in a standalone module (node-checkable).
export { locateConfigIssue, type ConfigIssueArea, type ConfigIssueLocation } from '@/lib/configIssuePath';

/**
 * Extra params of a 409 like PERSONALIZATION_OPTION_IN_USE / _FIELD_IN_USE
 * (`params.fields`, `params.options`): a list or a comma-joined string.
 */
export function readErrorParamList(payload: Record<string, unknown> | undefined, key: string): string[] {
  const params = payload && isPlainObject(payload.params) ? payload.params : undefined;
  const raw = params?.[key];
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean))];
}

/** Content locales of the creator's store (`GET /stores/my/store`), primary first; 'en' when unknown. */
export async function loadStoreLocales(token: string): Promise<{ primary: string; locales: string[] }> {
  const store = await api<{ language_config?: { primary_locale?: string; secondary_locales?: string[] } | null }>(
    '/stores/my/store',
    { token },
  );
  const primary = store?.language_config?.primary_locale || 'en';
  const secondary = Array.isArray(store?.language_config?.secondary_locales)
    ? store.language_config.secondary_locales.filter((l): l is string => typeof l === 'string' && l !== primary)
    : [];
  return { primary, locales: [primary, ...new Set(secondary)] };
}

/** Primary content locale of the creator's store, 'en' when unknown. */
export async function loadStorePrimaryLocale(token: string): Promise<string> {
  return (await loadStoreLocales(token)).primary;
}
