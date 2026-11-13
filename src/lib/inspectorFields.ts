// Which top-level fields the section inspector shows. Pure (type-only
// imports) so the node test runner can load it.
//
// - `pageTypes` on a field: shown only on those page types (the dynamic
//   source fields: PRODUCT_TEMPLATE only). Without a known page type such a
//   field stays hidden.
// - `showIf` on a field: shown only when the section SETTING `showIf.key` is
//   one of `showIf.in`; a missing value reads as ''. Read against settings
//   for both tabs, so a content field (html, image) can follow a setting
//   (content_source, image_source).
// Fields with neither rule are always shown, exactly as before.

import type { FieldDefinition, SectionSchema } from './section-schemas';

export type InspectorPageType = NonNullable<SectionSchema['pageTypes']>[number];

export function isFieldVisible(
  field: Pick<FieldDefinition, 'key' | 'pageTypes' | 'showIf' | 'defaultValue'>,
  settings: Record<string, unknown> | null | undefined,
  pageType: string | null | undefined,
): boolean {
  if (field.pageTypes) {
    const pt = (pageType || '').toUpperCase();
    if (!(field.pageTypes as readonly string[]).includes(pt)) {
      // Still shown when it already holds a non-default value (a section
      // that somehow carries a dynamic source onto another page), so the
      // owner can switch it back to static.
      const v = settings?.[field.key];
      if (v === undefined || v === null || v === '' || v === 'static' || v === field.defaultValue) return false;
    }
  }
  if (field.showIf) {
    const gate = settings?.[field.showIf.key];
    if (!field.showIf.in.includes(String(gate ?? ''))) return false;
  }
  return true;
}

export interface InspectorFieldSplit {
  settingsFields: FieldDefinition[];
  contentFields: FieldDefinition[];
}

/**
 * Split a schema into the Settings and Content tab fields (by
 * `translatable`) and drop the fields hidden for this page type / settings.
 */
export function visibleInspectorFields(
  schema: Pick<SectionSchema, 'schema' | 'translatable'>,
  settings: Record<string, unknown> | null | undefined,
  pageType: string | null | undefined,
): InspectorFieldSplit {
  const translatable = new Set(schema.translatable);
  const visible = schema.schema.filter((f) => isFieldVisible(f, settings, pageType));
  return {
    settingsFields: visible.filter((f) => !translatable.has(f.key)),
    contentFields: visible.filter((f) => translatable.has(f.key)),
  };
}

const DYNAMIC_SOURCE_KEYS = ['content_source', 'image_source'] as const;

/**
 * The dynamic source a section uses on this page type, or null when it is
 * static (missing / 'static' / not a product template). Drives the
 * "content comes from the product" note in the Content tab.
 */
export function activeDynamicSource(
  schema: Pick<SectionSchema, 'schema'>,
  settings: Record<string, unknown> | null | undefined,
  pageType: string | null | undefined,
): { key: (typeof DYNAMIC_SOURCE_KEYS)[number]; value: string } | null {
  for (const key of DYNAMIC_SOURCE_KEYS) {
    const field = schema.schema.find((f) => f.key === key);
    if (!field || !isFieldVisible(field, settings, pageType)) continue;
    const value = settings?.[key];
    if (typeof value === 'string' && value && value !== 'static' && field.options?.some((o) => o.value === value)) {
      return { key, value };
    }
  }
  return null;
}
