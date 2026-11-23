// Builder schema of "look-spread": a look taken apart into the pieces you can
// buy (numbered markers on two photographs, the same numbers in a ruled buy
// list with live prices). Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/look-spread.schema.ts (same
// keys, order, types, options, defaults, translatable, pageTypes, maxItems
// and showIf), with every text in the six dashboard locales.
//
// Type-only import: section-schemas.ts imports this file.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

/** Six-locale text, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});

const ON_PHOTO = { key: 'photo', in: ['a', 'b'] };

const ITEM_FIELDS: FieldDefinition[] = [
  {
    key: 'url',
    type: 'url',
    productLink: 'prefer',
    label: L('Product link', 'رابط المنتج', 'Ürün bağlantısı', 'Produktlink', 'Lien du produit', 'Produktlänk'),
    description: L(
      'Pick a product: its name, image and price are read live from the store.',
      'اختر منتجاً: يُقرأ اسمه وصورته وسعره مباشرة من المتجر.',
      'Bir ürün seçin: adı, görseli ve fiyatı mağazadan canlı okunur.',
      'Wählen Sie ein Produkt: Name, Bild und Preis werden live aus dem Shop gelesen.',
      'Choisissez un produit : son nom, son image et son prix sont lus en direct depuis la boutique.',
      'Välj en produkt: namn, bild och pris läses direkt från butiken.',
    ),
  },
  {
    key: 'title',
    type: 'text',
    label: L('Title', 'العنوان', 'Başlık', 'Titel', 'Titre', 'Titel'),
    maxLength: 80,
    description: L(
      'Empty = the product name.',
      'فارغ = اسم المنتج.',
      'Boş = ürün adı.',
      'Leer = der Produktname.',
      'Vide = le nom du produit.',
      'Tomt = produktens namn.',
    ),
  },
  { key: 'note', type: 'text', label: L('Note', 'ملاحظة', 'Not', 'Hinweis', 'Note', 'Notering'), maxLength: 80 },
  {
    key: 'image',
    type: 'image',
    label: L('Thumbnail', 'الصورة المصغّرة', 'Küçük görsel', 'Vorschaubild', 'Vignette', 'Miniatyrbild'),
    description: L(
      'Empty = the product image.',
      'فارغ = صورة المنتج.',
      'Boş = ürün görseli.',
      'Leer = das Produktbild.',
      'Vide = l’image du produit.',
      'Tomt = produktbilden.',
    ),
  },
  {
    key: 'photo',
    type: 'select',
    label: L('Marker on', 'العلامة على', 'İşaretin yeri', 'Markierung auf', 'Repère sur', 'Markering på'),
    defaultValue: 'none',
    options: [
      { value: 'none', label: L('No marker', 'بدون علامة', 'İşaret yok', 'Keine Markierung', 'Aucun repère', 'Ingen markering') },
      { value: 'a', label: L('Large photograph', 'الصورة الكبيرة', 'Büyük fotoğraf', 'Großes Foto', 'Grande photo', 'Stora bilden') },
      { value: 'b', label: L('Small photograph', 'الصورة الصغيرة', 'Küçük fotoğraf', 'Kleines Foto', 'Petite photo', 'Lilla bilden') },
    ],
  },
  {
    key: 'x',
    type: 'number',
    label: L(
      'Marker position from the left (%)',
      'موضع العلامة من اليسار (%)',
      'İşaretin soldan konumu (%)',
      'Position der Markierung von links (%)',
      'Position du repère depuis la gauche (%)',
      'Markeringens läge från vänster (%)',
    ),
    min: 0,
    max: 100,
    showIf: ON_PHOTO,
  },
  {
    key: 'y',
    type: 'number',
    label: L(
      'Marker position from the top (%)',
      'موضع العلامة من الأعلى (%)',
      'İşaretin üstten konumu (%)',
      'Position der Markierung von oben (%)',
      'Position du repère depuis le haut (%)',
      'Markeringens läge från toppen (%)',
    ),
    min: 0,
    max: 100,
    showIf: ON_PHOTO,
  },
];

const color = (key: string, label: LocalizedString, description: LocalizedString): FieldDefinition => ({
  key, type: 'color', label, description,
});

export const schema: SectionSchema = {
  id: 'look-spread',
  label: L('Look spread', 'إطلالة مفكّكة', 'Kombin sayfası', 'Look-Doppelseite', 'Double page du look', 'Lookuppslag'),
  icon: 'scan-eye',
  category: 'commerce',
  description: L(
    'A look taken apart: numbered markers on two photographs tied to a numbered buy list with live prices.',
    'إطلالة مفكّكة: علامات مرقّمة على صورتين مرتبطة بقائمة شراء مرقّمة بأسعار مباشرة.',
    'Parçalarına ayrılmış bir kombin: iki fotoğraftaki numaralı işaretler, canlı fiyatlı numaralı bir alışveriş listesine bağlanır.',
    'Ein Look, in seine Teile zerlegt: nummerierte Markierungen auf zwei Fotos, verbunden mit einer nummerierten Kaufliste mit Live-Preisen.',
    'Un look décomposé : des repères numérotés sur deux photos, reliés à une liste d’achat numérotée avec les prix en direct.',
    'En look uppdelad i sina delar: numrerade markeringar på två bilder kopplade till en numrerad köplista med aktuella priser.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING'],
  translatable: ['eyebrow', 'heading', 'note', 'link_label', 'alt_a', 'alt_b', 'items'],
  schema: [
    { key: 'eyebrow', type: 'text', label: L('Eyebrow', 'العنوان العلوي', 'Üst başlık', 'Dachzeile', 'Surtitre', 'Överrubrik'), maxLength: 60 },
    { key: 'heading', type: 'textarea', label: L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik'), maxLength: 100 },
    { key: 'note', type: 'textarea', label: L('Side note', 'ملاحظة جانبية', 'Yan not', 'Randnotiz', 'Note en marge', 'Sidonotering'), maxLength: 160 },
    { key: 'link_label', type: 'text', label: L('Link text', 'نص الرابط', 'Bağlantı metni', 'Linktext', 'Texte du lien', 'Länktext'), maxLength: 40 },
    {
      key: 'alt_a',
      type: 'text',
      label: L(
        'Large photograph description (alt text)',
        'وصف الصورة الكبيرة (النص البديل)',
        'Büyük fotoğraf açıklaması (alt metin)',
        'Beschreibung des großen Fotos (Alt-Text)',
        'Description de la grande photo (texte alternatif)',
        'Beskrivning av stora bilden (alt-text)',
      ),
      maxLength: 160,
    },
    {
      key: 'alt_b',
      type: 'text',
      label: L(
        'Small photograph description (alt text)',
        'وصف الصورة الصغيرة (النص البديل)',
        'Küçük fotoğraf açıklaması (alt metin)',
        'Beschreibung des kleinen Fotos (Alt-Text)',
        'Description de la petite photo (texte alternatif)',
        'Beskrivning av lilla bilden (alt-text)',
      ),
      maxLength: 160,
    },
    {
      key: 'items',
      type: 'repeater',
      label: L('Pieces', 'القطع', 'Parçalar', 'Teile', 'Pièces', 'Plagg'),
      maxItems: 6,
      fields: ITEM_FIELDS,
    },
    { key: 'image_a', type: 'image', label: L('Large photograph', 'الصورة الكبيرة', 'Büyük fotoğraf', 'Großes Foto', 'Grande photo', 'Stora bilden') },
    { key: 'image_b', type: 'image', label: L('Small photograph', 'الصورة الصغيرة', 'Küçük fotoğraf', 'Kleines Foto', 'Petite photo', 'Lilla bilden') },
    { key: 'link_url', type: 'url', label: L('Link URL', 'الرابط', 'Bağlantı URL’si', 'Link-URL', 'URL du lien', 'Länkadress') },
    {
      key: 'list_side',
      type: 'select',
      label: L('List side', 'جهة القائمة', 'Liste tarafı', 'Seite der Liste', 'Côté de la liste', 'Listans sida'),
      defaultValue: 'end',
      options: [
        {
          value: 'end',
          label: L('After the photographs', 'بعد الصور', 'Fotoğraflardan sonra', 'Nach den Fotos', 'Après les photos', 'Efter bilderna'),
        },
        {
          value: 'start',
          label: L('Before the photographs', 'قبل الصور', 'Fotoğraflardan önce', 'Vor den Fotos', 'Avant les photos', 'Före bilderna'),
        },
      ],
    },
    color(
      'bg_color',
      L('Background colour', 'لون الخلفية', 'Arka plan rengi', 'Hintergrundfarbe', 'Couleur de fond', 'Bakgrundsfärg'),
      L(
        'Empty = the theme background colour.',
        'فارغ = لون الخلفية في الثيم.',
        'Boş = temanın arka plan rengi.',
        'Leer = die Hintergrundfarbe des Themes.',
        'Vide = la couleur de fond du thème.',
        'Tomt = temats bakgrundsfärg.',
      ),
    ),
    color(
      'text_color',
      L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'),
      L(
        'Empty = the theme text colour.',
        'فارغ = لون النص في الثيم.',
        'Boş = temanın metin rengi.',
        'Leer = die Textfarbe des Themes.',
        'Vide = la couleur de texte du thème.',
        'Tomt = temats textfärg.',
      ),
    ),
    color(
      'marker_color',
      L('Marker colour', 'لون العلامة', 'İşaret rengi', 'Farbe der Markierung', 'Couleur du repère', 'Markeringens färg'),
      L(
        'Empty = the theme accent colour.',
        'فارغ = لون التمييز في الثيم.',
        'Boş = temanın vurgu rengi.',
        'Leer = die Akzentfarbe des Themes.',
        'Vide = la couleur d’accent du thème.',
        'Tomt = temats accentfärg.',
      ),
    ),
    color(
      'marker_text_color',
      L(
        'Marker number colour',
        'لون رقم العلامة',
        'İşaret numarasının rengi',
        'Farbe der Markierungsnummer',
        'Couleur du numéro du repère',
        'Färg på markeringens siffra',
      ),
      L('Empty = white.', 'فارغ = أبيض.', 'Boş = beyaz.', 'Leer = Weiß.', 'Vide = blanc.', 'Tomt = vitt.'),
    ),
  ],
  defaultSettings: { list_side: 'end' },
  defaultContent: {},
};
