// Store legal pages (plans/store-legal-pages SPEC): the four page kinds that
// back the storefront `/legal/<slug>` URLs of INDEPENDENT stores.

export type LegalSlug = 'privacy' | 'terms' | 'refund' | 'shipping';

/** Page kind (`static_kind` / legacy `type`) → storefront `/legal/<slug>`. */
export const LEGAL_KIND_TO_SLUG: Readonly<Record<string, LegalSlug>> = Object.freeze({
  PRIVACY_POLICY: 'privacy',
  TERMS: 'terms',
  RETURN_POLICY: 'refund',
  SHIPPING_POLICY: 'shipping',
});

/** Legal slug for a page kind, or null when the kind is not a legal one. */
export function legalSlugForKind(kind: string | null | undefined): LegalSlug | null {
  if (!kind) return null;
  return LEGAL_KIND_TO_SLUG[kind.toUpperCase()] ?? null;
}

/** Statuses in which the store can still request (or is waiting for) go-live. */
export function isPreLaunchStatus(status: string | null | undefined): boolean {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED' || status === 'PENDING_REVIEW';
}
