'use client';

import { useReducer } from 'react';
import type { DesignElement, TemplateSpecV1 } from '@/lib/designer/design-renderer';
import type { TemplateAssetKind, TemplateDetail } from '@/lib/designer/designer.api';
import { cloneSpec, type EditorArea } from '@/lib/designer/templateSpec';
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

export type TemplateEditorPatch = Partial<Omit<TemplateEditorState, 'spec' | 'sizeDrafts' | 'sampleTexts'>>;
type Patch = TemplateEditorPatch;

export type TemplateEditorAction =
  | { type: 'patch'; patch: Patch }
  /** A loaded / saved template: name, spec and the dirty baseline. */
  | { type: 'adopt'; detail: TemplateDetail }
  /** A version loaded into the working copy (not the baseline). */
  | { type: 'loadSpec'; spec: TemplateSpecV1 }
  | { type: 'updateSpec'; fn: (s: TemplateSpecV1) => TemplateSpecV1 }
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

export function templateEditorReducer(state: TemplateEditorState, action: TemplateEditorAction): TemplateEditorState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'adopt': {
      const d = action.detail;
      const s = d.latest_version?.spec ?? d.current_spec;
      if (!s) return { ...state, detail: d, name: d.name };
      const spec = cloneSpec(s);
      return { ...state, detail: d, name: d.name, spec, baseJson: JSON.stringify(s), sizeDrafts: draftsOf(spec) };
    }
    case 'loadSpec': {
      const spec = cloneSpec(action.spec);
      return { ...state, spec, sizeDrafts: draftsOf(spec), selected: null, issues: [], sideTab: 'elements' };
    }
    case 'updateSpec':
      return state.spec ? { ...state, spec: action.fn(cloneSpec(state.spec)) } : state;
    case 'sizeDraft': {
      const sizeDrafts = { ...state.sizeDrafts, [action.key]: action.value };
      const n = action.value.trim() === '' ? NaN : Number(action.value);
      if (!state.spec || !Number.isFinite(n)) return { ...state, sizeDrafts };
      return { ...state, sizeDrafts, spec: { ...cloneSpec(state.spec), [action.key]: n } };
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
