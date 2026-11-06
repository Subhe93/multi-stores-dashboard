// Self-hosted copies of the Google Fonts files that next/font/google used to
// download at build time, so builds never depend on fonts.googleapis.com.
// Each family keeps the exact Google subset files (latin, latin-ext and, where
// relevant, arabic) and their unicode-range, declared as one localFont call
// per subset under the same font-family name, in the same order as the Google
// CSS. The exported (latin) call carries the className / CSS variable and
// names the Arial-based '<Family> Fallback' face defined in
// fallbacks.css; the other calls only add their @font-face rules.
// Preload mirrors the old `subsets` option. Licences: OFL.txt in each folder.
/* eslint-disable @typescript-eslint/no-unused-vars -- the non-exported subset calls only register their @font-face rules */
import localFont from 'next/font/local';
import './fallbacks.css';

// The exported fonts are bound to the family name because next/font names the
// class font-family after the binding, so it stays 'Inter', 'Inter Fallback'
// exactly as with next/font/google.

// Base UI font (non-Arabic locales).
const interLatinExt = localFont({
  src: './inter/inter-latin-ext.woff2',
  weight: '100 900',
  style: 'normal',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: 'font-family', value: 'Inter' },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
});
const Inter = localFont({
  src: './inter/inter-latin.woff2',
  weight: '100 900',
  style: 'normal',
  preload: true,
  adjustFontFallback: false,
  fallback: ['Inter Fallback'],
  declarations: [
    { prop: 'font-family', value: 'Inter' },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
});

// Tailwind font-sans token (--font-sans).
const geistLatinExt = localFont({
  src: './geist/geist-latin-ext.woff2',
  weight: '100 900',
  style: 'normal',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: 'font-family', value: 'Geist' },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
});
const Geist = localFont({
  src: './geist/geist-latin.woff2',
  weight: '100 900',
  style: 'normal',
  preload: true,
  variable: '--font-sans',
  adjustFontFallback: false,
  fallback: ['Geist Fallback'],
  declarations: [
    { prop: 'font-family', value: 'Geist' },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
});

// Arabic UI font, applied only when the dashboard language is Arabic.
const cairoArabic = localFont({
  src: './cairo/cairo-arabic.woff2',
  weight: '200 1000',
  style: 'normal',
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: 'font-family', value: 'Cairo' },
    { prop: 'unicode-range', value: 'U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC7, U+10EC9-10EEE, U+10EF0-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1' },
  ],
});
const cairoLatinExt = localFont({
  src: './cairo/cairo-latin-ext.woff2',
  weight: '200 1000',
  style: 'normal',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: 'font-family', value: 'Cairo' },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
});
const Cairo = localFont({
  src: './cairo/cairo-latin.woff2',
  weight: '200 1000',
  style: 'normal',
  preload: true,
  variable: '--font-arabic',
  adjustFontFallback: false,
  fallback: ['Cairo Fallback'],
  declarations: [
    { prop: 'font-family', value: 'Cairo' },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
});

// ShopsDoor brand font: brand lockup and login headline (--font-manrope).
const manropeLatinExt = localFont({
  src: [
    { path: './manrope/manrope-latin-ext.woff2', weight: '500' },
    { path: './manrope/manrope-latin-ext.woff2', weight: '700' },
    { path: './manrope/manrope-latin-ext.woff2', weight: '800' },
  ],
  style: 'normal',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: 'font-family', value: 'Manrope' },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
});
const Manrope = localFont({
  src: [
    { path: './manrope/manrope-latin.woff2', weight: '500' },
    { path: './manrope/manrope-latin.woff2', weight: '700' },
    { path: './manrope/manrope-latin.woff2', weight: '800' },
  ],
  style: 'normal',
  preload: true,
  variable: '--font-manrope',
  adjustFontFallback: false,
  fallback: ['Manrope Fallback'],
  declarations: [
    { prop: 'font-family', value: 'Manrope' },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
});

export { Inter as inter, Geist as geist, Cairo as cairo, Manrope as manrope };
