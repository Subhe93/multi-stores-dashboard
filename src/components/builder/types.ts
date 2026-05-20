// Shared types for the builder UI. Mirror of the storefront's SectionInstance,
// plus dashboard-only state shape (which locale is being edited, etc.).

export interface SectionInstance {
  id: string;
  section_key: string;
  settings: Record<string, unknown>;
  sort_order: number;
  is_hidden?: boolean;
  // Server returns rows; we collapse into a map on load for easier editing.
  translations: { locale: string; content: Record<string, unknown> }[];
}

export interface BuilderPage {
  id: string;
  type: 'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER';
  slug: string | null;
  static_kind: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  seo: Record<string, unknown>;
  translations: PageTranslationRow[];
}

export interface PageTranslationRow {
  locale: string;
  title?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

export type DevicePreset = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_WIDTHS: Record<DevicePreset, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};
