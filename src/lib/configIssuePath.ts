/**
 * Maps a `PERSONALIZATION_CONFIG_INVALID` issue `path` to the place in the UI
 * where it can be fixed (M4.1 §4.3). Kept free of imports so the node check
 * script (`npm run check:config-issue-paths`) can load it on its own.
 *
 * Path shapes the API produces:
 * - field write:      `pricing.amount`, `translations[0].label`, `children[1].conditions`
 * - preset apply:     `<field>.pricing.amount`, `<field>.children[0].conditions`
 * - library save:     `definition.field.ui.placement`, `definition.children[0].name`
 * - product write:    `variant_option_config[2].valueMeta.<value>.count`
 */

/** Where a config issue belongs in the field dialog (tab keys) or the product options. */
export type ConfigIssueArea = 'basics' | 'visibility' | 'pricing' | 'repeat' | 'display' | 'productOptions';

export interface ConfigIssueLocation {
  area: ConfigIssueArea;
  /** Field name when the API prefixed the path with one (preset apply). */
  field?: string;
  /** Index of the sub-field within its repeater (`children[i]`). */
  child?: number;
  /** Index into `variant_option_config` for product option issues. */
  option?: number;
  /** Option value the issue is about (`valueMeta.<value>`). */
  value?: string;
}

const ISSUE_AREA_BY_KEY: Record<string, ConfigIssueArea> = {
  name: 'basics',
  type: 'basics',
  parent_id: 'basics',
  is_required: 'basics',
  placeholder: 'basics',
  options: 'basics',
  validation_rules: 'basics',
  linked_validation: 'basics',
  children: 'basics',
  conditions: 'visibility',
  pricing: 'pricing',
  repeat: 'repeat',
  ui: 'display',
  translations: 'display',
  variant_option_config: 'productOptions',
};

/** Translation keys edited on the Basics tab; the other translation columns live under Display. */
const BASICS_TRANSLATION_KEYS = new Set(['locale', 'label', 'placeholder', 'option_labels']);

/** Keys of one `valueMeta` entry; a trailing one is not part of the value name. */
const VALUE_META_KEYS = new Set(['label', 'sublabel', 'badge', 'badge_color', 'count', 'i18n']);

const keyOf = (seg: string | undefined): string => (seg ?? '').replace(/\[\d+\]$/, '');

const indexOf = (seg: string | undefined): number | undefined => {
  const m = /\[(\d+)\]$/.exec(seg ?? '');
  return m ? Number(m[1]) : undefined;
};

/** `variant_option_config[i](.valueMeta.<value>(.<metaKey>)?)?` */
function locateOptionIssue(segs: string[]): ConfigIssueLocation {
  const out: ConfigIssueLocation = { area: 'productOptions' };
  const option = indexOf(segs[0]);
  if (option !== undefined) out.option = option;
  if (segs[1] === 'valueMeta' && segs.length > 2) {
    const rest = segs.slice(2);
    // Values may contain dots, so only a known trailing meta key is dropped.
    if (rest.length > 1 && VALUE_META_KEYS.has(rest[rest.length - 1]!)) rest.pop();
    const value = rest.join('.');
    if (value) out.value = value;
  }
  return out;
}

/** Maps a validator `path` to the dialog area / product option it belongs to. */
export function locateConfigIssue(path: string | undefined): ConfigIssueLocation {
  const segs = (path ?? '').split('.').filter(Boolean);
  if (keyOf(segs[0]) === 'variant_option_config') return locateOptionIssue(segs);

  let i = 0;
  let field: string | undefined;
  let child: number | undefined;

  // Library paths: `definition.field.<key>` or `definition.children[i].<key>`;
  // neither `field` nor `children[i]` is a field name.
  if (segs[0] === 'definition') {
    i = 1;
    if (segs[1] === 'field') i = 2;
    else if (keyOf(segs[1]) === 'children' && indexOf(segs[1]) !== undefined && segs.length > 2) {
      child = indexOf(segs[1]);
      i = 2;
    }
  } else if (!ISSUE_AREA_BY_KEY[keyOf(segs[0])] && segs.length > 1 && ISSUE_AREA_BY_KEY[keyOf(segs[1])]) {
    // Preset paths start with the field name.
    field = segs[0];
    i = 1;
  }

  // A sub-field path (`children[i].<key>`): the area comes from the key after it.
  if (child === undefined && keyOf(segs[i]) === 'children' && indexOf(segs[i]) !== undefined && segs.length > i + 1) {
    child = indexOf(segs[i]);
    i += 1;
  }

  const base: ConfigIssueLocation = { area: 'basics' };
  if (field !== undefined) base.field = field;
  if (child !== undefined) base.child = child;

  const key = keyOf(segs[i]);
  const area = ISSUE_AREA_BY_KEY[key];
  if (!area || area === 'productOptions') return base;
  if (key === 'translations') {
    return { ...base, area: BASICS_TRANSLATION_KEYS.has(keyOf(segs[i + 1])) ? 'basics' : 'display' };
  }
  return { ...base, area };
}
