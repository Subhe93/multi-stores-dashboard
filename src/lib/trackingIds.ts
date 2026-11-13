// Tracking id rules of the "Tracking & cookies" card (TrackingSettingsCard).
// Mirror of the API DTO rules (multi-stores-api modules/stores/dto/store.dto.ts).

export type TrackingIdField =
  | 'ga4_measurement_id'
  | 'meta_pixel_id'
  | 'tiktok_pixel_id'
  | 'clarity_project_id';

export const TRACKING_ID_FIELDS: TrackingIdField[] = [
  'ga4_measurement_id',
  'meta_pixel_id',
  'tiktok_pixel_id',
  'clarity_project_id',
];

// Checked against the normalized value: GA4 and TikTok ids are stored
// upper-cased, Microsoft Clarity project ids (10 lower-case letters/digits
// today, e.g. "sxtuobatm6") lower-cased, Meta pixel ids as typed.
export const TRACKING_ID_RULES: Record<TrackingIdField, RegExp> = {
  ga4_measurement_id: /^$|^G-[A-Z0-9]{4,}$/i,
  meta_pixel_id: /^$|^[0-9]{5,32}$/,
  tiktok_pixel_id: /^$|^[A-Z0-9]{8,64}$/i,
  clarity_project_id: /^$|^[a-z0-9]{8,12}$/,
};

/** Trimmed, in the case the API stores. */
export function normalizeTrackingId(field: TrackingIdField, raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (field === 'meta_pixel_id') return trimmed;
  return field === 'clarity_project_id' ? trimmed.toLowerCase() : trimmed.toUpperCase();
}

/** Whether a typed id is acceptable (empty clears it). */
export function isValidTrackingId(field: TrackingIdField, raw: string): boolean {
  return TRACKING_ID_RULES[field].test(normalizeTrackingId(field, raw));
}

/**
 * The Clarity part of the PUT body: present only when the id changed against
 * the saved one, so saving never clears an id the form was not seeded with.
 * An empty string clears it on the API side.
 */
export function clarityPatch(typed: string, saved: string): { clarity_project_id?: string } {
  const next = normalizeTrackingId('clarity_project_id', typed);
  const prev = normalizeTrackingId('clarity_project_id', saved);
  return next === prev ? {} : { clarity_project_id: next };
}

/**
 * Clarity is always consent-gated on the storefront; the card warns when the
 * owner turns the consent banner off while a Clarity id is set.
 */
export function showClarityConsentWarning(clarityId: string, consentRequired: boolean): boolean {
  return !consentRequired && normalizeTrackingId('clarity_project_id', clarityId) !== '';
}
