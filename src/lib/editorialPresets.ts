// Presets of the editorial section set: an editorial homepage and a projects
// page. Pure (type-only imports) so the node test runner can load it; the
// section defaults are handed in by the caller (section-presets.ts reads them
// from the schemas), so the three new sections are never described twice.
//
// Rule, as for every preset: keys listed in a schema's `translatable` go into
// `content` (per locale), every other key into `settings`. Content variants
// are en, ar and sv; other primary locales get the English variant. No images:
// the creator uploads their own.

import type { PresetSection, SectionPreset } from './section-presets';

/** defaultSettings / defaultContent of one section schema. */
export interface SectionDefaults {
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
}

/** Deep copy, so a preset never shares arrays with the schema defaults. */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const STATUS_SAMPLE = ['completed', 'in_progress', 'planned'] as const;

/** Sample items of project-cards in another language (same shape as the schema default). */
function projectItems(titles: [string, string, string], category: string, location: string, description: string) {
  return titles.map((title, i) => ({ title, category, location, status: STATUS_SAMPLE[i], description }));
}

/** Sample items of category-tiles in another language (same shape as the schema default). */
function tileItems(rows: [string, string][]) {
  return rows.map(([title, subtitle]) => ({ title, subtitle, url: '/products' }));
}

export function buildEditorialPresets(defaultsOf: (sectionKey: string) => SectionDefaults): SectionPreset[] {
  const tiles = clone(defaultsOf('category-tiles'));
  const spotlight = clone(defaultsOf('progress-spotlight'));
  const cards = clone(defaultsOf('project-cards'));

  const editorialHome: PresetSection[] = [
    {
      section_key: 'hero-split',
      // Edge-to-edge variant. `cta_url` / `cta_secondary_url` are settings.
      settings: {
        variant: 'bleed',
        image_side: 'end',
        height: 'lg',
        image_width: 'half',
        image_focus: 'center',
        tone: 'surface',
        edge: 'soft',
        mobile_order: 'image-first',
        cta_tone: 'primary',
        cta_url: '/products',
        cta_secondary_url: '/',
      },
      content: {
        en: {
          eyebrow: 'New season',
          heading: 'Made to be worn, kept and passed on',
          subheading: 'One or two lines about what you sell and why it is worth a closer look.',
          cta_text: 'Shop the collection',
          cta_secondary_text: 'Our story',
        },
        ar: {
          eyebrow: 'موسم جديد',
          heading: 'صُنع ليُلبَس ويُحفَظ ويُورَّث',
          subheading: 'سطر أو سطران عمّا تبيعه ولماذا يستحق نظرة أقرب.',
          cta_text: 'تسوّق المجموعة',
          cta_secondary_text: 'قصتنا',
        },
        sv: {
          eyebrow: 'Ny säsong',
          heading: 'Gjort för att bäras, sparas och föras vidare',
          subheading: 'En eller två rader om vad du säljer och varför det är värt en närmare titt.',
          cta_text: 'Handla kollektionen',
          cta_secondary_text: 'Vår historia',
        },
      },
    },
    {
      section_key: 'trust-badges',
      // Placeholders, not claims: the creator states their own terms.
      settings: { layout: 'strip', padding: 'compact' },
      content: {
        en: {
          items: [
            { icon: 'truck', label: 'Delivery', description: 'State your delivery terms' },
            { icon: 'refresh', label: 'Returns', description: 'State your return terms' },
            { icon: 'shield', label: 'Secure payment', description: 'Encrypted checkout' },
            { icon: 'headphones', label: 'Support', description: 'How customers reach you' },
          ],
        },
        ar: {
          items: [
            { icon: 'truck', label: 'التوصيل', description: 'اذكر شروط التوصيل لديك' },
            { icon: 'refresh', label: 'الإرجاع', description: 'اذكر شروط الإرجاع لديك' },
            { icon: 'shield', label: 'دفع آمن', description: 'صفحة دفع مشفّرة' },
            { icon: 'headphones', label: 'الدعم', description: 'كيف يتواصل معك العملاء' },
          ],
        },
        sv: {
          items: [
            { icon: 'truck', label: 'Leverans', description: 'Ange dina leveransvillkor' },
            { icon: 'refresh', label: 'Returer', description: 'Ange dina returvillkor' },
            { icon: 'shield', label: 'Säker betalning', description: 'Krypterad kassa' },
            { icon: 'headphones', label: 'Support', description: 'Så når kunderna dig' },
          ],
        },
      },
    },
    {
      section_key: 'category-tiles',
      settings: tiles.settings,
      content: {
        en: tiles.content,
        ar: {
          heading: 'تسوّق حسب الفئة',
          items: tileItems([
            ['جديدنا', 'أحدث ما وصل'],
            ['ملابس', 'قطع لكل يوم'],
            ['إكسسوارات', 'لمسات أخيرة'],
            ['هدايا', 'شيء لكل شخص'],
          ]),
        },
        sv: {
          heading: 'Handla efter kategori',
          items: tileItems([
            ['Nyheter', 'Det senaste i butiken'],
            ['Kläder', 'Plagg för varje dag'],
            ['Accessoarer', 'Detaljerna som gör det'],
            ['Presenter', 'Något för alla'],
          ]),
        },
      },
    },
    {
      section_key: 'featured-products',
      settings: { filter: 'newest', aspect: 'portrait', limit: 8, columns: 4, columns_tablet: 3, columns_mobile: 2 },
      content: {
        en: { heading: 'New arrivals' },
        ar: { heading: 'وصل حديثاً' },
        sv: { heading: 'Nyheter' },
      },
    },
    {
      section_key: 'image-with-text',
      // Edge-to-edge story band; 'right' is the inline end.
      settings: {
        image_style: 'bleed',
        image_position: 'right',
        aspect: 'landscape',
        min_height: 'md',
        tone: 'surface',
        edge: 'hard',
        cta_tone: 'primary',
      },
      content: {
        en: {
          eyebrow: 'Our story',
          heading: 'What we stand for',
          body: 'Two or three sentences about how your products are made and what matters to you.',
          cta_text: 'Read more',
        },
        ar: {
          eyebrow: 'قصتنا',
          heading: 'ما نؤمن به',
          body: 'جملتان أو ثلاث عن طريقة صنع منتجاتك وما يهمّك.',
          cta_text: 'اقرأ المزيد',
        },
        sv: {
          eyebrow: 'Vår historia',
          heading: 'Det här står vi för',
          body: 'Två eller tre meningar om hur dina produkter tillverkas och vad som är viktigt för dig.',
          cta_text: 'Läs mer',
        },
      },
    },
  ];

  const projectsPage: PresetSection[] = [
    {
      section_key: 'rich-text',
      settings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
      content: {
        en: {
          heading: 'Our projects',
          html: '<p>Explain what the projects are, how they are chosen and how results are reported.</p>',
        },
        ar: {
          heading: 'مشاريعنا',
          html: '<p>اشرح ما هي المشاريع، وكيف تُختار، وكيف تُعلَن نتائجها.</p>',
        },
        sv: {
          heading: 'Våra projekt',
          html: '<p>Förklara vilka projekten är, hur de väljs ut och hur resultaten redovisas.</p>',
        },
      },
    },
    {
      section_key: 'progress-spotlight',
      // Schema defaults: goal 100, reached 0, so no progress is claimed.
      settings: spotlight.settings,
      content: {
        en: spotlight.content,
        ar: {
          eyebrow: 'هدفنا',
          heading: 'تابع تقدّمنا',
          body: 'صِف ما تعمل من أجله ولماذا هو مهم. يُحسب الشريط من الرقمين اللذين تُدخلهما.',
          item_title: 'اسم الهدف',
          item_meta: 'أين أو متى',
          unit_label: 'مكتمل',
          cta_text: 'اعرف المزيد',
        },
        sv: {
          eyebrow: 'Vårt mål',
          heading: 'Följ våra framsteg',
          body: 'Beskriv vad ni arbetar mot och varför det är viktigt. Indikatorn beräknas från de två tal du anger.',
          item_title: 'Målets namn',
          item_meta: 'Var eller när',
          unit_label: 'slutförda',
          cta_text: 'Läs mer',
        },
      },
    },
    {
      section_key: 'project-cards',
      settings: cards.settings,
      content: {
        en: cards.content,
        ar: {
          heading: 'مشاريعنا',
          subheading: 'ما هو مخطَّط، وما هو قيد التنفيذ، وما اكتمل.',
          items: projectItems(
            ['المشروع الأول', 'المشروع الثاني', 'المشروع الثالث'],
            'الفئة',
            'الموقع',
            'صِف المشروع في جملة أو جملتين.',
          ),
        },
        sv: {
          heading: 'Våra projekt',
          subheading: 'Vad som är planerat, vad som pågår och vad som är klart.',
          items: projectItems(
            ['Första projektet', 'Andra projektet', 'Tredje projektet'],
            'Kategori',
            'Plats',
            'Beskriv projektet med en eller två meningar.',
          ),
        },
      },
    },
  ];

  return [
    {
      id: 'editorial-home',
      name: { en: 'Editorial homepage', ar: 'صفحة رئيسية تحريرية' },
      description: {
        en: 'Edge-to-edge split hero, a strip of highlights, category tiles, new products and a story band.',
        ar: 'بانر منقسم من الحافة إلى الحافة، شريط مزايا، بطاقات الفئات، أحدث المنتجات وشريط قصة العلامة.',
      },
      i18n: { name: 'presetEditorialHomeName', description: 'presetEditorialHomeDesc' },
      icon: 'layout',
      pageTypes: ['HOME', 'LANDING'],
      sections: editorialHome,
    },
    {
      id: 'projects-page',
      name: { en: 'Projects page', ar: 'صفحة المشاريع' },
      description: {
        en: 'An intro text, a progress spotlight and a grid of project cards with their status.',
        ar: 'نص تمهيدي، تسليط ضوء على التقدّم وشبكة بطاقات مشاريع مع حالتها.',
      },
      i18n: { name: 'presetProjectsPageName', description: 'presetProjectsPageDesc' },
      icon: 'target',
      pageTypes: ['STATIC', 'LANDING'],
      sections: projectsPage,
    },
  ];
}
