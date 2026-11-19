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

// ── Look reset ("Reset to theme", a theme switch, a preset) ────────────────
// A reset clears the look tokens. What is the store's own stays: the custom
// CSS (owner content) and the behaviour settings `motion`, `product.card` and
// `listing`.
// Same rule and vectors as keepOwnerSettings in the API
// (multi-stores-api/src/modules/themes/keep-owner-css.ts).

/** What a look reset keeps. Spread it into the new customizations object. */
export interface OwnerSettings {
  customCss?: string;
  motion?: Dict;
  product?: { card: unknown };
  listing?: Dict;
}

/**
 * The store's own settings in `previous`:
 *  - `customCss` when it is a non-blank string;
 *  - `motion` when it is a non-empty plain object;
 *  - `product.card` when it is not null / undefined. Other `product` keys
 *    (e.g. `swatchShape`) are look tokens and are reset;
 *  - `listing` (filtered product listing) when it is a plain object, even
 *    empty (`{}` = switched on with the defaults).
 * Anything else (not an object, an array, a string) gives {}.
 */
export function keepOwnerSettings(previous: unknown): OwnerSettings {
  if (!isDict(previous)) return {};
  const kept: OwnerSettings = {};
  const css = previous.customCss;
  if (typeof css === 'string' && css.trim() !== '') kept.customCss = css;
  const motion = previous.motion;
  if (isDict(motion) && Object.keys(motion).length > 0) kept.motion = motion;
  const product = previous.product;
  if (isDict(product) && product.card !== null && product.card !== undefined) {
    kept.product = { card: product.card };
  }
  const listing = previous.listing;
  if (isDict(listing)) kept.listing = listing;
  return kept;
}

/** Top-level keys that never make a store's look "customized". */
const NON_LOOK_KEYS: ReadonlySet<string> = new Set(['customCss', 'motion', 'preset_id', 'listing']);

/**
 * True when the customizations carry look overrides (colours, fonts, spacing,
 * a swatch shape…). The custom CSS, `motion`, `product.card`, `listing` and
 * `preset_id` are not look overrides: a store that holds only those is on its theme's
 * own look.
 */
export function hasLookOverrides(tokens: unknown): boolean {
  if (!isDict(tokens)) return false;
  return Object.keys(tokens).some((key) => {
    if (NON_LOOK_KEYS.has(key)) return false;
    if (key !== 'product') return true;
    const product = tokens.product;
    // A product object that holds nothing but `card` is behaviour only.
    return !(isDict(product) && Object.keys(product).length > 0 && Object.keys(product).every((k) => k === 'card'));
  });
}

// ── Product card (store.theme_customizations.product.card) ─────────────────
// Opt-in object: present (even `{}`) = the enhanced product card on every
// listing of the storefront, absent = the classic card. Mirrors
// multi-stores-web/src/lib/productCard/settings.ts: same keys, value sets
// and defaults. Only what the owner chose is stored, never a default.

export const CARD_STYLES = ['classic', 'editorial'] as const;
export const CARD_ASPECTS = ['square', 'portrait', 'landscape'] as const;
export const CARD_CORNERS = ['theme', 'square'] as const;
export const CARD_AVAILABILITY = ['off', 'sold_out', 'sold_out_and_low'] as const;
export const CARD_BADGES = ['percent', 'sale', 'none'] as const;

export type CardStyle = (typeof CARD_STYLES)[number];
export type CardAspect = (typeof CARD_ASPECTS)[number];
export type CardCorners = (typeof CARD_CORNERS)[number];
export type CardAvailability = (typeof CARD_AVAILABILITY)[number];
export type CardBadge = (typeof CARD_BADGES)[number];

/**
 * Highest "Only N left" number a card may show. Equal to the storefront's
 * LOW_STOCK_CAP and the API's LOW_STOCK_DISPLAY_THRESHOLD: above it a stock
 * change does not refresh the store, so the number would be stale.
 */
export const LOW_STOCK_CAP = 10;
export const LOW_STOCK_DEFAULT = 3;

/** The object as stored (every key optional). */
export interface ProductCardStored {
  style?: CardStyle;
  aspect?: CardAspect;
  corners?: CardCorners;
  hover_image?: boolean;
  swatches?: boolean;
  sizes_line?: boolean;
  availability?: CardAvailability;
  low_stock_threshold?: number;
  badge?: CardBadge;
  quick_add?: boolean;
  [key: string]: unknown; // keys this editor does not know are kept
}

/** The card settings as the customizer shows them. */
export interface ProductCardValue {
  /** The opt-in switch: the `card` object exists. */
  enabled: boolean;
  style: CardStyle;
  /** '' = automatic: follows the style (portrait if editorial, else square). */
  aspect: CardAspect | '';
  /** '' = automatic: follows the style (square if editorial, else the theme's). */
  corners: CardCorners | '';
  hover_image: boolean;
  swatches: boolean;
  sizes_line: boolean;
  availability: CardAvailability;
  /** 1..LOW_STOCK_CAP. */
  low_stock_threshold: number;
  badge: CardBadge;
  quick_add: boolean;
}

const CARD_OFF: ProductCardValue = {
  enabled: false,
  style: 'classic',
  aspect: '',
  corners: '',
  hover_image: false,
  swatches: false,
  sizes_line: false,
  availability: 'off',
  low_stock_threshold: LOW_STOCK_DEFAULT,
  badge: 'percent',
  quick_add: false,
};

function cardChoice<T extends string>(set: readonly T[], value: unknown, fallback: T): T;
function cardChoice<T extends string>(set: readonly T[], value: unknown, fallback: ''): T | '';
function cardChoice(set: readonly string[], value: unknown, fallback: string): string {
  return typeof value === 'string' && set.includes(value) ? value : fallback;
}

/** A threshold as the storefront reads it: an integer clamped to 1..cap, else the default. */
function cardThreshold(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(LOW_STOCK_CAP, Math.max(1, n)) : LOW_STOCK_DEFAULT;
}

/** The aspect and corners a card gets when the owner left them automatic. */
export function cardStyleDefaults(style: CardStyle): { aspect: CardAspect; corners: CardCorners } {
  return style === 'editorial' ? { aspect: 'portrait', corners: 'square' } : { aspect: 'square', corners: 'theme' };
}

/**
 * The stored card settings. Anything but a plain `product.card` object reads
 * as off (the classic card), with every option at its default.
 */
export function productCardValue(tokens: ThemeTokensLike | null | undefined): ProductCardValue {
  const product = tokens?.product;
  const card = isDict(product) ? product.card : undefined;
  if (!isDict(card)) return { ...CARD_OFF };
  return {
    enabled: true,
    style: cardChoice(CARD_STYLES, card.style, 'classic'),
    aspect: cardChoice(CARD_ASPECTS, card.aspect, ''),
    corners: cardChoice(CARD_CORNERS, card.corners, ''),
    hover_image: card.hover_image === true,
    swatches: card.swatches === true,
    sizes_line: card.sizes_line === true,
    availability: cardChoice(CARD_AVAILABILITY, card.availability, 'off'),
    low_stock_threshold: cardThreshold(card.low_stock_threshold),
    badge: cardChoice(CARD_BADGES, card.badge, 'percent'),
    quick_add: card.quick_add === true,
  };
}

const CARD_KNOWN_KEYS = [
  'style',
  'aspect',
  'corners',
  'hover_image',
  'swatches',
  'sizes_line',
  'availability',
  'low_stock_threshold',
  'badge',
  'quick_add',
] as const;

/**
 * Copy of `tokens` with the card settings changed by `patch`.
 *  - Off removes `product.card` (and `product` once it is empty).
 *  - On writes the object with only what differs from the default: switching
 *    on with nothing chosen stores `{}`. Automatic aspect / corners are never
 *    stored; an explicit choice is.
 * Every other key (`product.swatchShape`, unknown keys inside `card`) is
 * kept; switching off a store that has no card leaves the copy deep-equal to
 * the input.
 */
export function withProductCard<T extends ThemeTokensLike>(tokens: T, patch: Partial<ProductCardValue>): T {
  const next: Dict = { ...tokens };
  const stored = next.product;
  const value = { ...productCardValue(tokens), ...patch };

  if (value.enabled === true) {
    const storedCard = isDict(stored) && isDict(stored.card) ? stored.card : {};
    const card: Dict = { ...storedCard };
    for (const key of CARD_KNOWN_KEYS) delete card[key];
    const style = cardChoice(CARD_STYLES, value.style, 'classic');
    const aspect = cardChoice(CARD_ASPECTS, value.aspect, '');
    const corners = cardChoice(CARD_CORNERS, value.corners, '');
    const availability = cardChoice(CARD_AVAILABILITY, value.availability, 'off');
    const badge = cardChoice(CARD_BADGES, value.badge, 'percent');
    const threshold = cardThreshold(value.low_stock_threshold);
    if (style !== 'classic') card.style = style;
    if (aspect) card.aspect = aspect;
    if (corners) card.corners = corners;
    if (value.hover_image === true) card.hover_image = true;
    if (value.swatches === true) card.swatches = true;
    if (value.sizes_line === true) card.sizes_line = true;
    if (availability !== 'off') card.availability = availability;
    if (threshold !== LOW_STOCK_DEFAULT) card.low_stock_threshold = threshold;
    if (badge !== 'percent') card.badge = badge;
    if (value.quick_add === true) card.quick_add = true;
    next.product = { ...(isDict(stored) ? stored : {}), card };
    return next as T;
  }

  // Nothing stored: nothing to remove, nothing to prune.
  if (!isDict(stored) || !('card' in stored)) return next as T;

  const nextProduct = { ...stored };
  delete nextProduct.card;
  if (Object.keys(nextProduct).length) next.product = nextProduct;
  else delete next.product;
  return next as T;
}

// ── Product listing (store.theme_customizations.listing) ───────────────────
// Opt-in object: present (even `{}`) = the filtered product listing on
// /products and the collection pages (filters with counts, chips, sort,
// column switch), absent = the listing as before. Mirrors
// multi-stores-web/src/lib/listingFilters/settings.ts: same keys, value sets
// and defaults. Only what the owner chose is stored, never a default.

export const LISTING_FILTER_KEYS = ['collection', 'type', 'price', 'availability', 'color', 'size'] as const;
export const LISTING_DENSITIES = [2, 3, 4] as const;
export const LISTING_MOBILE_DENSITIES = [1, 2] as const;
export const LISTING_STYLES = ['bar', 'rail'] as const;

export type ListingFilterKey = (typeof LISTING_FILTER_KEYS)[number];
export type ListingDensity = (typeof LISTING_DENSITIES)[number];
export type ListingMobileDensity = (typeof LISTING_MOBILE_DENSITIES)[number];
export type ListingStyle = (typeof LISTING_STYLES)[number];

/** The object as stored (every key optional). */
export interface ListingStored {
  filters?: ListingFilterKey[];
  density?: ListingDensity;
  mobile_density?: ListingMobileDensity;
  style?: ListingStyle;
  density_switch?: boolean;
  [key: string]: unknown; // keys this editor does not know are kept
}

/** The listing settings as the customizer shows them. */
export interface ListingValue {
  /** The opt-in switch: the `listing` object exists. */
  enabled: boolean;
  /** Filters shown, in this order. */
  filters: ListingFilterKey[];
  density: ListingDensity;
  mobile_density: ListingMobileDensity;
  style: ListingStyle;
  density_switch: boolean;
}

const LISTING_OFF: ListingValue = {
  enabled: false,
  filters: [...LISTING_FILTER_KEYS],
  density: 4,
  mobile_density: 2,
  style: 'bar',
  density_switch: true,
};

function listingFilters(value: unknown): ListingFilterKey[] {
  if (!Array.isArray(value)) return [...LISTING_FILTER_KEYS];
  return value.filter(
    (f, i, all): f is ListingFilterKey => (LISTING_FILTER_KEYS as readonly unknown[]).includes(f) && all.indexOf(f) === i,
  );
}

function listingChoice<T extends string | number>(set: readonly T[], value: unknown, fallback: T): T {
  return (set as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/** The stored listing settings; anything but a plain `listing` object reads as off. */
export function listingValue(tokens: ThemeTokensLike | null | undefined): ListingValue {
  const stored = (tokens as Dict | null | undefined)?.listing;
  if (!isDict(stored)) return { ...LISTING_OFF, filters: [...LISTING_OFF.filters] };
  return {
    enabled: true,
    filters: listingFilters(stored.filters),
    density: listingChoice(LISTING_DENSITIES, stored.density, 4),
    mobile_density: listingChoice(LISTING_MOBILE_DENSITIES, stored.mobile_density, 2),
    style: listingChoice(LISTING_STYLES, stored.style, 'bar'),
    density_switch: stored.density_switch !== false,
  };
}

const LISTING_KNOWN_KEYS = ['filters', 'density', 'mobile_density', 'style', 'density_switch'] as const;

/**
 * Copy of `tokens` with the listing settings changed by `patch`.
 *  - Off removes `listing`.
 *  - On writes the object with only what differs from the default:
 *    switching on with nothing chosen stores `{}`. `filters` is stored only
 *    when it is not all six in the default order (an empty list is stored:
 *    sort and columns without filters).
 * Unknown keys inside `listing` are kept; switching off a store that has no
 * listing leaves the copy deep-equal to the input.
 */
export function withListing<T extends ThemeTokensLike>(tokens: T, patch: Partial<ListingValue>): T {
  const next: Dict = { ...tokens };
  const stored = next.listing;
  const value = { ...listingValue(tokens), ...patch };

  if (value.enabled === true) {
    const listing: Dict = { ...(isDict(stored) ? stored : {}) };
    for (const key of LISTING_KNOWN_KEYS) delete listing[key];
    const filters = listingFilters(value.filters);
    const isDefaultFilters =
      filters.length === LISTING_FILTER_KEYS.length && filters.every((f, i) => f === LISTING_FILTER_KEYS[i]);
    if (!isDefaultFilters) listing.filters = filters;
    const density = listingChoice(LISTING_DENSITIES, value.density, 4);
    const mobile = listingChoice(LISTING_MOBILE_DENSITIES, value.mobile_density, 2);
    const style = listingChoice(LISTING_STYLES, value.style, 'bar');
    if (density !== 4) listing.density = density;
    if (mobile !== 2) listing.mobile_density = mobile;
    if (style !== 'bar') listing.style = style;
    if (value.density_switch === false) listing.density_switch = false;
    next.listing = listing;
    return next as T;
  }

  if (!('listing' in next)) return next as T;
  delete next.listing;
  return next as T;
}
