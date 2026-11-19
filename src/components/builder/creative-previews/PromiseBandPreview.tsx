// Palette thumbnail of "promise-band": a small centred heading, a horizon
// line with a small sun on it, then three promises side by side (line icon,
// title, short underline, text) split by thin dividers. Same 200 x 120 frame
// and neutral palette as the previews of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const SURFACE = '#fafafa';
const FILL = '#d4d4d8';
const TEXT = '#71717a';
const ACCENT = '#18181b';
const PRIMARY = '#3b82f6';

export function PromiseBandPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      <rect x="78" y="16" width="44" height="3" rx="1" fill={PRIMARY} />
      <rect x="12" y="31" width="176" height="0.8" fill={PRIMARY} opacity="0.7" />
      <circle cx="58" cy="31.4" r="3" fill={ACCENT} />
      {[0, 1, 2].map((i) => {
        const x = 14 + i * 62;
        return (
          <g key={i}>
            {i > 0 ? <rect x={x - 6} y="44" width="0.6" height="60" fill={FILL} /> : null}
            <circle cx={x + 8} cy="54" r="7" fill="none" stroke={ACCENT} strokeWidth="1" />
            <path d={`M${x + 4} 54a4 4 0 0 1 8 0`} fill="none" stroke={PRIMARY} strokeWidth="1.2" />
            <rect x={x + 40} y="47" width="8" height="2.5" rx="1" fill={PRIMARY} />
            <rect x={x} y="70" width="44" height="5" rx="1" fill={ACCENT} />
            <rect x={x} y="79" width="14" height="0.8" fill={PRIMARY} />
            <rect x={x} y="86" width="46" height="2.5" rx="1" fill={TEXT} />
            <rect x={x} y="92" width="34" height="2.5" rx="1" fill={TEXT} />
          </g>
        );
      })}
    </svg>
  );
}
