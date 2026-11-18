// Palette thumbnail of "impact-arc": a half circle over a horizon with its
// filled part, the mark at the reached point, the figure inside and three
// steps under the line. Same 200 x 120 frame and neutral palette as the
// previews of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const SURFACE = '#fafafa';
const FILL = '#d4d4d8';
const TEXT = '#71717a';
const HAIR = '#d4d4d8';
const INK = '#18181b';
const PRIMARY = '#3b82f6';

// Half circle: centre (100, 76), radius 42. The filled part ends at 37 %.
const TRACK = 'M58 76 A42 42 0 0 1 142 76';
const FILLED = 'M58 76 A42 42 0 0 1 83 37.6';
const STEPS = [34, 84, 134];

export function ImpactArcPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      {/* Header */}
      <rect x="90" y="10" width="20" height="2" rx="1" fill={PRIMARY} />
      <rect x="72" y="16" width="56" height="5" rx="1" fill={TEXT} />
      {/* Horizon and arc */}
      <line x1="16" y1="76" x2="184" y2="76" stroke={HAIR} strokeWidth="1" />
      <path d={TRACK} fill="none" stroke={HAIR} strokeWidth="1" />
      <path d={FILLED} fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" />
      <circle cx="83" cy="37.6" r="3" fill={PRIMARY} stroke={SURFACE} strokeWidth="1.5" />
      {/* Figure */}
      <rect x="88" y="52" width="24" height="8" rx="1" fill={INK} />
      <rect x="84" y="64" width="32" height="3" rx="1" fill={FILL} />
      {/* Steps */}
      {STEPS.map((x, i) => (
        <g key={x}>
          {i > 0 && <line x1={x - 9} y1="86" x2={x - 9} y2="106" stroke={HAIR} strokeWidth="1" />}
          <rect x={x} y="87" width="5" height="5" rx="1" fill={PRIMARY} />
          <rect x={x} y="96" width="30" height="3" rx="1" fill={TEXT} />
          <rect x={x} y="102" width="24" height="3" rx="1" fill={FILL} />
        </g>
      ))}
    </svg>
  );
}
