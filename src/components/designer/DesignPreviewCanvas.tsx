'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canvasSize,
  renderDesign,
  type Ctx2D,
  type DesignStateV1,
  type Mode,
  type RenderReport,
  type TemplateSpecV1,
} from '@/lib/designer/design-renderer';

export interface PreviewFont {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

/** Asset id of the generated sample photo used by the template preview. */
export const SAMPLE_PHOTO_ID = '__sample_photo__';
export const SAMPLE_PHOTO_SIZE = { width: 1600, height: 1200 } as const;

interface DesignPreviewCanvasProps {
  spec: TemplateSpecV1;
  state?: DesignStateV1;
  /** 'print' draws the print background; 'proof' the web one; 'edit' also shows empty-slot hints. */
  mode?: Mode;
  /** asset_id → absolute URL (public path or signed link). */
  assetUrls: Record<string, string>;
  fonts: PreviewFont[];
  locale?: string;
  /** CSS width cap of the canvas, px. */
  maxWidth?: number;
  /** Element outlined as the current selection (editor only). */
  selectedId?: string | null;
  emptySlotText?: string;
  onReport?: (report: RenderReport & { fontsFailed: string[] }) => void;
  className?: string;
}

const loadedFonts = new Map<string, Promise<boolean>>();

/** Loads one face through FontFace (cached per URL for the page lifetime). */
function loadFont(f: PreviewFont): Promise<boolean> {
  const key = `${f.family}|${f.weight}|${f.style}|${f.url}`;
  let p = loadedFonts.get(key);
  if (!p) {
    p = (async () => {
      if (typeof FontFace === 'undefined') return false;
      try {
        const face = new FontFace(f.family, `url(${JSON.stringify(f.url)})`, {
          weight: String(f.weight),
          style: f.style,
        });
        await face.load();
        document.fonts.add(face);
        return true;
      } catch {
        return false;
      }
    })();
    loadedFonts.set(key, p);
  }
  return p;
}

/** A neutral generated photo (gradient + grid), so slots show their crop without a real person. */
function samplePhoto(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SAMPLE_PHOTO_SIZE.width / 4;
  c.height = SAMPLE_PHOTO_SIZE.height / 4;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#93c5fd');
  g.addColorStop(1, '#c4b5fd');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= c.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, c.height);
    ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(c.width / 2, c.height * 0.42, c.height * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.width / 2, c.height * 0.92, c.width * 0.22, c.height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/**
 * Live preview of a template spec (and optional design state) drawn by the
 * shared renderer mirror. Images are drawn from their API URLs without
 * `crossOrigin`: the canvas is never exported, so tainting does not matter.
 */
export function DesignPreviewCanvas({
  spec,
  state,
  mode = 'proof',
  assetUrls,
  fonts,
  locale,
  maxWidth = 520,
  selectedId,
  emptySlotText,
  onReport,
  className,
}: DesignPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, CanvasImageSource>());
  const [tick, setTick] = useState(0);
  const [fontsFailed, setFontsFailed] = useState<string[]>([]);
  const reportRef = useRef(onReport);
  useEffect(() => {
    reportRef.current = onReport;
  }, [onReport]);

  // Load every referenced image once; each completed load triggers a redraw.
  const wanted = useMemo(() => {
    const ids = new Set<string>();
    for (const s of spec.surfaces ?? []) {
      if (s.background?.web?.asset_id) ids.add(s.background.web.asset_id);
      if (mode === 'print' && s.background?.print?.asset_id) ids.add(s.background.print.asset_id);
      for (const el of s.elements ?? []) if (el.type === 'image' && el.asset?.asset_id) ids.add(el.asset.asset_id);
    }
    for (const p of Object.values(state?.photos ?? {})) if (p?.asset_id) ids.add(p.asset_id);
    return [...ids];
  }, [spec, state, mode]);

  useEffect(() => {
    let cancelled = false;
    for (const id of wanted) {
      if (images.current.has(id)) continue;
      if (id === SAMPLE_PHOTO_ID) {
        images.current.set(id, samplePhoto());
        setTick((n) => n + 1);
        continue;
      }
      const url = assetUrls[id];
      if (!url) continue;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled) return;
        images.current.set(id, img);
        setTick((n) => n + 1);
      };
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [wanted, assetUrls]);

  // Fonts: redraw once all faces settled; failed faces are reported.
  const fontKey = fonts.map((f) => `${f.family}|${f.weight}|${f.style}|${f.url}`).join(',');
  useEffect(() => {
    let cancelled = false;
    Promise.all(fonts.map((f) => loadFont(f).then((ok) => (ok ? null : `${f.family} ${f.weight}`)))).then((res) => {
      if (cancelled) return;
      setFontsFailed(res.filter((x): x is string => !!x));
      setTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
    // fontKey stands for the font list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  const scale = Math.min(2, maxWidth * 2 / Math.max(1, spec.width));
  const size = canvasSize(spec, scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const report = renderDesign(ctx as unknown as Ctx2D, {
      spec,
      state: state ?? { v: 1, texts: {}, photos: {} },
      mode,
      scale,
      images: { get: (id: string) => images.current.get(id) },
      locale,
      ui: emptySlotText ? { emptySlotText: () => emptySlotText } : undefined,
    });
    // Selection outline (editor): dashed box around the element, rotated like it.
    const el = selectedId ? spec.surfaces[0]?.elements.find((e) => e.id === selectedId) : undefined;
    if (el) {
      const s = scale;
      ctx.save();
      ctx.translate((el.x + el.w / 2) * s, (el.y + el.h / 2) * s);
      ctx.rotate(((el.rot || 0) * Math.PI) / 180);
      ctx.translate(-(el.x + el.w / 2) * s, -(el.y + el.h / 2) * s);
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = Math.max(2, s);
      ctx.strokeStyle = '#2563eb';
      ctx.strokeRect(el.x * s, el.y * s, el.w * s, el.h * s);
      ctx.restore();
    }
    reportRef.current?.({ ...report, fontsFailed });
  }, [spec, state, mode, scale, locale, selectedId, emptySlotText, tick, fontsFailed]);

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      className={className ?? 'h-auto w-full rounded-md border bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]'}
      style={{ maxWidth, aspectRatio: `${spec.width} / ${spec.height}` }}
    />
  );
}
