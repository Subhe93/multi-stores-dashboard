import { validateSpec, type TemplateSpecV1 } from '@multi-stores/core/designer';
import type { SpecIssue } from '@/lib/designer/designer.api';
import { ELEMENT_ID_RE, locateSpecIssue, rebuildFonts, type FontFaceOption, type IssueLocation } from '@/lib/designer/templateSpec';
import { elementFieldId } from '@/components/designer/TemplateElementForm';

/** A validation issue placed in the editor (tab, element, field). */
export interface Issue {
  loc: IssueLocation;
  rule: string;
  path: string;
}

export const PRINT_PX_PER_MM = 6;

/** Print file size of a trim size (6 px/mm). */
export const printPxOf = (spec: Pick<TemplateSpecV1, 'width' | 'height'>) => ({
  w: Math.round(spec.width * PRINT_PX_PER_MM),
  h: Math.round(spec.height * PRINT_PX_PER_MM),
});

/**
 * Linked product count of a DESIGNER_TEMPLATE_LINKED body: `params.products`
 * is a count or a list; `product_ids` is an optional list.
 */
export function linkedProductCount(params: Record<string, unknown>, fallback: number): number {
  const p = params.products;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  if (Array.isArray(p)) return p.length;
  if (Array.isArray(params.product_ids)) return params.product_ids.length;
  return fallback;
}

/** DOM id of a background / general field. */
export const areaFieldId = (area: 'bg' | 'general', field: string) => `dz-${area}-${field}`;

/** DOM id the "jump to the field" flow focuses for an issue location. */
export const issueTargetId = (loc: IssueLocation): string =>
  loc.area === 'elements' && loc.elementIndex !== undefined
    ? elementFieldId(loc.elementIndex, loc.field ?? 'label')
    : loc.area === 'background'
      ? areaFieldId('bg', loc.field ?? 'color')
      : areaFieldId('general', loc.field ?? 'name');

/** Where a publish issue points: images that are not stored yet → Background, missing faces → the text using them. */
export function locatePublishIssue(i: SpecIssue, s: TemplateSpecV1 | null, fontOptions: FontFaceOption[]): IssueLocation {
  const loc = locateSpecIssue(i.path, i.rule, s);
  if (loc.area !== 'general') return loc;
  if (i.rule === 'pending_asset') return { area: 'background', field: /print/i.test(i.path) ? 'print' : 'web' };
  if (i.rule === 'missing_font' && s) {
    const els = s.surfaces[0]?.elements ?? [];
    const stored = new Set(fontOptions.map((f) => `${f.family.toLowerCase()}|${f.weight}|${f.style}`));
    const idx = els.findIndex((e) => e.type === 'text' && !stored.has(`${e.font.family.toLowerCase()}|${e.font.weight}|${e.font.style || 'normal'}`));
    if (idx >= 0) return { area: 'elements', elementIndex: idx, field: 'font' };
    const first = els.findIndex((e) => e.type === 'text');
    if (first >= 0) return { area: 'elements', elementIndex: first, field: 'font' };
  }
  return loc;
}

/** The spec as it will be sent (fonts rebuilt) plus client-side issues. */
export function prepareSpec(
  spec: TemplateSpecV1,
  name: string,
  fontOptions: FontFaceOption[],
  clone: (s: TemplateSpecV1) => TemplateSpecV1,
): { spec: TemplateSpecV1; issues: SpecIssue[] } {
  const out = clone(spec);
  const list: SpecIssue[] = [];
  if (!name.trim()) list.push({ path: 'name', rule: 'name_required' });
  const { fonts: rebuilt, missing } = rebuildFonts(out, fontOptions);
  out.fonts = rebuilt;
  out.surfaces[0].elements.forEach((el, i) => {
    const p = `surfaces[0].elements[${i}]`;
    if (!ELEMENT_ID_RE.test(el.id)) list.push({ path: `${p}.id`, rule: 'format' });
    if (el.type === 'text' && missing.some((m) => m.family === el.font.family && m.weight === el.font.weight)) {
      list.push({ path: `${p}.font`, rule: 'font_missing' });
    }
    if ((el.type === 'text' && el.editable) || el.type === 'image_slot') {
      if (!Object.values(el.label ?? {}).some((v) => v && v.trim())) list.push({ path: `${p}.label`, rule: 'label_required' });
    }
    if (el.type === 'text' && !/^#[0-9a-f]{3,8}$/i.test(el.color) && !/^[a-z]+$/i.test(el.color)) {
      list.push({ path: `${p}.color`, rule: 'color' });
    }
  });
  const structural = validateSpec(out);
  for (const e of structural.errors) {
    // A missing face is already reported as font_missing.
    if (e.rule === 'undeclared' && list.some((x) => x.path === e.path)) continue;
    list.push(e);
  }
  return { spec: out, issues: list };
}

/** Issues grouped the way the panels show them. */
export function groupIssues(issues: Issue[], issueText: (i: Issue) => string) {
  const general = issues.filter((i) => i.loc.area === 'general');
  const background: Record<string, string> = {};
  for (const i of issues) if (i.loc.area === 'background') background[i.loc.field ?? 'color'] ??= issueText(i);
  const element = (index: number): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const i of issues) {
      if (i.loc.elementIndex !== index) continue;
      const f = i.loc.field ?? 'geometry';
      out[f] ??= issueText(i);
    }
    return out;
  };
  const count = (area: string) => issues.filter((i) => i.loc.area === area).length;
  return { general, background, element, count };
}
