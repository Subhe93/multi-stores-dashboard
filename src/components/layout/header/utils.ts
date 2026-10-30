/** Up to two initials from a display name, e.g. "Noroj Store" -> "NS". */
export function initialsOf(name: string | undefined, fallback = '?'): string {
  const words = (name ?? '').trim().split(/[\s@._-]+/).filter(Boolean);
  if (words.length === 0) return fallback;
  const first = Array.from(words[0])[0] ?? '';
  const second = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return (first + second).toUpperCase() || fallback;
}

/** True when keyboard focus is in a text field, so single-key shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
  }
  return false;
}

/** Shared focus ring for controls on the dark top bar. */
export const DARK_FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';
