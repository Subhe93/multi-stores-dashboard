// Types and helpers for the creator "Themes" gallery (look-only presets).
// Applying a preset changes colors, fonts and the header/footer layout only;
// the API guarantees texts, menus, images and page content stay untouched.
// The API is built concurrently, so this codes against the contract.
import { api } from '@/lib/api';

export type BaseThemeKey = 'minimal' | 'bold' | 'classic';

export interface ThemePresetSwatch {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface ThemePresetFonts {
  heading: string;
  body: string;
}

export interface ThemePresetChrome {
  announcement_bar: boolean;
  sticky_header: boolean;
  mega_menu: boolean;
  mobile_bottom_nav: boolean;
  footer_columns: boolean;
  social_icons: boolean;
  payment_icons: boolean;
}

// GET /v2/themes
export interface ThemePresetSummary {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  tags: string[];
  base_theme_key: BaseThemeKey;
  swatch: ThemePresetSwatch;
  fonts: ThemePresetFonts;
  chrome: ThemePresetChrome;
}

export interface ApplyThemeChromeResult {
  page_id: string;
  created: boolean;
  sections_updated: number;
  sections_created: number;
  published: boolean;
}

// POST /v2/themes/:id/apply
export interface ApplyThemeResult {
  preset_id: string;
  theme_applied: true;
  header: ApplyThemeChromeResult;
  footer: ApplyThemeChromeResult;
  restore_points: number;
}

export function fetchThemes(token: string): Promise<ThemePresetSummary[]> {
  return api<ThemePresetSummary[]>('/v2/themes', { token });
}

export function applyTheme(token: string, id: string): Promise<ApplyThemeResult> {
  return api<ApplyThemeResult>(`/v2/themes/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
    token,
    body: JSON.stringify({ publish: true }),
  });
}
