// Tiny in-memory channel for the "the URL was saved as …" notice. Forms that
// navigate away right after a save (create screens) still get the notice:
// the listener lives in the app shell, which survives client-side
// navigation, and an event nobody received yet is handed to the next
// listener that subscribes shortly after (e.g. the page builder, which has
// its own layout).

export interface SlugAdjustedEvent {
  /** The slug the server stored (decoded, readable). */
  slug: string;
}

type Listener = (e: SlugAdjustedEvent) => void;
const listeners = new Set<Listener>();
const PENDING_TTL_MS = 10_000;
let pending: { event: SlugAdjustedEvent; at: number } | null = null;

/**
 * Shows the notice; kept briefly when no listener is mounted. With
 * `nextScreen` it is always kept for the next listener (use it right before
 * navigating to a screen outside the app shell, such as the page builder).
 */
export function announceSlugAdjusted(slug: string, opts: { nextScreen?: boolean } = {}): void {
  const event = { slug };
  if (opts.nextScreen || listeners.size === 0) {
    pending = { event, at: Date.now() };
    return;
  }
  pending = null;
  for (const l of listeners) l(event);
}

/** Subscribes to notices; returns the unsubscribe function. */
export function onSlugAdjusted(listener: Listener): () => void {
  listeners.add(listener);
  if (pending) {
    const { event, at } = pending;
    pending = null;
    if (Date.now() - at < PENDING_TTL_MS) listener(event);
  }
  return () => {
    listeners.delete(listener);
  };
}
