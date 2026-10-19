'use client';

import { useReducer } from 'react';
import type { DesignElement, TemplateSpecV1 } from '@multi-stores/core/designer';
import type { TemplateAssetKind, TemplateDetail } from '@/lib/designer/designer.api';
import { cloneSpec, type EditorArea } from '@/lib/designer/templateSpec';
import { historyPush, historyRedo, historyUndo, type History } from './history';
import type { Issue } from './specIssues';

export type SideTab = EditorArea | 'versions';
export type SizeKey = 'width' | 'height' | 'bleed_mm';
export type Busy = 'save' | 'publish' | 'status' | 'delete' | null;
export interface Picker {
  kind: TemplateAssetKind;
  target: 'web' | 'print' | 'new-deco' | number;
}
export interface PreviewProblems {
  missing: string[];
  fonts: string[];
}

/** Everything the editor edits (E18: one reducer instead of ~20 `useState`s). */
export interface TemplateEditorState {
  detail: TemplateDetail | null;
  loadError: string | null;
  spec: TemplateSpecV1 | null;
  /**
   * Undo / redo of the working spec (bounded to HISTORY_LIMIT). `historyKey`
   * is the coalescing key of the last `updateSpec` (a drag, a typed number):
   * the same key merges into the previous step instead of adding one.
   */
  past: TemplateSpecV1[];
  future: TemplateSpecV1[];
  historyKey: string | null;
  /** JSON of the last saved spec; `dirty` compares against it. */
  baseJson: string;
  name: string;
  /**
   * E21: the trim-size inputs keep what was typed; the spec only takes
   * finite numbers, so a half-typed value never yields `NaN×NaN mm`.
   */
  sizeDrafts: Record<SizeKey, string>;
  sideTab: SideTab;
  selected: number | null;
  issues: Issue[];
  busy: Busy;
  actionError: string | null;
  picker: Picker | null;
  confirmDelete: boolean;
  /** 409 DESIGNER_TEMPLATE_LINKED: products still linked when archiving / unpublishing. */
  linkedCount: number | null;
  loadingVersion: string | null;
  // Preview options.
  previewPrint: boolean;
  samplePhoto: boolean;
  sampleTexts: Record<string, string>;
  previewProblems: PreviewProblems;
  /** E9: in-app link the creator clicked while dirty, awaiting confirmation. */
  leaveTo: string | null;
}

export type TemplateEditorPatch = Partial<Omit<TemplateEditorState, 'spec' | 'sizeDrafts' | 'sampleTexts' | 'past' | 'future' | 'historyKey'>>;
type Patch = TemplateEditorPatch;

export type TemplateEditorAction =
  | { type: 'patch'; patch: Patch }
  /** A loaded / saved template: name, spec and the dirty baseline. */
  | { type: 'adopt'; detail: TemplateDetail }
  /** A version loaded into the working copy (not the baseline). */
  | { type: 'loadSpec'; spec: TemplateSpecV1 }
  /** `coalesce`: pushes sharing this key with the previous one form a single undo step. */
  | { type: 'updateSpec'; fn: (s: TemplateSpecV1) => TemplateSpecV1; coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Ends a coalescing run (pointer up): the next push starts a new step. */
  | { type: 'sealHistory' }
  | { type: 'sizeDraft'; key: SizeKey; value: string }
  | { type: 'clearIssues'; pred: (i: Issue) => boolean }
  | { type: 'sampleText'; id: string; value: string }
  | { type: 'previewReport'; missing: string[]; fonts: string[] };

const draftsOf = (spec: TemplateSpecV1 | null): Record<SizeKey, string> => ({
  width: spec && Number.isFinite(spec.width) ? String(spec.width) : '',
  height: spec && Number.isFinite(spec.height) ? String(spec.height) : '',
  bleed_mm: spec && Number.isFinite(spec.bleed_mm) ? String(spec.bleed_mm) : '',
});

export const initialTemplateEditorState: TemplateEditorState = {
  detail: null,
  loadError: null,
  spec: null,
  past: [],
  future: [],
  historyKey: null,
  baseJson: '',
  name: '',
  sizeDrafts: draftsOf(null),
  sideTab: 'elements',
  selected: null,
  issues: [],
  busy: null,
  actionError: null,
  picker: null,
  confirmDelete: false,
  linkedCount: null,
  loadingVersion: null,
  previewPrint: false,
  samplePhoto: true,
  sampleTexts: {},
  previewProblems: { missing: [], fonts: [] },
  leaveTo: null,
};

const historyOf = (state: TemplateEditorState, spec: TemplateSpecV1): History<TemplateSpecV1> => ({
  past: state.past,
  present: spec,
  future: state.future,
  key: state.historyKey,
});
const withHistory = (state: TemplateEditorState, h: History<TemplateSpecV1>): TemplateEditorState => ({
  ...state,
  spec: h.present,
  past: h.past,
  future: h.future,
  historyKey: h.key,
});

/** The new working spec with the previous one pushed to `past` (or merged when `key` repeats). */
function pushHistory(state: TemplateEditorState, spec: TemplateSpecV1, key: string | null): TemplateEditorState {
  if (!state.spec) return { ...state, spec };
  return withHistory(state, historyPush(historyOf(state, state.spec), spec, key));
}

/** After undo / redo: size drafts follow the spec and the selection stays in range. */
function afterTimeTravel(state: TemplateEditorState): TemplateEditorState {
  const count = state.spec?.surfaces[0]?.elements.length ?? 0;
  return {
    ...state,
    sizeDrafts: draftsOf(state.spec),
    selected: state.selected !== null && state.selected < count ? state.selected : null,
    issues: [],
  };
}

export function templateEditorReducer(state: TemplateEditorState, action: TemplateEditorAction): TemplateEditorState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'adopt': {
      const d = action.detail;
      const s = d.latest_version?.spec ?? d.current_spec;
      if (!s) return { ...state, detail: d, name: d.name };
      const spec = cloneSpec(s);
      // Saving / publishing the template already open keeps the undo history
      // (undo then returns to the pre-save working copy, which is dirty again);
      // the saved spec may differ from the working one (fonts are rebuilt on
      // save), so the identity of the template decides, not the spec. The
      // coalescing key is sealed so a typing run cannot merge past the saved
      // state. A first load starts a fresh history.
      const sameTemplate = state.spec !== null && state.detail?.id === d.id;
      return {
        ...state,
        detail: d,
        name: d.name,
        spec,
        baseJson: JSON.stringify(s),
        sizeDrafts: draftsOf(spec),
        ...(sameTemplate ? { historyKey: null } : { past: [], future: [], historyKey: null }),
      };
    }
    case 'loadSpec': {
      const spec = cloneSpec(action.spec);
      return { ...pushHistory(state, spec, null), sizeDrafts: draftsOf(spec), selected: null, issues: [], sideTab: 'elements' };
    }
    case 'updateSpec':
      return state.spec ? pushHistory(state, action.fn(cloneSpec(state.spec)), action.coalesce ?? null) : state;
    case 'undo':
      return state.spec && state.past.length ? afterTimeTravel(withHistory(state, historyUndo(historyOf(state, state.spec)))) : state;
    case 'redo':
      return state.spec && state.future.length ? afterTimeTravel(withHistory(state, historyRedo(historyOf(state, state.spec)))) : state;
    case 'sealHistory':
      return state.historyKey === null ? state : { ...state, historyKey: null };
    case 'sizeDraft': {
      const sizeDrafts = { ...state.sizeDrafts, [action.key]: action.value };
      const n = action.value.trim() === '' ? NaN : Number(action.value);
      if (!state.spec || !Number.isFinite(n)) return { ...state, sizeDrafts };
      return { ...pushHistory(state, { ...cloneSpec(state.spec), [action.key]: n }, `size:${action.key}`), sizeDrafts };
    }
    case 'clearIssues':
      // Issues are cleared field by field as the creator edits.
      return state.issues.some(action.pred) ? { ...state, issues: state.issues.filter((i) => !action.pred(i)) } : state;
    case 'sampleText':
      return { ...state, sampleTexts: { ...state.sampleTexts, [action.id]: action.value } };
    case 'previewReport': {
      const prev = state.previewProblems;
      if (prev.missing.join() === action.missing.join() && prev.fonts.join() === action.fonts.join()) return state;
      return { ...state, previewProblems: { missing: action.missing, fonts: action.fonts } };
    }
    default:
      return state;
  }
}

export function useTemplateEditorState() {
  return useReducer(templateEditorReducer, initialTemplateEditorState);
}

/** Element-list mutation helper shared by the editor and the panels. */
export const elementsUpdater =
  (fn: (els: DesignElement[]) => DesignElement[]) =>
  (s: TemplateSpecV1): TemplateSpecV1 => {
    s.surfaces[0].elements = fn(s.surfaces[0].elements);
    return s;
  };
