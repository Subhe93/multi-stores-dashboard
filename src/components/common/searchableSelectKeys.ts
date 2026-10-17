/**
 * Keyboard model of `SearchableSelect` (E15), kept free of React so it can be
 * unit-tested with `node --test` (see `searchableSelectKeys.test.mjs`).
 *
 * The state is the open flag plus the index of the highlighted option in the
 * *filtered* list (`-1` = none). The reducer never selects on its own: when a
 * key commits an option it reports the index in `commit` and the component
 * fires `onChange` with that option.
 */

export interface SelectKeyState {
  open: boolean;
  /** Highlighted index within the filtered options, -1 for none. */
  activeIndex: number;
}

export interface SelectKeyInput {
  /** `KeyboardEvent.key`. */
  key: string;
  /** Number of filtered options currently rendered. */
  count: number;
  /** Index of the selected value within the filtered options, -1 if absent. */
  selectedIndex: number;
}

export interface SelectKeyResult extends SelectKeyState {
  /** True when the key was consumed (the caller should `preventDefault`). */
  handled: boolean;
  /** Index of the option to select, when a key committed one. */
  commit?: number;
  /** True when the trigger button should receive focus back (Escape). */
  refocusTrigger?: boolean;
}

export const INITIAL_SELECT_KEY_STATE: SelectKeyState = { open: false, activeIndex: -1 };

const clamp = (i: number, count: number): number => (count <= 0 ? -1 : Math.min(Math.max(i, 0), count - 1));

/** Highlight to use when the list opens: the selected option, else the first one. */
export const openingIndex = (selectedIndex: number, count: number): number =>
  selectedIndex >= 0 && selectedIndex < count ? selectedIndex : clamp(0, count);

/** Pure keyboard reducer; see the module comment. */
export function selectKeyReducer(state: SelectKeyState, input: SelectKeyInput): SelectKeyResult {
  const { key, count, selectedIndex } = input;

  if (!state.open) {
    // Closed: the arrows (and Enter / Space on the trigger) open the list.
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
      return { open: true, activeIndex: openingIndex(selectedIndex, count), handled: true };
    }
    return { ...state, handled: false };
  }

  switch (key) {
    case 'ArrowDown':
      return { open: true, activeIndex: state.activeIndex < 0 ? clamp(0, count) : clamp(state.activeIndex + 1, count), handled: true };
    case 'ArrowUp':
      return { open: true, activeIndex: state.activeIndex < 0 ? clamp(count - 1, count) : clamp(state.activeIndex - 1, count), handled: true };
    case 'Home':
      return { open: true, activeIndex: clamp(0, count), handled: true };
    case 'End':
      return { open: true, activeIndex: clamp(count - 1, count), handled: true };
    case 'Enter': {
      const i = state.activeIndex;
      if (i >= 0 && i < count) return { open: false, activeIndex: -1, handled: true, commit: i, refocusTrigger: true };
      // Nothing highlighted (e.g. no results): swallow the key, keep the list open.
      return { ...state, handled: true };
    }
    case 'Escape':
      return { open: false, activeIndex: -1, handled: true, refocusTrigger: true };
    case 'Tab':
      // Close and let the browser move focus on.
      return { open: false, activeIndex: -1, handled: false };
    default:
      return { ...state, handled: false };
  }
}

/** Keeps the highlight valid after the filtered list changes (typing in the search box). */
export function clampActiveIndex(activeIndex: number, count: number): number {
  if (count <= 0) return -1;
  if (activeIndex < 0) return 0;
  return Math.min(activeIndex, count - 1);
}
