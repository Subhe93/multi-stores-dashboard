// Pure geometry of the direct-manipulation template editor (M5 designer
// editor): hit-testing with rotation, drag / resize math (Shift = keep
// aspect, Alt = from centre), smart-guide snapping, nudging, alignment and
// the stack-order helpers. Everything is in template millimetres and has no
// DOM dependency so it can be unit-tested with `node --test`.
//
// Conventions: an element box is `{x, y, w, h, rot}` with `rot` in degrees,
// clockwise, around the box centre (the renderer's rule). Positions are
// rounded to STEP_MM so dragging never produces values the form cannot show.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Granularity of every geometry write of the editor (mm). */
export const STEP_MM = 0.5;
/** Smallest element side the editor allows (mm). */
export const MIN_SIZE_MM = 2;
/** Snap distance of the smart guides (mm, independent of the zoom). */
export const SNAP_MM = 2;
/** Nudge distance of the arrow keys (mm); Shift multiplies by 10. */
export const NUDGE_MM = 0.5;
export const NUDGE_FAST_MM = 5;

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const roundStep = (v: number, step = STEP_MM): number => Math.round(v / step) * step;

const rad = (deg: number) => ((deg || 0) * Math.PI) / 180;

const centreOf = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Rotates a vector by `deg` degrees (clockwise in screen coordinates). */
export function rotateVec(v: Point, deg: number): Point {
  const a = rad(deg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * The point expressed in the element's unrotated frame (origin at the box's
 * top-left corner): the inverse of the renderer's centre rotation.
 */
export function toLocal(p: Point, box: Box): Point {
  const c = centreOf(box);
  const v = rotateVec({ x: p.x - c.x, y: p.y - c.y }, -(box.rot || 0));
  return { x: v.x + box.w / 2, y: v.y + box.h / 2 };
}

/** Whether the point lies inside the (rotated) box. `pad` grows the box (mm). */
export function containsPoint(box: Box, p: Point, pad = 0): boolean {
  const l = toLocal(p, box);
  return l.x >= -pad && l.x <= box.w + pad && l.y >= -pad && l.y <= box.h + pad;
}

/** Axis-aligned bounds of a rotated box (used for snapping rotated elements). */
export function boundsOf(box: Box): { x: number; y: number; w: number; h: number } {
  if (!box.rot) return { x: box.x, y: box.y, w: box.w, h: box.h };
  const c = centreOf(box);
  const corners = [
    { x: -box.w / 2, y: -box.h / 2 },
    { x: box.w / 2, y: -box.h / 2 },
    { x: box.w / 2, y: box.h / 2 },
    { x: -box.w / 2, y: box.h / 2 },
  ].map((v) => rotateVec(v, box.rot));
  const xs = corners.map((v) => v.x + c.x);
  const ys = corners.map((v) => v.y + c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/**
 * Index of the topmost element under the point, testing in reverse stack
 * order (highest z first, later index wins ties — the renderer's order).
 * Locked elements are selectable; the caller decides whether they move.
 * `pad` makes thin elements easier to grab (mm).
 */
export function hitTest<T extends Box & { z: number }>(elements: T[], p: Point, pad = 0): number {
  const order = elements
    .map((e, i) => ({ i, z: Number.isFinite(e.z) ? e.z : 0 }))
    .sort((a, b) => b.z - a.z || b.i - a.i);
  for (const { i } of order) if (containsPoint(elements[i], p, pad)) return i;
  return -1;
}

export interface ResizeOptions {
  /** Shift: keep the original aspect ratio. */
  keepAspect?: boolean;
  /** Alt: resize symmetrically around the centre. */
  fromCentre?: boolean;
  minSize?: number;
  step?: number;
}

/**
 * The box after dragging `handle` by the world-space delta `d`. The delta is
 * expressed in the element's local frame first, so a rotated element resizes
 * along its own axes and the opposite edge / corner stays put on screen.
 */
export function resizeBox(orig: Box, handle: Handle, d: Point, opts: ResizeOptions = {}): Box {
  const min = opts.minSize ?? MIN_SIZE_MM;
  const step = opts.step ?? STEP_MM;
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const local = rotateVec(d, -(orig.rot || 0));
  const k = opts.fromCentre ? 2 : 1;
  let w = sx ? Math.max(min, orig.w + sx * local.x * k) : orig.w;
  let h = sy ? Math.max(min, orig.h + sy * local.y * k) : orig.h;
  if (opts.keepAspect && orig.w > 0 && orig.h > 0) {
    const ratio = orig.w / orig.h;
    if (sx && sy) {
      // Corner: follow the axis that grew / shrank more.
      if (Math.abs(w - orig.w) >= Math.abs(h - orig.h) * ratio) h = w / ratio;
      else w = h * ratio;
    } else if (sx) h = w / ratio;
    else w = h * ratio;
    if (w < min) {
      w = min;
      h = w / ratio;
    }
    if (h < min) {
      h = min;
      w = h * ratio;
    }
  }
  w = roundStep(w, step);
  h = roundStep(h, step);
  // Centre shift in the local frame: the anchor (opposite side) stays fixed
  // unless resizing from the centre, where only the size changes.
  // Keep-aspect on an edge handle grows the other axis symmetrically (shift 0 there).
  const shift = opts.fromCentre ? { x: 0, y: 0 } : { x: sx ? (sx * (w - orig.w)) / 2 : 0, y: sy ? (sy * (h - orig.h)) / 2 : 0 };
  const c = centreOf(orig);
  const world = rotateVec(shift, orig.rot || 0);
  const cx = c.x + world.x;
  const cy = c.y + world.y;
  return { x: roundStep(cx - w / 2, step), y: roundStep(cy - h / 2, step), w, h, rot: orig.rot };
}

export interface Guide {
  axis: 'x' | 'y';
  /** Position of the guide line (mm). */
  at: number;
  kind: 'canvas' | 'centre' | 'bleed' | 'safe' | 'element';
}

export interface SnapCandidates {
  x: Guide[];
  y: Guide[];
}

export interface SnapCanvas {
  width: number;
  height: number;
  bleed_mm: number;
}

/**
 * Every line the moving element can snap to: the trim edges and centre
 * lines, the bleed box, the safe area (one bleed inside the trim) and the
 * edges / centres of the other elements (axis-aligned bounds).
 */
export function snapCandidates(canvas: SnapCanvas, others: Box[]): SnapCandidates {
  const x: Guide[] = [];
  const y: Guide[] = [];
  const b = Math.max(0, canvas.bleed_mm || 0);
  x.push({ axis: 'x', at: 0, kind: 'canvas' }, { axis: 'x', at: canvas.width, kind: 'canvas' }, { axis: 'x', at: canvas.width / 2, kind: 'centre' });
  y.push({ axis: 'y', at: 0, kind: 'canvas' }, { axis: 'y', at: canvas.height, kind: 'canvas' }, { axis: 'y', at: canvas.height / 2, kind: 'centre' });
  if (b > 0) {
    x.push({ axis: 'x', at: -b, kind: 'bleed' }, { axis: 'x', at: canvas.width + b, kind: 'bleed' });
    y.push({ axis: 'y', at: -b, kind: 'bleed' }, { axis: 'y', at: canvas.height + b, kind: 'bleed' });
    x.push({ axis: 'x', at: b, kind: 'safe' }, { axis: 'x', at: canvas.width - b, kind: 'safe' });
    y.push({ axis: 'y', at: b, kind: 'safe' }, { axis: 'y', at: canvas.height - b, kind: 'safe' });
  }
  for (const o of others) {
    const r = boundsOf(o);
    x.push({ axis: 'x', at: r.x, kind: 'element' }, { axis: 'x', at: r.x + r.w / 2, kind: 'element' }, { axis: 'x', at: r.x + r.w, kind: 'element' });
    y.push({ axis: 'y', at: r.y, kind: 'element' }, { axis: 'y', at: r.y + r.h / 2, kind: 'element' }, { axis: 'y', at: r.y + r.h, kind: 'element' });
  }
  return { x, y };
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

function bestSnap(lines: number[], candidates: Guide[], threshold: number): { delta: number; guide: Guide } | null {
  let best: { delta: number; guide: Guide } | null = null;
  for (const line of lines) {
    for (const g of candidates) {
      const delta = g.at - line;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, guide: g };
    }
  }
  return best;
}

/**
 * Snap correction for a moving box: the left / centre / right (top / middle
 * / bottom) of its bounds are compared with the candidates; the closest one
 * within `threshold` wins per axis. Returns the correction to add and the
 * guides to draw.
 */
export function snapBox(box: Box, candidates: SnapCandidates, threshold = SNAP_MM): SnapResult {
  const r = boundsOf(box);
  const sx = bestSnap([r.x, r.x + r.w / 2, r.x + r.w], candidates.x, threshold);
  const sy = bestSnap([r.y, r.y + r.h / 2, r.y + r.h], candidates.y, threshold);
  const guides: Guide[] = [];
  if (sx) guides.push(sx.guide);
  if (sy) guides.push(sy.guide);
  return { dx: sx?.delta ?? 0, dy: sy?.delta ?? 0, guides };
}

/**
 * Snap correction for the edges a resize handle moves (unrotated boxes
 * only): only the dragged sides are compared so the anchor never jumps.
 */
export function snapResizeEdges(box: Box, handle: Handle, candidates: SnapCandidates, threshold = SNAP_MM): SnapResult {
  if (box.rot) return { dx: 0, dy: 0, guides: [] };
  const xs: number[] = [];
  const ys: number[] = [];
  if (handle.includes('w')) xs.push(box.x);
  if (handle.includes('e')) xs.push(box.x + box.w);
  if (handle.includes('n')) ys.push(box.y);
  if (handle.includes('s')) ys.push(box.y + box.h);
  const sx = xs.length ? bestSnap(xs, candidates.x, threshold) : null;
  const sy = ys.length ? bestSnap(ys, candidates.y, threshold) : null;
  const guides: Guide[] = [];
  if (sx) guides.push(sx.guide);
  if (sy) guides.push(sy.guide);
  return { dx: sx?.delta ?? 0, dy: sy?.delta ?? 0, guides };
}

/** The box moved by a (possibly snapped) delta, rounded to the step. */
export function moveBox(orig: Box, d: Point, step = STEP_MM): Box {
  return { ...orig, x: roundStep(orig.x + d.x, step), y: roundStep(orig.y + d.y, step) };
}

/** Rotation from the pointer angle around the centre; Shift snaps to 15°. */
export function rotationFromPointer(box: Box, p: Point, snap15: boolean): number {
  const c = centreOf(box);
  // The rotation handle sits above the top edge, so "up" is 0°.
  let deg = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
  if (snap15) deg = Math.round(deg / 15) * 15;
  else deg = Math.round(deg);
  if (deg > 180) deg -= 360;
  if (deg <= -180) deg += 360;
  return deg === -0 ? 0 : deg;
}

export type NudgeKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/** Arrow-key nudge (Shift = fast). */
export function nudgeBox(box: Box, key: NudgeKey, fast: boolean): Box {
  const d = fast ? NUDGE_FAST_MM : NUDGE_MM;
  const dx = key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0;
  const dy = key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0;
  return moveBox(box, { x: dx, y: dy });
}

export type AlignKind = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'center';

/** The box aligned to the trim box (unrotated geometry, as the form shows it). */
export function alignBox(box: Box, canvas: { width: number; height: number }, kind: AlignKind): Box {
  const next = { ...box };
  switch (kind) {
    case 'left':
      next.x = 0;
      break;
    case 'centerX':
      next.x = roundStep((canvas.width - box.w) / 2);
      break;
    case 'right':
      next.x = roundStep(canvas.width - box.w);
      break;
    case 'top':
      next.y = 0;
      break;
    case 'centerY':
      next.y = roundStep((canvas.height - box.h) / 2);
      break;
    case 'bottom':
      next.y = roundStep(canvas.height - box.h);
      break;
    case 'center':
      next.x = roundStep((canvas.width - box.w) / 2);
      next.y = roundStep((canvas.height - box.h) / 2);
      break;
  }
  return next;
}

/** Positions of the 8 resize handles in the local frame (mm). */
export function handlePoints(box: Pick<Box, 'w' | 'h'>): Record<Handle, Point> {
  return {
    nw: { x: 0, y: 0 },
    n: { x: box.w / 2, y: 0 },
    ne: { x: box.w, y: 0 },
    e: { x: box.w, y: box.h / 2 },
    se: { x: box.w, y: box.h },
    s: { x: box.w / 2, y: box.h },
    sw: { x: 0, y: box.h },
    w: { x: 0, y: box.h / 2 },
  };
}

/**
 * CSS cursor of a handle, rotated with the element so the arrow still points
 * along the edge it drags (8 cursors, 45° buckets).
 */
export function handleCursor(handle: Handle, rot: number): string {
  const base: Record<Handle, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
  const cursors = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
  const deg = (((base[handle] + (rot || 0)) % 360) + 360) % 360;
  return cursors[Math.round(deg / 45) % 4];
}

// ─── Stack order ────────────────────────────────────────────────────────────

/** Elements with z rewritten as rank (0..n-1) after moving `index` to the front / back. */
export function sendInStack<T extends { z: number }>(elements: T[], index: number, to: 'front' | 'back'): T[] {
  if (index < 0 || index >= elements.length) return elements;
  const order = elements
    .map((e, i) => ({ i, z: Number.isFinite(e.z) ? e.z : 0 }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((x) => x.i)
    .filter((i) => i !== index);
  if (to === 'front') order.push(index);
  else order.unshift(index);
  const next = elements.map((e) => ({ ...e }));
  order.forEach((elIndex, rank) => {
    next[elIndex].z = rank;
  });
  return next;
}
