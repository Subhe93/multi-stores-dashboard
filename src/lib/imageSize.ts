// Dashboard copy of the image sizing model (spec: plans/image-sizing/SPEC.md,
// storefront helper: multi-stores-web/src/themes/imageSizing.ts). The repos
// are separate, so the constants and the legacy mapping are duplicated here
// and kept equal by src/lib/imageSize.test.mjs.
//
// Pure module (type-only imports) so the node test runner can load it.

import type { Breakpoint, Responsive } from './responsive';

export type ImageWidthMode = 'auto' | 'full' | 'px' | 'percent';
export type ImageHeightMode = 'auto' | 'px' | 'ratio';
export type ImageRatio = '1:1' | '4:5' | '3:4' | '2:3' | '9:16' | '4:3' | '3:2' | '16:9' | '21:9';
export type ImageFit = 'cover' | 'contain';
export type ImagePosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type ImageAlign = 'start' | 'center' | 'end';

export interface ImageSizeSettings {
  // Per breakpoint.
  width_mode?: Responsive<ImageWidthMode>;
  width_px?: Responsive<number>;
  width_percent?: Responsive<number>;
  height_mode?: Responsive<ImageHeightMode>;
  height_px?: Responsive<number>;
  ratio?: Responsive<ImageRatio>;
  align?: Responsive<ImageAlign>;
  // Flat (all breakpoints).
  max_width_px?: number;
  fit?: ImageFit;
  position?: ImagePosition;
}

export type ImageSizePerBpKey = 'width_mode' | 'width_px' | 'width_percent' | 'height_mode' | 'height_px' | 'ratio' | 'align';
export type ImageSizeFlatKey = 'max_width_px' | 'fit' | 'position';

export const IMAGE_WIDTH_MODES: readonly ImageWidthMode[] = ['auto', 'full', 'px', 'percent'];
export const IMAGE_HEIGHT_MODES: readonly ImageHeightMode[] = ['auto', 'px', 'ratio'];
export const IMAGE_RATIOS: readonly ImageRatio[] = ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9', '21:9'];
export const IMAGE_ALIGNS: readonly ImageAlign[] = ['start', 'center', 'end'];
export const IMAGE_FITS: readonly ImageFit[] = ['cover', 'contain'];
export const IMAGE_POSITIONS: readonly ImagePosition[] = ['center', 'top', 'bottom', 'left', 'right'];

export const IMAGE_SIZE_PER_BP_KEYS: readonly ImageSizePerBpKey[] = [
  'width_mode', 'width_px', 'width_percent', 'height_mode', 'height_px', 'ratio', 'align',
];
export const IMAGE_SIZE_FLAT_KEYS: readonly ImageSizeFlatKey[] = ['max_width_px', 'fit', 'position'];

// Clamp ranges (input min/max). Must equal the web IMAGE_SIZE_LIMITS.
export const IMAGE_SIZE_LIMITS = {
  width_px: { min: 16, max: 2400 },
  width_percent: { min: 1, max: 100 },
  height_px: { min: 16, max: 2400 },
  max_width_px: { min: 16, max: 4000 },
} as const;

// Defaults when a property is empty at every breakpoint. Must equal the web
// IMAGE_SIZE_DEFAULTS.
export const IMAGE_SIZE_DEFAULTS = {
  width_mode: 'full',
  width_px: 400,
  width_percent: 100,
  height_mode: 'auto',
  height_px: 400,
  ratio: '1:1',
  align: 'start',
  fit: 'cover',
  position: 'center',
} as const;

const BREAKPOINTS: readonly Breakpoint[] = ['desktop', 'tablet', 'mobile'];

export type ImageSizeNumberKey = keyof typeof IMAGE_SIZE_LIMITS;

/**
 * Round and clamp an editor number to its IMAGE_SIZE_LIMITS range (what the
 * storefront renders). Undefined for empty / non-finite / non-positive input.
 */
export function clampImageSizeNumber(key: ImageSizeNumberKey, n: unknown): number | undefined {
  const v = typeof n === 'number' ? n : typeof n === 'string' && n.trim() !== '' ? Number(n) : NaN;
  if (!Number.isFinite(v) || v <= 0) return undefined;
  const range = IMAGE_SIZE_LIMITS[key];
  return Math.min(range.max, Math.max(range.min, Math.round(v)));
}

const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur']);

/**
 * True when the store CONTENT locale is right-to-left. Image alignment
 * start/end resolves against the storefront direction, not the dashboard UI
 * direction, so the align icons mirror on this.
 */
export function isRtlContentLocale(locale: string | undefined | null): boolean {
  if (!locale) return false;
  return RTL_LANGS.has(locale.toLowerCase().split(/[-_]/)[0]);
}

function isDefined(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/** Value at exactly one breakpoint; '' and null count as empty. */
function own<T>(value: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const v = (value as Partial<Record<Breakpoint, T>>)[bp];
    return isDefined(v) ? v : undefined;
  }
  return bp === 'desktop' && isDefined(value) ? (value as T) : undefined;
}

/** Value with the mobile -> tablet -> desktop cascade applied. */
export function cascadeAt<T>(value: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  const chain: Breakpoint[] =
    bp === 'mobile' ? ['mobile', 'tablet', 'desktop'] : bp === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
  for (const b of chain) {
    const v = own(value, b);
    if (v !== undefined) return v;
  }
  return undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function num(v: unknown, range: { min: number; max: number }): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

/** Same rule as the web hasImageSize: any non-empty value at any breakpoint. */
export function hasImageSize(value: unknown): value is ImageSizeSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  for (const k of IMAGE_SIZE_FLAT_KEYS) if (isDefined(v[k])) return true;
  for (const k of IMAGE_SIZE_PER_BP_KEYS) {
    const x = v[k];
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      if (BREAKPOINTS.some((bp) => isDefined((x as Record<string, unknown>)[bp]))) return true;
    } else if (isDefined(x)) {
      return true;
    }
  }
  return false;
}

const LEGACY_ASPECT_RATIO: Record<string, ImageRatio | undefined> = {
  square: '1:1',
  portrait: '3:4',
  landscape: '4:3',
  wide: '16:9',
};

/**
 * The `image_size` value equivalent to a section's / block's legacy keys
 * (`aspect`, `fit`, `width_px`). Mirrors the web imageSizeFromLegacy.
 */
export function imageSizeFromLegacy(legacy: Record<string, unknown> | undefined | null): ImageSizeSettings {
  const l = legacy || {};
  const out: ImageSizeSettings = {};
  const widthPx = num(l.width_px, IMAGE_SIZE_LIMITS.width_px);
  if (widthPx) {
    out.width_mode = 'px';
    out.width_px = widthPx;
  } else {
    out.width_mode = 'full';
  }
  const ratio = typeof l.aspect === 'string' ? LEGACY_ASPECT_RATIO[l.aspect] : undefined;
  if (ratio) {
    out.height_mode = 'ratio';
    out.ratio = ratio;
  } else {
    out.height_mode = 'auto';
  }
  out.fit = l.fit === 'contain' ? 'contain' : 'cover';
  out.align = 'start';
  return out;
}

/**
 * What the editor shows: the stored value when it carries settings,
 * otherwise the equivalent of the legacy keys of the section / block. The
 * seeded object is written in full on the first edit.
 */
export function imageSizeEditorValue(
  value: unknown,
  siblings: Record<string, unknown> | undefined | null,
): { value: ImageSizeSettings; seeded: boolean } {
  if (hasImageSize(value)) return { value: value as ImageSizeSettings, seeded: false };
  return { value: imageSizeFromLegacy(siblings), seeded: true };
}

/** Which controls the editor shows at one breakpoint. */
export interface ImageSizeControls {
  widthMode: ImageWidthMode;
  heightMode: ImageHeightMode;
  widthPx: boolean;
  widthPercent: boolean;
  heightPx: boolean;
  ratio: boolean;
  /** Auto width combined with a ratio renders as full width. */
  autoBecomesFull: boolean;
  // Flat controls: fit applies to every breakpoint with a fixed height, so it
  // shows when ANY breakpoint has one; position additionally needs cover.
  fit: boolean;
  position: boolean;
}

export function imageSizeControlsAt(value: ImageSizeSettings | undefined | null, bp: Breakpoint): ImageSizeControls {
  const v = value || {};
  const D = IMAGE_SIZE_DEFAULTS;
  const widthMode = oneOf(cascadeAt(v.width_mode, bp), IMAGE_WIDTH_MODES) ?? D.width_mode;
  const heightMode = oneOf(cascadeAt(v.height_mode, bp), IMAGE_HEIGHT_MODES) ?? D.height_mode;
  const fixedSomewhere = BREAKPOINTS.some((b) => {
    const m = oneOf(cascadeAt(v.height_mode, b), IMAGE_HEIGHT_MODES) ?? D.height_mode;
    return m === 'px' || m === 'ratio';
  });
  const fit = oneOf(v.fit, IMAGE_FITS) ?? D.fit;
  return {
    widthMode,
    heightMode,
    widthPx: widthMode === 'px',
    widthPercent: widthMode === 'percent',
    heightPx: heightMode === 'px',
    ratio: heightMode === 'ratio',
    autoBecomesFull: widthMode === 'auto' && heightMode === 'ratio',
    fit: fixedSomewhere,
    position: fixedSomewhere && fit === 'cover',
  };
}

/**
 * Drops empty keys (undefined / '' / null, and per-breakpoint objects left
 * empty) so the stored object stays minimal. Returns undefined when nothing
 * is left, which makes the storefront fall back to its legacy render path.
 */
export function compactImageSize(value: ImageSizeSettings | undefined | null): ImageSizeSettings | undefined {
  if (!value) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(value)) {
    if (!isDefined(x)) continue;
    if (typeof x === 'object' && !Array.isArray(x)) {
      const o: Record<string, unknown> = {};
      for (const bp of BREAKPOINTS) {
        const y = (x as Record<string, unknown>)[bp];
        if (isDefined(y)) o[bp] = y;
      }
      const ks = Object.keys(o);
      if (ks.length === 0) continue;
      out[k] = ks.length === 1 && ks[0] === 'desktop' ? o.desktop : o;
    } else {
      out[k] = x;
    }
  }
  return Object.keys(out).length ? (out as ImageSizeSettings) : undefined;
}
