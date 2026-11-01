'use client';

import { useTranslations } from 'next-intl';
import { useApiError } from '@/lib/useApiError';

/**
 * Friendly messages for the Customers pages. Codes with a customer-specific
 * wording come from `creator.customers.errors.<code>`; raw class-validator
 * output (400 without a code) is mapped by the field it names; everything
 * else goes through the shared `errors.<code>` lookup.
 */
export function useCustomerError() {
  const t = useTranslations('creator.customers.errors');
  const describe = useApiError();
  return (err: unknown): string => {
    const e = err as { code?: string; status?: number; errors?: string[]; message?: string } | null | undefined;
    if (e?.code && t.has(e.code)) return t(e.code);
    if (e?.code) return describe(err);
    if (e?.status === 400) {
      const text = (e.errors ?? [e.message ?? '']).join(' ').toLowerCase();
      if (text.includes('email')) return t('invalidEmail');
      if (text.includes('phone')) return t('invalidPhone');
      if (text.includes('vat') || text.includes('org_number')) return t('invalidCompany');
      return t('invalidInput');
    }
    if (e?.status === 404) return t('notFound');
    if (e?.status === 403) return t('forbidden');
    return describe(err);
  };
}
