// Palette thumbnail of "object-study": a plate under a label line, three
// points on the object joined by leader lines to short notes in the two
// margins, then the title, the price and the button. Same 200 x 120 frame
// and neutral palette as the previews of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const SURFACE = '#fafafa';
const FILL = '#d4d4d8';
const FILL_DARK = '#a1a1aa';
const TEXT = '#71717a';
const HAIR = '#d4d4d8';
const INK = '#18181b';
const PRIMARY = '#3b82f6';

// Plate: x 72..128, y 16..86. Each note: the point on the object, the side
// of its margin and the height of the line.
const NOTES = [
  { x: 101, y: 52, side: 'right' as const },
  { x: 94, y: 34, side: 'left' as const },
  { x: 84, y: 68, side: 'left' as const },
];

export function ObjectStudyPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      {/* Label line */}
      <rect x="72" y="8" width="14" height="2" rx="1" fill={TEXT} />
      <rect x="108" y="8" width="20" height="2" rx="1" fill={FILL} />
      <line x1="72" y1="13" x2="128" y2="13" stroke={HAIR} strokeWidth="1" />
      {/* Plate with the object */}
      <rect x="72" y="16" width="56" height="70" fill="#ececee" />
      <rect x="97" y="24" width="6" height="10" rx="3" fill={FILL_DARK} />
      <circle cx="100" cy="54" r="17" fill={FILL_DARK} />
      <ellipse cx="100" cy="53" rx="5" ry="7" fill={SURFACE} />
      {[86, 93, 100, 107, 114].map((x) => (
        <circle key={x} cx={x} cy={x === 100 ? 78 : x === 93 || x === 107 ? 76 : 72} r="2.2" fill={FILL_DARK} />
      ))}
      {/* Leader lines, points and notes */}
      {NOTES.map((n, i) => {
        const end = n.side === 'left' ? 64 : 136;
        const textX = n.side === 'left' ? 34 : 140;
        return (
          <g key={i}>
            <line x1={n.x} y1={n.y} x2={end} y2={n.y} stroke={PRIMARY} strokeWidth="0.75" />
            <circle cx={n.x} cy={n.y} r="1.8" fill={INK} stroke={SURFACE} strokeWidth="0.8" />
            <rect x={n.side === 'left' ? 56 : 140} y={n.y - 2} width="4" height="4" rx="1" fill={PRIMARY} />
            <rect x={n.side === 'left' ? textX + 6 : textX} y={n.y + 5} width="20" height="2.5" rx="1" fill={TEXT} />
            <rect x={n.side === 'left' ? textX : textX} y={n.y + 10} width="26" height="2" rx="1" fill={FILL} />
          </g>
        );
      })}
      {/* Buy block */}
      <rect x="78" y="92" width="44" height="5" rx="1" fill={INK} />
      <rect x="80" y="103" width="14" height="4" rx="1" fill={TEXT} />
      <rect x="98" y="100" width="24" height="10" rx="2" fill={PRIMARY} />
    </svg>
  );
}
