export type BundleDiscountType = 'ITEM' | 'PERCENTAGE' | 'FIXED';
export type BundleStatus = 'ACTIVE' | 'DISABLED';

export interface BundleTranslation {
  locale: string;
  name: string;
}

export interface BundleOfferTranslation {
  locale: string;
  title: string;
  label?: string | null;
  sticker_text?: string | null;
}

export interface BundleOffer {
  id?: string;
  quantity: number;
  discount_type: BundleDiscountType;
  discount_value: number;
  external_ref?: string | null;
  sort_order: number;
  translations: BundleOfferTranslation[];
}

export interface Bundle {
  id: string;
  status: BundleStatus;
  created_at: string;
  updated_at: string;
  translations: BundleTranslation[];
  offers: BundleOffer[];
  products: { product_id: string }[];
  custom_products: { custom_product_id: string }[];
}

export interface BundleTemplate {
  id: string;
  label: string;
  description: string;
  offers: {
    quantity: number;
    discount_type: BundleDiscountType;
    discount_value: number;
    label?: string;
  }[];
}

export const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
};

export const RTL_LOCALES = new Set(['ar']);

type Translator = (key: string) => string;

export function getDiscountTypeOptions(
  t: Translator,
): { value: BundleDiscountType; label: string; help: string }[] {
  return [
    { value: 'ITEM', label: t('bundle.discountItem'), help: t('bundle.discountItemHelp') },
    { value: 'PERCENTAGE', label: t('bundle.discountPercentage'), help: t('bundle.discountPercentageHelp') },
    { value: 'FIXED', label: t('bundle.discountFixed'), help: t('bundle.discountFixedHelp') },
  ];
}

export function pickTranslation<T extends { locale: string }>(
  list: T[],
  primary: string,
): T | undefined {
  return list.find((t) => t.locale === primary) ?? list[0];
}
