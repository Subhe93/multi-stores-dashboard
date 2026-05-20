// Section schemas mirror the storefront's theme registry. Kept in sync
// manually — these are content contracts (field keys + types + labels) that
// drive the Inspector forms. The runtime React components stay in
// multi-stores-web/src/themes/<theme>/sections/.

export type LocalizedString = Record<string, string>;

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'color'
  | 'image'
  | 'url'
  | 'select'
  | 'menuPicker'
  | 'productPicker'
  | 'collectionPicker'
  | 'repeater';

export interface FieldDefinition {
  key: string;
  type: FieldType;
  label: LocalizedString;
  description?: LocalizedString;
  required?: boolean;
  defaultValue?: unknown;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: { value: string; label: LocalizedString }[];
  fields?: FieldDefinition[];
  // Conditional visibility — show this field only when a sibling field's
  // value is one of `in`. Used inside repeaters (e.g. a content block shows
  // only the fields relevant to its selected `type`).
  showIf?: { key: string; in: string[] };
}

export interface SectionSchema {
  id: string;
  label: LocalizedString;
  icon?: string;
  category: 'showcase' | 'content' | 'commerce' | 'social' | 'layout' | 'header' | 'footer';
  description?: LocalizedString;
  translatable: string[];
  schema: FieldDefinition[];
  defaultSettings?: Record<string, unknown>;
  defaultContent?: Record<string, unknown>;
  // Page types this section is available on. When omitted, the section is
  // available on every page type EXCEPT HEADER/FOOTER (the chrome palettes).
  // Chrome-only sections set pageTypes: ['HEADER'] or ['FOOTER'] to avoid
  // polluting the regular HOME / LANDING / STATIC palettes.
  pageTypes?: Array<'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER'>;
}

// Shared select options
const ALIGNMENT_OPTIONS = [
  { value: 'left', label: { en: 'Left', ar: 'يسار' } },
  { value: 'center', label: { en: 'Center', ar: 'وسط' } },
  { value: 'right', label: { en: 'Right', ar: 'يمين' } },
];

const ICON_OPTIONS = [
  { value: 'truck', label: { en: 'Truck (shipping)', ar: 'شاحنة (شحن)' } },
  { value: 'refresh', label: { en: 'Refresh (returns)', ar: 'تحديث (إرجاع)' } },
  { value: 'shield', label: { en: 'Shield (secure)', ar: 'درع (آمن)' } },
  { value: 'card', label: { en: 'Card (payment)', ar: 'بطاقة (دفع)' } },
  { value: 'award', label: { en: 'Award (quality)', ar: 'جائزة (جودة)' } },
  { value: 'star', label: { en: 'Star (rated)', ar: 'نجمة (مقيّم)' } },
  { value: 'headphones', label: { en: 'Headphones (support)', ar: 'سماعات (دعم)' } },
  { value: 'leaf', label: { en: 'Leaf (eco)', ar: 'ورقة (بيئي)' } },
];

// ── Shared field builders ──────────────────────────────────────────────
// Per-element color and button-style fields. Spread into a section's
// `schema` array. All overrides are optional — empty means "use theme
// default", which the storefront resolves at render time.

const c = (key: string, en: string, ar: string): FieldDefinition => ({
  key, type: 'color', label: { en, ar },
});

const n = (
  key: string, en: string, ar: string,
  opts: { min?: number; max?: number; defaultValue?: number } = {},
): FieldDefinition => ({
  key, type: 'number', label: { en, ar }, ...opts,
});

/** Text-color overrides. Pick which roles a section actually has. */
function textColorFields(roles: { eyebrow?: boolean; heading?: boolean; subheading?: boolean; body?: boolean }): FieldDefinition[] {
  const out: FieldDefinition[] = [];
  if (roles.eyebrow) out.push(c('eyebrow_color', 'Eyebrow color', 'لون التسمية الصغيرة'));
  if (roles.heading) out.push(c('heading_color', 'Heading color', 'لون العنوان'));
  if (roles.subheading) out.push(c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'));
  if (roles.body) out.push(c('body_color', 'Body color', 'لون النص'));
  return out;
}

/**
 * Full button-style group: bg / text / border (color + width) / radius.
 * `prefix` distinguishes primary vs secondary CTAs (e.g. 'cta', 'cta_secondary').
 * `arLabel` is appended to the Arabic labels — e.g. 'الرئيسي' / 'الثاني'.
 */
function buttonStyleFields(prefix: string, en: { suffix?: string } = {}, ar: { suffix?: string } = {}): FieldDefinition[] {
  const enS = en.suffix ? ` ${en.suffix}` : '';
  const arS = ar.suffix ? ` ${ar.suffix}` : '';
  return [
    c(`${prefix}_bg_color`, `Button background${enS}`, `خلفية الزر${arS}`),
    c(`${prefix}_text_color`, `Button text color${enS}`, `لون نص الزر${arS}`),
    c(`${prefix}_border_color`, `Button border color${enS}`, `لون حدود الزر${arS}`),
    n(`${prefix}_border_width`, `Button border width (px)${enS}`, `سماكة حدود الزر (px)${arS}`, { min: 0, max: 8, defaultValue: 0 }),
    n(`${prefix}_border_radius`, `Button corner radius (px)${enS}`, `انحناء زوايا الزر (px)${arS}`, { min: 0, max: 100 }),
  ];
}

// ── Section catalog (mirrors multi-stores-web/src/themes/minimal/sections/*) ─

export const SECTION_SCHEMAS: SectionSchema[] = [
  {
    id: 'hero-banner',
    label: { en: 'Hero Banner', ar: 'بانر رئيسي' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'Top-of-page banner. Three layouts: centered, full-bleed image background, or side-by-side.',
      ar: 'بانر أعلى الصفحة. ثلاث تخطيطات: في الوسط، خلفية صورة كاملة، أو صورة بجانب نص.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'centered',
        options: [
          { value: 'centered', label: { en: 'Centered', ar: 'وسط' } },
          { value: 'image-background', label: { en: 'Image background', ar: 'صورة كخلفية' } },
          { value: 'side-by-side', label: { en: 'Side-by-side', ar: 'جنبًا إلى جنب' } },
        ],
      },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height (for image background)', ar: 'الارتفاع (لخلفية الصورة)' },
        defaultValue: 'md',
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة' }, min: 0, max: 1, defaultValue: 0.35 },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
      // Per-element colors + button styles. All optional; empty = theme default.
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta', { suffix: '(primary)' }, { suffix: '(رئيسي)' }),
      ...buttonStyleFields('cta_secondary', { suffix: '(secondary)' }, { suffix: '(ثانوي)' }),
    ],
    defaultSettings: { layout: 'centered', alignment: 'center', height: 'md', overlay_opacity: 0.35 },
    defaultContent: {
      heading: 'Welcome to our store',
      subheading: 'Discover our latest collection',
      cta_text: 'Shop now',
    },
  },
  {
    id: 'hero-slider',
    label: { en: 'Hero Slider', ar: 'سلايدر البانر الرئيسي' },
    icon: 'images',
    category: 'showcase',
    description: {
      en: 'Multi-slide hero carousel. Full-bleed image + text + CTA per slide, with autoplay/arrows/dots.',
      ar: 'سلايدر بانر متعدد الشرائح. صورة كاملة العرض مع نص وزر لكل شريحة، مع تشغيل تلقائي وأسهم ونقاط.',
    },
    translatable: ['slides'],
    schema: [
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'sm', label: { en: 'Small (320px)', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium (480px)', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large (640px)', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة' }, min: 0, max: 1, defaultValue: 0.4 },
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 5000 },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: true },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: true },
      {
        key: 'slides',
        type: 'repeater',
        label: { en: 'Slides', ar: 'الشرائح' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Background image', ar: 'صورة الخلفية' } },
          { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
          { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
          { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
          { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
          { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
          { key: 'alignment', type: 'select', label: { en: 'Text alignment', ar: 'محاذاة النص' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
        ],
      },
      // Section-level styling — applied to all slides for consistency.
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: {
      height: 'lg',
      overlay_opacity: 0.4,
      autoplay_ms: 5000,
      show_arrows: true,
      show_dots: true,
      loop: true,
    },
    defaultContent: {
      slides: [
        {
          eyebrow: 'New season',
          heading: 'Welcome to our store',
          subheading: 'Discover the latest collection — handpicked just for you.',
          cta_text: 'Shop now',
          cta_url: '#',
          alignment: 'center',
        },
        {
          eyebrow: 'Limited time',
          heading: 'Spring sale up to 40% off',
          subheading: 'Save on best-sellers across every category.',
          cta_text: 'See offers',
          cta_url: '#',
          alignment: 'center',
        },
      ],
    },
  },
  {
    id: 'aurora-hero',
    label: { en: 'Aurora Hero', ar: 'بانر أورورا' },
    icon: 'sparkles',
    category: 'showcase',
    description: {
      en: 'A modern full-bleed hero with soft animated SVG gradient blobs drifting behind the headline.',
      ar: 'بانر عصري كامل العرض بأشكال SVG متدرّجة متحرّكة تنساب خلف العنوان.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text'],
    schema: [
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
      c('bg_color', 'Background color', 'لون الخلفية'),
      c('color_1', 'Aurora color 1', 'لون أورورا 1'),
      c('color_2', 'Aurora color 2', 'لون أورورا 2'),
      c('color_3', 'Aurora color 3', 'لون أورورا 3'),
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
      c('eyebrow_color', 'Eyebrow color', 'لون التسمية الصغيرة'),
      c('cta_bg_color', 'Button background', 'خلفية الزر'),
      c('cta_text_color', 'Button text color', 'لون نص الزر'),
      n('cta_border_radius', 'Button corner radius (px)', 'انحناء زوايا الزر (px)', { min: 0, max: 100 }),
      c('cta_secondary_border_color', 'Secondary button border', 'حدود الزر الثاني'),
    ],
    defaultSettings: { height: 'lg', bg_color: '#0b1020', color_1: '#6366f1', color_2: '#ec4899', color_3: '#06b6d4' },
    defaultContent: {
      eyebrow: 'New',
      heading: 'Build something people love',
      subheading: 'A modern hero with a living gradient backdrop.',
      cta_text: 'Get started',
      cta_secondary_text: 'Learn more',
    },
  },
  {
    id: 'bento-grid',
    label: { en: 'Bento Grid', ar: 'شبكة بنتو' },
    icon: 'layout-grid',
    category: 'content',
    description: {
      en: 'A modern asymmetric grid of mixed-size tiles with images or text. Tiles reveal in a stagger and lift on hover.',
      ar: 'شبكة عصرية غير متماثلة من بطاقات بأحجام مختلفة بصور أو نصوص. تظهر بالتتابع وترتفع عند المرور.',
    },
    translatable: ['heading', 'subheading', 'tiles'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'tiles',
        type: 'repeater',
        label: { en: 'Tiles', ar: 'البطاقات' },
        fields: [
          { key: 'size', type: 'select', label: { en: 'Size', ar: 'الحجم' }, defaultValue: 'small', options: [
            { value: 'small', label: { en: 'Small (1×1)', ar: 'صغير (1×1)' } },
            { value: 'wide', label: { en: 'Wide (2×1)', ar: 'عريض (2×1)' } },
            { value: 'tall', label: { en: 'Tall (1×2)', ar: 'طويل (1×2)' } },
            { value: 'large', label: { en: 'Large (2×2)', ar: 'كبير (2×2)' } },
          ] },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'text', type: 'textarea', label: { en: 'Text', ar: 'النص' } },
          { key: 'image', type: 'image', label: { en: 'Background image (optional)', ar: 'صورة خلفية (اختياري)' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          c('bg_color', 'Tile color (no image)', 'لون البطاقة (بدون صورة)'),
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
    ],
    defaultSettings: {},
    defaultContent: {
      tiles: [
        { size: 'large', title: 'Featured', text: 'Your headline highlight goes here.' },
        { size: 'small', title: 'Fast' },
        { size: 'small', title: 'Secure' },
        { size: 'wide', title: 'Loved by thousands', text: 'Add a supporting line.' },
        { size: 'tall', title: 'Quality' },
      ],
    },
  },
  {
    id: 'animated-features',
    label: { en: 'Animated Features', ar: 'مميزات متحرّكة' },
    icon: 'sparkles',
    category: 'content',
    description: {
      en: 'A row of features whose line-art SVG icons draw themselves when scrolled into view.',
      ar: 'صف من المميزات بأيقونات SVG خطية ترسم نفسها عند ظهورها أثناء التمرير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      n('columns', 'Columns', 'الأعمدة', { min: 2, max: 4, defaultValue: 4 }),
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Features', ar: 'المميزات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: [
            { value: 'bolt', label: { en: 'Bolt', ar: 'برق' } },
            { value: 'heart', label: { en: 'Heart', ar: 'قلب' } },
            { value: 'star', label: { en: 'Star', ar: 'نجمة' } },
            { value: 'gift', label: { en: 'Gift', ar: 'هدية' } },
            { value: 'shield', label: { en: 'Shield', ar: 'درع' } },
            { value: 'truck', label: { en: 'Truck', ar: 'شاحنة' } },
            { value: 'check', label: { en: 'Check', ar: 'صح' } },
            { value: 'spark', label: { en: 'Spark', ar: 'بريق' } },
          ] },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      c('icon_color', 'Icon color', 'لون الأيقونة'),
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
      c('title_color', 'Feature title color', 'لون عنوان الميزة'),
      c('description_color', 'Feature description color', 'لون وصف الميزة'),
    ],
    defaultSettings: { columns: 4 },
    defaultContent: {
      items: [
        { icon: 'bolt', title: 'Lightning fast', description: 'Built for speed from the ground up.' },
        { icon: 'shield', title: 'Secure', description: 'Protected with bank-level encryption.' },
        { icon: 'heart', title: 'Loved', description: 'Trusted by thousands of customers.' },
        { icon: 'spark', title: 'Delightful', description: 'Thoughtful details in every corner.' },
      ],
    },
  },
  {
    id: 'marquee-text',
    label: { en: 'Marquee Text', ar: 'نص متحرّك' },
    icon: 'type',
    category: 'showcase',
    description: {
      en: 'A bold oversized phrase that scrolls across the screen on a loop. Pauses on hover.',
      ar: 'عبارة ضخمة جريئة تمرّ أفقياً عبر الشاشة بشكل متكرّر. تتوقف عند المرور.',
    },
    translatable: ['text'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 60 },
      { key: 'separator', type: 'text', label: { en: 'Separator', ar: 'الفاصل' }, maxLength: 3, defaultValue: '✦' },
      {
        key: 'size',
        type: 'select',
        label: { en: 'Size', ar: 'الحجم' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'xl', label: { en: 'Extra large', ar: 'ضخم' } },
        ],
      },
      {
        key: 'speed',
        type: 'select',
        label: { en: 'Speed', ar: 'السرعة' },
        defaultValue: 'normal',
        options: [
          { value: 'slow', label: { en: 'Slow', ar: 'بطيء' } },
          { value: 'normal', label: { en: 'Normal', ar: 'متوسط' } },
          { value: 'fast', label: { en: 'Fast', ar: 'سريع' } },
        ],
      },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مصمت' } },
          { value: 'outline', label: { en: 'Outline', ar: 'مفرّغ' } },
        ],
      },
      c('text_color', 'Text color', 'لون النص'),
      c('bg_color', 'Background color', 'لون الخلفية'),
    ],
    defaultSettings: { separator: '✦', size: 'lg', speed: 'normal', style: 'solid' },
    defaultContent: { text: 'Free shipping worldwide' },
  },
  {
    id: 'rich-text',
    label: { en: 'Rich Text', ar: 'نص منسّق' },
    icon: 'text',
    category: 'content',
    description: {
      en: 'Long-form content with optional eyebrow, heading, and surface card style.',
      ar: 'محتوى مطوّل مع تسمية وعنوان وخيار بطاقة ملوّنة.',
    },
    translatable: ['eyebrow', 'heading', 'html'],
    schema: [
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'html', type: 'richtext', label: { en: 'Content', ar: 'المحتوى' } },
      {
        key: 'width',
        type: 'select',
        label: { en: 'Content width', ar: 'عرض المحتوى' },
        defaultValue: 'normal',
        options: [
          { value: 'narrow', label: { en: 'Narrow', ar: 'ضيّق' } },
          { value: 'normal', label: { en: 'Normal', ar: 'عادي' } },
          { value: 'wide', label: { en: 'Wide', ar: 'واسع' } },
        ],
      },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'left', options: [
        { value: 'left', label: { en: 'Left', ar: 'يسار' } },
        { value: 'center', label: { en: 'Center', ar: 'وسط' } },
      ] },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Vertical padding', ar: 'الحشو العمودي' },
        defaultValue: 'medium',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'small', label: { en: 'Small', ar: 'صغير' } },
          { value: 'medium', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'large', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'surface', type: 'boolean', label: { en: 'Card background', ar: 'خلفية بطاقة' }, defaultValue: false },
    ],
    defaultSettings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
    defaultContent: {
      heading: 'About us',
      html: '<p>Tell your story here. This block supports rich formatting — headings, links, lists.</p>',
    },
  },
  {
    id: 'image-gallery',
    label: { en: 'Image Gallery', ar: 'معرض صور' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Visual grid, masonry or horizontal carousel. Each image can link and reveal a caption.',
      ar: 'شبكة، Masonry، أو شريط أفقي. كل صورة قابلة للربط مع تسمية تظهر عند المرور.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
          { value: 'masonry', label: { en: 'Masonry', ar: 'Masonry' } },
          { value: 'carousel', label: { en: 'Horizontal carousel', ar: 'شريط أفقي' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'auto', label: { en: 'Original', ar: 'الأصلي' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop (grid)', ar: 'الأعمدة — سطح المكتب (للشبكة)' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'show_caption', type: 'boolean', label: { en: 'Show captions on hover', ar: 'تسميات عند المرور' }, defaultValue: true },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'url', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية' } },
          { key: 'href', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
    defaultSettings: { layout: 'grid', aspect: 'square', columns: 3, columns_tablet: 2, columns_mobile: 2, show_caption: true, rounded: true },
    defaultContent: {
      heading: 'Gallery',
    },
  },
  {
    id: 'gallery-slider',
    label: { en: 'Gallery Slider', ar: 'سلايدر معرض الصور' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Horizontal image carousel. Independent slides-per-view per device, optional autoplay, captions on hover.',
      ar: 'شريط صور أفقي. عدد شرائح مستقل لكل جهاز، تشغيل تلقائي اختياري، تسميات عند المرور.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'slides_per_view', type: 'number', label: { en: 'Slides per view — desktop', ar: 'عدد الشرائح — سطح المكتب' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'slides_per_view_tablet', type: 'number', label: { en: 'Slides per view — tablet', ar: 'عدد الشرائح — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'slides_per_view_mobile', type: 'number', label: { en: 'Slides per view — mobile', ar: 'عدد الشرائح — جوال' }, min: 1, max: 4, defaultValue: 1 },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between slides (px)', ar: 'الفجوة بين الشرائح (px)' }, min: 0, max: 64, defaultValue: 16 },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      { key: 'show_caption', type: 'boolean', label: { en: 'Show captions on hover', ar: 'إظهار التسميات عند المرور' }, defaultValue: true },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 0 },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: true },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: false },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'url', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية' } },
          { key: 'href', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
    defaultSettings: {
      slides_per_view: 3,
      slides_per_view_tablet: 2,
      slides_per_view_mobile: 1,
      gap_px: 16,
      aspect: 'square',
      show_caption: true,
      rounded: true,
      autoplay_ms: 0,
      show_arrows: true,
      show_dots: true,
      loop: false,
    },
  },
  {
    id: 'image-with-text',
    label: { en: 'Image with Text', ar: 'صورة مع نص' },
    icon: 'columns',
    category: 'content',
    description: {
      en: '50/50 image and text. Common for "About", "Story", or feature spotlights.',
      ar: 'صورة 50/50 مع نص. مناسب لـ "من نحن"، "قصتنا"، أو ميزة.',
    },
    translatable: ['eyebrow', 'heading', 'body', 'cta_text'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'image_position',
        type: 'select',
        label: { en: 'Image position', ar: 'موقع الصورة' },
        defaultValue: 'left',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'right', label: { en: 'Right', ar: 'يمين' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect', ar: 'نسبة الصورة' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'body', type: 'textarea', label: { en: 'Body text', ar: 'النص' } },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' } },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      ...textColorFields({ eyebrow: true, heading: true, body: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { image_position: 'left', aspect: 'square' },
    defaultContent: {
      eyebrow: 'Our story',
      heading: 'Crafted with care',
      body: 'Replace this with a short paragraph about your brand, process, or mission.',
      cta_text: 'Learn more',
    },
  },
  {
    id: 'faq-list',
    label: { en: 'FAQ List', ar: 'الأسئلة الشائعة' },
    icon: 'help',
    category: 'content',
    description: {
      en: 'Smooth-animated accordion. One or two columns; single or multiple open.',
      ar: 'أكورديون بحركة ناعمة. عمود أو عمودان.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'stacked',
        options: [
          { value: 'stacked', label: { en: 'Stacked (1 column)', ar: 'عمود واحد' } },
          { value: 'two-column', label: { en: 'Two columns', ar: 'عمودان' } },
        ],
      },
      { key: 'allow_multiple', type: 'boolean', label: { en: 'Allow multiple open', ar: 'السماح بفتح عدة' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Questions', ar: 'الأسئلة' },
        fields: [
          { key: 'question', type: 'text', label: { en: 'Question', ar: 'السؤال' } },
          { key: 'answer', type: 'textarea', label: { en: 'Answer', ar: 'الإجابة' } },
        ],
      },
    ],
    defaultSettings: { layout: 'stacked', allow_multiple: true },
    defaultContent: {
      heading: 'Frequently asked questions',
      items: [
        { question: 'How long does shipping take?', answer: 'Most orders arrive within 3–5 business days.' },
        { question: 'What is your return policy?', answer: 'We accept returns within 30 days of delivery.' },
        { question: 'Do you ship internationally?', answer: 'Yes — international shipping rates appear at checkout.' },
      ],
    },
  },
  {
    id: 'call-to-action',
    label: { en: 'Call to Action', ar: 'دعوة لإجراء' },
    icon: 'megaphone',
    category: 'showcase',
    description: {
      en: 'Highlighted block with a button. Four styles: solid, gradient, image background, or split.',
      ar: 'بطاقة بارزة مع زر. أربعة أنماط.',
    },
    translatable: ['heading', 'subheading', 'cta_text'],
    schema: [
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid color', ar: 'لون صلب' } },
          { value: 'gradient', label: { en: 'Gradient', ar: 'تدرّج' } },
          { value: 'image-bg', label: { en: 'Image background', ar: 'صورة كخلفية' } },
          { value: 'split', label: { en: 'Split (text + image)', ar: 'منقسم' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 100 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      ...textColorFields({ heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { style: 'solid' },
    defaultContent: {
      heading: 'Ready to start?',
      subheading: 'Browse the full collection and find something you love.',
      cta_text: 'Shop now',
    },
  },
  {
    id: 'sticky-cta-bar',
    label: { en: 'Sticky CTA Bar', ar: 'شريط دعوة لاصق' },
    icon: 'megaphone',
    category: 'showcase',
    description: {
      en: 'A call-to-action bar that slides up and pins to the bottom of the screen after the visitor scrolls. Dismissible.',
      ar: 'شريط دعوة لإجراء ينزلق ويلتصق بأسفل الشاشة بعد أن يمرّر الزائر. قابل للإغلاق.',
    },
    translatable: ['text', 'cta_text'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 120 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      n('show_after_px', 'Show after scrolling (px)', 'يظهر بعد التمرير (px)', { min: 0, max: 4000, defaultValue: 500 }),
      { key: 'show_close', type: 'boolean', label: { en: 'Show dismiss button', ar: 'إظهار زر الإغلاق' }, defaultValue: true },
      c('bar_bg_color', 'Bar background', 'خلفية الشريط'),
      c('text_color', 'Text color', 'لون النص'),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { show_after_px: 500, show_close: true },
    defaultContent: { text: 'Ready to get started?', cta_text: 'Shop now' },
  },
  {
    id: 'trust-badges',
    label: { en: 'Trust Badges', ar: 'شارات الثقة' },
    icon: 'shield',
    category: 'social',
    description: {
      en: 'Row of reassurance points (shipping, returns, payment). Cards or inline.',
      ar: 'صف من نقاط الثقة. بطاقات أو سطر.',
    },
    translatable: ['items'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'cards',
        options: [
          { value: 'cards', label: { en: 'Cards', ar: 'بطاقات' } },
          { value: 'inline', label: { en: 'Inline row', ar: 'سطر' } },
        ],
      },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Padding', ar: 'الحشو' },
        defaultValue: 'comfortable',
        options: [
          { value: 'compact', label: { en: 'Compact', ar: 'مدمج' } },
          { value: 'comfortable', label: { en: 'Comfortable', ar: 'مريح' } },
        ],
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Badges', ar: 'الشارات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: ICON_OPTIONS },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
    ],
    defaultSettings: { layout: 'cards', padding: 'comfortable' },
    defaultContent: {
      items: [
        { icon: 'truck', label: 'Free shipping', description: 'On orders over $50' },
        { icon: 'refresh', label: '30-day returns', description: 'Easy and free' },
        { icon: 'shield', label: 'Secure checkout', description: 'Protected payments' },
        { icon: 'headphones', label: 'Friendly support', description: 'Available 7 days a week' },
      ],
    },
  },
  {
    id: 'newsletter-signup',
    label: { en: 'Newsletter Signup', ar: 'الاشتراك بالنشرة' },
    icon: 'mail',
    category: 'social',
    description: {
      en: 'Email capture form. Three styles: surface card, plain inline, or gradient banner.',
      ar: 'نموذج بريد إلكتروني. ثلاثة أنماط.',
    },
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'FOOTER'],
    translatable: ['heading', 'subheading', 'placeholder', 'button_label', 'success_message'],
    schema: [
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'card',
        options: [
          { value: 'card', label: { en: 'Card', ar: 'بطاقة' } },
          { value: 'inline', label: { en: 'Inline', ar: 'سطر' } },
          { value: 'banner', label: { en: 'Banner', ar: 'بانر' } },
        ],
      },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'placeholder', type: 'text', label: { en: 'Input placeholder', ar: 'النص داخل الحقل' } },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
      { key: 'success_message', type: 'text', label: { en: 'Success message', ar: 'رسالة النجاح' } },
      ...textColorFields({ heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { style: 'card' },
    defaultContent: {
      heading: 'Join our newsletter',
      subheading: 'Get exclusive offers and product launches straight to your inbox.',
      placeholder: 'your@email.com',
      button_label: 'Subscribe',
      success_message: "Thanks — you're subscribed.",
    },
  },
  {
    id: 'social-icons',
    label: { en: 'Social Icons', ar: 'أيقونات التواصل الاجتماعي' },
    icon: 'share',
    category: 'social',
    description: {
      en: '18 platforms (Instagram, TikTok, X, …) with brand colors or your own palette. Horizontal/vertical/grid layouts, three shapes, hover effects.',
      ar: '18 منصّة (إنستغرام، تيك توك، إكس، …) بألوان كل منصّة أو لوحة ألوانك. تخطيطات أفقي/عمودي/شبكة، ثلاثة أشكال، تأثيرات تمرير.',
    },
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'HEADER', 'FOOTER'],
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading (optional)', ar: 'العنوان الفرعي (اختياري)' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Social links', ar: 'الروابط الاجتماعية' },
        fields: [
          {
            key: 'platform',
            type: 'select',
            label: { en: 'Platform', ar: 'المنصّة' },
            defaultValue: 'instagram',
            options: [
              { value: 'instagram', label: { en: 'Instagram', ar: 'إنستغرام' } },
              { value: 'facebook', label: { en: 'Facebook', ar: 'فيسبوك' } },
              { value: 'twitter', label: { en: 'X (Twitter)', ar: 'إكس (تويتر)' } },
              { value: 'tiktok', label: { en: 'TikTok', ar: 'تيك توك' } },
              { value: 'youtube', label: { en: 'YouTube', ar: 'يوتيوب' } },
              { value: 'whatsapp', label: { en: 'WhatsApp', ar: 'واتساب' } },
              { value: 'snapchat', label: { en: 'Snapchat', ar: 'سناب شات' } },
              { value: 'telegram', label: { en: 'Telegram', ar: 'تيليغرام' } },
              { value: 'pinterest', label: { en: 'Pinterest', ar: 'بينترست' } },
              { value: 'linkedin', label: { en: 'LinkedIn', ar: 'لينكدإن' } },
              { value: 'discord', label: { en: 'Discord', ar: 'ديسكورد' } },
              { value: 'reddit', label: { en: 'Reddit', ar: 'ريديت' } },
              { value: 'twitch', label: { en: 'Twitch', ar: 'تويتش' } },
              { value: 'github', label: { en: 'GitHub', ar: 'غيت هاب' } },
              { value: 'threads', label: { en: 'Threads', ar: 'ثريدز' } },
              { value: 'email', label: { en: 'Email', ar: 'بريد إلكتروني' } },
              { value: 'phone', label: { en: 'Phone', ar: 'هاتف' } },
              { value: 'website', label: { en: 'Website', ar: 'موقع إلكتروني' } },
            ],
          },
          { key: 'url', type: 'text', label: { en: 'URL or handle', ar: 'الرابط أو المُعرّف' } },
          { key: 'label', type: 'text', label: { en: 'Custom label (optional)', ar: 'تسمية مخصّصة (اختياري)' } },
        ],
      },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'horizontal',
        options: [
          { value: 'horizontal', label: { en: 'Horizontal row', ar: 'صف أفقي' } },
          { value: 'vertical', label: { en: 'Vertical stack', ar: 'عمود عمودي' } },
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
        ],
      },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between icons (px)', ar: 'المسافة بين الأيقونات (px)' }, min: 0, max: 80, defaultValue: 12 },
      {
        key: 'icon_style',
        type: 'select',
        label: { en: 'Icon style', ar: 'نمط الأيقونة' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid chip', ar: 'بطاقة ملوّنة' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
          { value: 'plain', label: { en: 'Plain (no chip)', ar: 'بدون بطاقة' } },
        ],
      },
      {
        key: 'icon_shape',
        type: 'select',
        label: { en: 'Shape', ar: 'الشكل' },
        defaultValue: 'circle',
        options: [
          { value: 'circle', label: { en: 'Circle', ar: 'دائري' } },
          { value: 'rounded', label: { en: 'Rounded square', ar: 'مربع مدوّر' } },
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
        ],
      },
      {
        key: 'size',
        type: 'select',
        label: { en: 'Size preset', ar: 'الحجم' },
        defaultValue: 'md',
        options: [
          { value: 'xs', label: { en: 'XS (28px)', ar: 'صغير جداً (28px)' } },
          { value: 'sm', label: { en: 'Small (36px)', ar: 'صغير (36px)' } },
          { value: 'md', label: { en: 'Medium (44px)', ar: 'متوسط (44px)' } },
          { value: 'lg', label: { en: 'Large (56px)', ar: 'كبير (56px)' } },
          { value: 'xl', label: { en: 'XL (72px)', ar: 'كبير جداً (72px)' } },
        ],
      },
      { key: 'size_px', type: 'number', label: { en: 'Custom size (px, overrides preset)', ar: 'حجم مخصّص (px، يلغي الحجم المختار)' }, min: 16, max: 200 },
      {
        key: 'color_mode',
        type: 'select',
        label: { en: 'Color mode', ar: 'وضع الألوان' },
        defaultValue: 'brand',
        options: [
          { value: 'brand', label: { en: 'Brand colors (per platform)', ar: 'ألوان كل منصّة' } },
          { value: 'theme-primary', label: { en: 'Theme primary', ar: 'اللون الأساسي للثيم' } },
          { value: 'theme-accent', label: { en: 'Theme accent', ar: 'لون التمييز للثيم' } },
          { value: 'theme-text', label: { en: 'Theme text', ar: 'لون نص الثيم' } },
          { value: 'custom', label: { en: 'Custom', ar: 'مخصّص' } },
        ],
      },
      { key: 'custom_color', type: 'color', label: { en: 'Custom icon color', ar: 'لون الأيقونة المخصّص' } },
      { key: 'custom_bg_color', type: 'color', label: { en: 'Custom chip background (solid style)', ar: 'خلفية البطاقة المخصّصة (نمط مملوء)' } },
      {
        key: 'label_mode',
        type: 'select',
        label: { en: 'Show platform name', ar: 'إظهار اسم المنصّة' },
        defaultValue: 'never',
        options: [
          { value: 'never', label: { en: 'Never', ar: 'أبداً' } },
          { value: 'hover', label: { en: 'On hover', ar: 'عند المرور' } },
          { value: 'always', label: { en: 'Always', ar: 'دائماً' } },
        ],
      },
      {
        key: 'hover_effect',
        type: 'select',
        label: { en: 'Hover effect', ar: 'تأثير التمرير' },
        defaultValue: 'scale',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'scale', label: { en: 'Scale up', ar: 'تكبير' } },
          { value: 'lift', label: { en: 'Lift', ar: 'رفع' } },
          { value: 'invert', label: { en: 'Fade (solid only)', ar: 'تلاشٍ (للنمط المملوء فقط)' } },
        ],
      },
      { key: 'open_in_new_tab', type: 'boolean', label: { en: 'Open links in new tab', ar: 'فتح الروابط في نافذة جديدة' }, defaultValue: true },
      { key: 'nofollow', type: 'boolean', label: { en: 'Add rel="nofollow"', ar: 'إضافة rel="nofollow"' }, defaultValue: false },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: {
      layout: 'horizontal',
      alignment: 'center',
      gap_px: 12,
      icon_style: 'solid',
      icon_shape: 'circle',
      size: 'md',
      color_mode: 'brand',
      label_mode: 'never',
      hover_effect: 'scale',
      open_in_new_tab: true,
      nofollow: false,
    },
    defaultContent: {
      items: [
        { platform: 'instagram', url: 'https://instagram.com/' },
        { platform: 'facebook', url: 'https://facebook.com/' },
        { platform: 'tiktok', url: 'https://tiktok.com/' },
        { platform: 'whatsapp', url: 'https://wa.me/' },
      ],
    },
  },
  {
    id: 'testimonials',
    label: { en: 'Testimonials', ar: 'آراء العملاء' },
    icon: 'quote',
    category: 'social',
    description: {
      en: 'Customer quotes with name, role, avatar and star rating. Cards or plain layout.',
      ar: 'اقتباسات العملاء مع الاسم والصفة والصورة والتقييم بالنجوم. بطاقات أو تخطيط بسيط.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'cards',
        options: [
          { value: 'cards', label: { en: 'Cards', ar: 'بطاقات' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
        ],
      },
      n('columns', 'Columns', 'الأعمدة', { min: 1, max: 4, defaultValue: 3 }),
      { key: 'show_rating', type: 'boolean', label: { en: 'Show star rating', ar: 'إظهار التقييم بالنجوم' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Testimonials', ar: 'الآراء' },
        fields: [
          { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' } },
          { key: 'author', type: 'text', label: { en: 'Author name', ar: 'اسم صاحب الرأي' } },
          { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' } },
          { key: 'avatar', type: 'image', label: { en: 'Avatar', ar: 'الصورة' } },
          { key: 'rating', type: 'number', label: { en: 'Rating (0–5)', ar: 'التقييم (0–5)' }, min: 0, max: 5, defaultValue: 5 },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
      c('star_color', 'Star color', 'لون النجوم'),
      c('star_empty_color', 'Empty star color', 'لون النجوم الفارغة'),
      c('quote_icon_color', 'Quote icon color', 'لون أيقونة الاقتباس'),
      c('quote_color', 'Quote text color', 'لون نص الاقتباس'),
      c('author_color', 'Author name color', 'لون اسم الكاتب'),
      c('role_color', 'Role / company color', 'لون الصفة / الشركة'),
      c('card_bg_color', 'Card background (cards layout)', 'خلفية البطاقة (تخطيط البطاقات)'),
      c('card_border_color', 'Card border (cards layout)', 'حد البطاقة (تخطيط البطاقات)'),
    ],
    defaultSettings: { layout: 'cards', columns: 3, show_rating: true },
    defaultContent: {
      heading: 'What our customers say',
      items: [
        { quote: 'Absolutely love the quality — exceeded my expectations.', author: 'Sarah M.', role: 'Verified buyer', rating: 5 },
        { quote: 'Fast shipping and great support. Will order again.', author: 'Ahmed K.', role: 'Verified buyer', rating: 5 },
        { quote: 'Beautiful products at a fair price. Highly recommend.', author: 'Lena P.', role: 'Verified buyer', rating: 4 },
      ],
    },
  },
  {
    id: 'logo-list',
    label: { en: 'Logo List', ar: 'قائمة الشعارات' },
    icon: 'image',
    category: 'social',
    description: {
      en: 'Row of partner or brand logos. Optional grayscale that colours on hover.',
      ar: 'صف من شعارات الشركاء أو الماركات. خيار تدرّج رمادي يتلوّن عند المرور.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      n('columns', 'Columns', 'الأعمدة', { min: 2, max: 8, defaultValue: 5 }),
      { key: 'grayscale', type: 'boolean', label: { en: 'Grayscale (colour on hover)', ar: 'رمادي (يتلوّن عند المرور)' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Logos', ar: 'الشعارات' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Logo image', ar: 'صورة الشعار' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل' } },
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
    ],
    defaultSettings: { columns: 5, grayscale: true },
    defaultContent: { heading: 'Trusted by leading brands', items: [] },
  },
  {
    id: 'logo-marquee',
    label: { en: 'Logo Marquee', ar: 'شريط شعارات متحرك' },
    icon: 'image',
    category: 'social',
    description: {
      en: 'Auto-scrolling row of partner or brand logos. Pauses on hover; grayscale colours on hover.',
      ar: 'صف شعارات يتحرك تلقائياً للشركاء أو الماركات. يتوقف عند المرور؛ ويتلوّن الرمادي عند المرور.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      {
        key: 'speed',
        type: 'select',
        label: { en: 'Scroll speed', ar: 'سرعة التمرير' },
        defaultValue: 'normal',
        options: [
          { value: 'slow', label: { en: 'Slow', ar: 'بطيء' } },
          { value: 'normal', label: { en: 'Normal', ar: 'متوسط' } },
          { value: 'fast', label: { en: 'Fast', ar: 'سريع' } },
        ],
      },
      { key: 'grayscale', type: 'boolean', label: { en: 'Grayscale (colour on hover)', ar: 'رمادي (يتلوّن عند المرور)' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Logos', ar: 'الشعارات' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Logo image', ar: 'صورة الشعار' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل' } },
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
    ],
    defaultSettings: { speed: 'normal', grayscale: true },
    defaultContent: { heading: 'Trusted by leading brands', items: [] },
  },
  {
    id: 'stats-bar',
    label: { en: 'Stats', ar: 'إحصائيات' },
    icon: 'bar-chart',
    category: 'content',
    description: {
      en: 'Row of big numbers with labels — customers, orders, ratings, anything.',
      ar: 'صف من الأرقام الكبيرة مع تسميات — عملاء، طلبات، تقييمات، أي شيء.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'plain',
        options: [
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
          { value: 'surface', label: { en: 'Surface card', ar: 'بطاقة' } },
        ],
      },
      n('columns', 'Columns', 'الأعمدة', { min: 2, max: 4, defaultValue: 3 }),
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Stats', ar: 'الأرقام' },
        fields: [
          { key: 'value', type: 'text', label: { en: 'Value', ar: 'القيمة' } },
          { key: 'prefix', type: 'text', label: { en: 'Prefix (optional)', ar: 'بادئة (اختياري)' } },
          { key: 'suffix', type: 'text', label: { en: 'Suffix (optional)', ar: 'لاحقة (اختياري)' } },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
        ],
      },
      c('value_color', 'Number color', 'لون الرقم'),
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { style: 'plain', columns: 3 },
    defaultContent: {
      items: [
        { value: '10K', suffix: '+', label: 'Happy customers' },
        { value: '50K', suffix: '+', label: 'Orders delivered' },
        { value: '4.9', suffix: '/5', label: 'Average rating' },
      ],
    },
  },
  {
    id: 'feature-grid',
    label: { en: 'Features', ar: 'المميزات' },
    icon: 'sparkles',
    category: 'content',
    description: {
      en: 'Grid of features, each with an icon, title and short description.',
      ar: 'شبكة من المميزات، كل منها بأيقونة وعنوان ووصف قصير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      n('columns', 'Columns', 'الأعمدة', { min: 1, max: 4, defaultValue: 3 }),
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: [
        { value: 'left', label: { en: 'Left', ar: 'يسار' } },
        { value: 'center', label: { en: 'Center', ar: 'وسط' } },
      ] },
      {
        key: 'icon_style',
        type: 'select',
        label: { en: 'Icon style', ar: 'نمط الأيقونة' },
        defaultValue: 'chip',
        options: [
          { value: 'chip', label: { en: 'Chip', ar: 'بطاقة ملوّنة' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بدون بطاقة' } },
        ],
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Features', ar: 'المميزات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: [
            ...ICON_OPTIONS,
            { value: 'gift', label: { en: 'Gift', ar: 'هدية' } },
            { value: 'heart', label: { en: 'Heart', ar: 'قلب' } },
            { value: 'package', label: { en: 'Package', ar: 'صندوق' } },
            { value: 'sparkles', label: { en: 'Sparkles', ar: 'بريق' } },
            { value: 'zap', label: { en: 'Lightning', ar: 'برق' } },
          ] },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
      c('icon_color', 'Icon color', 'لون الأيقونة'),
      c('icon_bg_color', 'Icon background (chip style)', 'خلفية الأيقونة (نمط البطاقة)'),
      c('title_color', 'Feature title color', 'لون عنوان الميزة'),
      c('description_color', 'Feature description color', 'لون وصف الميزة'),
    ],
    defaultSettings: { columns: 3, alignment: 'center', icon_style: 'chip' },
    defaultContent: {
      items: [
        { icon: 'truck', title: 'Fast delivery', description: 'Get your order in record time with our express shipping.' },
        { icon: 'shield', title: 'Secure payments', description: 'Your data is protected with bank-level encryption.' },
        { icon: 'headphones', title: 'Friendly support', description: 'Our team is here for you seven days a week.' },
      ],
    },
  },
  {
    id: 'steps',
    label: { en: 'Steps', ar: 'خطوات' },
    icon: 'list-ordered',
    category: 'content',
    description: {
      en: 'Numbered "how it works" process — each step with a title and short description.',
      ar: 'خطوات مرقّمة لشرح "كيف تعمل" — كل خطوة بعنوان ووصف قصير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'show_connector', type: 'boolean', label: { en: 'Show connector line', ar: 'إظهار خط الوصل' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Steps', ar: 'الخطوات' },
        fields: [
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'badge_color', type: 'color', label: { en: 'Number badge color', ar: 'لون شارة الرقم' } },
      { key: 'badge_text_color', type: 'color', label: { en: 'Number text color', ar: 'لون رقم الشارة' } },
      { key: 'title_color', type: 'color', label: { en: 'Step title color', ar: 'لون عنوان الخطوة' } },
      { key: 'description_color', type: 'color', label: { en: 'Step description color', ar: 'لون وصف الخطوة' } },
    ],
    defaultSettings: { columns: 3, show_connector: true },
    defaultContent: {
      items: [
        { title: 'Tap', description: 'Tap your card on any smartphone — no app required.' },
        { title: 'Share', description: 'Your details and links appear instantly on their phone.' },
        { title: 'Save', description: 'They save you to their contacts with a single click.' },
      ],
    },
  },
  {
    id: 'comparison-table',
    label: { en: 'Comparison', ar: 'مقارنة' },
    icon: 'table',
    category: 'content',
    description: {
      en: 'Two-column feature comparison ("us" vs "others") with check / cross marks and a highlighted column.',
      ar: 'مقارنة من عمودين ("نحن" مقابل "الآخرون") بعلامات صح / خطأ وعمود مميَّز.',
    },
    translatable: ['heading', 'subheading', 'col_a_label', 'col_b_label', 'rows'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'col_a_label', type: 'text', label: { en: 'Your column label', ar: 'تسمية عمودك' } },
      { key: 'col_b_label', type: 'text', label: { en: 'Other column label', ar: 'تسمية العمود الآخر' } },
      {
        key: 'rows',
        type: 'repeater',
        label: { en: 'Rows', ar: 'الصفوف' },
        fields: [
          { key: 'feature', type: 'text', label: { en: 'Feature', ar: 'الميزة' } },
          { key: 'a', type: 'select', label: { en: 'Your column', ar: 'عمودك' }, defaultValue: 'yes', options: [
            { value: 'yes', label: { en: 'Yes (check)', ar: 'نعم (صح)' } },
            { value: 'no', label: { en: 'No (cross)', ar: 'لا (خطأ)' } },
          ] },
          { key: 'b', type: 'select', label: { en: 'Other column', ar: 'العمود الآخر' }, defaultValue: 'no', options: [
            { value: 'yes', label: { en: 'Yes (check)', ar: 'نعم (صح)' } },
            { value: 'no', label: { en: 'No (cross)', ar: 'لا (خطأ)' } },
          ] },
        ],
      },
      { key: 'highlight_color', type: 'color', label: { en: 'Highlight color', ar: 'لون التمييز' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
    defaultSettings: {},
    defaultContent: {
      col_a_label: 'Smart card',
      col_b_label: 'Paper card',
      rows: [
        { feature: 'Share instantly with one tap', a: 'yes', b: 'no' },
        { feature: 'Always up to date', a: 'yes', b: 'no' },
        { feature: 'Never runs out', a: 'yes', b: 'no' },
        { feature: 'Eco-friendly', a: 'yes', b: 'no' },
      ],
    },
  },
  {
    id: 'countdown',
    label: { en: 'Countdown Timer', ar: 'عدّاد تنازلي' },
    icon: 'timer',
    category: 'showcase',
    description: {
      en: 'A live countdown to a deadline — perfect for sales and launches. Shows an expired message after the date passes.',
      ar: 'عدّاد حيّ يتناقص حتى موعد محدّد — مثالي للعروض والإطلاقات. يعرض رسالة انتهاء بعد مرور الموعد.',
    },
    translatable: ['heading', 'subheading', 'expired_text'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'target_date', type: 'text', label: { en: 'End date & time (e.g. 2026-12-31T23:59)', ar: 'تاريخ ووقت الانتهاء (مثال: 2026-12-31T23:59)' } },
      { key: 'expired_text', type: 'text', label: { en: 'Expired message', ar: 'رسالة الانتهاء' } },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
      c('digit_color', 'Digit color', 'لون الأرقام'),
      c('box_bg_color', 'Box background', 'خلفية الصندوق'),
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { alignment: 'center' },
    defaultContent: {
      heading: 'Sale ends soon',
      subheading: "Don't miss out — limited time only.",
    },
  },
  {
    id: 'video',
    label: { en: 'Video', ar: 'فيديو' },
    icon: 'video',
    category: 'content',
    description: {
      en: 'Embed a YouTube/Vimeo video or a direct file. Optional poster image with a play overlay.',
      ar: 'تضمين فيديو يوتيوب/فيميو أو ملف مباشر. صورة غلاف اختيارية مع زر تشغيل.',
    },
    translatable: ['heading', 'subheading'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'video_url', type: 'url', label: { en: 'Video URL (YouTube, Vimeo, or .mp4)', ar: 'رابط الفيديو (يوتيوب، فيميو، أو .mp4)' } },
      { key: 'poster', type: 'image', label: { en: 'Poster image (optional)', ar: 'صورة الغلاف (اختياري)' } },
      {
        key: 'aspect_ratio',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: '16/9',
        options: [
          { value: '16/9', label: { en: '16:9 (widescreen)', ar: '16:9 (عريض)' } },
          { value: '4/3', label: { en: '4:3', ar: '4:3' } },
          { value: '1/1', label: { en: '1:1 (square)', ar: '1:1 (مربّع)' } },
          { value: '9/16', label: { en: '9:16 (vertical)', ar: '9:16 (عمودي)' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { aspect_ratio: '16/9' },
  },
  {
    id: 'spacer',
    label: { en: 'Spacer / Divider', ar: 'فاصل / مسافة' },
    icon: 'minus',
    category: 'layout',
    description: {
      en: 'Adds vertical breathing room between sections, with an optional divider line.',
      ar: 'يضيف مسافة عمودية بين السكشنات، مع خط فاصل اختياري.',
    },
    translatable: [],
    schema: [
      n('height_px', 'Height (px)', 'الارتفاع (px)', { min: 0, max: 400, defaultValue: 48 }),
      { key: 'show_divider', type: 'boolean', label: { en: 'Show divider line', ar: 'إظهار خط فاصل' }, defaultValue: false },
      {
        key: 'divider_style',
        type: 'select',
        label: { en: 'Divider style', ar: 'نمط الخط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'متصل' } },
          { value: 'dashed', label: { en: 'Dashed', ar: 'متقطّع' } },
          { value: 'dotted', label: { en: 'Dotted', ar: 'منقّط' } },
        ],
      },
      c('divider_color', 'Divider color', 'لون الخط'),
    ],
    defaultSettings: { height_px: 48, show_divider: false, divider_style: 'solid' },
  },
  {
    id: 'layout-columns',
    label: { en: 'Columns / Layout', ar: 'أعمدة / تخطيط' },
    icon: 'layout',
    category: 'layout',
    description: {
      en: 'Divide the page into a responsive grid or flex row. Each column holds inline blocks: heading, text, image, button, divider, spacer, or HTML.',
      ar: 'قسّم الصفحة إلى شبكة متجاوبة أو صف flex. كل عمود يحتوي بلوكات: عنوان، نص، صورة، زر، فاصل، مسافة، أو HTML.',
    },
    translatable: ['cells'],
    schema: [
      {
        key: 'mode',
        type: 'select',
        label: { en: 'Mode', ar: 'الوضع' },
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: { en: 'Grid (equal columns)', ar: 'شبكة (أعمدة متساوية)' } },
          { value: 'flex', label: { en: 'Flex (flexible widths)', ar: 'مرن (عرض متغيّر)' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 1 },
      {
        key: 'direction',
        type: 'select',
        label: { en: 'Flex direction', ar: 'اتجاه flex' },
        defaultValue: 'row',
        options: [
          { value: 'row', label: { en: 'Row', ar: 'صف' } },
          { value: 'column', label: { en: 'Column', ar: 'عمود' } },
        ],
      },
      { key: 'wrap', type: 'boolean', label: { en: 'Wrap (flex)', ar: 'التفاف (flex)' }, defaultValue: true },
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'الفجوة (px)' }, min: 0, max: 80, defaultValue: 24 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical align', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: [
          { value: 'start', label: { en: 'Top', ar: 'أعلى' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'end', label: { en: 'Bottom', ar: 'أسفل' } },
          { value: 'stretch', label: { en: 'Stretch', ar: 'تمدّد' } },
        ],
      },
      {
        key: 'justify',
        type: 'select',
        label: { en: 'Horizontal distribution', ar: 'التوزيع الأفقي' },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'موزّع' } },
          { value: 'around', label: { en: 'Space around', ar: 'محيطي' } },
        ],
      },
      {
        key: 'cells',
        type: 'repeater',
        label: { en: 'Columns', ar: 'الأعمدة' },
        fields: [
          { key: 'col_span', type: 'number', label: { en: 'Column span / flex ratio', ar: 'امتداد العمود / نسبة flex' }, min: 1, max: 6, defaultValue: 1 },
          {
            key: 'align',
            type: 'select',
            label: { en: 'Block alignment', ar: 'محاذاة البلوكات' },
            defaultValue: 'stretch',
            options: [
              { value: 'start', label: { en: 'Start', ar: 'البداية' } },
              { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
              { value: 'end', label: { en: 'End', ar: 'النهاية' } },
              { value: 'stretch', label: { en: 'Stretch', ar: 'تمدّد' } },
            ],
          },
          {
            key: 'blocks',
            type: 'repeater',
            label: { en: 'Content blocks', ar: 'بلوكات المحتوى' },
            fields: [
              {
                key: 'type',
                type: 'select',
                label: { en: 'Block type', ar: 'نوع البلوك' },
                defaultValue: 'text',
                options: [
                  { value: 'heading', label: { en: 'Heading', ar: 'عنوان' } },
                  { value: 'text', label: { en: 'Text', ar: 'نص' } },
                  { value: 'image', label: { en: 'Image', ar: 'صورة' } },
                  { value: 'button', label: { en: 'Button', ar: 'زر' } },
                  { value: 'divider', label: { en: 'Divider', ar: 'فاصل' } },
                  { value: 'spacer', label: { en: 'Spacer', ar: 'مسافة' } },
                  { value: 'html', label: { en: 'Custom HTML', ar: 'HTML مخصّص' } },
                ],
              },
              { key: 'text', type: 'text', label: { en: 'Heading text', ar: 'نص العنوان' }, showIf: { key: 'type', in: ['heading'] } },
              {
                key: 'level',
                type: 'select',
                label: { en: 'Heading level', ar: 'مستوى العنوان' },
                defaultValue: 'h2',
                options: [
                  { value: 'h2', label: { en: 'H2', ar: 'H2' } },
                  { value: 'h3', label: { en: 'H3', ar: 'H3' } },
                  { value: 'h4', label: { en: 'H4', ar: 'H4' } },
                ],
                showIf: { key: 'type', in: ['heading'] },
              },
              { key: 'html', type: 'richtext', label: { en: 'Text', ar: 'النص' }, showIf: { key: 'type', in: ['text'] } },
              { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: { key: 'type', in: ['image'] } },
              { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' }, showIf: { key: 'type', in: ['image'] } },
              {
                key: 'aspect',
                type: 'select',
                label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
                defaultValue: 'auto',
                options: [
                  { value: 'auto', label: { en: 'Original', ar: 'الأصلي' } },
                  { value: 'square', label: { en: 'Square', ar: 'مربع' } },
                  { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
                  { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
                  { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
                ],
                showIf: { key: 'type', in: ['image'] },
              },
              { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true, showIf: { key: 'type', in: ['image'] } },
              { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' }, showIf: { key: 'type', in: ['button'] } },
              { key: 'button_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' }, showIf: { key: 'type', in: ['button'] } },
              {
                key: 'button_variant',
                type: 'select',
                label: { en: 'Button style', ar: 'نمط الزر' },
                defaultValue: 'solid',
                options: [
                  { value: 'solid', label: { en: 'Solid', ar: 'صلب' } },
                  { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
                ],
                showIf: { key: 'type', in: ['button'] },
              },
              { key: 'height_px', type: 'number', label: { en: 'Height (px)', ar: 'الارتفاع (px)' }, min: 4, max: 200, defaultValue: 24, showIf: { key: 'type', in: ['spacer'] } },
              { key: 'raw_html', type: 'textarea', label: { en: 'HTML', ar: 'HTML' }, showIf: { key: 'type', in: ['html'] } },
              {
                key: 'align',
                type: 'select',
                label: { en: 'Align', ar: 'المحاذاة' },
                defaultValue: 'start',
                options: ALIGNMENT_OPTIONS,
                showIf: { key: 'type', in: ['heading', 'text', 'button', 'html'] },
              },
              { key: 'color', type: 'color', label: { en: 'Color', ar: 'اللون' }, showIf: { key: 'type', in: ['heading', 'text', 'divider'] } },
            ],
          },
        ],
      },
    ],
    defaultSettings: {
      mode: 'grid',
      columns: 2,
      columns_tablet: 2,
      columns_mobile: 1,
      direction: 'row',
      wrap: true,
      gap_px: 24,
      align: 'stretch',
      justify: 'start',
    },
    defaultContent: {
      cells: [
        {
          col_span: 1,
          align: 'stretch',
          blocks: [
            { type: 'heading', text: 'Column one', level: 'h3', align: 'start' },
            { type: 'text', html: '<p>Describe something here. This block supports rich text.</p>', align: 'start' },
            { type: 'button', button_label: 'Learn more', button_url: '#', button_variant: 'solid', align: 'start' },
          ],
        },
        {
          col_span: 1,
          align: 'stretch',
          blocks: [
            { type: 'heading', text: 'Column two', level: 'h3', align: 'start' },
            { type: 'text', html: '<p>Another column of content sitting side by side.</p>', align: 'start' },
          ],
        },
      ],
    },
  },
  {
    id: 'featured-products',
    label: { en: 'Featured Products', ar: 'منتجات مميّزة' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'Auto-loads a row of products from your catalogue.',
      ar: 'يجلب صف من المنتجات من كتالوجك.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'filter',
        type: 'select',
        label: { en: 'Pick from', ar: 'اختر من' },
        defaultValue: 'newest',
        options: [
          { value: 'newest', label: { en: 'Newest', ar: 'الأحدث' } },
          { value: 'featured', label: { en: 'Featured only', ar: 'المميّزة فقط' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 12, defaultValue: 4 },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص الرابط' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      ...textColorFields({ heading: true, subheading: true }),
      c('link_color', 'See-all link color', 'لون رابط الكل'),
    ],
    defaultSettings: { filter: 'newest', limit: 4, columns: 4, columns_tablet: 3, columns_mobile: 2 },
    defaultContent: {
      heading: 'Featured products',
      subheading: 'Handpicked picks from our latest catalogue.',
      link_label: 'View all',
    },
  },
  {
    id: 'product-slider',
    label: { en: 'Product Slider', ar: 'سلايدر المنتجات' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'Auto-loaded products in a horizontal carousel. Per-device slides-per-view, optional autoplay.',
      ar: 'منتجات يتم جلبها تلقائياً ضمن سلايدر أفقي. عدد شرائح مستقل لكل جهاز وتشغيل تلقائي اختياري.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'filter',
        type: 'select',
        label: { en: 'Pick from', ar: 'اختر من' },
        defaultValue: 'newest',
        options: [
          { value: 'newest', label: { en: 'Newest', ar: 'الأحدث' } },
          { value: 'featured', label: { en: 'Featured only', ar: 'المميّزة فقط' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 24, defaultValue: 8 },
      { key: 'slides_per_view', type: 'number', label: { en: 'Slides per view — desktop', ar: 'عدد الشرائح — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'slides_per_view_tablet', type: 'number', label: { en: 'Slides per view — tablet', ar: 'عدد الشرائح — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'slides_per_view_mobile', type: 'number', label: { en: 'Slides per view — mobile', ar: 'عدد الشرائح — جوال' }, min: 1, max: 4, defaultValue: 1.5 },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between slides (px)', ar: 'الفجوة بين الشرائح (px)' }, min: 0, max: 64, defaultValue: 16 },
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 0 },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: false },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: false },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص رابط الكل' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      ...textColorFields({ heading: true, subheading: true }),
      c('link_color', 'See-all link color', 'لون رابط الكل'),
    ],
    defaultSettings: {
      filter: 'newest',
      limit: 8,
      slides_per_view: 4,
      slides_per_view_tablet: 3,
      slides_per_view_mobile: 1.5,
      gap_px: 16,
      autoplay_ms: 0,
      show_arrows: true,
      show_dots: false,
      loop: false,
    },
    defaultContent: { heading: 'Featured products' },
  },
  {
    id: 'collection-products',
    label: { en: 'Products by Category', ar: 'منتجات حسب الفئة' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'A grid of products pulled from one category. Independent column counts per breakpoint.',
      ar: 'شبكة منتجات تُجلب من فئة واحدة. عدد أعمدة مستقل لكل جهاز.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'category', type: 'collectionPicker', label: { en: 'Category', ar: 'الفئة' }, description: { en: 'Pick one of your categories — its products fill the grid.', ar: 'اختر إحدى فئاتك — تُعرض منتجاتها في الشبكة.' } },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 24, defaultValue: 8 },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص رابط الكل' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      ...textColorFields({ heading: true, subheading: true }),
      c('link_color', 'See-all link color', 'لون رابط الكل'),
    ],
    defaultSettings: { limit: 8, columns: 4, columns_tablet: 3, columns_mobile: 2 },
    defaultContent: { heading: 'Shop the collection' },
  },
  // ── Magic sections (product page templates only) ─────────────
  {
    id: 'product-page',
    label: { en: 'Product Page', ar: 'صفحة المنتج' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'The complete product body — gallery, price, bundles, variants, custom fields, shipping and tabs. Matches the full storefront product design.',
      ar: 'جسم المنتج الكامل — المعرض، السعر، الباندلز، الخيارات، الحقول المخصّصة، الشحن والتابات. مطابق لتصميم صفحة المنتج الكامل.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      { key: 'show_trust_badges', type: 'boolean', label: { en: 'Show trust badges', ar: 'إظهار شارات الثقة' }, defaultValue: true },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping & delivery', ar: 'إظهار الشحن والتوصيل' }, defaultValue: true },
      { key: 'show_tabs', type: 'boolean', label: { en: 'Show tabs (description / specs / FAQ)', ar: 'إظهار التابات (الوصف / المواصفات / الأسئلة)' }, defaultValue: true },
      { key: 'show_tags', type: 'boolean', label: { en: 'Show tags', ar: 'إظهار الوسوم' }, defaultValue: true },
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Add-to-cart button style', ar: 'نمط زر الإضافة للسلة' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
    ],
    defaultSettings: {
      show_trust_badges: true,
      show_shipping: true,
      show_tabs: true,
      show_tags: true,
      button_style: 'solid',
    },
  },
  {
    id: 'product-gallery',
    label: { en: 'Product Gallery', ar: 'معرض المنتج' },
    icon: 'gallery',
    category: 'commerce',
    description: {
      en: 'Magic section. Four layouts with optional hover-zoom.',
      ar: 'قسم سحري. أربع تخطيطات مع تكبير عند المرور.',
    },
    translatable: [],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'main-thumbnails',
        options: [
          { value: 'main-thumbnails', label: { en: 'Main + Thumbnails', ar: 'رئيسي + مصغرات' } },
          { value: 'carousel', label: { en: 'Carousel', ar: 'شريط' } },
          { value: 'grid', label: { en: 'Two-column grid', ar: 'شبكة عمودين' } },
          { value: 'stacked', label: { en: 'Stacked', ar: 'مكدّس' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
        ],
      },
      { key: 'enable_zoom', type: 'boolean', label: { en: 'Hover to zoom', ar: 'تكبير عند المرور' }, defaultValue: true },
    ],
    defaultSettings: { layout: 'main-thumbnails', aspect: 'square', enable_zoom: true },
  },
  {
    id: 'product-details',
    label: { en: 'Product Details', ar: 'تفاصيل المنتج' },
    icon: 'info',
    category: 'commerce',
    description: {
      en: 'Magic section. Title, price, description, sale badge, rating, share.',
      ar: 'قسم سحري. عنوان وسعر ووصف وشارة خصم وتقييم ومشاركة.',
    },
    translatable: [],
    schema: [
      { key: 'show_sale_badge', type: 'boolean', label: { en: 'Show sale badge', ar: 'شارة الخصم' }, defaultValue: true },
      { key: 'show_rating', type: 'boolean', label: { en: 'Show rating row', ar: 'صف التقييم' }, defaultValue: false },
      { key: 'show_price', type: 'boolean', label: { en: 'Show price', ar: 'إظهار السعر' }, defaultValue: true },
      { key: 'show_compare_at', type: 'boolean', label: { en: 'Show compare-at price', ar: 'السعر قبل الخصم' }, defaultValue: true },
      { key: 'show_description', type: 'boolean', label: { en: 'Show description', ar: 'إظهار الوصف' }, defaultValue: true },
      { key: 'show_share', type: 'boolean', label: { en: 'Show share/wishlist', ar: 'مشاركة/قائمة الأمنيات' }, defaultValue: false },
    ],
    defaultSettings: {
      show_sale_badge: true,
      show_rating: false,
      show_price: true,
      show_compare_at: true,
      show_description: true,
      show_share: false,
    },
  },
  {
    id: 'product-tabs',
    label: { en: 'Product Tabs', ar: 'تبويبات المنتج' },
    icon: 'tabs',
    category: 'commerce',
    description: {
      en: 'Magic section. Tabbed view of description, FAQs, shipping and returns.',
      ar: 'قسم سحري. تبويبات للوصف والأسئلة والشحن والإرجاع.',
    },
    translatable: [
      'tab_description_label',
      'tab_faqs_label',
      'tab_shipping_label',
      'tab_returns_label',
      'shipping_html',
      'returns_html',
    ],
    schema: [
      { key: 'show_description', type: 'boolean', label: { en: 'Show description tab', ar: 'تبويب الوصف' }, defaultValue: true },
      { key: 'show_faqs', type: 'boolean', label: { en: 'Show FAQs tab', ar: 'تبويب الأسئلة' }, defaultValue: true },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping tab', ar: 'تبويب الشحن' }, defaultValue: false },
      { key: 'show_returns', type: 'boolean', label: { en: 'Show returns tab', ar: 'تبويب الإرجاع' }, defaultValue: false },
      { key: 'tab_description_label', type: 'text', label: { en: 'Description label', ar: 'تسمية الوصف' } },
      { key: 'tab_faqs_label', type: 'text', label: { en: 'FAQs label', ar: 'تسمية الأسئلة' } },
      { key: 'tab_shipping_label', type: 'text', label: { en: 'Shipping label', ar: 'تسمية الشحن' } },
      { key: 'tab_returns_label', type: 'text', label: { en: 'Returns label', ar: 'تسمية الإرجاع' } },
      { key: 'shipping_html', type: 'richtext', label: { en: 'Shipping content', ar: 'محتوى الشحن' } },
      { key: 'returns_html', type: 'richtext', label: { en: 'Returns content', ar: 'محتوى الإرجاع' } },
    ],
    defaultSettings: { show_description: true, show_faqs: true, show_shipping: false, show_returns: false },
  },
  {
    id: 'add-to-cart',
    label: { en: 'Add to Cart', ar: 'إضافة للسلة' },
    icon: 'shopping-cart',
    category: 'commerce',
    description: {
      en: 'Magic section. Color swatches, size pills, quantity, optional sticky mobile CTA.',
      ar: 'قسم سحري. دوائر ألوان، مقاسات، كمية، وزر ثابت أسفل الجوال.',
    },
    translatable: ['button_label'],
    schema: [
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Button style', ar: 'نمط الزر' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'صلب' } },
          { value: 'outline', label: { en: 'Outline', ar: 'مخطّط' } },
        ],
      },
      { key: 'full_width', type: 'boolean', label: { en: 'Full width button', ar: 'زر بعرض كامل' }, defaultValue: true },
      { key: 'show_quantity', type: 'boolean', label: { en: 'Show quantity picker', ar: 'إظهار اختيار الكمية' }, defaultValue: true },
      { key: 'show_stock', type: 'boolean', label: { en: 'Show stock level', ar: 'إظهار الكمية المتوفرة' }, defaultValue: false },
      { key: 'sticky_on_mobile', type: 'boolean', label: { en: 'Sticky CTA on mobile', ar: 'زر ثابت أسفل الجوال' }, defaultValue: false },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
    ],
    defaultSettings: {
      button_style: 'solid',
      full_width: true,
      show_quantity: true,
      show_stock: false,
      sticky_on_mobile: false,
    },
  },
  // ── Chrome sections (HEADER / FOOTER pages only) ────────────────
  {
    id: 'header-bar',
    label: { en: 'Header Bar', ar: 'شريط الهيدر' },
    icon: 'menu',
    category: 'header',
    description: {
      en: 'Logo, navigation, search, cart, account, and locale switcher in one bar. Falls back to store pages when no nav links are entered.',
      ar: 'شعار وروابط تنقل وبحث وسلة وحساب ومبدّل لغة في شريط واحد. يستخدم صفحات المتجر تلقائياً عند عدم إدخال روابط مخصّصة.',
    },
    pageTypes: ['HEADER'],
    translatable: ['items'],
    schema: [
      { key: 'show_logo', type: 'boolean', label: { en: 'Show logo', ar: 'إظهار الشعار' }, defaultValue: true },
      { key: 'show_store_name', type: 'boolean', label: { en: 'Show store name', ar: 'إظهار اسم المتجر' }, defaultValue: true },
      { key: 'logo_url', type: 'image', label: { en: 'Logo override (desktop, optional)', ar: 'استبدال الشعار (سطح المكتب، اختياري)' } },
      { key: 'logo_url_mobile', type: 'image', label: { en: 'Mobile logo (optional)', ar: 'شعار الجوال (اختياري)' } },
      { key: 'store_name_override', type: 'text', label: { en: 'Store name override (optional)', ar: 'استبدال اسم المتجر (اختياري)' } },
      { key: 'logo_size', type: 'number', label: { en: 'Logo size (px)', ar: 'حجم الشعار (px)' }, min: 16, max: 96, defaultValue: 32 },
      { key: 'show_search', type: 'boolean', label: { en: 'Show search', ar: 'إظهار البحث' }, defaultValue: true },
      { key: 'show_cart', type: 'boolean', label: { en: 'Show cart', ar: 'إظهار السلة' }, defaultValue: true },
      {
        key: 'cart_action',
        type: 'select',
        label: { en: 'Cart click action', ar: 'سلوك زر السلة' },
        defaultValue: 'page',
        options: [
          { value: 'page', label: { en: 'Go to cart page', ar: 'الذهاب لصفحة السلة' } },
          { value: 'popup', label: { en: 'Open cart popup (drawer)', ar: 'فتح نافذة السلة المنبثقة' } },
        ],
      },
      { key: 'show_account', type: 'boolean', label: { en: 'Show account', ar: 'إظهار الحساب' }, defaultValue: false },
      { key: 'show_locale', type: 'boolean', label: { en: 'Show locale switcher', ar: 'إظهار مبدّل اللغة' }, defaultValue: true },
      {
        key: 'sticky_mode',
        type: 'select',
        label: { en: 'Sticky on scroll', ar: 'التثبيت عند التمرير' },
        defaultValue: 'always',
        options: [
          { value: 'always', label: { en: 'Always', ar: 'دائماً' } },
          { value: 'desktop', label: { en: 'Desktop only', ar: 'سطح المكتب فقط' } },
          { value: 'mobile', label: { en: 'Mobile only', ar: 'الجوال فقط' } },
          { value: 'none', label: { en: 'Never', ar: 'أبداً' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Bottom border color', ar: 'لون الحد السفلي' } },
      { key: 'accent_color', type: 'color', label: { en: 'Accent (active locale)', ar: 'لون التمييز (اللغة النشطة)' } },
      { key: 'menu_key', type: 'menuPicker', label: { en: 'Menu', ar: 'القائمة' }, description: { en: 'Pick a menu built in the Menus page. Leave as None to use the inline links below.', ar: 'اختر قائمة من صفحة القوائم. اتركها بدون لاستخدام الروابط أدناه.' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Inline links (used when no menu is selected)', ar: 'روابط مباشرة (تُستخدم عند عدم اختيار قائمة)' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
        ],
      },
    ],
    defaultSettings: {
      show_logo: true,
      show_store_name: true,
      show_search: true,
      show_cart: true,
      cart_action: 'page',
      show_account: false,
      show_locale: true,
      sticky_mode: 'always',
      logo_size: 32,
    },
  },
  {
    id: 'footer-columns',
    label: { en: 'Footer Columns', ar: 'أعمدة الفوتر' },
    icon: 'columns',
    category: 'footer',
    description: {
      en: 'Responsive column-based link list. Auto-fits columns to width.',
      ar: 'قائمة روابط متعدّدة الأعمدة. تتكيّف الأعمدة مع العرض تلقائياً.',
    },
    pageTypes: ['FOOTER'],
    translatable: ['columns'],
    schema: [
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'heading_color', type: 'color', label: { en: 'Column heading color', ar: 'لون عناوين الأعمدة' } },
      { key: 'link_color', type: 'color', label: { en: 'Link color', ar: 'لون الروابط' } },
      {
        key: 'columns',
        type: 'repeater',
        label: { en: 'Columns', ar: 'الأعمدة' },
        fields: [
          { key: 'heading', type: 'text', label: { en: 'Column heading', ar: 'عنوان العمود' } },
          { key: 'menu_key', type: 'menuPicker', label: { en: 'Menu (optional — overrides links)', ar: 'القائمة (اختياري — تلغي الروابط)' } },
          {
            key: 'links',
            type: 'repeater',
            label: { en: 'Links (used when no menu key)', ar: 'الروابط (عند عدم وجود مفتاح قائمة)' },
            fields: [
              { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
              { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
            ],
          },
        ],
      },
    ],
    defaultSettings: {},
    defaultContent: {
      columns: [
        { heading: 'Shop', links: [{ label: 'All products', url: '/products' }] },
        { heading: 'Help', links: [{ label: 'Contact', url: '/pages/contact' }] },
        { heading: 'Company', links: [{ label: 'About', url: '/pages/about' }] },
      ],
    },
  },
  {
    id: 'copyright-bar',
    label: { en: 'Copyright Bar', ar: 'شريط حقوق النشر' },
    icon: 'copyright',
    category: 'footer',
    description: {
      en: 'Thin bottom strip. Tokens {year} and {store} auto-fill with the current year and store name.',
      ar: 'شريط سفلي رفيع. الرمزان {year} و {store} يُملآن تلقائياً.',
    },
    pageTypes: ['FOOTER'],
    translatable: ['text', 'payment_methods'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Copyright text (use {year} and {store})', ar: 'نص حقوق النشر (استخدم {year} و {store})' } },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'between',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'موزّع' } },
        ],
      },
      { key: 'show_payment_icons', type: 'boolean', label: { en: 'Show payment badges', ar: 'إظهار شارات الدفع' }, defaultValue: false },
      {
        key: 'payment_methods',
        type: 'repeater',
        label: { en: 'Payment badges', ar: 'شارات الدفع' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label (e.g. Visa, Mada)', ar: 'التسمية (مثل Visa, مدى)' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Top border color', ar: 'لون الحد العلوي' } },
    ],
    defaultSettings: { alignment: 'between', show_payment_icons: false },
    defaultContent: { text: '© {year} {store}' },
  },
  // ── Phase 2 chrome sections ─────────────────────────────────────
  {
    id: 'announcement-bar',
    label: { en: 'Announcement Bar', ar: 'شريط الإعلان' },
    icon: 'megaphone',
    category: 'header',
    description: {
      en: 'Thin promotional strip above the header. Single, marquee, or auto-rotate. Optional dismiss button persists per browser.',
      ar: 'شريط ترويجي رفيع فوق الهيدر. مفرد، متحرّك، أو تدوير تلقائي. زر إخفاء اختياري يتذكّر اختيار المستخدم.',
    },
    pageTypes: ['HEADER'],
    translatable: ['messages'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'simple',
        options: [
          { value: 'simple', label: { en: 'Single message', ar: 'رسالة واحدة' } },
          { value: 'marquee', label: { en: 'Scrolling marquee', ar: 'شريط متحرّك' } },
          { value: 'rotating', label: { en: 'Auto-rotate', ar: 'تدوير تلقائي' } },
        ],
      },
      {
        key: 'messages',
        type: 'repeater',
        label: { en: 'Messages', ar: 'الرسائل' },
        fields: [
          { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 160 },
          { key: 'link_label', type: 'text', label: { en: 'Inline link label (optional)', ar: 'نص الرابط داخل النص (اختياري)' }, maxLength: 40 },
          { key: 'link_url', type: 'url', label: { en: 'Link URL', ar: 'رابط الرابط' } },
        ],
      },
      { key: 'rotate_ms', type: 'number', label: { en: 'Rotate interval (ms, rotating layout)', ar: 'فاصل التدوير (ms)' }, min: 2000, max: 30000, defaultValue: 5000 },
      { key: 'marquee_speed_s', type: 'number', label: { en: 'Marquee duration (s, marquee layout)', ar: 'مدة الشريط المتحرّك (s)' }, min: 8, max: 120, defaultValue: 25 },
      { key: 'dismissible', type: 'boolean', label: { en: 'Show close button', ar: 'إظهار زر الإغلاق' }, defaultValue: false },
      { key: 'dismiss_key', type: 'text', label: { en: 'Dismiss key (change to "show again")', ar: 'مفتاح الإخفاء (غيّره لإعادة الإظهار)' }, defaultValue: 'default' },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'link_color', type: 'color', label: { en: 'Inline link color', ar: 'لون الرابط الداخلي' } },
    ],
    defaultSettings: {
      layout: 'simple',
      rotate_ms: 5000,
      marquee_speed_s: 25,
      dismissible: false,
      dismiss_key: 'default',
    },
    defaultContent: {
      messages: [{ text: 'Free shipping on orders over $50', link_label: 'Shop now', link_url: '/products' }],
    },
  },
  {
    id: 'mega-menu',
    label: { en: 'Mega Menu', ar: 'القائمة الموسّعة' },
    icon: 'layout-grid',
    category: 'header',
    description: {
      en: 'Top-bar triggers that open a full-width panel with link columns + an optional feature card. Mobile collapses to an accordion.',
      ar: 'محفّزات في الشريط العلوي تكشف لوحة بعرض كامل بأعمدة روابط + بطاقة ميزة اختيارية. على الجوال تتحوّل إلى أكورديون.',
    },
    pageTypes: ['HEADER'],
    translatable: ['triggers'],
    schema: [
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Trigger alignment', ar: 'محاذاة المحفّزات' },
        defaultValue: 'center',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      {
        key: 'triggers',
        type: 'repeater',
        label: { en: 'Triggers', ar: 'المحفّزات' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Trigger label', ar: 'تسمية المحفّز' }, maxLength: 40 },
          { key: 'url', type: 'url', label: { en: 'Trigger URL', ar: 'رابط المحفّز' } },
          {
            key: 'columns',
            type: 'repeater',
            label: { en: 'Link columns', ar: 'أعمدة الروابط' },
            fields: [
              { key: 'heading', type: 'text', label: { en: 'Column heading', ar: 'عنوان العمود' } },
              {
                key: 'links',
                type: 'repeater',
                label: { en: 'Links', ar: 'الروابط' },
                fields: [
                  { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
                  { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
                ],
              },
            ],
          },
          {
            key: 'feature',
            type: 'repeater',
            label: { en: 'Feature card', ar: 'بطاقة ميزة' },
            fields: [
              { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
              { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'التسمية' } },
              { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
            ],
          },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Bar background color', ar: 'لون خلفية الشريط' } },
      { key: 'text_color', type: 'color', label: { en: 'Bar text color', ar: 'لون نص الشريط' } },
      { key: 'panel_bg_color', type: 'color', label: { en: 'Panel background color', ar: 'لون خلفية اللوحة' } },
      { key: 'panel_text_color', type: 'color', label: { en: 'Panel text color', ar: 'لون نص اللوحة' } },
      { key: 'accent_color', type: 'color', label: { en: 'Column heading color', ar: 'لون عنوان العمود' } },
      { key: 'border_color', type: 'color', label: { en: 'Border color', ar: 'لون الحدود' } },
    ],
    defaultSettings: { alignment: 'center' },
    defaultContent: {
      triggers: [
        {
          label: 'Shop',
          url: '/products',
          columns: [
            {
              heading: 'Categories',
              links: [
                { label: 'New arrivals', url: '/products?sort=newest' },
                { label: 'Best sellers', url: '/products?sort=popular' },
                { label: 'On sale', url: '/products?sale=true' },
              ],
            },
          ],
        },
        { label: 'About', url: '/pages/about' },
        { label: 'Contact', url: '/pages/contact' },
      ],
    },
  },
  {
    id: 'mobile-bottom-nav',
    label: { en: 'Mobile Bottom Nav', ar: 'شريط الجوال السفلي' },
    icon: 'smartphone',
    category: 'header',
    description: {
      en: 'Fixed icon bar at the bottom of the viewport on mobile only. Six built-in destinations + a custom-link slot. Hidden ≥ md.',
      ar: 'شريط أيقونات ثابت أسفل الشاشة على الجوال فقط. ست وجهات جاهزة + خانة رابط مخصّص. مخفي على الشاشات الأكبر.',
    },
    pageTypes: ['HEADER', 'FOOTER'],
    translatable: ['items'],
    schema: [
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Items (3–5 recommended)', ar: 'العناصر (3-5 موصى به)' },
        fields: [
          {
            key: 'type',
            type: 'select',
            label: { en: 'Type', ar: 'النوع' },
            defaultValue: 'home',
            options: [
              { value: 'home', label: { en: 'Home', ar: 'الرئيسية' } },
              { value: 'search', label: { en: 'Search', ar: 'البحث' } },
              { value: 'categories', label: { en: 'Categories', ar: 'الفئات' } },
              { value: 'cart', label: { en: 'Cart', ar: 'السلة' } },
              { value: 'account', label: { en: 'Account', ar: 'الحساب' } },
              { value: 'wishlist', label: { en: 'Wishlist', ar: 'المفضّلة' } },
              { value: 'menu', label: { en: 'Menu', ar: 'القائمة' } },
              { value: 'custom', label: { en: 'Custom link', ar: 'رابط مخصّص' } },
            ],
          },
          { key: 'label', type: 'text', label: { en: 'Label (optional override)', ar: 'التسمية (اختياري)' } },
          { key: 'url', type: 'url', label: { en: 'URL (optional override)', ar: 'الرابط (اختياري)' } },
        ],
      },
      { key: 'show_labels', type: 'boolean', label: { en: 'Show labels under icons', ar: 'إظهار التسمية أسفل الأيقونة' }, defaultValue: true },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Inactive color', ar: 'اللون غير النشط' } },
      { key: 'active_color', type: 'color', label: { en: 'Active color', ar: 'اللون النشط' } },
      { key: 'border_color', type: 'color', label: { en: 'Top border color', ar: 'لون الحد العلوي' } },
    ],
    defaultSettings: { show_labels: true },
    defaultContent: {
      items: [
        { type: 'home' },
        { type: 'search' },
        { type: 'cart' },
        { type: 'account' },
      ],
    },
  },
];

export function findSectionSchema(id: string): SectionSchema | undefined {
  return SECTION_SCHEMAS.find((s) => s.id === id);
}

export function labelOf(loc: LocalizedString, locale: string): string {
  return loc[locale] || loc.en || Object.values(loc)[0] || '';
}
