// Builder schema of "script-manifesto": one sentence in up to four languages
// and scripts, the visitor's own language in ink. Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/script-manifesto.schema.ts
// (same keys, order, types, options, defaults, translatable, pageTypes and
// maxItems), with every text in the six dashboard locales.
//
// Type-only import: section-schemas.ts imports this file.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

/** Six-locale text, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});

const LINE_FIELDS: FieldDefinition[] = [
  {
    key: 'text',
    type: 'textarea',
    label: L('Sentence', 'الجملة', 'Cümle', 'Satz', 'Phrase', 'Mening'),
    maxLength: 160,
    description: L(
      'A line break is kept only while this line is the highlighted one.',
      'يُحتفَظ بفاصل السطر فقط عندما يكون هذا السطر هو البارز.',
      'Satır sonu yalnızca bu satır vurgulanan satırken korunur.',
      'Ein Zeilenumbruch bleibt nur erhalten, solange diese Zeile die hervorgehobene ist.',
      'Un saut de ligne n’est conservé que lorsque cette ligne est celle mise en avant.',
      'En radbrytning behålls bara när den här raden är den framhävda.',
    ),
  },
  {
    key: 'label',
    type: 'text',
    label: L('Language label', 'اسم اللغة', 'Dil etiketi', 'Sprachbezeichnung', 'Nom de la langue', 'Språketikett'),
    maxLength: 30,
    description: L(
      'The name of the language as its speakers write it.',
      'اسم اللغة كما يكتبه أهلها.',
      'Dilin adı, konuşanlarının yazdığı biçimde.',
      'Der Name der Sprache, wie ihre Sprecher ihn schreiben.',
      'Le nom de la langue tel que ses locuteurs l’écrivent.',
      'Språkets namn så som dess talare skriver det.',
    ),
  },
  {
    key: 'lang',
    type: 'text',
    label: L('Language code', 'رمز اللغة', 'Dil kodu', 'Sprachcode', 'Code de langue', 'Språkkod'),
    maxLength: 8,
    description: L(
      'Short code such as en, ar, sv, ku. The line matching the visitor’s language is highlighted.',
      'رمز قصير مثل en أو ar أو sv أو ku. يُبرَز السطر المطابق للغة الزائر.',
      'en, ar, sv, ku gibi kısa kod. Ziyaretçinin diliyle eşleşen satır vurgulanır.',
      'Kurzer Code wie en, ar, sv, ku. Die Zeile in der Sprache des Besuchers wird hervorgehoben.',
      'Code court comme en, ar, sv, ku. La ligne dans la langue du visiteur est mise en avant.',
      'Kort kod som en, ar, sv, ku. Raden på besökarens språk framhävs.',
    ),
  },
  {
    key: 'dir',
    type: 'select',
    label: L('Writing direction', 'اتجاه الكتابة', 'Yazı yönü', 'Schreibrichtung', 'Sens d’écriture', 'Skrivriktning'),
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: L('Automatic', 'تلقائي', 'Otomatik', 'Automatisch', 'Automatique', 'Automatisk') },
      {
        value: 'ltr',
        label: L('Left to right', 'من اليسار إلى اليمين', 'Soldan sağa', 'Links nach rechts', 'De gauche à droite', 'Vänster till höger'),
      },
      {
        value: 'rtl',
        label: L('Right to left', 'من اليمين إلى اليسار', 'Sağdan sola', 'Rechts nach links', 'De droite à gauche', 'Höger till vänster'),
      },
    ],
  },
];

export const schema: SectionSchema = {
  id: 'script-manifesto',
  label: L(
    'Manifesto in several languages',
    'البيان بعدة لغات',
    'Birkaç dilde manifesto',
    'Manifest in mehreren Sprachen',
    'Manifeste en plusieurs langues',
    'Manifest på flera språk',
  ),
  icon: 'languages',
  category: 'content',
  description: L(
    'One sentence shown in up to four languages and scripts at once. The visitor’s own language is strong, the others are quiet.',
    'جملة واحدة تظهر بما يصل إلى أربع لغات وخطوط معاً. لغة الزائر بارزة والبقية هادئة.',
    'Tek bir cümle, aynı anda en fazla dört dilde ve yazıda gösterilir. Ziyaretçinin dili belirgin, diğerleri sakindir.',
    'Ein Satz, gleichzeitig in bis zu vier Sprachen und Schriften. Die Sprache des Besuchers ist kräftig, die anderen sind zurückhaltend.',
    'Une phrase affichée dans jusqu’à quatre langues et écritures à la fois. La langue du visiteur est forte, les autres sont discrètes.',
    'En mening som visas på upp till fyra språk och skriftsystem samtidigt. Besökarens språk är starkt, de andra är dämpade.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING', 'FOOTER'],
  // The lines are NOT translatable: the same lines show in every locale.
  translatable: ['cta_text'],
  schema: [
    {
      key: 'lines',
      type: 'repeater',
      label: L('Lines', 'السطور', 'Satırlar', 'Zeilen', 'Lignes', 'Rader'),
      maxItems: 4,
      fields: LINE_FIELDS,
      description: L(
        'The same lines show in every language of the store.',
        'تظهر السطور نفسها في كل لغات المتجر.',
        'Aynı satırlar mağazanın her dilinde gösterilir.',
        'Dieselben Zeilen erscheinen in jeder Sprache des Shops.',
        'Les mêmes lignes s’affichent dans toutes les langues de la boutique.',
        'Samma rader visas på butikens alla språk.',
      ),
    },
    {
      key: 'cta_text',
      type: 'text',
      label: L('Link text', 'نص الرابط', 'Bağlantı metni', 'Linktext', 'Texte du lien', 'Länktext'),
      maxLength: 40,
    },
    {
      key: 'mark_image',
      type: 'image',
      label: L('Symbol', 'الرمز', 'Sembol', 'Symbol', 'Symbole', 'Symbol'),
      description: L(
        'A small mark above the lines (shown at 40 px).',
        'علامة صغيرة فوق السطور (تُعرض بحجم 40 بكسل).',
        'Satırların üstünde küçük bir işaret (40 px olarak gösterilir).',
        'Ein kleines Zeichen über den Zeilen (in 40 px dargestellt).',
        'Un petit signe au-dessus des lignes (affiché en 40 px).',
        'Ett litet märke ovanför raderna (visas i 40 px).',
      ),
    },
    {
      key: 'active_first',
      type: 'boolean',
      label: L(
        'Visitor’s language first',
        'لغة الزائر أولاً',
        'Ziyaretçinin dili önce',
        'Sprache des Besuchers zuerst',
        'Langue du visiteur en premier',
        'Besökarens språk först',
      ),
      defaultValue: true,
    },
    {
      key: 'cta_url',
      type: 'url',
      label: L('Link', 'الرابط', 'Bağlantı', 'Link', 'Lien', 'Länk'),
    },
    {
      key: 'bg_color',
      type: 'color',
      label: L('Background colour', 'لون الخلفية', 'Arka plan rengi', 'Hintergrundfarbe', 'Couleur de fond', 'Bakgrundsfärg'),
      description: L(
        'Empty = the theme text colour (a dark band).',
        'فارغ = لون النص في الثيم (شريط داكن).',
        'Boş = temanın metin rengi (koyu bir bant).',
        'Leer = die Textfarbe des Themes (ein dunkles Band).',
        'Vide = la couleur de texte du thème (une bande sombre).',
        'Tomt = temats textfärg (ett mörkt band).',
      ),
    },
    {
      key: 'text_color',
      type: 'color',
      label: L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'),
      description: L(
        'Empty = the theme background colour.',
        'فارغ = لون الخلفية في الثيم.',
        'Boş = temanın arka plan rengi.',
        'Leer = die Hintergrundfarbe des Themes.',
        'Vide = la couleur de fond du thème.',
        'Tomt = temats bakgrundsfärg.',
      ),
    },
    {
      key: 'accent_color',
      type: 'color',
      label: L('Accent colour', 'لون التمييز', 'Vurgu rengi', 'Akzentfarbe', 'Couleur d’accent', 'Accentfärg'),
      description: L(
        'Empty = the theme accent colour.',
        'فارغ = لون التمييز في الثيم.',
        'Boş = temanın vurgu rengi.',
        'Leer = die Akzentfarbe des Themes.',
        'Vide = la couleur d’accent du thème.',
        'Tomt = temats accentfärg.',
      ),
    },
    {
      key: 'heading_level',
      type: 'select',
      label: L('Highlighted line', 'السطر البارز', 'Vurgulanan satır', 'Hervorgehobene Zeile', 'Ligne mise en avant', 'Framhävd rad'),
      defaultValue: 'p',
      options: [
        { value: 'h2', label: L('Heading (H2)', 'عنوان (H2)', 'Başlık (H2)', 'Überschrift (H2)', 'Titre (H2)', 'Rubrik (H2)') },
        { value: 'p', label: L('Paragraph', 'فقرة', 'Paragraf', 'Absatz', 'Paragraphe', 'Stycke') },
      ],
    },
  ],
  defaultSettings: { active_first: true, heading_level: 'p' },
  defaultContent: {},
};
