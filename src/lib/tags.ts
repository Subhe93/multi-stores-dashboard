// Pure helpers of the tags picker (INTERNAL creator categories) and the
// collection / tag filters of the product lists. Unit-tested in tags.test.mjs.

export interface TagOption {
  id: string;
  name: string;
}

/** Normalises a typed tag name: trimmed, inner whitespace collapsed. */
export function normalizeTagName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Finds a tag whose name equals `name` ignoring case and surrounding spaces. */
export function findTagByName(name: string, tags: readonly TagOption[]): TagOption | undefined {
  const needle = normalizeTagName(name).toLowerCase();
  if (!needle) return undefined;
  return tags.find((tag) => normalizeTagName(tag.name).toLowerCase() === needle);
}

export type TagEnterDecision =
  | { kind: 'none' }
  | { kind: 'select'; id: string; name: string }
  | { kind: 'create'; name: string };

/**
 * What pressing Enter in the tags search box does: nothing for an empty
 * query, select the tag whose name matches exactly (already selected = no-op
 * as well), otherwise create a tag with the typed name.
 */
export function decideTagEnter(
  query: string,
  tags: readonly TagOption[],
  selectedIds: readonly string[],
): TagEnterDecision {
  const name = normalizeTagName(query);
  if (!name) return { kind: 'none' };
  const existing = findTagByName(name, tags);
  if (existing) {
    if (selectedIds.includes(existing.id)) return { kind: 'none' };
    return { kind: 'select', id: existing.id, name: existing.name };
  }
  return { kind: 'create', name };
}

/** Whether the "Create "<name>"" row is offered for the current query. */
export function canOfferCreate(query: string, tags: readonly TagOption[]): boolean {
  const name = normalizeTagName(query);
  return name.length > 0 && !findTagByName(name, tags);
}

// ── Product list filters ────────────────────────────────────────────────────

export interface CollectionFilterNode {
  id: string;
  visibility?: 'PUBLIC' | 'INTERNAL' | null;
  translations?: { locale: string; name: string }[];
  children?: CollectionFilterNode[];
}

export interface FilterOption {
  value: string;
  label: string;
}

function nodeName(node: CollectionFilterNode, primaryLocale?: string): string {
  const translations = node.translations ?? [];
  const primary = primaryLocale ? translations.find((tr) => tr.locale === primaryLocale)?.name : undefined;
  return primary?.trim() || translations[0]?.name?.trim() || '—';
}

/**
 * Splits the `/creator-categories` tree into the two filter lists of the
 * product lists: PUBLIC collections as path-labelled options
 * ("Parent › Child") and INTERNAL rows as flat tag options. Tags are never
 * nested, so a tag found anywhere in the tree is lifted out of its branch.
 */
export function splitCollectionFilterOptions(
  nodes: readonly CollectionFilterNode[],
  primaryLocale?: string,
): { collections: FilterOption[]; tags: FilterOption[] } {
  const collections: FilterOption[] = [];
  const tags: FilterOption[] = [];
  const walk = (list: readonly CollectionFilterNode[], trail: string[]) => {
    for (const node of list) {
      const name = nodeName(node, primaryLocale);
      if (node.visibility === 'INTERNAL') {
        tags.push({ value: node.id, label: name });
        continue;
      }
      const path = [...trail, name];
      collections.push({ value: node.id, label: path.join(' › ') });
      if (node.children?.length) walk(node.children, path);
    }
  };
  walk(nodes, []);
  tags.sort((a, b) => a.label.localeCompare(b.label));
  return { collections, tags };
}

/**
 * Both filters share the `?collection=` URL param (the API accepts a PUBLIC
 * or an INTERNAL id there). The value is shown in the Tags select when it is
 * a known tag id, otherwise in the Collections select ('' and 'none' included).
 */
export function collectionFilterSelection(
  value: string,
  tags: readonly FilterOption[],
): { collection: string; tag: string } {
  const isTag = value !== '' && tags.some((tag) => tag.value === value);
  return isTag ? { collection: '', tag: value } : { collection: value, tag: '' };
}
