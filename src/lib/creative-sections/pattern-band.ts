// Builder schema of "pattern-band": a woven band built from the store's own
// tile artwork. Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/pattern-band.schema.ts (same
// keys, order, types, options, defaults, translatable and pageTypes), with
// every text in the six dashboard locales.
//
// Type-only import: section-schemas.ts imports this file.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

/** Six-locale text, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});
const option = (value: string, label: LocalizedString) => ({ value, label });

const FIELDS: FieldDefinition[] = [
  {
    key: 'label',
    type: 'text',
    label: L('Label', 'النص', 'Etiket', 'Beschriftung', 'Libellé', 'Etikett'),
    maxLength: 60,
    description: L(
      'Optional. A small tag centred on the band.',
      'اختياري. بطاقة صغيرة في منتصف الشريط.',
      'İsteğe bağlı. Şeridin ortasında küçük bir etiket.',
      'Optional. Ein kleines Etikett in der Mitte des Bandes.',
      'Facultatif. Une petite étiquette centrée sur la bande.',
      'Valfritt. En liten etikett mitt på bandet.',
    ),
  },
  {
    key: 'tile_image',
    type: 'image',
    label: L('Tile artwork', 'صورة النقش', 'Desen karosu', 'Musterkachel', 'Motif à répéter', 'Mönsterruta'),
    description: L(
      'One tile of your pattern (SVG, PNG or WebP). It repeats along the band at the height of the band.',
      'بلاطة واحدة من نقشك (SVG أو PNG أو WebP). تتكرر على طول الشريط بارتفاع الشريط.',
      'Deseninizin tek bir karosu (SVG, PNG veya WebP). Şerit boyunca, şerit yüksekliğinde tekrarlanır.',
      'Eine Kachel Ihres Musters (SVG, PNG oder WebP). Sie wiederholt sich entlang des Bandes in dessen Höhe.',
      'Un carreau de votre motif (SVG, PNG ou WebP). Il se répète le long de la bande, à la hauteur de celle-ci.',
      'En ruta av ditt mönster (SVG, PNG eller WebP). Den upprepas längs bandet i bandets höjd.',
    ),
  },
  {
    key: 'size',
    type: 'select',
    label: L('Band height', 'ارتفاع الشريط', 'Şerit yüksekliği', 'Bandhöhe', 'Hauteur de la bande', 'Bandets höjd'),
    defaultValue: 'md',
    options: [
      option('sm', L('Small', 'صغير', 'Küçük', 'Klein', 'Petite', 'Liten')),
      option('md', L('Medium', 'متوسط', 'Orta', 'Mittel', 'Moyenne', 'Medel')),
      option('lg', L('Large', 'كبير', 'Büyük', 'Groß', 'Grande', 'Stor')),
    ],
  },
  {
    key: 'rows',
    type: 'select',
    label: L('Rows', 'الصفوف', 'Sıralar', 'Reihen', 'Rangées', 'Rader'),
    defaultValue: '1',
    options: [
      option('1', L('One row', 'صف واحد', 'Tek sıra', 'Eine Reihe', 'Une rangée', 'En rad')),
      option('2', L('Two rows, offset', 'صفّان متداخلان', 'İki sıra, kaydırılmış', 'Zwei Reihen, versetzt', 'Deux rangées décalées', 'Två rader, förskjutna')),
    ],
    description: L(
      'Two rows double the band; the second row is shifted by half a square tile.',
      'الصفّان يضاعفان الشريط، والصف الثاني مُزاح بمقدار نصف بلاطة مربّعة.',
      'İki sıra şeridi iki katına çıkarır; ikinci sıra yarım kare karo kadar kaydırılır.',
      'Zwei Reihen verdoppeln das Band; die zweite Reihe ist um eine halbe quadratische Kachel versetzt.',
      'Deux rangées doublent la bande ; la seconde est décalée d’un demi-carreau carré.',
      'Två rader fördubblar bandet; den andra raden är förskjuten en halv kvadratisk ruta.',
    ),
  },
  {
    key: 'width',
    type: 'select',
    label: L('Width', 'العرض', 'Genişlik', 'Breite', 'Largeur', 'Bredd'),
    defaultValue: 'full',
    options: [
      option('full', L('Full width', 'عرض كامل', 'Tam genişlik', 'Volle Breite', 'Pleine largeur', 'Full bredd')),
      option('contained', L('Contained', 'ضمن الحاوية', 'Kapsayıcı içinde', 'Im Container', 'Dans le conteneur', 'Inom containern')),
    ],
  },
  {
    key: 'space',
    type: 'select',
    label: L(
      'Space above and below',
      'المسافة أعلى وأسفل',
      'Üst ve alt boşluk',
      'Abstand oben und unten',
      'Espace au-dessus et en dessous',
      'Avstånd över och under',
    ),
    defaultValue: 'md',
    options: [
      option('none', L('None', 'بدون', 'Yok', 'Keiner', 'Aucun', 'Inget')),
      option('sm', L('Small', 'صغيرة', 'Küçük', 'Klein', 'Petit', 'Litet')),
      option('md', L('Medium', 'متوسطة', 'Orta', 'Mittel', 'Moyen', 'Medel')),
      option('lg', L('Large', 'كبيرة', 'Büyük', 'Groß', 'Grand', 'Stort')),
    ],
  },
  {
    key: 'rails',
    type: 'boolean',
    label: L(
      'Hairlines above and below',
      'خطّان رفيعان أعلى وأسفل',
      'Üstte ve altta ince çizgiler',
      'Haarlinien oben und unten',
      'Filets au-dessus et en dessous',
      'Hårlinjer över och under',
    ),
    defaultValue: false,
  },
  {
    key: 'label_url',
    type: 'url',
    label: L('Label link', 'رابط النص', 'Etiket bağlantısı', 'Link der Beschriftung', 'Lien du libellé', 'Etikettens länk'),
  },
  {
    key: 'bg_color',
    type: 'color',
    label: L('Band ground', 'أرضية الشريط', 'Şerit zemini', 'Grund des Bandes', 'Fond de la bande', 'Bandets botten'),
    description: L(
      'Empty = transparent, the ground of the artwork shows.',
      'فارغ = شفاف، تظهر أرضية النقش نفسها.',
      'Boş = şeffaf, desenin kendi zemini görünür.',
      'Leer = transparent, der Grund des Motivs ist sichtbar.',
      'Vide = transparent, le fond du motif reste visible.',
      'Tomt = genomskinligt, mönstrets egen botten syns.',
    ),
  },
  {
    key: 'tag_color',
    type: 'color',
    label: L('Label ground', 'خلفية النص', 'Etiket zemini', 'Grund der Beschriftung', 'Fond du libellé', 'Etikettens botten'),
    description: L(
      'Empty = the theme background colour.',
      'فارغ = لون الخلفية في القالب.',
      'Boş = temanın arka plan rengi.',
      'Leer = die Hintergrundfarbe des Themes.',
      'Vide = la couleur de fond du thème.',
      'Tomt = temats bakgrundsfärg.',
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
];

export const schema: SectionSchema = {
  id: 'pattern-band',
  label: L('Pattern band', 'شريط النسيج', 'Desen şeridi', 'Musterband', 'Bande à motif', 'Mönsterband'),
  icon: 'grip-horizontal',
  category: 'content',
  description: L(
    'A woven band from your own tile artwork: a divider, a texture and, with a label, a small signpost.',
    'شريط منسوج من نقشك الخاص: فاصل وملمس، ومع نص يصبح لافتة صغيرة.',
    'Kendi deseninizden dokunmuş bir şerit: ayırıcı, doku ve etiketle birlikte küçük bir işaret.',
    'Ein gewebtes Band aus Ihrem eigenen Muster: Trenner, Textur und, mit Beschriftung, ein kleiner Wegweiser.',
    'Une bande tissée à partir de votre propre motif : séparateur, texture et, avec un libellé, un petit repère.',
    'Ett vävt band av ditt eget mönster: avdelare, textur och, med etikett, en liten vägvisare.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING', 'FOOTER'],
  translatable: ['label'],
  schema: FIELDS,
  defaultSettings: { size: 'md', rows: '1', width: 'full', space: 'md', rails: false },
  defaultContent: {},
};

export default schema;
