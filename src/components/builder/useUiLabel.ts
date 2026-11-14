'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { labelOf, type LocalizedString } from '@/lib/section-schemas';

/**
 * Resolves builder chrome strings (section/field labels, descriptions, select
 * option labels, preset names) in the DASHBOARD UI locale (next-intl).
 *
 * Never pass the store-content locale here: a Swedish store edited from an
 * English dashboard must still show English labels. The content locale only
 * decides which translation row is read and written.
 */
export function useUiLabel(): (loc: LocalizedString) => string {
  const uiLocale = useLocale();
  return useCallback((loc: LocalizedString) => labelOf(loc, uiLocale), [uiLocale]);
}
