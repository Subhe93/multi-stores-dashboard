// Optional theme tokens edited in the theme customizer and stored in
// store.theme_customizations (free-form JSON):
//   typography.fontFamilyArabic.heading / .body  - Arabic-script fallback font
//   spacing.radius.button                        - one button shape
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
