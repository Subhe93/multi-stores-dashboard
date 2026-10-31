'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  initialSlugState,
  slugFromText,
  slugProblem,
  slugStateOnBlur,
  slugStateOnInput,
  slugWasAdjusted,
  type SlugFieldState,
} from '@/lib/slug';
import { announceSlugAdjusted } from '@/lib/slugNotice';

/**
 * WordPress-like slug input:
 * - follows the title while the slug is new / empty and the user has not
 *   edited it (an existing slug never changes when the title does);
 * - free typing, sanitized (WP sanitize_title) on blur and on submit;
 * - after a save, `applySaved` shows the slug the server stored and a notice
 *   when it differs from what was sent (e.g. a `-2` suffix).
 */
export function useSlugField({ title, locale }: { title: string; locale?: string | null }) {
  const [state, setState] = useState<SlugFieldState>(() => initialSlugState());

  // While following the title the slug is derived during render, so it can
  // never lag behind the title.
  const effective = useMemo<SlugFieldState>(
    () => (state.auto ? { ...state, value: slugFromText(title, locale) } : state),
    [state, title, locale],
  );

  /** Loads a stored slug (edit screens); an empty one follows the title. */
  const reset = useCallback((existing?: string | null) => setState(initialSlugState(existing)), []);

  const onChange = useCallback(
    (e: { target: { value: string } }) => setState((s) => slugStateOnInput(s, e.target.value)),
    [],
  );

  const onBlur = useCallback(() => setState(slugStateOnBlur(effective, title, locale)), [effective, title, locale]);

  /** Sanitizes for submit, commits it to the input, and returns the slug to send. */
  const finalize = useCallback((): string => {
    const next = slugStateOnBlur(effective, title, locale);
    setState(next);
    return next.value;
  }, [effective, title, locale]);

  /** Shows the slug the server stored; notices when it differs from `sent`. */
  const applySaved = useCallback((stored: string | null | undefined, sent: string) => {
    if (!stored) return;
    setState({ value: stored, auto: false, typed: false });
    if (slugWasAdjusted(sent, stored)) announceSlugAdjusted(stored);
  }, []);

  /** Back to following the title (the "regenerate" button). */
  const regenerate = useCallback(() => setState({ value: '', auto: true, typed: false }), []);

  return {
    value: effective.value,
    auto: effective.auto,
    /** The sanitized slug that a save would send right now (for previews). */
    preview: slugStateOnBlur(effective, title, locale).value,
    problem: slugProblem(effective, title, locale),
    inputProps: { value: effective.value, onChange, onBlur },
    reset,
    finalize,
    applySaved,
    regenerate,
  };
}

/** Announces the notice for forms that keep several slugs (per-locale rows). */
export function noticeIfSlugAdjusted(sent: string | null | undefined, stored: string | null | undefined): void {
  if (stored && slugWasAdjusted(sent, stored)) announceSlugAdjusted(stored);
}
