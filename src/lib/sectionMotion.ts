// Per-section motion override (section.settings._style.motion). The store's
// motion style treats every section automatically; one section can opt out.
//   _style.motion - 'none'; absent = automatic (never stored as 'auto')
// Mirrors SectionStyle.motion in multi-stores-web/src/themes/sectionStyle.ts:
// only the exact string 'none' switches a section off.

export type SectionMotionChoice = 'auto' | 'none';

/** The two choices of the style panel, in display order. */
export const SECTION_MOTION_CHOICES: readonly SectionMotionChoice[] = ['auto', 'none'];

type StyleLike = { motion?: unknown };

/** 'none' only for the stored string 'none'; unset and junk read as automatic. */
export function sectionMotionValue(style: StyleLike | null | undefined): SectionMotionChoice {
  return style?.motion === 'none' ? 'none' : 'auto';
}

/**
 * Copy of `style` with the override set. 'none' stores `motion: 'none'`;
 * anything else removes the key, so an untouched section keeps its style
 * object deep-equal to the input.
 */
export function withSectionMotion<T extends object>(style: T | null | undefined, choice: string): T {
  const next = { ...(style || {}) } as T & StyleLike;
  if (choice === 'none') next.motion = 'none';
  else delete next.motion;
  return next;
}
