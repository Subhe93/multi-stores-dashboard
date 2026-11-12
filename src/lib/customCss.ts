// Store-wide "Custom CSS" kept in theme_customizations.customCss (top-level
// key, not a design token). The storefront sanitizes and renders it on every
// page of the store; it ignores everything beyond the same cap.
// Pure (no imports) so the node test runner can load it.

/** Maximum length; mirrors CUSTOM_CSS_MAX_LENGTH in the web (lib/customCss.ts). */
export const CUSTOM_CSS_MAX_LENGTH = 20000;

/** The custom CSS of a customizations object ('' when unset or not a string). */
export function customCssOf(customizations: { customCss?: unknown } | null | undefined): string {
  const value = customizations?.customCss;
  return typeof value === 'string' ? value : '';
}

/**
 * Copy of `customizations` with the custom CSS set. A blank value removes the
 * key, so an emptied field leaves nothing behind in the stored object.
 */
export function withCustomCss<T extends { customCss?: unknown }>(customizations: T, css: string): T {
  const next = { ...customizations };
  if (css.trim()) next.customCss = css;
  else delete next.customCss;
  return next;
}

export function isCustomCssTooLong(css: string): boolean {
  return css.length > CUSTOM_CSS_MAX_LENGTH;
}
