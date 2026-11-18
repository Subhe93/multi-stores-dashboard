// Builder schema of "object-study": one product as a catalogue plate (leader
// lines from points on the photograph to short notes, live price and a link
// to the product under it). Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/object-study.schema.ts (same
// keys, order, types, options, defaults, translatable, pageTypes and
// maxItems), with every text in the six dashboard locales.
//
// Type-only import: section-schemas.ts imports this file.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

/** Six-locale text, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});

const NOTE_FIELDS: FieldDefinition[] = [
  { key: 'title', type: 'text', label: L('Title', 'العنوان', 'Başlık', 'Titel', 'Titre', 'Rubrik'), maxLength: 50 },
  { key: 'text', type: 'textarea', label: L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text'), maxLength: 120 },
  {
    key: 'x',
    type: 'number',
    label: L(
      'Point: from the left (%)',
      'النقطة: من اليسار (%)',
      'Nokta: soldan (%)',
      'Punkt: von links (%)',
      'Point : depuis la gauche (%)',
      'Punkt: från vänster (%)',
    ),
    min: 0,
    max: 100,
    defaultValue: 50,
    description: L(
      'Position on the photograph, measured from its left edge in every language.',
      'الموضع على الصورة، يُقاس من حافتها اليسرى في كل اللغات.',
      'Fotoğraf üzerindeki konum; her dilde sol kenardan ölçülür.',
      'Position auf dem Foto, in jeder Sprache vom linken Rand gemessen.',
      'Position sur la photo, mesurée depuis son bord gauche dans toutes les langues.',
      'Position på bilden, mätt från dess vänstra kant på alla språk.',
    ),
  },
  {
    key: 'y',
    type: 'number',
    label: L(
      'Point: from the top (%)',
      'النقطة: من الأعلى (%)',
      'Nokta: üstten (%)',
      'Punkt: von oben (%)',
      'Point : depuis le haut (%)',
      'Punkt: uppifrån (%)',
    ),
    min: 0,
    max: 100,
    defaultValue: 50,
  },
];

export const schema: SectionSchema = {
  id: 'object-study',
  label: L('Object study', 'دراسة قطعة', 'Obje incelemesi', 'Objektstudie', 'Étude d’objet', 'Objektstudie'),
  icon: 'crosshair',
  category: 'commerce',
  description: L(
    'One product as a catalogue plate: thin lines run from points on the photograph to short notes, with the live price and a link to the product under it.',
    'منتج واحد كلوحة في كتالوج: خطوط رفيعة تخرج من نقاط على الصورة إلى ملاحظات قصيرة، وتحته السعر الحالي ورابط المنتج.',
    'Katalog levhası gibi tek bir ürün: fotoğraftaki noktalardan kısa notlara ince çizgiler uzanır; altında güncel fiyat ve ürün bağlantısı yer alır.',
    'Ein Produkt als Katalogtafel: Feine Linien führen von Punkten auf dem Foto zu kurzen Notizen, darunter der aktuelle Preis und ein Link zum Produkt.',
    'Un produit présenté comme une planche de catalogue : de fines lignes relient des points de la photo à de courtes notes, avec le prix actuel et un lien vers le produit en dessous.',
    'En produkt som en katalogplansch: tunna linjer går från punkter på bilden till korta noteringar, med aktuellt pris och en länk till produkten under.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE'],
  translatable: ['plate_label', 'category_label', 'heading', 'body', 'cta_text', 'alt', 'notes'],
  schema: [
    // Content
    {
      key: 'plate_label',
      type: 'text',
      label: L('Plate label', 'تسمية اللوحة', 'Levha etiketi', 'Tafelbezeichnung', 'Libellé de la planche', 'Planschens etikett'),
      maxLength: 40,
    },
    {
      key: 'category_label',
      type: 'text',
      label: L('Category label', 'تسمية الفئة', 'Kategori etiketi', 'Kategoriebezeichnung', 'Libellé de catégorie', 'Kategorietikett'),
      maxLength: 40,
    },
    {
      key: 'heading',
      type: 'text',
      label: L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik'),
      maxLength: 80,
      description: L(
        'Empty = the title of the linked product.',
        'فارغ = اسم المنتج المرتبط.',
        'Boş = bağlı ürünün adı.',
        'Leer = der Titel des verknüpften Produkts.',
        'Vide = le titre du produit lié.',
        'Tomt = den länkade produktens namn.',
      ),
    },
    { key: 'body', type: 'textarea', label: L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text'), maxLength: 240 },
    {
      key: 'cta_text',
      type: 'text',
      label: L('Button text', 'نص الزر', 'Düğme metni', 'Button-Text', 'Texte du bouton', 'Knapptext'),
      maxLength: 40,
    },
    {
      key: 'alt',
      type: 'text',
      label: L(
        'Image description (alt)',
        'وصف الصورة (alt)',
        'Görsel açıklaması (alt)',
        'Bildbeschreibung (Alt)',
        'Description de l’image (alt)',
        'Bildbeskrivning (alt)',
      ),
      maxLength: 160,
    },
    {
      key: 'notes',
      type: 'repeater',
      label: L('Notes', 'الملاحظات', 'Notlar', 'Notizen', 'Notes', 'Noteringar'),
      maxItems: 4,
      fields: NOTE_FIELDS,
    },
    // Settings
    {
      key: 'product_url',
      type: 'url',
      label: L('Product', 'المنتج', 'Ürün', 'Produkt', 'Produit', 'Produkt'),
      description: L(
        'Link to a product (/products/…). Title, photograph and price come from it. On a product template: empty = the product of the page.',
        'رابط منتج (/products/…). يأتي منه الاسم والصورة والسعر. في قالب المنتج: فارغ = منتج الصفحة.',
        'Bir ürün bağlantısı (/products/…). Ad, fotoğraf ve fiyat buradan gelir. Ürün şablonunda: boş = sayfanın ürünü.',
        'Link zu einem Produkt (/products/…). Titel, Foto und Preis stammen daraus. In einer Produktvorlage: leer = das Produkt der Seite.',
        'Lien vers un produit (/products/…). Le titre, la photo et le prix en proviennent. Dans un modèle de produit : vide = le produit de la page.',
        'Länk till en produkt (/products/…). Namn, bild och pris hämtas därifrån. I en produktmall: tomt = sidans produkt.',
      ),
    },
    {
      key: 'image',
      type: 'image',
      label: L('Photograph', 'الصورة', 'Fotoğraf', 'Foto', 'Photo', 'Bild'),
      description: L(
        'Empty = the photograph of the linked product.',
        'فارغ = صورة المنتج المرتبط.',
        'Boş = bağlı ürünün fotoğrafı.',
        'Leer = das Foto des verknüpften Produkts.',
        'Vide = la photo du produit lié.',
        'Tomt = den länkade produktens bild.',
      ),
    },
    {
      key: 'aspect',
      type: 'select',
      label: L('Plate shape', 'شكل اللوحة', 'Levha biçimi', 'Tafelform', 'Forme de la planche', 'Planschens form'),
      defaultValue: 'portrait',
      options: [
        { value: 'portrait', label: L('Portrait (4:5)', 'طولي (4:5)', 'Dikey (4:5)', 'Hochformat (4:5)', 'Portrait (4:5)', 'Stående (4:5)') },
        { value: 'square', label: L('Square', 'مربع', 'Kare', 'Quadrat', 'Carré', 'Kvadrat') },
      ],
    },
    {
      key: 'fit',
      type: 'select',
      label: L('Photograph fit', 'ملاءمة الصورة', 'Fotoğraf sığdırma', 'Foto-Anpassung', 'Ajustement de la photo', 'Bildanpassning'),
      defaultValue: 'contain',
      options: [
        {
          value: 'contain',
          label: L(
            'Whole photograph (cut-out or studio)',
            'الصورة كاملة (مفرّغة أو استوديو)',
            'Fotoğrafın tamamı (dekupe veya stüdyo)',
            'Ganzes Foto (Freisteller oder Studio)',
            'Photo entière (détourée ou studio)',
            'Hela bilden (frilagd eller studio)',
          ),
        },
        {
          value: 'cover',
          label: L('Fill the plate', 'تملأ اللوحة', 'Levhayı doldur', 'Tafel füllen', 'Remplir la planche', 'Fyll planschen'),
        },
      ],
    },
    {
      key: 'bg_color',
      type: 'color',
      label: L('Background colour', 'لون الخلفية', 'Arka plan rengi', 'Hintergrundfarbe', 'Couleur de fond', 'Bakgrundsfärg'),
      description: L(
        'Empty = the theme surface colour.',
        'فارغ = لون السطح في القالب.',
        'Boş = temanın yüzey rengi.',
        'Leer = die Flächenfarbe des Themes.',
        'Vide = la couleur de surface du thème.',
        'Tomt = temats ytfärg.',
      ),
    },
    {
      key: 'ground_color',
      type: 'color',
      label: L(
        'Plate ground colour',
        'لون أرضية اللوحة',
        'Levha zemin rengi',
        'Grundfarbe der Tafel',
        'Couleur du fond de la planche',
        'Planschens bottenfärg',
      ),
      description: L(
        'Behind a photograph shown whole. Empty = none.',
        'خلف الصورة المعروضة كاملة. فارغ = بلا لون.',
        'Tamamı gösterilen fotoğrafın arkasında. Boş = yok.',
        'Hinter einem ganz gezeigten Foto. Leer = keine.',
        'Derrière une photo affichée en entier. Vide = aucune.',
        'Bakom en bild som visas hel. Tomt = ingen.',
      ),
    },
    {
      key: 'text_color',
      type: 'color',
      label: L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'),
      description: L(
        'Empty = the theme text colour.',
        'فارغ = لون النص في القالب.',
        'Boş = temanın metin rengi.',
        'Leer = die Textfarbe des Themes.',
        'Vide = la couleur de texte du thème.',
        'Tomt = temats textfärg.',
      ),
    },
    {
      key: 'line_color',
      type: 'color',
      label: L('Line colour', 'لون الخطوط', 'Çizgi rengi', 'Linienfarbe', 'Couleur des lignes', 'Linjefärg'),
      description: L(
        'Empty = the theme accent colour.',
        'فارغ = لون التمييز في القالب.',
        'Boş = temanın vurgu rengi.',
        'Leer = die Akzentfarbe des Themes.',
        'Vide = la couleur d’accent du thème.',
        'Tomt = temats accentfärg.',
      ),
    },
    {
      key: 'show_price',
      type: 'boolean',
      label: L('Show the price', 'إظهار السعر', 'Fiyatı göster', 'Preis anzeigen', 'Afficher le prix', 'Visa priset'),
      defaultValue: true,
    },
  ],
  defaultSettings: { aspect: 'portrait', fit: 'contain', show_price: true },
  defaultContent: {},
};
