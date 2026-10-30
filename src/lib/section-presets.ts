// Section presets (M6.5): an ordered list of sections with default settings
// and content, inserted into a page in one action. Setting/content keys mirror
// the schemas in ./section-schemas.ts — translatable keys go into the
// translation `content`, everything else into `settings`.

import { findSectionSchema, type LocalizedString } from './section-schemas';

export interface PresetSection {
  section_key: string;
  settings: Record<string, unknown>;
  // Content variants per locale. The inserted translation uses the store's
  // primary locale's variant when it exists, else `en`.
  content: Record<string, Record<string, unknown>>;
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
  // Page types the preset is offered on (not templates / chrome).
  pageTypes: Array<'HOME' | 'STATIC' | 'LANDING'>;
  sections: PresetSection[];
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'occasion-page',
    name: { en: 'Occasion page', ar: 'صفحة مناسبة' },
    description: {
      en: 'Hero banner, the products of one collection or internal label, an SEO text block, then questions and answers — the layout of a gift-occasion page.',
      ar: 'بانر رئيسي، ثم منتجات مجموعة أو تصنيف داخلي، ثم كتلة نص لتحسين الظهور في محركات البحث، ثم أسئلة وأجوبة — تخطيط صفحة هدايا المناسبات.',
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
        // `category` stays empty: the creator picks the collection or internal
        // label; the section shows its "pick a collection" prompt until then.
        // Keys and defaults are mirrored server-side in
        // multi-stores-api/src/modules/occasion-conversion/occasion-preset.ts.
        settings: { category: '', aspect: 'square', limit: 12, columns: 4, columns_tablet: 3, columns_mobile: 2 },
        content: {
          en: { heading: 'Our picks', link_label: 'View all' },
          ar: { heading: 'مختاراتنا', link_label: 'عرض الكل' },
          sv: { heading: 'Våra favoriter', link_label: 'Visa alla' },
        },
      },
      {
        section_key: 'rich-text',
        settings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
        content: {
          en: {
            heading: 'About these gifts',
            html: '<p>Write the SEO text for this occasion here — who the gifts are for, what makes them special, and how to choose.</p>',
          },
          ar: {
            heading: 'عن هذه الهدايا',
            html: '<p>اكتب هنا نص تحسين الظهور في محركات البحث لهذه المناسبة — لمن هذه الهدايا، وما الذي يميّزها، وكيف تختار منها.</p>',
          },
          sv: {
            heading: 'Om dessa presenter',
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

export function findSectionPreset(id: string): SectionPreset | undefined {
  return SECTION_PRESETS.find((p) => p.id === id);
}

export function presetsForPageType(pageType: string): SectionPreset[] {
  return SECTION_PRESETS.filter((p) => (p.pageTypes as string[]).includes(pageType));
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
