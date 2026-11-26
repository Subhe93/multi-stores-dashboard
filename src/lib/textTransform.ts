/**
 * `ui.transform` of a personalization text field as the field dialog edits it
 * (M173 adds 'capitalize'). Pure and import-free so the node test can load it.
 * The stored value is one of TEXT_TRANSFORMS, or absent for "as typed".
 */
export const TEXT_TRANSFORMS = ['uppercase', 'capitalize'] as const;
export type TextTransform = (typeof TEXT_TRANSFORMS)[number];

const isTextTransform = (v: unknown): v is TextTransform =>
  typeof v === 'string' && (TEXT_TRANSFORMS as readonly string[]).includes(v);

/** Select value for a stored `ui.transform` ('none' when absent or unknown). */
export function transformSelectValue(stored: unknown): TextTransform | 'none' {
  return isTextTransform(stored) ? stored : 'none';
}

/** `ui.transform` to store for a select value; undefined removes the key. */
export function transformFromSelect(selected: unknown): TextTransform | undefined {
  return isTextTransform(selected) ? selected : undefined;
}
