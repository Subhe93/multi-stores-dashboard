'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const INTERACTION_EVENTS = ['keydown', 'pointerdown', 'paste', 'drop'] as const;

/**
 * Unsaved-changes tracking for an editor form.
 *
 * `snapshot` is a serialisation of everything a save would send (null while
 * the record is loading). The form is dirty when it differs from the last
 * saved snapshot.
 *
 * Forms normalise data after load (rich-text editors re-emit their HTML,
 * pickers realign a primary id once their data arrives, the variant manager
 * regenerates rows, ...). Until the user interacts with the page (key,
 * pointer, paste, drop), the baseline therefore follows the snapshot, so those
 * load-time adjustments never count as changes. The same applies right after
 * a save, so a post-save reload is absorbed too.
 */
export function useDirtyTracker(snapshot: string | null) {
  // While following, the baseline is implicitly the current snapshot; it is
  // frozen (copied from latestRef) on the first user interaction.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  const latestRef = useRef<string | null>(snapshot);
  // Number of user interactions so far; lets markSaved tell whether the user
  // kept editing while the save request was in flight.
  const interactions = useRef(0);

  useEffect(() => {
    latestRef.current = snapshot;
  });

  const ready = snapshot !== null;
  useEffect(() => {
    if (!ready) return;
    const onInteract = () => {
      interactions.current += 1;
      if (!followingRef.current) return;
      followingRef.current = false;
      setBaseline(latestRef.current);
      setFollowing(false);
    };
    INTERACTION_EVENTS.forEach((e) => document.addEventListener(e, onInteract, true));
    return () => INTERACTION_EVENTS.forEach((e) => document.removeEventListener(e, onInteract, true));
  }, [ready]);

  /** Interaction count to pass back to markSaved (read when a save starts). */
  const saveToken = useCallback(() => interactions.current, []);

  /**
   * Record a successful save of `savedSnapshot` (the snapshot taken when the
   * save started). If the user did not touch the page meanwhile, the baseline
   * follows again so a post-save reload / id adoption stays clean.
   */
  const markSaved = useCallback((savedSnapshot: string | null, token: number) => {
    if (savedSnapshot !== null) setBaseline(savedSnapshot);
    if (interactions.current === token) {
      followingRef.current = true;
      setFollowing(true);
    }
  }, []);

  const dirty = !following && snapshot !== null && baseline !== null && snapshot !== baseline;
  return { dirty, saveToken, markSaved };
}

/** Warn before closing / reloading the tab while `active`. */
export function useBeforeUnloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}

/** JSON with object keys sorted, so key order never makes two states differ. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return v;
  });
}

const htmlText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Rich-text canonicaliser. The Tiptap editor re-emits stored HTML in its own
 * form whenever its content is set programmatically (first render, switching
 * the locale tab), e.g. `Hello` → `<p>Hello</p>`. Such emissions are learnt
 * here (normalised → original) so they compare equal to the stored value.
 * An emission counts as programmatic when no contenteditable has focus and
 * the visible text is unchanged; anything typed is a real change.
 */
export function createHtmlCanon() {
  const map = new Map<string, string>();
  return {
    /** Call from the editor's onChange with the field's previous value. */
    learn(prev: string | undefined, next: string) {
      const before = prev ?? '';
      if (before === next || map.has(next)) return;
      const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
      if (active?.isContentEditable) return;
      if (htmlText(before) !== htmlText(next)) return;
      map.set(next, map.get(before) ?? before);
    },
    canon(value: string | undefined): string {
      const v = value ?? '';
      return map.get(v) ?? v;
    },
  };
}
