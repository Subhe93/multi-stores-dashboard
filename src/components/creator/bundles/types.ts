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
};

export const RTL_LOCALES = new Set(['ar']);

export const DISCOUNT_TYPE_OPTIONS: { value: BundleDiscountType; label: string; help: string }[] = [
  { value: 'ITEM', label: 'Item', help: 'Number of free units (e.g. buy 2 get 1)' },
  { value: 'PERCENTAGE', label: 'Percentage', help: '% off the bundle total' },
  { value: 'FIXED', label: 'Fixed', help: 'Flat amount off the bundle total' },
];

export function pickTranslation<T extends { locale: string }>(
  list: T[],
  primary: string,
): T | undefined {
  return list.find((t) => t.locale === primary) ?? list[0];
}
