// Pure check for links that come from API data (e.g. a notification's
// `data.url`) before the dashboard navigates to them. Free of React so
// node:test can run it.

// C0 control characters and DEL: browsers strip tabs / newlines from URLs,
// so "/\t/evil.com" would turn into the protocol-relative "//evil.com".
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/** A same-origin dashboard path (never a protocol-relative or absolute URL). */
export function isDashboardPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !CONTROL_CHARS.test(value)
  );
}
