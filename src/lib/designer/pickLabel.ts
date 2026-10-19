/**
 * `{locale: text}` → the text for the dashboard locale: exact locale, then
 * the same language (`sv-SE` → `sv`), then `en`, then the first entry.
 * Shared by the order add-ons block and the add-ons editor.
 */
export function pickLabel(label: Record<string, string>, locale: string): string {
  const lang = locale.split(/[-_]/)[0];
  const keys = Object.keys(label);
  return (
    label[locale] ||
    label[keys.find((k) => k.split(/[-_]/)[0] === lang) ?? ''] ||
    label.en ||
    (keys[0] ? label[keys[0]] : '') ||
    ''
  );
}
