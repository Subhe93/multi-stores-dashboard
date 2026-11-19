// Palette thumbnail of "hero-dawn": a dark sky with a rayed sun rising behind
// a ridge, an arch photo in front of it, a small card, the copy on the
// inline start and a light curved edge closing the frame. Same 200 x 120
// frame and neutral palette as the previews of SectionPreviews.tsx.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const NIGHT = '#18181b';
const GROUND = '#27272a';
const LIGHT = '#fafafa';
const MUTED = '#a1a1aa';
const PRIMARY = '#3b82f6';
const PHOTO = '#52525b';

export function HeroDawnPreview({ compact: _compact, ...rest }: PreviewProps): ReactElement {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return (
      <line
        key={i}
        x1={(138 + c * 26).toFixed(1)}
        y1={(70 + s * 26).toFixed(1)}
        x2={(138 + c * 36).toFixed(1)}
        y2={(70 + s * 36).toFixed(1)}
        stroke={PRIMARY}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
    );
  });
  return (
    <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={NIGHT} />
      <circle cx="138" cy="70" r="46" fill={PRIMARY} opacity="0.12" />
      {rays}
      <circle cx="138" cy="70" r="20" fill={PRIMARY} />
      <path d="M0 96C40 92 80 84 120 76C150 70 176 78 200 84V120H0Z" fill={GROUND} />
      <path d="M0 96C40 92 80 84 120 76C150 70 176 78 200 84" fill="none" stroke={PRIMARY} strokeWidth="0.6" opacity="0.7" />
      <path d="M120 120V82a18 18 0 0 1 36 0V120Z" fill={PHOTO} />
      <rect x="106" y="86" width="14" height="18" fill={MUTED} stroke={PRIMARY} strokeWidth="0.5" />
      <rect x="14" y="30" width="10" height="1" fill={PRIMARY} />
      <rect x="27" y="29" width="24" height="3" rx="1" fill={PRIMARY} />
      <rect x="14" y="38" width="60" height="6" rx="1" fill={LIGHT} />
      <rect x="14" y="47" width="48" height="6" rx="1" fill={PRIMARY} />
      <rect x="14" y="58" width="56" height="2.5" rx="1" fill={MUTED} />
      <rect x="14" y="63" width="44" height="2.5" rx="1" fill={MUTED} />
      <rect x="14" y="72" width="26" height="8" rx="1.5" fill={PRIMARY} />
      <rect x="45" y="75" width="20" height="2.5" rx="1" fill={LIGHT} />
      <path d="M0 112C30 109 60 112 100 108C140 104 170 109 200 106V120H0Z" fill={LIGHT} />
    </svg>
  );
}
