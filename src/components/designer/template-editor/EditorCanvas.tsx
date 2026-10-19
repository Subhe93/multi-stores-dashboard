'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Maximize2, Minus, Plus, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DesignElement, DesignStateV1, Mode, RenderReport, TemplateSpecV1 } from '@multi-stores/core/designer';
import {
  HANDLES,
  boundsOf,
  handleCursor,
  handlePoints,
  hitTest,
  moveBox,
  nudgeBox,
  resizeBox,
  rotationFromPointer,
  snapBox,
  snapCandidates,
  snapResizeEdges,
  type Box,
  type Guide,
  type Handle,
  type NudgeKey,
} from '@/lib/designer/editorGeometry';
import { DesignPreviewCanvas, type PreviewFont } from '@/components/designer/DesignPreviewCanvas';

/** Editor zoom: 100 % = 2 CSS px per mm (the web-preview resolution). */
const PX_PER_MM_AT_100 = 2;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
/** Padding around the canvas inside the viewport (px). */
const VIEW_PAD = 24;
/** Grab tolerance around thin elements (mm). */
const HIT_PAD_MM = 1;

export type Zoom = number | 'fit';

type Gesture =
  | { kind: 'move'; index: number; start: { x: number; y: number }; orig: Box; key: string }
  | { kind: 'resize'; index: number; handle: Handle; start: { x: number; y: number }; orig: Box; key: string }
  | { kind: 'rotate'; index: number; orig: Box; key: string }
  | { kind: 'pan'; startClient: { x: number; y: number }; scroll: { left: number; top: number } };

export interface EditorCanvasProps {
  spec: TemplateSpecV1;
  state: DesignStateV1;
  mode: Mode;
  assetUrls: Record<string, string>;
  fonts: PreviewFont[];
  locale: string;
  emptySlotText: string;
  onReport: (report: RenderReport & { fontsFailed: string[] }) => void;
  selected: number | null;
  elementName: (el: DesignElement) => string;
  onSelect: (index: number | null) => void;
  /** Geometry of one element changed by a gesture; `coalesce` groups a whole drag into one undo step. */
  onChangeBox: (index: number, box: Box, coalesce: string) => void;
  /** Pointer released: the next change starts a new undo step. */
  onGestureEnd: () => void;
  onEditText: (index: number) => void;
  onDelete: (index: number) => void;
  onDuplicate: (index: number) => void;
  /** Rendered at the start of the toolbar row (background toggle, sample photo). */
  toolbarStart?: ReactNode;
  /** Rendered between the toolbar and the viewport (alignment toolbar). */
  children?: ReactNode;
}

const boxOf = (el: DesignElement): Box => ({ x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot || 0 });
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/**
 * Direct-manipulation layer of the template editor: the renderer mirror
 * draws the design, a transparent overlay above it handles click-to-select
 * (reverse stack order, rotation-aware), drag to move, 8 resize handles
 * (Shift keeps the aspect, Alt resizes from the centre), a rotation handle
 * (Shift snaps to 15°), smart guides (canvas / bleed / safe / element lines,
 * Alt disables), arrow-key nudges and the usual shortcuts. The canvas sits in
 * a scrollable, zoomable viewport (fit / 100 % / 200 %, Ctrl + wheel, pan
 * with Space + drag or the middle button). Undo / redo / save shortcuts are
 * handled page-wide by the editor.
 */
export function EditorCanvas({
  spec, state, mode, assetUrls, fonts, locale, emptySlotText, onReport,
  selected, elementName, onSelect, onChangeBox, onGestureEnd, onEditText, onDelete, onDuplicate,
  toolbarStart, children,
}: EditorCanvasProps) {
  const t = useTranslations('creator.designer.editor.canvas');
  const elements = useMemo(() => spec.surfaces[0]?.elements ?? [], [spec]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const zoomAnchor = useRef<{ mx: number; my: number; clientX: number; clientY: number } | null>(null);

  const [zoom, setZoom] = useState<Zoom>('fit');
  const [fitK, setFitK] = useState(PX_PER_MM_AT_100 * 0.5);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [readout, setReadout] = useState<Box | null>(null);
  const [panning, setPanning] = useState(false);

  const k = zoom === 'fit' ? fitK : zoom * PX_PER_MM_AT_100;
  const zoomPct = Math.round((k / PX_PER_MM_AT_100) * 100);

  // Fit: the zoom at which the whole trim box (plus padding) is visible.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const measure = () => {
      const w = vp.clientWidth - VIEW_PAD * 2;
      const h = vp.clientHeight - VIEW_PAD * 2;
      const next = Math.max(ZOOM_MIN * PX_PER_MM_AT_100, Math.min(w / Math.max(1, spec.width), h / Math.max(1, spec.height)));
      setFitK((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [spec.width, spec.height]);

  // Ctrl / ⌘ + wheel zooms around the cursor (non-passive so the page does not zoom).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const stage = stageRef.current;
      if (stage) {
        const r = stage.getBoundingClientRect();
        zoomAnchor.current = { mx: (e.clientX - r.left) / k, my: (e.clientY - r.top) / k, clientX: e.clientX, clientY: e.clientY };
      }
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (k / PX_PER_MM_AT_100) * factor));
      // Clamped: nothing changes, so the anchor must not wait for a later zoom.
      if (Math.abs(next * PX_PER_MM_AT_100 - k) < 1e-6) zoomAnchor.current = null;
      else setZoom(next);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [k]);

  // Keep the point under the cursor fixed after a wheel zoom.
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!a || !vp || !stage) return;
    zoomAnchor.current = null;
    const r = stage.getBoundingClientRect();
    vp.scrollLeft += r.left + a.mx * k - a.clientX;
    vp.scrollTop += r.top + a.my * k - a.clientY;
  }, [k]);

  const stepZoom = (dir: 1 | -1) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (k / PX_PER_MM_AT_100) * (dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP))));

  // ─── Pointer gestures ────────────────────────────────────────────────────

  const toMm = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    },
    [k],
  );

  const candidatesFor = (index: number) =>
    snapCandidates(
      { width: spec.width, height: spec.height, bleed_mm: spec.bleed_mm || 0 },
      elements.filter((_, i) => i !== index).map(boxOf),
    );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.focus({ preventScroll: true });
    // Pan: middle button, or Space held.
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      const vp = viewportRef.current;
      if (!vp) return;
      e.preventDefault();
      gesture.current = { kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, scroll: { left: vp.scrollLeft, top: vp.scrollTop } };
      setPanning(true);
      overlay.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = toMm(e);
    const key = `g:${e.pointerId}:${Date.now()}`;
    const target = e.target as HTMLElement;
    const handleNode = target.closest<HTMLElement>('[data-handle]');
    if (handleNode && selected !== null && elements[selected]) {
      const el = elements[selected];
      if (el.locked) return;
      e.preventDefault();
      const h = handleNode.dataset.handle as Handle | 'rotate';
      gesture.current =
        h === 'rotate'
          ? { kind: 'rotate', index: selected, orig: boxOf(el), key }
          : { kind: 'resize', index: selected, handle: h, start: p, orig: boxOf(el), key };
      overlay.setPointerCapture(e.pointerId);
      setReadout(boxOf(el));
      return;
    }
    const hit = hitTest(elements, p, HIT_PAD_MM / Math.max(0.25, k / PX_PER_MM_AT_100));
    if (hit < 0) {
      onSelect(null);
      return;
    }
    onSelect(hit);
    const el = elements[hit];
    if (el.locked) return;
    e.preventDefault();
    gesture.current = { kind: 'move', index: hit, start: p, orig: boxOf(el), key };
    overlay.setPointerCapture(e.pointerId);
    setReadout(boxOf(el));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan') {
      const vp = viewportRef.current;
      if (!vp) return;
      vp.scrollLeft = g.scroll.left - (e.clientX - g.startClient.x);
      vp.scrollTop = g.scroll.top - (e.clientY - g.startClient.y);
      return;
    }
    const p = toMm(e);
    const noSnap = e.altKey;
    let next: Box;
    let lines: Guide[] = [];
    if (g.kind === 'move') {
      next = moveBox(g.orig, { x: p.x - g.start.x, y: p.y - g.start.y });
      if (!noSnap) {
        const s = snapBox(next, candidatesFor(g.index));
        next = moveBox(next, { x: s.dx, y: s.dy });
        lines = s.guides;
      }
    } else if (g.kind === 'resize') {
      next = resizeBox(g.orig, g.handle, { x: p.x - g.start.x, y: p.y - g.start.y }, { keepAspect: e.shiftKey, fromCentre: e.altKey });
      if (!noSnap && !e.shiftKey) {
        const s = snapResizeEdges(next, g.handle, candidatesFor(g.index));
        if (s.dx || s.dy) {
          next = resizeBox(g.orig, g.handle, { x: p.x - g.start.x + s.dx, y: p.y - g.start.y + s.dy }, { fromCentre: e.altKey });
          lines = s.guides;
        }
      }
    } else {
      next = { ...g.orig, rot: rotationFromPointer(g.orig, p, e.shiftKey) };
    }
    setGuides(lines);
    setReadout(next);
    onChangeBox(g.index, next, g.key);
  };

  const endGesture = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    const overlay = overlayRef.current;
    // After pointercancel / lostpointercapture the pointer is no longer active
    // and releasePointerCapture throws; the state resets must still run.
    if (overlay?.hasPointerCapture?.(e.pointerId)) overlay.releasePointerCapture(e.pointerId);
    setGuides([]);
    setReadout(null);
    setPanning(false);
    if (g.kind !== 'pan') onGestureEnd();
  };

  const onDoubleClick = (e: { clientX: number; clientY: number }) => {
    const hit = hitTest(elements, toMm(e), HIT_PAD_MM);
    if (hit >= 0 && elements[hit].type === 'text') onEditText(hit);
  };

  // ─── Keyboard ────────────────────────────────────────────────────────────

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const meta = e.ctrlKey || e.metaKey;
    if (e.key === ' ') {
      spaceDown.current = true;
      e.preventDefault();
      return;
    }
    // Undo / redo / save are page-wide shortcuts (TemplateEditor); they bubble.
    if (e.key === 'Escape') {
      onSelect(null);
      return;
    }
    if (selected === null || !elements[selected]) return;
    if (meta && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      onDuplicate(selected);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(selected);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const el = elements[selected];
      if (el.locked) return;
      onChangeBox(selected, nudgeBox(boxOf(el), e.key as NudgeKey, e.shiftKey), `nudge:${el.id}`);
    }
  };
  const onKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') spaceDown.current = false;
    if (e.key.startsWith('Arrow')) onGestureEnd();
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const sel = selected !== null ? elements[selected] : undefined;
  const selBox = sel ? boxOf(sel) : null;
  const bleed = Math.max(0, spec.bleed_mm || 0);
  const stageW = spec.width * k;
  const stageH = spec.height * k;
  const announce = sel
    ? t('a11y.selected', { name: elementName(sel), x: fmt(sel.x), y: fmt(sel.y), w: fmt(sel.w), h: fmt(sel.h) })
    : t('a11y.none');

  const zoomBtn = 'h-7 px-2 text-xs pointer-coarse:h-11 pointer-coarse:px-3';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">{toolbarStart}</div>
        <div className="inline-flex items-center gap-0.5 rounded-md border bg-zinc-50 p-0.5" role="group" aria-label={t('zoom')}>
          <Button type="button" variant="ghost" size="sm" className={zoomBtn} aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => stepZoom(-1)}>
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-11 text-center font-mono text-[11px] tabular-nums" aria-live="off" dir="ltr">
            {zoomPct}%
          </span>
          <Button type="button" variant="ghost" size="sm" className={zoomBtn} aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => stepZoom(1)}>
            <Plus className="size-3.5" />
          </Button>
          <Button type="button" variant={zoom === 'fit' ? 'outline' : 'ghost'} size="sm" className={`${zoomBtn} bg-white`} onClick={() => setZoom('fit')} title={t('zoomFitHint')}>
            <Maximize2 className="size-3.5" /> {t('zoomFit')}
          </Button>
          <Button type="button" variant={zoom === 1 ? 'outline' : 'ghost'} size="sm" className={zoomBtn} onClick={() => setZoom(1)}>
            100%
          </Button>
          <Button type="button" variant={zoom === 2 ? 'outline' : 'ghost'} size="sm" className={zoomBtn} onClick={() => setZoom(2)}>
            200%
          </Button>
        </div>
      </div>

      {children}

      <div
        ref={viewportRef}
        className={`relative h-[min(68vh,760px)] min-h-[360px] overflow-auto rounded-md border bg-zinc-100 ${panning ? 'cursor-grabbing' : ''}`}
        dir="ltr"
      >
        <div className="flex min-h-full min-w-full">
          <div className="m-auto" style={{ padding: VIEW_PAD }}>
            <div ref={stageRef} className="relative" style={{ width: stageW, height: stageH }}>
              <DesignPreviewCanvas
                spec={spec}
                state={state}
                mode={mode}
                assetUrls={assetUrls}
                fonts={fonts}
                locale={locale}
                pxPerMm={k}
                selectedId={null}
                emptySlotText={emptySlotText}
                onReport={onReport}
                className="block rounded-none border-0 bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] shadow-md"
              />

              {/* Bleed outline (outside the trim box). */}
              {bleed > 0 && (
                <div
                  className="pointer-events-none absolute border border-dashed border-rose-300/80"
                  style={{ left: -bleed * k, top: -bleed * k, width: (spec.width + 2 * bleed) * k, height: (spec.height + 2 * bleed) * k }}
                  aria-hidden
                />
              )}

              {/* Smart guides. */}
              <svg className="pointer-events-none absolute inset-0 overflow-visible" width={stageW} height={stageH} aria-hidden>
                {guides.map((g, i) => {
                  const color = g.kind === 'centre' ? '#e11d48' : g.kind === 'element' ? '#7c3aed' : g.kind === 'bleed' ? '#f43f5e' : g.kind === 'safe' ? '#0d9488' : '#2563eb';
                  return g.axis === 'x' ? (
                    <line key={i} x1={g.at * k} x2={g.at * k} y1={-bleed * k} y2={stageH + bleed * k} stroke={color} strokeWidth={1} strokeDasharray={g.kind === 'element' ? '4 3' : undefined} />
                  ) : (
                    <line key={i} y1={g.at * k} y2={g.at * k} x1={-bleed * k} x2={stageW + bleed * k} stroke={color} strokeWidth={1} strokeDasharray={g.kind === 'element' ? '4 3' : undefined} />
                  );
                })}
              </svg>

              {/* Interaction overlay. */}
              <div
                ref={overlayRef}
                role="application"
                aria-label={t('a11y.label')}
                aria-describedby="dz-canvas-hint"
                tabIndex={0}
                className={`absolute inset-0 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${panning ? 'cursor-grabbing' : 'cursor-default'}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                onLostPointerCapture={endGesture}
                onDoubleClick={onDoubleClick}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onBlur={() => {
                  spaceDown.current = false;
                }}
              >
                {sel && selBox && (
                  <SelectionBox box={selBox} k={k} locked={sel.locked} readout={readout} label={elementName(sel)} lockedText={t('locked')} rotateText={t('rotate')} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p id="dz-canvas-hint" className="text-center text-[11px] leading-5 text-muted-foreground" dir="auto">
        {t('hint')}
      </p>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
    </div>
  );
}

// ─── Selection box ──────────────────────────────────────────────────────────

const HANDLE_HIT = 'size-6 pointer-coarse:size-7';

function SelectionBox({
  box, k, locked, readout, label, lockedText, rotateText,
}: {
  box: Box;
  k: number;
  locked: boolean;
  readout: Box | null;
  label: string;
  lockedText: string;
  rotateText: string;
}) {
  const pts = handlePoints(box);
  const bounds = boundsOf(box);
  return (
    <>
      <div
        className="absolute"
        style={{ left: box.x * k, top: box.y * k, width: box.w * k, height: box.h * k, transform: `rotate(${box.rot}deg)`, transformOrigin: 'center' }}
      >
        <div className={`absolute -inset-px border-2 ${locked ? 'border-zinc-500' : 'border-sky-500'} motion-reduce:transition-none`} />
        {locked ? (
          <span className="absolute -top-6 left-0 inline-flex items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-white" title={lockedText}>
            <Lock className="size-3" /> {lockedText}
          </span>
        ) : (
          <>
            {HANDLES.map((h) => (
              <div
                key={h}
                data-handle={h}
                className={`absolute ${HANDLE_HIT} -translate-x-1/2 -translate-y-1/2`}
                style={{ left: pts[h].x * k, top: pts[h].y * k, cursor: handleCursor(h, box.rot) }}
              >
                <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-sky-500 bg-white" />
              </div>
            ))}
            <div className="pointer-events-none absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 -translate-y-full bg-sky-500" />
            <div
              data-handle="rotate"
              title={rotateText}
              className={`absolute left-1/2 top-0 ${HANDLE_HIT} -translate-x-1/2 -translate-y-[calc(100%+22px)] cursor-grab`}
            >
              <div className="absolute left-1/2 top-1/2 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-sky-500 bg-white">
                <RotateCw className="size-2.5 text-sky-600" />
              </div>
            </div>
          </>
        )}
      </div>
      {readout && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded bg-zinc-900/90 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums"
          style={{ left: (bounds.x + bounds.w / 2) * k, top: (bounds.y + bounds.h) * k + 8, transform: 'translateX(-50%)' }}
          dir="ltr"
        >
          {label}: x {fmt(readout.x)} · y {fmt(readout.y)} · {fmt(readout.w)} × {fmt(readout.h)} mm
          {readout.rot ? ` · ${fmt(readout.rot)}°` : ''}
        </div>
      )}
    </>
  );
}
