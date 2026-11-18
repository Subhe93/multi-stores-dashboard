// Palette thumbnail of "script-manifesto": a dark band, a small mark, four
// ruled rows with a language label each; the first row is strong and has the
// accent bar, the others are quiet. Same 200 x 120 frame and neutral palette
// as the previews of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const BAND = '#18181b';
const INK = '#fafafa';
const QUIET = '#71717a';
const HAIR = '#3f3f46';
const PRIMARY = '#3b82f6';

// Row tops; the third row is a right-to-left sentence (it starts at the right).
const ROWS = [
  { y: 34, w: 84, strong: true, rtl: false },
  { y: 54, w: 70, strong: false, rtl: false },
  { y: 70, w: 62, strong: false, rtl: true },
  { y: 86, w: 66, strong: false, rtl: false },
];

export function ScriptManifestoPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={BAND} />
      <circle cx="100" cy="17" r="5" fill="none" stroke={INK} strokeWidth="1" />
      <circle cx="100" cy="17" r="1.5" fill={INK} />
      {ROWS.map((row) => {
        const h = row.strong ? 6 : 3;
        const x = row.rtl ? 160 - row.w : 68;
        return (
          <g key={row.y}>
            <rect x="40" y={row.y - 6} width="120" height="0.75" fill={HAIR} />
            <rect x="40" y={row.y + (row.strong ? 1.5 : 0)} width="16" height="2" rx="1" fill={QUIET} />
            <rect x={x} y={row.y} width={row.w} height={h} rx="1" fill={row.strong ? INK : QUIET} />
            {row.strong ? <rect x="35" y={row.y - 1} width="1.5" height="8" fill={PRIMARY} /> : null}
          </g>
        );
      })}
      <rect x="40" y="98" width="120" height="0.75" fill={HAIR} />
      <rect x="86" y="106" width="28" height="2" rx="1" fill={INK} />
    </svg>
  );
}

export default ScriptManifestoPreview;
