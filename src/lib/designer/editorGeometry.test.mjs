// Unit test of the template-editor geometry (hit-test with rotation,
// resize math, snapping, alignment, stack order).
// Run: node --experimental-strip-types --test src/lib/designer/editorGeometry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alignBox,
  boundsOf,
  containsPoint,
  handleCursor,
  hitTest,
  moveBox,
  nudgeBox,
  resizeBox,
  rotationFromPointer,
  sendInStack,
  snapBox,
  snapCandidates,
  snapResizeEdges,
  toLocal,
} from './editorGeometry.ts';

const box = (x, y, w, h, rot = 0) => ({ x, y, w, h, rot });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('toLocal: inverse of the centre rotation', () => {
  const b = box(100, 100, 40, 20, 90);
  // Top-right corner (local 40,0 → vector 20,-10) rotated 90° clockwise around the centre (120,110) lands at (130,130).
  const corner = toLocal({ x: 130, y: 130 }, b);
  near(corner.x, 40);
  near(corner.y, 0);
  const c = toLocal({ x: 120, y: 110 }, b);
  near(c.x, 20);
  near(c.y, 10);
});

test('containsPoint / hitTest respect rotation and reverse stack order', () => {
  const thin = { ...box(100, 100, 100, 10, 90), z: 0 };
  // Unrotated the point (105, 140) would be outside; rotated 90° the bar is vertical and covers it.
  assert.equal(containsPoint(box(100, 100, 100, 10, 0), { x: 105, y: 140 }), false);
  assert.equal(containsPoint(thin, { x: 150, y: 140 }), true);
  const a = { ...box(0, 0, 100, 100), z: 0, locked: false };
  const b = { ...box(50, 50, 100, 100), z: 1, locked: true };
  const c = { ...box(50, 50, 100, 100), z: 1, locked: false };
  assert.equal(hitTest([a, b], { x: 75, y: 75 }), 1, 'highest z wins');
  assert.equal(hitTest([a, b], { x: 10, y: 10 }), 0);
  assert.equal(hitTest([a, b], { x: 500, y: 500 }), -1);
  assert.equal(hitTest([b, c], { x: 75, y: 75 }), 1, 'equal z: later index is on top');
  assert.equal(hitTest([a], { x: 101, y: 50 }, 2), 0, 'pad grows the hit box');
});

test('resizeBox: east handle grows width, anchor stays', () => {
  const r = resizeBox(box(10, 10, 100, 50), 'e', { x: 20, y: 7 });
  assert.deepEqual(r, box(10, 10, 120, 50));
  const w = resizeBox(box(10, 10, 100, 50), 'w', { x: 20, y: 0 });
  assert.deepEqual(w, box(30, 10, 80, 50), 'west handle moves x and shrinks');
  const n = resizeBox(box(10, 10, 100, 50), 'nw', { x: -10, y: -10 });
  assert.deepEqual(n, box(0, 0, 110, 60));
});

test('resizeBox: minimum size, step rounding', () => {
  const r = resizeBox(box(0, 0, 100, 50), 'e', { x: -200, y: 0 });
  assert.equal(r.w, 2);
  const s = resizeBox(box(0, 0, 100, 50), 'se', { x: 0.3, y: 0.2 });
  assert.deepEqual([s.w, s.h], [100.5, 50]);
});

test('resizeBox: Shift keeps the aspect ratio', () => {
  const r = resizeBox(box(0, 0, 100, 50), 'se', { x: 50, y: 0 }, { keepAspect: true });
  assert.deepEqual([r.w, r.h], [150, 75]);
  near(r.w / r.h, 2);
  const e = resizeBox(box(0, 0, 100, 50), 'e', { x: 100, y: 0 }, { keepAspect: true });
  assert.deepEqual([e.w, e.h], [200, 100]);
  // The horizontal anchor stays (x = 0); the extra height is split around the centre.
  assert.equal(e.x, 0);
  assert.equal(e.y, -25);
});

test('resizeBox: Alt resizes from the centre', () => {
  const r = resizeBox(box(100, 100, 100, 50), 'e', { x: 10, y: 0 }, { fromCentre: true });
  assert.deepEqual(r, box(90, 100, 120, 50));
  const c = resizeBox(box(100, 100, 100, 50), 'se', { x: 10, y: 10 }, { fromCentre: true, keepAspect: true });
  near(c.x + c.w / 2, 150);
  near(c.y + c.h / 2, 125);
  near(c.w / c.h, 2);
});

test('resizeBox: rotated element resizes along its own axes', () => {
  // 90° clockwise: dragging the (local) east handle downwards on screen grows the width.
  const r = resizeBox(box(100, 100, 100, 50, 90), 'e', { x: 0, y: 20 });
  assert.equal(r.w, 120);
  assert.equal(r.h, 50);
  assert.equal(r.rot, 90);
  // The anchor (local west edge) keeps its screen position: centre moved 10 along +y.
  near(r.y + r.h / 2, 135);
  near(r.x + r.w / 2, 150);
});

test('snapCandidates / snapBox: canvas centre, bleed, safe area and other elements', () => {
  const cands = snapCandidates({ width: 500, height: 700, bleed_mm: 3 }, [box(100, 100, 50, 50)]);
  assert.ok(cands.x.some((g) => g.kind === 'centre' && g.at === 250));
  assert.ok(cands.x.some((g) => g.kind === 'bleed' && g.at === -3));
  assert.ok(cands.y.some((g) => g.kind === 'safe' && g.at === 697));
  assert.ok(cands.x.some((g) => g.kind === 'element' && g.at === 125), 'other element centre');
  // 1.5 mm off the canvas centre → snapped; 2.5 mm → not.
  const s = snapBox(box(226.5, 10, 50, 50), cands);
  assert.equal(s.dx, -1.5);
  assert.equal(s.guides[0].kind, 'centre');
  const far = snapBox(box(222.5, 300, 50, 50), cands);
  assert.equal(far.dx, 0);
  // Left edge 1 mm from the other element's right edge (150).
  const edge = snapBox(box(151, 300, 50, 50), cands);
  assert.equal(edge.dx, -1);
  assert.equal(edge.guides[0].at, 150);
  const moved = moveBox(box(151, 300, 50, 50), { x: edge.dx, y: edge.dy });
  assert.equal(moved.x, 150);
});

test('snapBox: rotated element snaps with its bounds; snapResizeEdges only the dragged side', () => {
  const cands = snapCandidates({ width: 500, height: 700, bleed_mm: 0 }, []);
  const r = box(0, 0, 100, 20, 90); // bounds: x 40..60
  const b = boundsOf(r);
  near(b.x, 40);
  near(b.w, 20);
  const edges = snapResizeEdges(box(10, 10, 239, 50), 'e', cands);
  assert.equal(edges.dx, 1, 'right edge 249 → centre 250');
  const none = snapResizeEdges(box(10, 10, 239, 50), 'w', cands);
  assert.equal(none.dx, 0, 'the west handle ignores the right edge');
  assert.equal(snapResizeEdges(r, 'e', cands).dx, 0, 'rotated boxes do not edge-snap');
});

test('nudgeBox / rotationFromPointer / alignBox', () => {
  assert.deepEqual(nudgeBox(box(10, 10, 5, 5), 'ArrowRight', false), box(10.5, 10, 5, 5));
  assert.deepEqual(nudgeBox(box(10, 10, 5, 5), 'ArrowUp', true), box(10, 5, 5, 5));
  const b = box(100, 100, 100, 100);
  assert.equal(rotationFromPointer(b, { x: 150, y: 0 }, false), 0, 'straight up = 0°');
  assert.equal(rotationFromPointer(b, { x: 300, y: 150 }, false), 90);
  assert.equal(rotationFromPointer(b, { x: 300, y: 120 }, true), 75, 'Shift snaps to 15°');
  assert.deepEqual(alignBox(box(10, 10, 100, 50), { width: 500, height: 700 }, 'center'), box(200, 325, 100, 50));
  assert.deepEqual(alignBox(box(10, 10, 100, 50), { width: 500, height: 700 }, 'right'), box(400, 10, 100, 50));
  assert.deepEqual(alignBox(box(10, 10, 100, 50), { width: 500, height: 700 }, 'bottom'), box(10, 650, 100, 50));
});

test('handleCursor rotates with the element', () => {
  assert.equal(handleCursor('e', 0), 'ew-resize');
  assert.equal(handleCursor('e', 90), 'ns-resize');
  assert.equal(handleCursor('se', 0), 'nwse-resize');
  assert.equal(handleCursor('se', 90), 'nesw-resize');
});

test('sendInStack rewrites z as ranks', () => {
  const els = [{ z: 0 }, { z: 5 }, { z: 2 }];
  assert.deepEqual(sendInStack(els, 0, 'front').map((e) => e.z), [2, 1, 0]);
  assert.deepEqual(sendInStack(els, 1, 'back').map((e) => e.z), [1, 0, 2]);
  assert.equal(sendInStack(els, 9, 'front'), els);
});
