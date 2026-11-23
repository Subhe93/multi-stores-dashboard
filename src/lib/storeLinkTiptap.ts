// Tiptap link validation of the store editors (M165). The default Link
// extension rejects unknown schemes, which would drop `product:<id>` hrefs on
// load and on paste. A strict product reference is allowed; everything else
// keeps the extension's default rules. Pure (src/lib/storeLinkTiptap.test.mjs).

import { PRODUCT_REF_RE } from '@multi-stores/core/link-ref';

export function storeLinkIsAllowedUri(url: string, ctx: { defaultValidate: (url: string) => boolean }): boolean {
  const value = typeof url === 'string' ? url.trim() : '';
  if (/^product:/i.test(value)) return PRODUCT_REF_RE.test(value);
  return ctx.defaultValidate(url);
}
