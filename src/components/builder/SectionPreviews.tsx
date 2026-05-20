// SVG illustrations of each section type. Used in the Add Section dialog so
// creators can recognise a section by its layout, not its name. Compact set
// for the SectionList rail too (smaller variant via `compact` prop).
//
// Design rules: 200×120 viewBox, neutral grays (#e4e4e7, #a1a1aa, #18181b),
// one accent color (#3b82f6) for buttons or highlights. Keeps the previews
// theme-agnostic so they look at home next to any theme.

import type { ReactElement, SVGProps } from 'react';

type PreviewProps = SVGProps<SVGSVGElement> & { compact?: boolean };

const VIEW = '0 0 200 120';
const SURFACE = '#fafafa';
const BORDER = '#e4e4e7';
const FILL = '#d4d4d8';
const TEXT = '#71717a';
const ACCENT = '#18181b';
const PRIMARY = '#3b82f6';

function Frame({ children, ...rest }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg viewBox={VIEW} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" {...rest}>
      <rect x="0" y="0" width="200" height="120" fill={SURFACE} />
      {children}
    </svg>
  );
}

// Tiny text bar — used everywhere we need to suggest "text". Coordinates
// accept either numbers or numeric strings so the literal-heavy preview
// markup below stays terse.
type NumLike = number | string;
function Bar({
  x,
  y,
  w,
  h = 3,
  c = FILL,
  r = 1,
}: {
  x: NumLike;
  y: NumLike;
  w: NumLike;
  h?: NumLike;
  c?: string;
  r?: NumLike;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={c} />;
}

// ── Per-section previews ────────────────────────────────────────

function HeroBannerPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="10" y="10" width="180" height="60" rx="3" fill={FILL} />
      <circle cx="100" cy="35" r="10" fill={BORDER} />
      <Bar x="60" y="78" w="80" h="5" c={ACCENT} />
      <Bar x="75" y="89" w="50" />
      <rect x="80" y="100" width="40" height="10" rx="2" fill={PRIMARY} />
    </Frame>
  );
}

function RichTextPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <Bar x="40" y="20" w="120" h="6" c={ACCENT} />
      <Bar x="25" y="36" w="150" />
      <Bar x="25" y="46" w="140" />
      <Bar x="25" y="56" w="148" />
      <Bar x="25" y="66" w="120" />
      <Bar x="25" y="80" w="150" />
      <Bar x="25" y="90" w="130" />
      <Bar x="25" y="100" w="100" />
    </Frame>
  );
}

function ImageGalleryPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <Bar x="60" y="14" w="80" h="5" c={ACCENT} />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={20 + col * 56}
            y={28 + row * 28}
            width="44"
            height="20"
            rx="2"
            fill={FILL}
          />
        )),
      )}
    </Frame>
  );
}

function ImageWithTextPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="14" y="22" width="80" height="76" rx="3" fill={FILL} />
      <Bar x="104" y="32" w="80" h="6" c={ACCENT} />
      <Bar x="104" y="48" w="80" />
      <Bar x="104" y="56" w="70" />
      <Bar x="104" y="64" w="76" />
      <rect x="104" y="80" width="44" height="10" rx="2" fill={PRIMARY} />
    </Frame>
  );
}

function FaqListPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <Bar x="60" y="12" w="80" h="5" c={ACCENT} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="20" y={26 + i * 21} width="160" height="16" rx="3" fill="white" stroke={BORDER} />
          <Bar x="28" y={32 + i * 21} w={i === 0 ? 110 : 80 + i * 10} c={TEXT} />
          <path d="M165 30 l4 4 l4 -4" stroke={TEXT} fill="none" strokeWidth="1.5" transform={`translate(0 ${i * 21})`} />
        </g>
      ))}
    </Frame>
  );
}

function CallToActionPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="20" y="20" width="160" height="80" rx="6" fill={ACCENT} />
      <Bar x="55" y="42" w="90" h="6" c="white" />
      <Bar x="65" y="58" w="70" c="#71717a" />
      <rect x="78" y="74" width="44" height="12" rx="2" fill="white" />
    </Frame>
  );
}

function TrustBadgesPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={12 + i * 46} y="32" width="40" height="56" rx="4" fill="white" stroke={BORDER} />
          <circle cx={32 + i * 46} cy="50" r="6" fill={PRIMARY} opacity="0.2" />
          <circle cx={32 + i * 46} cy="50" r="3" fill={PRIMARY} />
          <Bar x={18 + i * 46} y="64" w="28" h="3" c={ACCENT} />
          <Bar x={20 + i * 46} y="72" w="24" />
        </g>
      ))}
    </Frame>
  );
}

function LayoutColumnsPreview(props: PreviewProps) {
  // Two columns, each with a heading bar + text lines + a button — conveys
  // "page divided into columns of content blocks".
  const cols = [{ x: 16 }, { x: 104 }];
  return (
    <Frame {...props}>
      {cols.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y="18" width="80" height="84" rx="4" fill="white" stroke={BORDER} />
          <Bar x={c.x + 10} y="30" w="50" h="5" c={ACCENT} />
          <Bar x={c.x + 10} y="44" w="60" />
          <Bar x={c.x + 10} y="53" w="56" />
          <Bar x={c.x + 10} y="62" w="48" />
          <rect x={c.x + 10} y="78" width="40" height="12" rx="2" fill={PRIMARY} />
        </g>
      ))}
    </Frame>
  );
}

// ── Chrome previews (header / footer) ───────────────────────────

function AnnouncementBarPreview(props: PreviewProps) {
  // Filled strip with centered text — the chrome's most identifiable shape.
  return (
    <Frame {...props}>
      <rect x="0" y="0" width="200" height="22" fill={ACCENT} />
      <Bar x="50" y="10" w="80" h="3" c="white" />
      <Bar x="134" y="10" w="22" h="3" c="white" />
      <circle cx="188" cy="11" r="3" fill="white" opacity="0.5" />
      {/* Hint of header + page body below */}
      <rect x="0" y="22" width="200" height="20" fill="white" stroke={BORDER} />
      <rect x="10" y="28" width="10" height="8" rx="2" fill={ACCENT} />
      <Bar x="26" y="30" w="26" h="4" />
      <Bar x="60" y="30" w="14" />
      <Bar x="80" y="30" w="14" />
      <Bar x="50" y="60" w="100" h="4" c={FILL} />
      <Bar x="40" y="74" w="120" />
      <Bar x="40" y="84" w="120" />
    </Frame>
  );
}

function MegaMenuPreview(props: PreviewProps) {
  // Top bar with two triggers; an open panel hangs below showing two
  // columns of links + a feature image on the right.
  return (
    <Frame {...props}>
      <rect x="0" y="0" width="200" height="20" fill="white" stroke={BORDER} />
      <Bar x="60" y="9" w="20" h="3" c={ACCENT} />
      <Bar x="90" y="9" w="20" h="3" c={ACCENT} />
      <Bar x="120" y="9" w="20" h="3" />
      {/* Open panel */}
      <rect x="0" y="20" width="200" height="78" fill={SURFACE} stroke={BORDER} />
      {/* Column 1 */}
      <Bar x="14" y="32" w="32" h="3" c={ACCENT} />
      <Bar x="14" y="42" w="40" />
      <Bar x="14" y="50" w="36" />
      <Bar x="14" y="58" w="42" />
      {/* Column 2 */}
      <Bar x="68" y="32" w="32" h="3" c={ACCENT} />
      <Bar x="68" y="42" w="40" />
      <Bar x="68" y="50" w="34" />
      <Bar x="68" y="58" w="38" />
      {/* Feature image */}
      <rect x="124" y="30" width="60" height="56" rx="2" fill={FILL} />
      <rect x="124" y="72" width="60" height="14" fill={ACCENT} opacity="0.7" />
      <Bar x="130" y="78" w="34" h="3" c="white" />
    </Frame>
  );
}

function MobileBottomNavPreview(props: PreviewProps) {
  // Phone outline with five icon-labels at the bottom — instantly reads as
  // a mobile bottom tab bar.
  return (
    <Frame {...props}>
      {/* Phone outline */}
      <rect x="68" y="6" width="64" height="108" rx="8" fill="white" stroke={BORDER} strokeWidth="1.5" />
      <rect x="68" y="6" width="64" height="14" rx="8" fill={SURFACE} />
      <circle cx="100" cy="13" r="1.5" fill={TEXT} />
      {/* Page body */}
      <Bar x="76" y="30" w="48" />
      <Bar x="76" y="40" w="48" />
      <Bar x="76" y="50" w="36" />
      {/* Bottom tab bar */}
      <rect x="68" y="92" width="64" height="22" fill={SURFACE} stroke={BORDER} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={76 + i * 16} cy="100" r="2.5" fill={i === 0 ? PRIMARY : TEXT} opacity={i === 0 ? 1 : 0.6} />
          <rect x={73 + i * 16} y="105" width="6" height="1.5" rx="0.75" fill={TEXT} opacity="0.4" />
        </g>
      ))}
    </Frame>
  );
}

function HeaderBarPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      {/* Header bar across the top with logo on the left, nav in the middle,
          and three action icons on the right. The page body is hinted at by
          three faint bars below so the preview reads as "this is chrome". */}
      <rect x="0" y="0" width="200" height="32" fill="white" stroke={BORDER} />
      {/* Logo + store name */}
      <rect x="12" y="10" width="12" height="12" rx="2" fill={ACCENT} />
      <Bar x="28" y="13" w="32" h="6" c={ACCENT} />
      {/* Nav links */}
      <Bar x="78" y="14" w="18" />
      <Bar x="100" y="14" w="18" />
      <Bar x="122" y="14" w="18" />
      {/* Action icons */}
      <circle cx="160" cy="16" r="3" fill={TEXT} opacity="0.5" />
      <circle cx="172" cy="16" r="3" fill={TEXT} opacity="0.5" />
      <circle cx="184" cy="16" r="3" fill={TEXT} opacity="0.5" />
      {/* Page body hint */}
      <Bar x="50" y="60" w="100" h="4" c={FILL} />
      <Bar x="40" y="74" w="120" />
      <Bar x="40" y="84" w="120" />
      <Bar x="40" y="94" w="120" />
    </Frame>
  );
}

function FooterColumnsPreview(props: PreviewProps) {
  // 4 columns: each has a bold heading + 2-3 link bars beneath.
  const columns = [
    { x: 14 }, { x: 60 }, { x: 106 }, { x: 152 },
  ];
  return (
    <Frame {...props}>
      <rect x="0" y="0" width="200" height="120" fill="white" />
      {columns.map((c, i) => (
        <g key={i}>
          <Bar x={c.x} y={20} w={28} h={4} c={ACCENT} />
          <Bar x={c.x} y={34} w={32} />
          <Bar x={c.x} y={44} w={28} />
          <Bar x={c.x} y={54} w={30} />
          <Bar x={c.x} y={64} w={24} />
        </g>
      ))}
    </Frame>
  );
}

function CopyrightBarPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      {/* Just the very-bottom strip — text on the left, payment badges on
          the right — with a faint hint of the footer body above so the
          preview reads "this is the bottom of a footer". */}
      <rect x="0" y="0" width="200" height="80" fill={SURFACE} />
      <Bar x="20" y="20" w="80" />
      <Bar x="20" y="30" w="60" />
      <line x1="0" y1="80" x2="200" y2="80" stroke={BORDER} />
      <rect x="0" y="80" width="200" height="40" fill="white" />
      <Bar x="12" y="98" w="60" />
      {/* Payment badges */}
      <rect x="120" y="92" width="18" height="12" rx="2" fill={FILL} />
      <rect x="142" y="92" width="18" height="12" rx="2" fill={FILL} />
      <rect x="164" y="92" width="18" height="12" rx="2" fill={FILL} />
    </Frame>
  );
}

function SocialIconsPreview(props: PreviewProps) {
  // Five branded chips in a horizontal row — instantly recognisable as
  // social icons without needing the brand glyphs at this tiny size.
  const chips: { x: number; fill: string }[] = [
    { x: 30, fill: '#E4405F' }, // instagram pink
    { x: 60, fill: '#1877F2' }, // facebook blue
    { x: 90, fill: '#000000' }, // x black
    { x: 120, fill: '#25D366' }, // whatsapp green
    { x: 150, fill: '#FF0000' }, // youtube red
  ];
  return (
    <Frame {...props}>
      <Bar x="55" y="22" w="90" h="5" c={ACCENT} />
      <Bar x="70" y="34" w="60" />
      {chips.map((c, i) => (
        <g key={i}>
          <circle cx={c.x + 10} cy="72" r="11" fill={c.fill} />
          {/* tiny inner glyph dot — gives the chip a focal point without
              committing to a real glyph at preview resolution */}
          <circle cx={c.x + 10} cy="72" r="3.5" fill="white" />
        </g>
      ))}
    </Frame>
  );
}

function NewsletterSignupPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="14" y="18" width="172" height="84" rx="6" fill="white" stroke={BORDER} />
      <Bar x="55" y="32" w="90" h="6" c={ACCENT} />
      <Bar x="65" y="46" w="70" />
      <rect x="32" y="62" width="100" height="22" rx="4" fill={SURFACE} stroke={BORDER} />
      <Bar x="40" y="71" w="50" />
      <rect x="138" y="62" width="32" height="22" rx="4" fill={PRIMARY} />
    </Frame>
  );
}

function FeaturedProductsPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <Bar x="20" y="14" w="90" h="5" c={ACCENT} />
      <Bar x="160" y="15" w="22" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={14 + i * 45} y="30" width="40" height="50" rx="2" fill={FILL} />
          <Bar x={16 + i * 45} y="84" w="32" c={ACCENT} />
          <Bar x={16 + i * 45} y="93" w="20" c={PRIMARY} />
        </g>
      ))}
    </Frame>
  );
}

function ProductGalleryPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="20" y="14" width="160" height="76" rx="3" fill={FILL} />
      <circle cx="100" cy="52" r="14" fill={BORDER} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={28 + i * 36} y="96" width="28" height="16" rx="2" fill={FILL} stroke={i === 0 ? ACCENT : 'none'} strokeWidth="1.5" />
      ))}
    </Frame>
  );
}

function ProductDetailsPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="18" y="20" width="32" height="12" rx="2" fill={PRIMARY} opacity="0.2" />
      <Bar x="18" y="38" w="120" h="7" c={ACCENT} />
      <Bar x="18" y="50" w="80" h="5" c={PRIMARY} />
      <Bar x="18" y="68" w="160" />
      <Bar x="18" y="78" w="150" />
      <Bar x="18" y="88" w="140" />
      <Bar x="18" y="98" w="120" />
    </Frame>
  );
}

function ProductTabsPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="20" y="22" width="40" height="16" rx="2" fill="white" stroke={BORDER} />
      <Bar x="26" y="29" w="28" c={ACCENT} />
      <rect x="64" y="22" width="40" height="16" rx="2" fill="white" stroke={BORDER} />
      <Bar x="70" y="29" w="28" />
      <rect x="108" y="22" width="40" height="16" rx="2" fill="white" stroke={BORDER} />
      <Bar x="114" y="29" w="28" />
      <rect x="20" y="38" width="160" height="2" fill={ACCENT} />
      <Bar x="20" y="54" w="160" />
      <Bar x="20" y="64" w="140" />
      <Bar x="20" y="74" w="155" />
      <Bar x="20" y="84" w="120" />
      <Bar x="20" y="94" w="100" />
    </Frame>
  );
}

// Slider previews share the same visual language as their non-slider siblings,
// plus arrow chevrons on the sides and dot indicators at the bottom — the
// universal "this scrolls horizontally" cues.

function SliderArrows() {
  return (
    <>
      <circle cx="14" cy="60" r="6" fill="white" stroke={BORDER} />
      <path d="M16 56 l-3 4 l3 4" stroke={TEXT} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="186" cy="60" r="6" fill="white" stroke={BORDER} />
      <path d="M184 56 l3 4 l-3 4" stroke={TEXT} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function SliderDots({ count = 3, active = 0, y = 110 }: { count?: number; active?: number; y?: number }) {
  // Active dot is a stretched pill so it reads at-a-glance as the current slide.
  const total = count * 6 + (count - 1) * 3 + 4; // active dot is 4px wider
  const start = 100 - total / 2;
  let x = start;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        const w = isActive ? 10 : 6;
        const dot = <rect key={i} x={x} y={y - 2} width={w} height={4} rx={2} fill={isActive ? ACCENT : BORDER} />;
        x += w + 3;
        return dot;
      })}
    </>
  );
}

function HeroSliderPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      {/* Hero slide — full-width image with darkened overlay and centered text. */}
      <rect x="0" y="0" width="200" height="105" fill={FILL} />
      <rect x="0" y="0" width="200" height="105" fill={ACCENT} opacity="0.35" />
      <Bar x="55" y="40" w="90" h="6" c="white" />
      <Bar x="65" y="54" w="70" c="white" />
      <rect x="80" y="68" width="40" height="11" rx="2" fill={PRIMARY} />
      <SliderArrows />
      <SliderDots count={3} active={0} y={117} />
    </Frame>
  );
}

function GallerySliderPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      {/* Row of image tiles + a half-visible 4th tile on the right to convey "more". */}
      <Bar x="60" y="12" w="80" h="5" c={ACCENT} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={26 + i * 50} y="28" width="44" height="62" rx="3" fill={FILL} />
      ))}
      <rect x={26 + 3 * 50} y="28" width="20" height="62" rx="3" fill={FILL} opacity="0.5" />
      <SliderArrows />
      <SliderDots count={4} active={0} y={108} />
    </Frame>
  );
}

function ProductSliderPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      {/* Row of product cards (image + title bar + price). 4th card peeks. */}
      <Bar x="20" y="12" w="90" h="5" c={ACCENT} />
      <Bar x="160" y="13" w="22" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={20 + i * 50} y="28" width="44" height="48" rx="2" fill={FILL} />
          <Bar x={22 + i * 50} y="80" w="36" c={ACCENT} />
          <Bar x={22 + i * 50} y="88" w="22" c={PRIMARY} />
        </g>
      ))}
      <rect x={20 + 3 * 50} y="28" width="20" height="48" rx="2" fill={FILL} opacity="0.5" />
      <SliderArrows />
    </Frame>
  );
}

function AddToCartPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <Bar x="20" y="18" w="40" h="4" c={ACCENT} />
      {/* Color swatches */}
      <circle cx="28" cy="36" r="6" fill="#1f2937" stroke={ACCENT} strokeWidth="1.5" />
      <circle cx="46" cy="36" r="6" fill="#f87171" />
      <circle cx="64" cy="36" r="6" fill="#fbbf24" />
      <circle cx="82" cy="36" r="6" fill="#60a5fa" />
      <Bar x="20" y="54" w="32" h="4" c={ACCENT} />
      {/* Size pills */}
      {['S', 'M', 'L', 'XL'].map((_, i) => (
        <rect
          key={i}
          x={20 + i * 26}
          y="64"
          width="22"
          height="14"
          rx="2"
          fill="white"
          stroke={i === 1 ? ACCENT : BORDER}
          strokeWidth={i === 1 ? 1.5 : 1}
        />
      ))}
      <Bar x="20" y="88" w="44" h="5" c={PRIMARY} />
      {/* CTA */}
      <rect x="20" y="98" width="160" height="16" rx="3" fill={ACCENT} />
      <Bar x="80" y="104" w="40" h="4" c="white" />
    </Frame>
  );
}

// ── New content / social / layout previews ──────────────────

function TestimonialsPreview(props: PreviewProps) {
  // Three quote cards, each with a star row, a couple of text lines and an
  // avatar dot + name bar at the bottom.
  return (
    <Frame {...props}>
      <Bar x="60" y="12" w="80" h="5" c={ACCENT} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={12 + i * 60} y="28" width="52" height="80" rx="4" fill="white" stroke={BORDER} />
          {[0, 1, 2].map((s) => (
            <path
              key={s}
              d="M0 0 l1.4 2.8 l3.1 .4 l-2.2 2.2 .5 3.1 -2.8 -1.5 -2.8 1.5 .5 -3.1 -2.2 -2.2 3.1 -.4 z"
              transform={`translate(${18 + i * 60 + s * 8} 36) scale(0.7)`}
              fill={PRIMARY}
            />
          ))}
          <Bar x={18 + i * 60} y="52" w="40" c={TEXT} />
          <Bar x={18 + i * 60} y="60" w="36" c={TEXT} />
          <Bar x={18 + i * 60} y="68" w="28" c={TEXT} />
          <circle cx={24 + i * 60} cy="92" r="5" fill={FILL} />
          <Bar x={32 + i * 60} y="90" w="22" c={ACCENT} />
        </g>
      ))}
    </Frame>
  );
}

function LogoListPreview(props: PreviewProps) {
  // A caption bar, then a row of five faint logo placeholders.
  return (
    <Frame {...props}>
      <Bar x="65" y="20" w="70" h="4" c={TEXT} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={16 + i * 36} y="52" width="28" height="18" rx="3" fill={FILL} />
      ))}
    </Frame>
  );
}

function LogoMarqueePreview(props: PreviewProps) {
  // A caption bar, a row of logos clipped at the edges, with arrows hinting at
  // the auto-scroll motion.
  return (
    <Frame {...props}>
      <Bar x="65" y="18" w="70" h="4" c={TEXT} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={6 + i * 42} y="48" width="30" height="18" rx="3" fill={FILL} opacity={i === 0 || i === 4 ? 0.4 : 1} />
      ))}
      <path d="M150 57 l8 0 m-3 -3 l3 3 l-3 3" stroke={PRIMARY} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

function StickyCtaBarPreview(props: PreviewProps) {
  // A faint page behind, with a pinned bar at the bottom: text + button.
  return (
    <Frame {...props}>
      <Bar x="24" y="22" w="120" h="4" c={TEXT} />
      <Bar x="24" y="34" w="90" c="#a1a1aa" />
      <rect x="16" y="78" width="168" height="26" rx="6" fill={PRIMARY} />
      <Bar x="28" y="89" w="80" c="white" />
      <rect x="132" y="84" width="40" height="14" rx="7" fill={ACCENT} />
    </Frame>
  );
}

function StatsBarPreview(props: PreviewProps) {
  // Three big numbers with small labels beneath.
  return (
    <Frame {...props}>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={20 + i * 58} y="40" width="40" height="16" rx="2" fill={PRIMARY} opacity="0.85" />
          <Bar x={26 + i * 58} y="64" w="28" c={TEXT} />
        </g>
      ))}
    </Frame>
  );
}

function FeatureGridPreview(props: PreviewProps) {
  // Three columns, each: an icon chip + title bar + two body lines.
  return (
    <Frame {...props}>
      <Bar x="60" y="12" w="80" h="5" c={ACCENT} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={26 + i * 56} y="30" width="20" height="20" rx="5" fill={PRIMARY} opacity="0.2" />
          <circle cx={36 + i * 56} cy="40" r="4" fill={PRIMARY} />
          <Bar x={22 + i * 56} y="58" w="36" h="3" c={ACCENT} />
          <Bar x={22 + i * 56} y="68" w="32" c={TEXT} />
          <Bar x={22 + i * 56} y="76" w="26" c={TEXT} />
        </g>
      ))}
    </Frame>
  );
}

function StepsPreview(props: PreviewProps) {
  // Three numbered circles joined by a connector line, each with a title +
  // body line beneath — the "how it works" look.
  return (
    <Frame {...props}>
      <Bar x="70" y="14" w="60" h="5" c={ACCENT} />
      <line x1="40" y1="44" x2="160" y2="44" stroke={BORDER} strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={40 + i * 60} cy="44" r="11" fill={PRIMARY} />
          <text x={40 + i * 60} y="48" textAnchor="middle" fontSize="11" fill="white" fontWeight="700">
            {i + 1}
          </text>
          <Bar x={22 + i * 60} y="64" w="36" h="3" c={ACCENT} />
          <Bar x={26 + i * 60} y="74" w="28" c={TEXT} />
        </g>
      ))}
    </Frame>
  );
}

function ComparisonTablePreview(props: PreviewProps) {
  // A bordered table: header with one highlighted column, then rows of a
  // feature label plus a check (highlighted) and a cross (other) column.
  return (
    <Frame {...props}>
      <rect x="34" y="16" width="132" height="84" rx="5" fill="none" stroke={BORDER} />
      <rect x="120" y="16" width="46" height="84" fill={PRIMARY} opacity="0.07" />
      <rect x="120" y="16" width="46" height="14" fill={PRIMARY} opacity="0.85" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <Bar x="42" y={40 + i * 15} w="56" c={TEXT} />
          <path
            d={`M137 ${44 + i * 15} l3 3 l6 -7`}
            fill="none"
            stroke={PRIMARY}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M156 ${42 + i * 15} l7 7 M163 ${42 + i * 15} l-7 7`}
            stroke={TEXT}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.4"
          />
        </g>
      ))}
    </Frame>
  );
}

function CountdownPreview(props: PreviewProps) {
  // A heading, then four boxed digit pairs with unit captions — the classic
  // days/hours/minutes/seconds look.
  return (
    <Frame {...props}>
      <Bar x="65" y="22" w="70" h="5" c={ACCENT} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={26 + i * 38} y="46" width="30" height="32" rx="4" fill={SURFACE} stroke={BORDER} />
          <Bar x={32 + i * 38} y="58" w="18" h="6" c={PRIMARY} r={1.5} />
          <Bar x={34 + i * 38} y="84" w="14" c={TEXT} />
        </g>
      ))}
    </Frame>
  );
}

function VideoPreview(props: PreviewProps) {
  // A 16:9 frame with a centered play triangle in a circle.
  return (
    <Frame {...props}>
      <rect x="24" y="20" width="152" height="80" rx="4" fill={FILL} />
      <circle cx="100" cy="60" r="16" fill="white" opacity="0.9" />
      <path d="M96 52 l12 8 l-12 8 z" fill={PRIMARY} />
    </Frame>
  );
}

function SpacerPreview(props: PreviewProps) {
  // Two faint content blocks with a divider line in the gap between them —
  // reads as "space between sections".
  return (
    <Frame {...props}>
      <rect x="20" y="14" width="160" height="30" rx="3" fill={SURFACE} stroke={BORDER} />
      <line x1="40" y1="60" x2="160" y2="60" stroke={FILL} strokeWidth="1.5" strokeDasharray="4 3" />
      <rect x="20" y="76" width="160" height="30" rx="3" fill={SURFACE} stroke={BORDER} />
    </Frame>
  );
}

function CollectionProductsPreview(props: PreviewProps) {
  // Same product-grid language as featured products, with a small "category"
  // tag at the top-left to hint the source.
  return (
    <Frame {...props}>
      <rect x="14" y="12" width="34" height="10" rx="5" fill={PRIMARY} opacity="0.2" />
      <Bar x="160" y="14" w="22" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={14 + i * 45} y="30" width="40" height="50" rx="2" fill={FILL} />
          <Bar x={16 + i * 45} y="84" w="32" c={ACCENT} />
          <Bar x={16 + i * 45} y="93" w="20" c={PRIMARY} />
        </g>
      ))}
    </Frame>
  );
}

function ProductPagePreview(props: PreviewProps) {
  // Full product body: big gallery on the left; on the right a title bar,
  // price, two bundle rows, colour swatches and an add-to-cart button —
  // the at-a-glance shape of the complete product page.
  return (
    <Frame {...props}>
      {/* Gallery */}
      <rect x="10" y="12" width="86" height="86" rx="3" fill={FILL} />
      <circle cx="53" cy="55" r="14" fill={BORDER} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={10 + i * 22} y="102" width="18" height="12" rx="2" fill={FILL} stroke={i === 0 ? ACCENT : 'none'} />
      ))}
      {/* Info column */}
      <Bar x="104" y="14" w="40" h="3" c={PRIMARY} />
      <Bar x="104" y="22" w="80" h="6" c={ACCENT} />
      <Bar x="104" y="34" w="40" h="6" c={PRIMARY} />
      {/* Bundle rows */}
      <rect x="104" y="46" width="86" height="13" rx="3" fill="white" stroke={BORDER} />
      <circle cx="111" cy="52.5" r="2.5" fill="none" stroke={TEXT} />
      <Bar x="118" y="51" w="40" c={TEXT} />
      <rect x="104" y="62" width="86" height="13" rx="3" fill="white" stroke={PRIMARY} />
      <circle cx="111" cy="68.5" r="2.5" fill={PRIMARY} />
      <Bar x="118" y="67" w="40" c={ACCENT} />
      {/* Swatches */}
      {['#eab308', '#ef4444', '#06b6d4', '#22c55e'].map((c, i) => (
        <circle key={i} cx={110 + i * 12} cy="84" r="4.5" fill={c} />
      ))}
      {/* Add to cart */}
      <rect x="104" y="94" width="86" height="14" rx="7" fill={ACCENT} />
      <Bar x="132" y="100" w="30" h="3" c="white" />
    </Frame>
  );
}

// ── Generic fallback ────────────────────────────────────────

function GenericPreview(props: PreviewProps) {
  return (
    <Frame {...props}>
      <rect x="20" y="20" width="160" height="80" rx="4" fill="white" stroke={BORDER} strokeDasharray="3 3" />
      <Bar x="60" y="50" w="80" h="6" c={TEXT} />
      <Bar x="70" y="64" w="60" />
    </Frame>
  );
}

// ── Registry + lookup ───────────────────────────────────────

const PREVIEW_MAP: Record<string, (p: PreviewProps) => ReactElement> = {
  'hero-banner': HeroBannerPreview,
  'hero-slider': HeroSliderPreview,
  'rich-text': RichTextPreview,
  'image-gallery': ImageGalleryPreview,
  'gallery-slider': GallerySliderPreview,
  'image-with-text': ImageWithTextPreview,
  'faq-list': FaqListPreview,
  'call-to-action': CallToActionPreview,
  'trust-badges': TrustBadgesPreview,
  'testimonials': TestimonialsPreview,
  'logo-list': LogoListPreview,
  'logo-marquee': LogoMarqueePreview,
  'sticky-cta-bar': StickyCtaBarPreview,
  'stats-bar': StatsBarPreview,
  'feature-grid': FeatureGridPreview,
  'steps': StepsPreview,
  'comparison-table': ComparisonTablePreview,
  'countdown': CountdownPreview,
  'video': VideoPreview,
  'spacer': SpacerPreview,
  'layout-columns': LayoutColumnsPreview,
  'collection-products': CollectionProductsPreview,
  'newsletter-signup': NewsletterSignupPreview,
  'social-icons': SocialIconsPreview,
  'header-bar': HeaderBarPreview,
  'footer-columns': FooterColumnsPreview,
  'copyright-bar': CopyrightBarPreview,
  'announcement-bar': AnnouncementBarPreview,
  'mega-menu': MegaMenuPreview,
  'mobile-bottom-nav': MobileBottomNavPreview,
  'featured-products': FeaturedProductsPreview,
  'product-slider': ProductSliderPreview,
  'product-page': ProductPagePreview,
  'product-gallery': ProductGalleryPreview,
  'product-details': ProductDetailsPreview,
  'product-tabs': ProductTabsPreview,
  'add-to-cart': AddToCartPreview,
};

interface SectionPreviewProps {
  sectionKey: string;
  className?: string;
  compact?: boolean;
}

export function SectionPreview({ sectionKey, className, compact }: SectionPreviewProps) {
  const Preview = PREVIEW_MAP[sectionKey] || GenericPreview;
  return (
    <Preview
      className={className}
      // Compact rail icons get a smaller intrinsic size; tiles get larger.
      width={compact ? 32 : undefined}
      height={compact ? 20 : undefined}
    />
  );
}
