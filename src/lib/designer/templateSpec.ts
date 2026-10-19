// Pure helpers of the dashboard template editor (M4.2 WP9): element
// factories, the font list rebuild and the mapping of spec issue paths
// (`validateSpec` / 400 DESIGNER_TEMPLATE_INVALID) to an editor location.

import type {
  DesignElement,
  FontRef,
  ImageElement,
  ImageSlotElement,
  TemplateSpecV1,
  TextElement,
} from '@multi-stores/core/designer';

/** Element ids follow the renderer rule ^[a-z0-9_-]{1,32}$. */
export const ELEMENT_ID_RE = /^[a-z0-9_-]{1,32}$/;

/** A store font face the editor can pick (current upload of the face). */
export interface FontFaceOption {
  asset_id: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

export const faceKey = (f: { family: string; weight: number; style?: string }) =>
  `${f.family}|${f.weight}|${f.style || 'normal'}`;

/** Deep copy (specs are plain JSON). */
export function cloneSpec(spec: TemplateSpecV1): TemplateSpecV1 {
  return JSON.parse(JSON.stringify(spec)) as TemplateSpecV1;
}

/** A fresh id with the given prefix that no element of the spec uses yet. */
export function newElementId(spec: TemplateSpecV1, prefix: 'txt' | 'slot' | 'img'): string {
  const used = new Set((spec.surfaces[0]?.elements ?? []).map((e) => e.id));
  for (let i = 1; i < 1000; i++) {
    const id = `${prefix}_${i}`;
    if (!used.has(id)) return id;
  }
  return `${prefix}_${Date.now().toString(36)}`.slice(0, 32);
}

const topZ = (spec: TemplateSpecV1) =>
  (spec.surfaces[0]?.elements ?? []).reduce((m, e) => Math.max(m, Number.isFinite(e.z) ? e.z : 0), 0);

/** A new editable text in the middle of the template (NPP defaults). */
export function newTextElement(spec: TemplateSpecV1, font: FontFaceOption | null, locale: string): TextElement {
  const w = Math.round(spec.width * 0.6);
  const h = Math.round(spec.height * 0.08);
  return {
    id: newElementId(spec, 'txt'),
    type: 'text',
    x: Math.round((spec.width - w) / 2),
    y: Math.round(spec.height * 0.1),
    w,
    h,
    rot: 0,
    z: topZ(spec) + 1,
    locked: false,
    label: { [locale]: '' },
    placeholder: { [locale]: '' },
    default_text: '',
    font: font
      ? { family: font.family, weight: font.weight, style: font.style }
      : { family: 'Montserrat', weight: 400, style: 'normal' },
    size: 28,
    color: '#000000',
    align: 'center',
    transform: 'none',
    fit: { mode: 'shrink', step: 0.5, min: 6, pad_ref_px: 8 },
    inset: 4,
    editable: true,
    required: true,
    max_length: 40,
    direction: 'auto',
  };
}

/** A new photo slot covering the centre of the template. */
export function newSlotElement(spec: TemplateSpecV1, locale: string): ImageSlotElement {
  const w = Math.round(spec.width * 0.6);
  const h = Math.round(spec.height * 0.45);
  return {
    id: newElementId(spec, 'slot'),
    type: 'image_slot',
    x: Math.round((spec.width - w) / 2),
    y: Math.round((spec.height - h) / 2),
    w,
    h,
    rot: 0,
    z: topZ(spec) + 1,
    locked: false,
    label: { [locale]: '' },
    placeholder: { [locale]: '' },
    shape: 'rect',
    radius: 0,
    border_color: '#999999',
    required: true,
    adj_limits: { zoom: [1, 3], rot: [-180, 180] },
    default_adj: { zoom: 1, rot: 0, panX: 0.5, panY: 0.5 },
  };
}

/** A decoration drawn over the full template (aspect of the image kept in width). */
export function newImageElement(
  spec: TemplateSpecV1,
  asset: { id: string; width: number; height: number },
): ImageElement {
  const w = spec.width;
  const h = asset.width > 0 ? Math.min(spec.height, Math.round((w * asset.height) / asset.width)) : spec.height;
  return {
    id: newElementId(spec, 'img'),
    type: 'image',
    x: 0,
    y: 0,
    w,
    h,
    rot: 0,
    z: topZ(spec) + 1,
    locked: false,
    asset: { asset_id: asset.id, width: asset.width, height: asset.height },
  };
}

/**
 * `spec.fonts` rebuilt from the faces the text elements use. A face that is
 * already declared keeps its asset id (old versions stay byte-identical);
 * new faces take the store's current upload. Returns the faces with no
 * uploaded file (each one blocks saving).
 */
export function rebuildFonts(
  spec: TemplateSpecV1,
  storeFaces: FontFaceOption[],
): { fonts: FontRef[]; missing: { family: string; weight: number; style: string }[] } {
  const declared = new Map(spec.fonts.map((f) => [faceKey(f), f]));
  const store = new Map(storeFaces.map((f) => [faceKey(f), f]));
  const fonts: FontRef[] = [];
  const missing: { family: string; weight: number; style: string }[] = [];
  const seen = new Set<string>();
  for (const el of spec.surfaces[0]?.elements ?? []) {
    if (el.type !== 'text') continue;
    const key = faceKey(el.font);
    if (seen.has(key)) continue;
    seen.add(key);
    const keep = declared.get(key);
    const face = store.get(key);
    if (keep) {
      fonts.push({ ...keep, style: keep.style || 'normal' });
    } else if (face) {
      fonts.push({ family: face.family, weight: face.weight, style: face.style, asset_id: face.asset_id });
    } else {
      missing.push({ family: el.font.family, weight: el.font.weight, style: el.font.style || 'normal' });
    }
  }
  return { fonts, missing };
}

// ─── Issue paths ────────────────────────────────────────────────────────────

/** Editor sections of the template page. */
export type EditorArea = 'general' | 'background' | 'elements';

export interface IssueLocation {
  area: EditorArea;
  /** Index into surfaces[0].elements. */
  elementIndex?: number;
  /** Field of the element / background the issue names (`font`, `size`, `web`, …). */
  field?: string;
}

/**
 * Where an issue path points in the editor:
 * - `surfaces[0].elements[3].font` → element 3, field `font`;
 * - `surfaces[0].elements[3]` (rule position/size/rot_z) → element 3, geometry;
 * - `surfaces[0].background.web` → background, field `web`;
 * - `fonts[2]` → the first text element using that declared face;
 * - anything else → general.
 */
export function locateSpecIssue(path: string, rule: string, spec: TemplateSpecV1 | null): IssueLocation {
  const el = /^surfaces\[(\d+)\]\.elements\[(\d+)\](?:\.([a-z_]+))?/.exec(path);
  if (el) {
    const field = el[3] ?? (rule === 'position' || rule === 'size' || rule === 'rot_z' ? 'geometry' : undefined);
    return { area: 'elements', elementIndex: Number(el[2]), field };
  }
  const bg = /^surfaces\[(\d+)\]\.background(?:\.([a-z_]+))?/.exec(path);
  if (bg) return { area: 'background', field: bg[2] ?? 'color' };
  const font = /^fonts\[(\d+)\]/.exec(path);
  if (font && spec) {
    const f = spec.fonts[Number(font[1])];
    const els = spec.surfaces[0]?.elements ?? [];
    const idx = f ? els.findIndex((e) => e.type === 'text' && faceKey(e.font) === faceKey(f)) : -1;
    if (idx >= 0) return { area: 'elements', elementIndex: idx, field: 'font' };
  }
  return { area: 'general' };
}

/** Human order of elements in the list: top of the stack first (highest z, later index). */
export function stackOrder(elements: DesignElement[]): number[] {
  return elements
    .map((e, i) => ({ i, z: Number.isFinite(e.z) ? e.z : 0 }))
    .sort((a, b) => b.z - a.z || b.i - a.i)
    .map((x) => x.i);
}

/**
 * Moves an element one step up/down the stack by rewriting every z as its
 * rank (0..n-1); the renderer sorts by (z, index), so ranks keep the order.
 */
export function moveInStack(elements: DesignElement[], index: number, dir: 'up' | 'down'): DesignElement[] {
  const order = stackOrder(elements).reverse(); // bottom → top
  const pos = order.indexOf(index);
  const target = dir === 'up' ? pos + 1 : pos - 1;
  if (pos < 0 || target < 0 || target >= order.length) return elements;
  [order[pos], order[target]] = [order[target], order[pos]];
  const next = elements.map((e) => ({ ...e }));
  order.forEach((elIndex, rank) => {
    next[elIndex].z = rank;
  });
  return next;
}
