// Scene theme and living background of any section (`settings._style`),
// edited in the StylePanel. Flat keys, read by the storefront in
// multi-stores-web/src/themes/creative/decor/sectionDecor.tsx: an unset key
// means no attribute, no class and no CSS, so every setter here REMOVES a key
// instead of storing an empty or default value.
// Pure (no imports) so the node test runner can load it.

export const SCENE_VALUES = ['dark', 'light', 'accent'] as const;
export const BACKDROP_VALUES = ['dots', 'particles', 'glow'] as const;

export type SceneValue = (typeof SCENE_VALUES)[number];
export type BackdropValue = (typeof BACKDROP_VALUES)[number];

/** The four scene keys: the scene itself and its three colour overrides. */
export const SCENE_KEYS = ['scene', 'scene_bg', 'scene_text', 'scene_accent'] as const;
/** The six living-background keys. */
export const BACKDROP_KEYS = [
  'backdrop',
  'backdrop_color_1',
  'backdrop_color_2',
  'backdrop_intensity',
  'backdrop_motion',
  'backdrop_particle',
] as const;

export type SceneStyleKey = (typeof SCENE_KEYS)[number] | (typeof BACKDROP_KEYS)[number];

/** Values that are the storefront's behaviour when the key is absent. */
const UNSET_DEFAULTS: Partial<Record<SceneStyleKey, string>> = {
  backdrop_intensity: 'soft',
  backdrop_motion: 'slow',
  backdrop_particle: 'dot',
};

type StyleLike = Record<string, unknown>;

/** The stored scene when it is one of the three, else ''. */
export function sceneOf(style: object | null | undefined): SceneValue | '' {
  const value = (style as StyleLike | null | undefined)?.scene;
  return typeof value === 'string' && (SCENE_VALUES as readonly string[]).includes(value) ? (value as SceneValue) : '';
}

/** The stored backdrop when it is one of the three, else ''. */
export function backdropOf(style: object | null | undefined): BackdropValue | '' {
  const value = (style as StyleLike | null | undefined)?.backdrop;
  return typeof value === 'string' && (BACKDROP_VALUES as readonly string[]).includes(value)
    ? (value as BackdropValue)
    : '';
}

/**
 * Copy of `style` with one flat key set. '', undefined and the value that
 * equals the unset behaviour (soft / slow / dot) remove the key.
 */
export function withStyleKey<T extends object>(style: T, key: SceneStyleKey, value: string | undefined): T {
  const next = { ...style } as StyleLike;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed === UNSET_DEFAULTS[key]) delete next[key];
  else next[key] = trimmed;
  return next as T;
}

/**
 * Copy of `style` with the scene set. '' or an unknown value removes the
 * scene AND its three colour overrides: the storefront reads an override
 * without a scene as a light scene, so leaving them would keep a scene on.
 */
export function withScene<T extends object>(style: T, value: string): T {
  const next = { ...style } as StyleLike;
  if ((SCENE_VALUES as readonly string[]).includes(value)) {
    next.scene = value;
    return next as T;
  }
  for (const key of SCENE_KEYS) delete next[key];
  return next as T;
}

/** Copy of `style` with the backdrop set; '' or unknown removes all six keys. */
export function withBackdrop<T extends object>(style: T, value: string): T {
  const next = { ...style } as StyleLike;
  if ((BACKDROP_VALUES as readonly string[]).includes(value)) {
    next.backdrop = value;
    // The particle shape belongs to the particles pattern only.
    if (value !== 'particles') delete next.backdrop_particle;
    return next as T;
  }
  for (const key of BACKDROP_KEYS) delete next[key];
  return next as T;
}

// ── Contrast of a colour override pair (WCAG 2.x) ──────────────────────────

/** Minimum contrast of text on its background. */
export const MIN_TEXT_CONTRAST = 4.5;

function channels(hex: unknown): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio (1 to 21) of two hex colours; null when either is not a hex. */
export function contrastRatio(a: unknown, b: unknown): number | null {
  const ca = channels(a);
  const cb = channels(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The override pairs that fall under 4.5:1, as ratios rounded down to one
 * decimal (so 4.46 never shows as a passing "4.5"). A pair is checked only
 * when BOTH colours are overridden: the theme's own colours are not known
 * here.
 */
export function sceneContrastIssues(input: object | null | undefined): { text?: number; accent?: number } {
  const style = input as StyleLike | null | undefined;
  const out: { text?: number; accent?: number } = {};
  const floor1 = (n: number) => Math.floor(n * 10) / 10;
  const text = contrastRatio(style?.scene_text, style?.scene_bg);
  if (text !== null && text < MIN_TEXT_CONTRAST) out.text = floor1(text);
  const accent = contrastRatio(style?.scene_accent, style?.scene_bg);
  if (accent !== null && accent < MIN_TEXT_CONTRAST) out.accent = floor1(accent);
  return out;
}
