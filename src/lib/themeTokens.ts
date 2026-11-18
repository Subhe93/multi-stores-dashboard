// Optional theme tokens edited in the theme customizer and stored in
// store.theme_customizations (free-form JSON):
//   typography.fontFamilyArabic.heading / .body  - Arabic-script fallback font
//   spacing.radius.button                        - one button shape
//   motion.reveal / motion.zoom                  - calmer or no movement
//   motion.creative                              - store-level motion style
// Absent, empty, wrong type or invalid all mean "unset": the storefront then
// renders exactly as before. The setters keep every other key and prune only
// the objects they emptied themselves.
// Pure (no imports) so the node test runner can load it.

/**
 * Arabic font families the storefront accepts. Mirrors ARABIC_FONTS in
 * multi-stores-web/src/lib/arabicFonts.ts: same six names, same order.
 */
export const ARABIC_FONT_FAMILIES = [
  'Noto Naskh Arabic',
  'Markazi Text',
  'Noto Kufi Arabic',
  'Noto Sans Arabic',
  'IBM Plex Sans Arabic',
  'Cairo',
] as const;

/** Button shapes offered by the customizer: square, slight, rounded, pill. */
export const BUTTON_RADIUS_OPTIONS = ['0px', '4px', '8px', '9999px'] as const;

/** A stored button radius: 0px to 9999px, the same rule as the storefront. */
const BUTTON_RADIUS_PATTERN = /^\d{1,4}px$/;

export type ArabicFontSlot = 'heading' | 'body';

/** The part of the customizations object these helpers read and write. */
export interface ThemeTokensLike {
  typography?: unknown;
  spacing?: unknown;
  motion?: unknown;
  [key: string]: unknown; // colors, product, customCss, preset_id… are kept as they are
}

type Dict = Record<string, unknown>;

const isDict = (value: unknown): value is Dict =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The allow-listed family named by `value` (compared after trim), else ''. */
function arabicFamily(value: unknown): string {
  if (typeof value !== 'string') return '';
  const name = value.trim();
  return (ARABIC_FONT_FAMILIES as readonly string[]).includes(name) ? name : '';
}

function buttonRadius(value: unknown): string {
  return typeof value === 'string' && BUTTON_RADIUS_PATTERN.test(value) ? value : '';
}

/** The stored Arabic font of a slot when it is one of the six, else ''. */
export function arabicFontValue(tokens: ThemeTokensLike | null | undefined, slot: ArabicFontSlot): string {
  const typography = tokens?.typography;
  const arabic = isDict(typography) ? typography.fontFamilyArabic : undefined;
  return isDict(arabic) ? arabicFamily(arabic[slot]) : '';
}

/** The stored button radius when it is a valid px value, else ''. */
export function buttonRadiusValue(tokens: ThemeTokensLike | null | undefined): string {
  const spacing = tokens?.spacing;
  const radius = isDict(spacing) ? spacing.radius : undefined;
  return isDict(radius) ? buttonRadius(radius.button) : '';
}

/**
 * Copy of `tokens` with `tokens[group][parent][key]` set to `value`, or with
 * that key removed when `value` is ''. Removing prunes `parent` and `group`
 * only when the removal left them empty; a key that was not there leaves the
 * copy deep-equal to the input.
 */
function withNested<T extends ThemeTokensLike>(
  tokens: T,
  group: 'typography' | 'spacing',
  parent: string,
  key: string,
  value: string,
): T {
  const next: Dict = { ...tokens };
  const storedGroup = next[group];
  const storedParent = isDict(storedGroup) ? storedGroup[parent] : undefined;

  if (value) {
    next[group] = {
      ...(isDict(storedGroup) ? storedGroup : {}),
      [parent]: { ...(isDict(storedParent) ? storedParent : {}), [key]: value },
    };
    return next as T;
  }

  // Nothing stored under that key: nothing to remove, nothing to prune.
  if (!isDict(storedGroup) || !isDict(storedParent) || !(key in storedParent)) return next as T;

  const nextParent = { ...storedParent };
  delete nextParent[key];
  const nextGroup = { ...storedGroup };
  if (Object.keys(nextParent).length) nextGroup[parent] = nextParent;
  else delete nextGroup[parent];
  if (Object.keys(nextGroup).length) next[group] = nextGroup;
  else delete next[group];
  return next as T;
}

/**
 * Copy of `tokens` with the Arabic font of a slot set. '' (or a name outside
 * the six) removes the key, so nothing invalid is ever written.
 */
export function withArabicFont<T extends ThemeTokensLike>(tokens: T, slot: ArabicFontSlot, value: string): T {
  return withNested(tokens, 'typography', 'fontFamilyArabic', slot, arabicFamily(value));
}

/**
 * Copy of `tokens` with the button radius set. '' (or a value that is not a
 * valid px radius) removes the key.
 */
export function withButtonRadius<T extends ThemeTokensLike>(tokens: T, value: string): T {
  return withNested(tokens, 'spacing', 'radius', 'button', buttonRadius(value));
}

// ── Motion (store.theme_customizations.motion) ─────────────────────────────
//   motion.reveal - scroll animations: 'calm' | 'off'
//   motion.zoom   - image zoom on hover: 'subtle' | 'off'
// The standard behaviour is never stored: the key is absent. The storefront
// (multi-stores-web/src/themes/tokens.ts, motionAttrs) reads absent,
// 'default', a wrong type and any unknown value as unset.

/** Stored values of motion.reveal, besides the unset standard. */
export const MOTION_REVEAL_VALUES = ['calm', 'off'] as const;
/** Stored values of motion.zoom, besides the unset standard. */
export const MOTION_ZOOM_VALUES = ['subtle', 'off'] as const;

export type MotionKey = 'reveal' | 'zoom';

const MOTION_VALUES: Record<MotionKey, readonly string[]> = {
  reveal: MOTION_REVEAL_VALUES,
  zoom: MOTION_ZOOM_VALUES,
};

function motionChoice(key: MotionKey, value: unknown): string {
  return typeof value === 'string' && MOTION_VALUES[key].includes(value) ? value : '';
}

/** The stored motion value of `key` when it is one of its two values, else ''. */
export function motionValue(tokens: ThemeTokensLike | null | undefined, key: MotionKey): string {
  const motion = tokens?.motion;
  return isDict(motion) ? motionChoice(key, motion[key]) : '';
}

/**
 * Copy of `tokens` with motion[key] set. '', 'default' or a value outside the
 * list removes the key, and removes `motion` when that left it empty. Every
 * other key is kept; a key that was not there leaves the copy deep-equal to
 * the input.
 */
export function withMotion<T extends ThemeTokensLike>(tokens: T, key: MotionKey, value: string): T {
  const next: Dict = { ...tokens };
  const stored = next.motion;
  const choice = motionChoice(key, value);

  if (choice) {
    next.motion = { ...(isDict(stored) ? stored : {}), [key]: choice };
    return next as T;
  }

  // Nothing stored under that key: nothing to remove, nothing to prune.
  if (!isDict(stored) || !(key in stored)) return next as T;

  const nextMotion = { ...stored };
  delete nextMotion[key];
  if (Object.keys(nextMotion).length) next.motion = nextMotion;
  else delete next.motion;
  return next as T;
}

// ── Motion style (store.theme_customizations.motion.creative) ──────────────
//   creative.enabled    - true; absent = off (never stored as false)
//   creative.smooth     - 'off'; absent = smooth scrolling on
//   creative.magnetic   - 'off'; absent = magnetic buttons on
//   creative.transition - 'curtain'; absent = no page transition
//   creative.progress   - 'bar'; absent = no scroll progress bar
//   creative.cursor     - 'dot'; absent = the normal pointer
// Mirrors readCreative in multi-stores-web/src/themes/creative/creativeAttrs.ts:
// anything but `enabled === true` reads as off. Unset values are never
// stored; switching the master off removes `creative`, and `motion` when
// that left it empty.

export interface CreativeValue {
  /** The store-level motion style switch. */
  enabled: boolean;
  /** Smooth scrolling (on by default once enabled). */
  smooth: boolean;
  /** Magnetic buttons (on by default once enabled). */
  magnetic: boolean;
  /** Page transition curtain (off by default). */
  curtain: boolean;
  /** Thin scroll progress bar at the top of the page (off by default). */
  progress: boolean;
  /** Small dot that follows the pointer (off by default). */
  cursor: boolean;
}

/** What switching the master on gives before any option is touched. */
const CREATIVE_OFF: CreativeValue = {
  enabled: false,
  smooth: true,
  magnetic: true,
  curtain: false,
  progress: false,
  cursor: false,
};

/**
 * The motion style switches as booleans. While the master is off the
 * options read as their defaults (smooth and magnetic on; curtain, progress
 * bar and cursor dot off).
 */
export function creativeValue(tokens: ThemeTokensLike | null | undefined): CreativeValue {
  const motion = tokens?.motion;
  const creative = isDict(motion) ? motion.creative : undefined;
  if (!isDict(creative) || creative.enabled !== true) return { ...CREATIVE_OFF };
  return {
    enabled: true,
    smooth: creative.smooth !== 'off',
    magnetic: creative.magnetic !== 'off',
    curtain: creative.transition === 'curtain',
    progress: creative.progress === 'bar',
    cursor: creative.cursor === 'dot',
  };
}

/**
 * Copy of `tokens` with the creative switches changed by `patch`. Off
 * removes `motion.creative` (and `motion` once it is empty); on stores
 * `enabled: true` plus only the options that differ from their default.
 * Every other key is kept; switching off a store that has no `creative`
 * leaves the copy deep-equal to the input.
 */
export function withCreative<T extends ThemeTokensLike>(tokens: T, patch: Partial<CreativeValue>): T {
  const next: Dict = { ...tokens };
  const stored = next.motion;
  const value = { ...creativeValue(tokens), ...patch };

  if (value.enabled === true) {
    const storedCreative = isDict(stored) && isDict(stored.creative) ? stored.creative : {};
    // Unknown keys inside creative survive; the known ones are rewritten.
    const creative: Dict = { ...storedCreative, enabled: true };
    delete creative.smooth;
    delete creative.magnetic;
    delete creative.transition;
    delete creative.progress;
    delete creative.cursor;
    if (value.smooth === false) creative.smooth = 'off';
    if (value.magnetic === false) creative.magnetic = 'off';
    if (value.curtain === true) creative.transition = 'curtain';
    if (value.progress === true) creative.progress = 'bar';
    if (value.cursor === true) creative.cursor = 'dot';
    next.motion = { ...(isDict(stored) ? stored : {}), creative };
    return next as T;
  }

  // Nothing stored: nothing to remove, nothing to prune.
  if (!isDict(stored) || !('creative' in stored)) return next as T;

  const nextMotion = { ...stored };
  delete nextMotion.creative;
  if (Object.keys(nextMotion).length) next.motion = nextMotion;
  else delete next.motion;
  return next as T;
}
