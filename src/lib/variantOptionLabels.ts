// M159: display labels of the variant option names / values per language
// (ProductTranslation.variant_option_labels). The canonical names and values
// (store primary language) never change: variants, carts, orders and image
// maps keep using them. A label only changes what a shopper reads in another
// language; an empty label shows the canonical text.
// Mirrors the API limits (src/common/catalog/variant-option-labels.ts).

export const OPTION_NAME_LABEL_MAX = 80;
export const OPTION_VALUE_LABEL_MAX = 120;

export interface VariantOptionLabels {
  names?: Record<string, string>;
  values?: Record<string, Record<string, string>>;
}

/** Form state of one language: always both maps (may be empty). */
export interface FormOptionLabels {
  names: Record<string, string>;
  values: Record<string, Record<string, string>>;
}

export interface OptionListEntry {
  name: string;
  values: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The options a label can be given for: names in option-config order, values
 * in config order, then values only found on variants (an old or imported
 * product), then names only found on variants.
 */
export function optionListFor(
  options: readonly { name: string; values: readonly string[] }[],
  variants: readonly { options?: Record<string, string> | null }[],
): OptionListEntry[] {
  const out: OptionListEntry[] = [];
  const byName = new Map<string, OptionListEntry>();
  const entry = (name: string) => {
    let e = byName.get(name);
    if (!e) {
      e = { name, values: [] };
      byName.set(name, e);
      out.push(e);
    }
    return e;
  };
  for (const o of options) {
    if (!o?.name) continue;
    const e = entry(o.name);
    for (const v of o.values ?? []) if (typeof v === 'string' && v && !e.values.includes(v)) e.values.push(v);
  }
  for (const v of variants) {
    if (!isRecord(v?.options)) continue;
    for (const [name, value] of Object.entries(v.options)) {
      if (!name || typeof value !== 'string' || !value) continue;
      const e = entry(name);
      if (!e.values.includes(value)) e.values.push(value);
    }
  }
  return out;
}

/** Form labels of a loaded translation row; undefined when the API sent no key. */
export function labelsFromRow(row: object): FormOptionLabels | undefined {
  if (!Object.prototype.hasOwnProperty.call(row, 'variant_option_labels')) return undefined;
  const raw = (row as { variant_option_labels?: unknown }).variant_option_labels;
  const out: FormOptionLabels = { names: {}, values: {} };
  if (!isRecord(raw)) return out;
  if (isRecord(raw.names)) {
    for (const [k, v] of Object.entries(raw.names)) if (typeof v === 'string' && v) out.names[k] = v;
  }
  if (isRecord(raw.values)) {
    for (const [name, m] of Object.entries(raw.values)) {
      if (!isRecord(m)) continue;
      const inner: Record<string, string> = {};
      for (const [k, v] of Object.entries(m)) if (typeof v === 'string' && v) inner[k] = v;
      if (Object.keys(inner).length) out.values[name] = inner;
    }
  }
  return out;
}

/** Labels as the API stores them: trimmed, no empty / canonical / unknown keys; null when none. */
export function cleanLabels(
  labels: FormOptionLabels | undefined,
  optionList: readonly OptionListEntry[],
): VariantOptionLabels | null {
  if (!labels) return null;
  const names: Record<string, string> = {};
  const values: Record<string, Record<string, string>> = {};
  for (const o of optionList) {
    const n = (labels.names[o.name] ?? '').trim().slice(0, OPTION_NAME_LABEL_MAX);
    if (n && n !== o.name) names[o.name] = n;
    const m = labels.values[o.name] ?? {};
    const inner: Record<string, string> = {};
    for (const v of o.values) {
      const l = (m[v] ?? '').trim().slice(0, OPTION_VALUE_LABEL_MAX);
      if (l && l !== v) inner[v] = l;
    }
    if (Object.keys(inner).length) values[o.name] = inner;
  }
  const out: VariantOptionLabels = {};
  if (Object.keys(names).length) out.names = names;
  if (Object.keys(values).length) out.values = values;
  return out.names || out.values ? out : null;
}

/**
 * True when `locale` counts as the store primary language for option labels
 * (same rule as the API: same base language, so `sv-FI` with primary `sv`).
 * Such a locale holds the canonical names and never carries labels.
 */
export function isPrimaryLabelLocale(locale: string, primaryLocale: string): boolean {
  const base = (l: string) => l.split(/[-_]/)[0].toLowerCase();
  return base(locale) === base(primaryLocale);
}

/**
 * Translation body part of a product save. The key is sent only when it
 * matters, so a product without labels saves exactly as before:
 * - never loaded / edited (undefined): no key (the API keeps the stored labels);
 * - labels set: `{ variant_option_labels: {...} }` (cleaned, unknown keys pruned);
 * - all cleared while labels are stored: `{ variant_option_labels: null }`;
 * - otherwise nothing. The primary language never sends labels.
 */
export function labelsPayload(
  labels: FormOptionLabels | undefined,
  stored: FormOptionLabels | undefined,
  optionList: readonly OptionListEntry[],
  isPrimary: boolean,
): { variant_option_labels?: VariantOptionLabels | null } {
  if (isPrimary || labels === undefined) return {};
  const clean = cleanLabels(labels, optionList);
  if (clean) return { variant_option_labels: clean };
  const hadStored = !!stored && (Object.keys(stored.names).length > 0 || Object.keys(stored.values).length > 0);
  return hadStored ? { variant_option_labels: null } : {};
}

/** Stable text of the labels for the unsaved-changes tracker ('' = none). */
export function labelsKey(labels: FormOptionLabels | undefined, optionList: readonly OptionListEntry[]): string {
  const clean = cleanLabels(labels, optionList);
  if (!clean) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(clean.names ?? {})) parts.push(`n|${k}|${v}`);
  for (const [n, m] of Object.entries(clean.values ?? {})) for (const [k, v] of Object.entries(m)) parts.push(`v|${n}|${k}|${v}`);
  return parts.sort().join('\n');
}

/** True when the form labels differ from the stored ones (after cleaning). */
export function isLabelsDirty(
  labels: FormOptionLabels | undefined,
  stored: FormOptionLabels | undefined,
  optionList: readonly OptionListEntry[],
): boolean {
  return labelsKey(labels, optionList) !== labelsKey(stored, optionList);
}

/** Immutable updates of the form state. */
export function withNameLabel(labels: FormOptionLabels | undefined, name: string, label: string): FormOptionLabels {
  const base = labels ?? { names: {}, values: {} };
  return { names: { ...base.names, [name]: label }, values: base.values };
}

export function withValueLabel(
  labels: FormOptionLabels | undefined,
  name: string,
  value: string,
  label: string,
): FormOptionLabels {
  const base = labels ?? { names: {}, values: {} };
  return { names: base.names, values: { ...base.values, [name]: { ...(base.values[name] ?? {}), [value]: label } } };
}

/** The language of an option-labels error of the API (`issues[].locale`), if any. */
export function optionLabelsErrorLocale(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code.startsWith('PRODUCT_OPTION_LABELS_')) return null;
  const issues = Array.isArray(body.issues) ? body.issues : [];
  const first = issues.find((i) => isRecord(i) && typeof i.locale === 'string');
  return first && isRecord(first) ? (first.locale as string) : null;
}
