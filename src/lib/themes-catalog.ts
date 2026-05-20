// Mirror of the storefront theme registry, summarized for the dashboard's UI.
// Kept in sync manually because the dashboard and storefront are independent
// Next.js apps. Source of truth for runtime theme behavior lives in
// multi-stores-web/src/themes/.

export interface ThemeCatalogEntry {
  key: string;
  label: Record<string, string>;
  description: Record<string, string>;
  swatch: { primary: string; secondary: string; accent: string; background: string };
  fontHeading: string;
}

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    key: 'minimal',
    label: { en: 'Minimal', ar: 'بسيط' },
    description: {
      en: 'Clean, spacious layout with serif headings. Suits boutique and editorial brands.',
      ar: 'تصميم بسيط ومريح للعين مع عناوين بخط Serif. يناسب العلامات البوتيكية والتحريرية.',
    },
    swatch: { primary: '#111827', secondary: '#374151', accent: '#2563eb', background: '#ffffff' },
    fontHeading: 'Playfair Display',
  },
  {
    key: 'bold',
    label: { en: 'Bold', ar: 'جريء' },
    description: {
      en: 'High-contrast, energetic palette with confident type. Suits streetwear and youth brands.',
      ar: 'ألوان متباينة وحيوية مع خطوط واثقة. يناسب علامات الستريت وير وعلامات الشباب.',
    },
    swatch: { primary: '#ff3d00', secondary: '#0a0a0a', accent: '#ffd600', background: '#0a0a0a' },
    fontHeading: 'Montserrat',
  },
  {
    key: 'classic',
    label: { en: 'Classic', ar: 'كلاسيكي' },
    description: {
      en: 'Warm tones, elegant serifs, traditional layouts. Suits artisan and heritage brands.',
      ar: 'ألوان دافئة وخطوط Serif أنيقة وتخطيطات تقليدية. يناسب علامات الحرف اليدوية والتراث.',
    },
    swatch: { primary: '#7c2d12', secondary: '#451a03', accent: '#ca8a04', background: '#fffbeb' },
    fontHeading: 'Merriweather',
  },
];

export const DEFAULT_THEME_KEY = 'minimal';

export function findTheme(key: string | null | undefined): ThemeCatalogEntry {
  return THEME_CATALOG.find((t) => t.key === key) || THEME_CATALOG[0];
}
