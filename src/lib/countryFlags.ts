// Country flags in the dashboard.
//
// A flag that carries writing (script, a motto, lettering) must be shown as
// the complete official artwork or not at all: an OS emoji is a vendor's own
// simplified drawing (and on Windows no flag at all, only two letters). Those
// flags are therefore never drawn as an emoji. The ones the dashboard can
// actually list are bundled as unmodified Wikimedia Commons files under
// public/flags/ (see public/flags/SOURCES.txt) and drawn by
// components/common/CountryFlag.tsx; the rest show no flag.
//
// Pure module: no JSX and no imports, so the node unit tests can load it.

/** National flags that carry script, a motto or lettering (ISO 3166-1 alpha-2). */
export const FLAGS_WITH_WRITING: ReadonlySet<string> = new Set([
  // Script, a motto or lettering on the flag itself.
  'SA', 'IR', 'IQ', 'EG', 'AF', 'BN', 'BR', 'ES', 'MT', 'AD', 'SM', 'BZ', 'BO', 'DO',
  'SV', 'GT', 'HT', 'NI', 'PY', 'GQ',
  // Conservative extras: a badge or arms with lettering in common artwork.
  // Listing one too many is harmless, the flag is simply not drawn.
  'CR', 'VE', 'EC', 'FJ', 'GU', 'VI', 'BM', 'FK', 'GS', 'IO', 'KY', 'MS', 'PN', 'SH',
  'TC', 'VG', 'AS', 'MP',
]);

/**
 * Flags with writing that ship as files: public/flags/<code>.svg, with the
 * pixel size the file declares (its official proportions).
 */
export const BUNDLED_FLAGS: Record<string, { width: number; height: number }> = {
  SA: { width: 900, height: 600 },
  IR: { width: 630, height: 360 },
  IQ: { width: 900, height: 600 },
  EG: { width: 900, height: 600 },
  BR: { width: 1000, height: 700 },
  ES: { width: 750, height: 500 },
  MT: { width: 900, height: 600 },
};

/** The regional-indicator pair of an ISO alpha-2 code; a globe for anything else. */
function regionalIndicatorPair(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    0x1f1e6 + (code.toUpperCase().charCodeAt(0) - 65),
    0x1f1e6 + (code.toUpperCase().charCodeAt(1) - 65),
  );
}

/**
 * Flag emoji for text labels. Empty for a flag that carries writing: such a
 * flag is never drawn as an emoji.
 */
export function flagEmoji(code: string): string {
  if (code && FLAGS_WITH_WRITING.has(code.toUpperCase())) return '';
  return regionalIndicatorPair(code);
}

/**
 * Sort key that keeps the order lists had when every label started with its
 * flag emoji. Never rendered.
 */
export function flagSortKey(code: string): string {
  return regionalIndicatorPair(code);
}

/** Same-origin path of the bundled artwork, or null when the flag is not bundled. */
export function bundledFlagSrc(code: string): string | null {
  const upper = (code || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(BUNDLED_FLAGS, upper)
    ? `/flags/${upper.toLowerCase()}.svg`
    : null;
}
