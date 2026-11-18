// Palette thumbnail of "look-spread": a large photograph with a numbered
// marker, a smaller one overlapping its edge, and a ruled buy list beside
// them (number, thumbnail, name, price). Same 200 x 120 frame and neutral
// palette as the previews of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const SURFACE = '#fafafa';
const FILL = '#d4d4d8';
const FILL_DARK = '#a1a1aa';
const TEXT = '#71717a';
const HAIR = '#e4e4e7';
const PRIMARY = '#3b82f6';

// List rows: the first two are tied to a marker, the others carry a diamond.
const ROWS = [
  { y: 34, marked: true },
  { y: 52, marked: true },
  { y: 70, marked: false },
  { y: 88, marked: false },
];

export function LookSpreadPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      {/* Header */}
      <rect x="16" y="12" width="20" height="2" rx="1" fill={PRIMARY} />
      <rect x="16" y="18" width="58" height="5" rx="1" fill={TEXT} />
      {/* Large photograph and its marker */}
      <rect x="16" y="30" width="68" height="80" fill={FILL} />
      <circle cx="48" cy="78" r="5" fill={PRIMARY} stroke={SURFACE} strokeWidth="1.5" />
      {/* Small photograph, lower and over the edge of the large one */}
      <rect x="77" y="46" width="34" height="44" fill={SURFACE} />
      <rect x="79" y="48" width="30" height="40" fill={FILL_DARK} />
      <circle cx="96" cy="64" r="4" fill={PRIMARY} stroke={SURFACE} strokeWidth="1.5" />
      {/* Buy list */}
      {ROWS.map((row) => (
        <g key={row.y}>
          <rect x="122" y={row.y - 4} width="62" height="0.75" fill={HAIR} />
          {row.marked ? (
            <circle cx="125" cy={row.y + 5} r="2.5" fill={PRIMARY} />
          ) : (
            <rect x="123.5" y={row.y + 3.5} width="3" height="3" fill={PRIMARY} transform={`rotate(45 125 ${row.y + 5})`} />
          )}
          <rect x="132" y={row.y} width="10" height="10" fill={FILL} />
          <rect x="146" y={row.y + 2} width="22" height="2.5" rx="1" fill={TEXT} />
          <rect x="146" y={row.y + 7} width="14" height="2" rx="1" fill={FILL} />
          <rect x="174" y={row.y + 3} width="10" height="2.5" rx="1" fill={TEXT} />
        </g>
      ))}
      <rect x="122" y="102" width="62" height="0.75" fill={HAIR} />
      <rect x="122" y="108" width="30" height="2" rx="1" fill={TEXT} />
    </svg>
  );
}
