// Palette thumbnail of "pattern-band": two blocks of content with a woven
// band between them (two brick-offset rows of stepped diamonds) and a small
// tag in the middle. Same 200 x 120 frame and neutral palette as the previews
// of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const SURFACE = '#fafafa';
const FILL = '#d4d4d8';
const TEXT = '#71717a';
const ACCENT = '#18181b';
const PRIMARY = '#3b82f6';

const TILE = 16;
const ROWS = [
  { y: 44, shift: 0 },
  { y: 60, shift: -TILE / 2 },
];

/** One stepped diamond centred in a 16 x 16 tile whose corner is (x, y). */
function diamond(x: number, y: number, key: string, strong: boolean): ReactElement {
  const c = strong ? PRIMARY : ACCENT;
  return (
    <g key={key} fill={c}>
      <rect x={x + 7} y={y + 3} width="2" height="10" />
      <rect x={x + 5} y={y + 5} width="6" height="6" />
      <rect x={x + 3} y={y + 7} width="10" height="2" />
      <rect x={x + 7} y={y + 7} width="2" height="2" fill={SURFACE} />
    </g>
  );
}

export function PatternBandPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <defs>
        <clipPath id="cx-pb-preview-clip">
          <rect x="0" y="44" width="200" height="32" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      <rect x="64" y="16" width="72" height="5" rx="1" fill={TEXT} />
      <rect x="54" y="27" width="92" height="3" rx="1" fill={FILL} />
      <g clipPath="url(#cx-pb-preview-clip)">
        {ROWS.map((row, r) =>
          Array.from({ length: 14 }, (_, i) => diamond(row.shift + i * TILE, row.y, `${r}-${i}`, (i + r) % 2 === 0)),
        )}
      </g>
      <rect x="0" y="43.25" width="200" height="0.75" fill={ACCENT} />
      <rect x="0" y="76" width="200" height="0.75" fill={ACCENT} />
      {/* The tag interrupts the band. */}
      <rect x="72" y="44" width="56" height="32" fill={SURFACE} />
      <rect x="82" y="58.5" width="36" height="3" rx="1" fill={TEXT} />
      <rect x="54" y="90" width="92" height="3" rx="1" fill={FILL} />
      <rect x="66" y="98" width="68" height="3" rx="1" fill={FILL} />
    </svg>
  );
}

export default PatternBandPreview;
