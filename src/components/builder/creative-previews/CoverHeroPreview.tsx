// Palette thumbnail of "cover-hero": a masthead line with a seal on it, a
// text block at the start, a tall photograph with a woven edge and a small
// photograph with its caption, lower than the large one. Same drawing rules
// as SectionPreviews.tsx (200 x 120 view box, neutral greys, one accent).

import type { SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const SURFACE = '#fafafa';
const BORDER = '#e4e4e7';
const FILL = '#d4d4d8';
const TEXT = '#71717a';
const ACCENT = '#18181b';
const PRIMARY = '#3b82f6';

export function CoverHeroPreview({ compact: _compact, ...rest }: PreviewProps) {
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      {/* Masthead: two small labels on a hairline. */}
      <rect x="14" y="12" width="22" height="2.5" rx="1" fill={TEXT} />
      <rect x="164" y="12" width="22" height="2.5" rx="1" fill={TEXT} />
      <rect x="14" y="19" width="172" height="0.8" fill={BORDER} />
      {/* Text block: eyebrow, heading, rule, body, two buttons. */}
      <rect x="14" y="50" width="18" height="2.5" rx="1" fill={PRIMARY} />
      <rect x="14" y="58" width="58" height="6" rx="1" fill={ACCENT} />
      <rect x="14" y="68" width="44" height="6" rx="1" fill={ACCENT} />
      <rect x="14" y="80" width="10" height="1.2" fill={PRIMARY} />
      <rect x="14" y="86" width="62" height="2.5" rx="1" fill={FILL} />
      <rect x="14" y="92" width="50" height="2.5" rx="1" fill={FILL} />
      <rect x="14" y="101" width="26" height="9" rx="1.5" fill={PRIMARY} />
      <rect x="44" y="101" width="28" height="9" rx="1.5" fill="none" stroke={TEXT} strokeWidth="1" />
      {/* Large photograph standing on the bottom edge, woven edge before it. */}
      <rect x="104" y="23" width="52" height="97" fill={FILL} />
      <rect x="100.5" y="23" width="2.5" height="97" fill={PRIMARY} opacity="0.55" />
      <circle cx="130" cy="56" r="9" fill={BORDER} />
      {/* Seal on the masthead line, over the photograph corner. */}
      <circle cx="104" cy="19.4" r="8" fill={SURFACE} />
      <circle cx="104" cy="19.4" r="5.5" fill={PRIMARY} />
      {/* Small photograph, lower, with its caption. */}
      <rect x="162" y="60" width="24" height="32" fill={FILL} />
      <rect x="162" y="96" width="14" height="2" rx="1" fill={TEXT} />
      <rect x="162" y="101" width="22" height="2.5" rx="1" fill={ACCENT} />
    </svg>
  );
}
