// Builder schema of "promise-band": up to three promises under a small
// heading and a horizon line that a small sun walks along while the page
// scrolls. Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/promise-band.schema.ts (same
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

const EMPTY_BAND = L(
  'Empty = the built-in band palette.',
  'فارغ = ألوان الشريط المدمجة.',
  'Boş = yerleşik şerit paleti.',
  'Leer = die eingebaute Palette des Bandes.',
  'Vide = la palette intégrée de la bande.',
  'Tomt = bandets inbyggda palett.',
);

const ITEM_FIELDS: FieldDefinition[] = [
  {
    key: 'title',
    type: 'text',
    label: L('Title', 'العنوان', 'Başlık', 'Titel', 'Titre', 'Rubrik'),
    maxLength: 80,
  },
  {
    key: 'text',
    type: 'textarea',
    label: L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text'),
    maxLength: 200,
  },
  {
    key: 'icon',
    type: 'select',
    label: L('Icon', 'الأيقونة', 'Simge', 'Symbol', 'Icône', 'Ikon'),
    defaultValue: 'book',
    options: [
      option('book', L('Open book', 'كتاب مفتوح', 'Açık kitap', 'Offenes Buch', 'Livre ouvert', 'Öppen bok')),
      option('mountain', L('Mountains and sun', 'جبال وشمس', 'Dağlar ve güneş', 'Berge und Sonne', 'Montagnes et soleil', 'Berg och sol')),
      option('gem', L('Gem', 'جوهرة', 'Mücevher', 'Edelstein', 'Pierre précieuse', 'Ädelsten')),
      option('heart', L('Heart', 'قلب', 'Kalp', 'Herz', 'Cœur', 'Hjärta')),
      option('leaf', L('Leaf', 'ورقة نبات', 'Yaprak', 'Blatt', 'Feuille', 'Löv')),
      option('truck', L('Delivery', 'توصيل', 'Teslimat', 'Lieferung', 'Livraison', 'Leverans')),
      option('shield', L('Shield', 'درع', 'Kalkan', 'Schild', 'Bouclier', 'Sköld')),
      option('gift', L('Gift', 'هدية', 'Hediye', 'Geschenk', 'Cadeau', 'Present')),
      option('custom', L('My own icon', 'أيقونتي الخاصة', 'Kendi simgem', 'Eigenes Symbol', 'Mon icône', 'Egen ikon')),
    ],
  },
  {
    key: 'icon_image',
    type: 'image',
    label: L('Own icon', 'الأيقونة الخاصة', 'Kendi simge', 'Eigenes Symbol', 'Icône personnelle', 'Egen ikon'),
    description: L(
      'A small square SVG or PNG on a transparent background, drawn in your colours.',
      'ملف SVG أو PNG مربع صغير بخلفية شفافة، مرسوم بألوانك.',
      'Şeffaf arka planlı, kendi renklerinizle çizilmiş küçük, kare bir SVG veya PNG.',
      'Ein kleines quadratisches SVG oder PNG mit transparentem Hintergrund, in Ihren Farben gezeichnet.',
      'Un petit SVG ou PNG carré sur fond transparent, dessiné dans vos couleurs.',
      'En liten kvadratisk SVG eller PNG med transparent bakgrund, ritad i dina färger.',
    ),
    showIf: { key: 'icon', in: ['custom'] },
  },
];

const FIELDS: FieldDefinition[] = [
  {
    key: 'heading',
    type: 'text',
    label: L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik'),
    maxLength: 80,
  },
  {
    key: 'items',
    type: 'repeater',
    label: L('Promises', 'الوعود', 'Vaatler', 'Versprechen', 'Promesses', 'Löften'),
    maxItems: 3,
    fields: ITEM_FIELDS,
    description: L(
      'One to three promises, side by side (stacked on phones).',
      'من وعد إلى ثلاثة، جنباً إلى جنب (فوق بعضها على الهاتف).',
      'Bir ila üç vaat, yan yana (telefonlarda alt alta).',
      'Ein bis drei Versprechen nebeneinander (auf Telefonen untereinander).',
      'Une à trois promesses côte à côte (empilées sur téléphone).',
      'Ett till tre löften sida vid sida (staplade på mobiler).',
    ),
  },
  {
    key: 'numbers',
    type: 'boolean',
    label: L('Numbers 01, 02, 03', 'الأرقام 01، 02، 03', 'Numaralar 01, 02, 03', 'Nummern 01, 02, 03', 'Numéros 01, 02, 03', 'Nummer 01, 02, 03'),
    defaultValue: true,
  },
  {
    key: 'bg_color',
    type: 'color',
    label: L('Background', 'الخلفية', 'Arka plan', 'Hintergrund', 'Arrière-plan', 'Bakgrund'),
    description: L(
      'Give it the colour of the lower edge of the dawn hero above. Empty = the built-in band palette.',
      'اجعلها بلون الحافة السفلية لواجهة الفجر أعلاه. فارغ = ألوان الشريط المدمجة.',
      'Yukarıdaki şafak hero’sunun alt kenarının rengini verin. Boş = yerleşik şerit paleti.',
      'Geben Sie ihm die Farbe des unteren Randes des Morgenrot-Heros darüber. Leer = die eingebaute Palette des Bandes.',
      'Donnez-lui la couleur du bord inférieur du hero aube au-dessus. Vide = la palette intégrée de la bande.',
      'Ge den färgen på den nedre kanten av gryningsheron ovanför. Tomt = bandets inbyggda palett.',
    ),
  },
  {
    key: 'text_color',
    type: 'color',
    label: L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'),
    description: EMPTY_BAND,
  },
  {
    key: 'gold_color',
    type: 'color',
    label: L(
      'Gold (heading, horizon, icons)',
      'الذهبي (العنوان، الأفق، الأيقونات)',
      'Altın (başlık, ufuk, simgeler)',
      'Gold (Überschrift, Horizont, Symbole)',
      'Or (titre, horizon, icônes)',
      'Guld (rubrik, horisont, ikoner)',
    ),
    description: EMPTY_BAND,
  },
  {
    key: 'accent_color',
    type: 'color',
    label: L(
      'Accent (sun, hover)',
      'لون التمييز (الشمس، التمرير)',
      'Vurgu (güneş, üzerine gelme)',
      'Akzent (Sonne, Hover)',
      'Accent (soleil, survol)',
      'Accent (sol, hovring)',
    ),
    description: EMPTY_BAND,
  },
];

export const schema: SectionSchema = {
  id: 'promise-band',
  label: L('Promise band', 'شريط الوعود', 'Vaat şeridi', 'Versprechensband', 'Bande des promesses', 'Löftesband'),
  icon: 'layout',
  category: 'content',
  description: L(
    'Up to three promises under a horizon line: the line draws itself, a small sun rises and walks along it while the page scrolls. Pairs with the dawn hero.',
    'حتى ثلاثة وعود تحت خط أفق: يُرسم الخط وتصعد شمس صغيرة وتسير عليه أثناء التمرير. يناسب واجهة الفجر.',
    'Bir ufuk çizgisinin altında en fazla üç vaat: çizgi kendini çizer, küçük bir güneş doğar ve sayfa kaydırılırken çizgi boyunca ilerler. Şafak hero’suyla uyumludur.',
    'Bis zu drei Versprechen unter einer Horizontlinie: Die Linie zeichnet sich selbst, eine kleine Sonne geht auf und wandert beim Scrollen an ihr entlang. Passt zum Morgenrot-Hero.',
    'Jusqu’à trois promesses sous une ligne d’horizon : la ligne se trace, un petit soleil se lève et la parcourt pendant le défilement. Va de pair avec le hero aube.',
    'Upp till tre löften under en horisontlinje: linjen ritar sig själv, en liten sol stiger och vandrar längs den medan sidan rullas. Passar ihop med gryningsheron.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING'],
  translatable: ['heading', 'items'],
  schema: FIELDS,
  defaultSettings: { numbers: true },
  defaultContent: {
    heading: 'Our promise',
    items: [
      { title: 'A first promise', text: 'One short sentence about it.', icon: 'book' },
      { title: 'A second promise', text: 'One short sentence about it.', icon: 'mountain' },
      { title: 'A third promise', text: 'One short sentence about it.', icon: 'gem' },
    ],
  },
};

export default schema;
