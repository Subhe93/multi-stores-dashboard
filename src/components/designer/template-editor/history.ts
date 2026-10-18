// Pure undo / redo history of the template editor. Bounded to HISTORY_LIMIT
// steps; pushes that carry the same `key` as the previous push coalesce
// (a continuous drag or a typed number is one undo step). No React, no DOM.

export const HISTORY_LIMIT = 100;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Coalescing key of the last push; null after undo / redo / reset. */
  key: string | null;
}

export function historyInit<T>(present: T): History<T> {
  return { past: [], present, future: [] as T[], key: null };
}

/**
 * A new present. With `key` equal to the previous push's key the step is
 * merged (the past is not extended); otherwise the old present joins the
 * past and the future is dropped.
 */
export function historyPush<T>(h: History<T>, next: T, key: string | null = null): History<T> {
  if (key !== null && key === h.key) return { ...h, present: next, future: [] };
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, present: next, future: [], key };
}

export function historyUndo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const past = h.past.slice(0, -1);
  return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: null };
}

export function historyRedo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [present, ...future] = h.future;
  return { past: [...h.past, h.present], present, future, key: null };
}

/** Replaces the present and forgets everything (a freshly loaded template). */
export function historyReset<T>(h: History<T>, present: T): History<T> {
  void h;
  return historyInit(present);
}

/** Ends a coalescing run: the next push with the same key starts a new step. */
export function historySeal<T>(h: History<T>): History<T> {
  return h.key === null ? h : { ...h, key: null };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;
