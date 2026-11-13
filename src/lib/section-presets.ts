// Section presets (M6.5): an ordered list of sections with default settings
// and content, inserted into a page in one action. Setting/content keys mirror
// the schemas in ./section-schemas.ts — translatable keys go into the
// translation `content`, everything else into `settings`.

import { findSectionSchema, type LocalizedString } from './section-schemas';
import {
  CLASSIC_PRODUCT_PRESET_SECTIONS,
  PRODUCT_BLOCK_CONFLICT_KEYS,
  presetNodeBodies,
  type PresetNodeBody,
} from './productBlocksPreset';

export interface PresetSection {
  section_key: string;
  settings: Record<string, unknown>;
  // Content variants per locale. The inserted translation uses the store's
  // primary locale's variant when it exists, else `en`.
  content: Record<string, Record<string, unknown>>;
  // Sections created inside this one (layout containers only). Inserted
  // parent-first with parent_id (see productBlocksPreset.createPresetTree).
  children?: PresetSection[];
}

export interface SectionPreset {
  id: string;
  // Store-locale fallbacks for the name/description; the builder card reads
  // `i18n` (dashboard UI locale) first.
  name: LocalizedString;
  description: LocalizedString;
  // Keys under the `builder` namespace that translate the card text in the
  // dashboard UI locale (all six locales).
  i18n?: { name: string; description: string };
  // Lucide icon name hint for the picker card.
  icon?: string;
  // Page types the preset is offered on (no chrome).
  pageTypes: Array<'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE'>;
  // Feature gate, as on section schemas: offered only when enabled.
  gate?: 'layout-containers';
  // The preset is offered but disabled while the page has a visible section
  // with one of these keys (e.g. a second buy form on a product page).
  blockedBy?: readonly string[];
  sections: PresetSection[];
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'occasion-page',
    name: { en: 'Occasion page', ar: 'صفحة مناسبة' },
    description: {
      en: 'Hero banner, the products of one collection or tag, an SEO text block, then questions and answers — the layout of a gift-occasion page.',
      ar: 'بانر رئيسي، ثم منتجات مجموعة أو وسم، ثم كتلة نص لتحسين الظهور في محركات البحث، ثم أسئلة وأجوبة — تخطيط صفحة هدايا المناسبات.',
    },
    i18n: { name: 'presetOccasionName', description: 'presetOccasionDesc' },
    icon: 'gift',
    pageTypes: ['LANDING', 'STATIC', 'HOME'],
    sections: [
      {
        section_key: 'hero-banner',
        // No image: the creator uploads one. Layout/height are the schema defaults.
        settings: { layout: 'centered', height: 'md', overlay_opacity: 0.35, alignment: 'center' },
        content: {
          en: {
            heading: 'Gifts for …',
            subheading: 'Hand-picked gifts for the people who matter most.',
          },
          ar: {
            heading: 'هدايا لـ…',
            subheading: 'هدايا مختارة بعناية لمن يهمّك أمرهم.',
          },
          sv: {
            heading: 'Presenter till …',
            subheading: 'Handplockade presenter till dem som betyder mest.',
          },
        },
      },
      {
        section_key: 'collection-products',
        // `category` stays empty: the creator picks the collection or tag;
        // the section shows its "pick a collection" prompt until then.
        // Keys and defaults are mirrored server-side in
        // multi-stores-api/src/modules/occasion-conversion/occasion-preset.ts.
        settings: { category: '', aspect: 'square', limit: 12, columns: 4, columns_tablet: 3, columns_mobile: 2 },
        // A small plain line instead of a heading (Namez 2026-11-10): the
        // hero carries the page's only heading.
        content: {
          en: { subheading: 'Find your favourite', link_label: 'View all' },
          ar: { subheading: 'اعثر على المفضّلة لديك', link_label: 'عرض الكل' },
          sv: { subheading: 'Hitta din favorit', link_label: 'Visa alla' },
        },
      },
      {
        section_key: 'rich-text',
        settings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
        content: {
          en: {
            html: '<p>Write the SEO text for this occasion here — who the gifts are for, what makes them special, and how to choose.</p>',
          },
          ar: {
            html: '<p>اكتب هنا نص تحسين الظهور في محركات البحث لهذه المناسبة — لمن هذه الهدايا، وما الذي يميّزها، وكيف تختار منها.</p>',
          },
          sv: {
            html: '<p>Skriv SEO-texten för tillfället här – vem presenterna är till, vad som gör dem speciella och hur man väljer.</p>',
          },
        },
      },
      {
        // Questions at the end (also emitted as FAQPage structured data).
        // Sample pairs: the creator replaces them with the page's own.
        section_key: 'faq-list',
        settings: { layout: 'stacked', allow_multiple: true },
        content: {
          en: {
            heading: 'Frequently asked questions',
            items: [
              { question: 'How long does delivery take?', answer: 'Replace with your answer.' },
              { question: 'Can the gift be personalised?', answer: 'Replace with your answer.' },
            ],
          },
          ar: {
            heading: 'الأسئلة الشائعة',
            items: [
              { question: 'كم يستغرق التوصيل؟', answer: 'اكتب إجابتك هنا.' },
              { question: 'هل يمكن تخصيص الهدية؟', answer: 'اكتب إجابتك هنا.' },
            ],
          },
          sv: {
            heading: 'Vanliga frågor',
            items: [
              { question: 'Hur lång är leveranstiden?', answer: 'Ersätt med ditt svar.' },
              { question: 'Kan presenten personifieras?', answer: 'Ersätt med ditt svar.' },
            ],
          },
        },
      },
    ],
  },
];

// Product template (layout containers): today's product page built from
// separate product blocks. Keys/settings live in productBlocksPreset.ts and
// mirror the API's "Convert to blocks" tree.
SECTION_PRESETS.push({
  id: 'classic-product-page',
  name: { en: 'Classic product page', ar: 'صفحة منتج كلاسيكية' },
  description: {
    en: 'Gallery beside title, price, options, personalization and add to cart, with the product tabs below — today’s product page as separate blocks.',
    ar: 'المعرض بجانب العنوان والسعر والخيارات والتخصيص والإضافة للسلة، مع تبويبات المنتج في الأسفل — صفحة المنتج الحالية كأقسام منفصلة.',
  },
  i18n: { name: 'presetClassicProductName', description: 'presetClassicProductDesc' },
  icon: 'layout',
  pageTypes: ['PRODUCT_TEMPLATE'],
  gate: 'layout-containers',
  blockedBy: PRODUCT_BLOCK_CONFLICT_KEYS,
  sections: CLASSIC_PRODUCT_PRESET_SECTIONS,
});

export function findSectionPreset(id: string): SectionPreset | undefined {
  return SECTION_PRESETS.find((p) => p.id === id);
}

export function presetsForPageType(
  pageType: string,
  options: { layoutContainers?: boolean } = {},
): SectionPreset[] {
  return SECTION_PRESETS.filter(
    (p) =>
      (p.pageTypes as string[]).includes(pageType) &&
      (p.gate !== 'layout-containers' || !!options.layoutContainers),
  );
}

/**
 * Nested create bodies of a preset (parents with their children), for
 * presets with layout containers. Same content rule as presetSections.
 */
export function presetTreeBodies(presetId: string, primaryLocale: string): PresetNodeBody[] {
  const preset = findSectionPreset(presetId);
  if (!preset) return [];
  return presetNodeBodies(preset.sections, primaryLocale, (key) => !!findSectionSchema(key));
}

/**
 * Resolve a preset into the bodies to POST to `/v2/pages/:id/sections`, in
 * order. Content picks the primary-locale variant, else `en`. Unknown preset
 * ids yield an empty list.
 */
export function presetSections(
  presetId: string,
  primaryLocale: string,
): { section_key: string; settings: Record<string, unknown>; content: Record<string, unknown> }[] {
  const preset = findSectionPreset(presetId);
  if (!preset) return [];
  return preset.sections
    // Skip sections whose schema no longer exists so a stale preset never
    // creates an "unknown section" row.
    .filter((s) => findSectionSchema(s.section_key))
    .map((s) => ({
      section_key: s.section_key,
      settings: { ...s.settings },
      content: { ...(s.content[primaryLocale] ?? s.content.en ?? {}) },
    }));
}
