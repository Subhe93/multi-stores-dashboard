import type { SectionSchema } from './section-schemas';

/**
 * Builder schema of the `product-stories` block (plans/customer-stories/
 * CONTRACT.md 7.2 / 7.6).
 *
 * Deliberately NOT registered in `SECTION_SCHEMAS` yet: the storefront has no
 * renderer for this block until the web workflow ships it, and the builder
 * must never offer a block the storefront cannot render. The web workflow
 * registers it together with the renderer by:
 *   1. adding `PRODUCT_STORIES_SECTION_SCHEMA` to `SECTION_SCHEMAS` after
 *      `product-faq`,
 *   2. adding `'product-stories': 'h2'` to the heading-level default map,
 *   3. adding the key to the product block key lists of
 *      `productBlockSchemas.test.mjs` and `layoutBlocksFlag.test.mjs`.
 * Keys and defaults must stay identical to the web registry.
 */
export const PRODUCT_STORIES_SECTION_SCHEMA: SectionSchema = {
  id: 'product-stories',
  label: { en: 'Customer stories', ar: 'قصص العملاء' },
  icon: 'quote',
  category: 'product',
  description: {
    en: 'Photo and video stories of real customers, entered in the product editor.',
    ar: 'قصص عملاء حقيقيين بالصور والفيديو، تُدخل من محرر المنتج.',
  },
  pageTypes: ['PRODUCT_TEMPLATE'],
  gate: 'layout-containers',
  translatable: ['heading', 'subheading'],
  schema: [
    { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
    {
      key: 'heading',
      type: 'text',
      label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' },
      description: {
        en: 'Leave empty to use the default word in the page language.',
        ar: 'اتركه فارغاً لاستخدام الكلمة الافتراضية بلغة الصفحة.',
      },
      defaultValue: '',
    },
    { key: 'subheading', type: 'text', label: { en: 'Subheading (optional)', ar: 'العنوان الفرعي (اختياري)' }, defaultValue: '' },
    {
      key: 'layout',
      type: 'select',
      label: { en: 'Layout', ar: 'طريقة العرض' },
      defaultValue: 'slider',
      options: [
        { value: 'slider', label: { en: 'Slider', ar: 'شريط متحرك' } },
        { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
        { value: 'overlay', label: { en: 'Cards with text on the media', ar: 'بطاقات والنص فوق الصورة' } },
      ],
    },
    {
      key: 'card_aspect',
      type: 'select',
      label: { en: 'Card shape', ar: 'شكل البطاقة' },
      defaultValue: 'portrait',
      options: [
        { value: 'portrait', label: { en: 'Portrait (9:16)', ar: 'طولي (9:16)' } },
        { value: 'square', label: { en: 'Square (1:1)', ar: 'مربع (1:1)' } },
        { value: 'landscape', label: { en: 'Landscape (16:9)', ar: 'عرضي (16:9)' } },
      ],
    },
    { key: 'columns', type: 'number', label: { en: 'Columns (desktop)', ar: 'الأعمدة (سطح المكتب)' }, min: 1, max: 6, defaultValue: 4 },
    { key: 'columns_tablet', type: 'number', label: { en: 'Columns (tablet)', ar: 'الأعمدة (الجهاز اللوحي)' }, min: 1, max: 4, defaultValue: 3 },
    { key: 'columns_mobile', type: 'number', label: { en: 'Columns (mobile)', ar: 'الأعمدة (الجوال)' }, min: 1, max: 2, defaultValue: 1 },
    {
      key: 'text_position',
      type: 'select',
      label: { en: 'Text position', ar: 'موضع النص' },
      defaultValue: 'below',
      showIf: { key: 'layout', in: ['slider', 'grid'] },
      options: [
        { value: 'below', label: { en: 'Below the media', ar: 'أسفل الصورة' } },
        { value: 'overlay', label: { en: 'On the media', ar: 'فوق الصورة' } },
      ],
    },
    { key: 'show_rating', type: 'boolean', label: { en: 'Show stars', ar: 'إظهار النجوم' }, defaultValue: true },
    { key: 'show_subtitle', type: 'boolean', label: { en: 'Show role / company / city', ar: 'إظهار الوظيفة / الشركة / المدينة' }, defaultValue: true },
    { key: 'show_verified', type: 'boolean', label: { en: 'Show verified-buyer check', ar: 'إظهار علامة المشتري الموثّق' }, defaultValue: true },
  ],
  defaultSettings: {
    show_heading: true,
    heading: '',
    subheading: '',
    layout: 'slider',
    card_aspect: 'portrait',
    columns: 4,
    columns_tablet: 3,
    columns_mobile: 1,
    text_position: 'below',
    show_rating: true,
    show_subtitle: true,
    show_verified: true,
  },
};
