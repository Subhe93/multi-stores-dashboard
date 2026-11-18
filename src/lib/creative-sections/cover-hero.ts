// "cover-hero": a first screen composed like the cover of a printed issue.
// A field-by-field mirror of the storefront schema
// (multi-stores-web/src/themes/creative/schemas/cover-hero.schema.ts): same
// keys, order, types, options, defaults, translatable keys and page types,
// with labels in six locales.
//
// Type-only import: section-schemas.ts imports this file, so nothing of it
// may be needed at run time here.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});

type Extra = Partial<Pick<FieldDefinition, 'description' | 'required'>>;
type Option = [value: string, label: LocalizedString];

const text = (key: string, label: LocalizedString, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key, type: 'text', label, maxLength, ...extra,
});
const area = (key: string, label: LocalizedString, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key, type: 'textarea', label, maxLength, ...extra,
});
const image = (key: string, label: LocalizedString, extra: Extra = {}): FieldDefinition => ({
  key, type: 'image', label, ...extra,
});
const url = (key: string, label: LocalizedString, extra: Extra = {}): FieldDefinition => ({
  key, type: 'url', label, ...extra,
});
const color = (key: string, label: LocalizedString, extra: Extra = {}): FieldDefinition => ({
  key, type: 'color', label, ...extra,
});
const select = (key: string, label: LocalizedString, defaultValue: string, options: Option[]): FieldDefinition => ({
  key,
  type: 'select',
  label,
  defaultValue,
  options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
});

const TRANSLATABLE = [
  'masthead_start',
  'masthead_center',
  'masthead_end',
  'eyebrow',
  'heading',
  'subheading',
  'cta_text',
  'cta_secondary_text',
  'detail_label',
  'detail_title',
  'alt',
  'detail_alt',
];

export const schema: SectionSchema = {
  id: 'cover-hero',
  label: L('Cover hero', 'غلاف العدد', 'Kapak hero', 'Cover-Hero', 'Hero couverture', 'Omslagshero'),
  icon: 'layout-template',
  category: 'showcase',
  description: L(
    'A first screen composed like the cover of a printed issue: a masthead line, two photographs of different sizes and a caption that links to the product in the small one.',
    'شاشة أولى مركّبة كغلاف مجلة مطبوعة: سطر ترويسة، صورتان بحجمين مختلفين، وتعليق يقود إلى المنتج الظاهر في الصورة الصغيرة.',
    'Basılı bir derginin kapağı gibi kurulmuş ilk ekran: bir künye satırı, farklı boyutlarda iki fotoğraf ve küçük fotoğraftaki ürüne bağlanan bir alt yazı.',
    'Ein erster Bildschirm wie das Cover eines gedruckten Hefts: eine Kopfzeile, zwei Fotos unterschiedlicher Größe und eine Bildunterschrift, die zum Produkt im kleinen Foto führt.',
    'Un premier écran composé comme la couverture d’un magazine imprimé : une ligne de titre, deux photographies de tailles différentes et une légende qui mène au produit de la petite.',
    'En första skärm komponerad som omslaget till ett tryckt nummer: en redaktionsrad, två fotografier i olika storlek och en bildtext som länkar till produkten i det lilla.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING'],
  translatable: TRANSLATABLE,
  schema: [
    // ── Content ──
    text('masthead_start', L('Masthead, start', 'الترويسة، البداية', 'Künye, başlangıç', 'Kopfzeile, Anfang', 'Ligne de titre, début', 'Redaktionsrad, början'), 40),
    text('masthead_center', L('Masthead, centre', 'الترويسة، الوسط', 'Künye, orta', 'Kopfzeile, Mitte', 'Ligne de titre, centre', 'Redaktionsrad, mitten'), 60, {
      description: L(
        'On phones only this label is shown (or the start label when this one is empty).',
        'على الهاتف يظهر هذا النص فقط (أو نص البداية إن كان فارغاً).',
        'Telefonlarda yalnızca bu etiket gösterilir (boşsa başlangıç etiketi).',
        'Auf Telefonen wird nur dieses Label gezeigt (oder das Anfangs-Label, wenn dieses leer ist).',
        'Sur téléphone, seul ce libellé est affiché (ou celui du début s’il est vide).',
        'På telefoner visas bara den här etiketten (eller början-etiketten om den är tom).',
      ),
    }),
    text('masthead_end', L('Masthead, end', 'الترويسة، النهاية', 'Künye, son', 'Kopfzeile, Ende', 'Ligne de titre, fin', 'Redaktionsrad, slut'), 40),
    text('eyebrow', L('Eyebrow', 'النص العلوي', 'Üst yazı', 'Dachzeile', 'Surtitre', 'Överrubrik'), 60),
    area('heading', L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik'), 120, {
      required: true,
      description: L(
        'A new line starts a new line of the heading.',
        'السطر الجديد يبدأ سطراً جديداً في العنوان.',
        'Yeni satır, başlıkta yeni bir satır başlatır.',
        'Eine neue Zeile beginnt eine neue Zeile der Überschrift.',
        'Un retour à la ligne commence une nouvelle ligne du titre.',
        'En ny rad börjar en ny rad i rubriken.',
      ),
    }),
    area('subheading', L('Subheading', 'العنوان الفرعي', 'Alt başlık', 'Unterzeile', 'Sous-titre', 'Underrubrik'), 280),
    text('cta_text', L('Button text', 'نص الزر', 'Düğme metni', 'Button-Text', 'Texte du bouton', 'Knapptext'), 40),
    text('cta_secondary_text', L('Second button text', 'نص الزر الثاني', 'İkinci düğme metni', 'Text des zweiten Buttons', 'Texte du second bouton', 'Text på andra knappen'), 40),
    text('detail_label', L('Caption label', 'عنوان التعليق', 'Alt yazı etiketi', 'Label der Bildunterschrift', 'Libellé de la légende', 'Bildtextens etikett'), 40),
    text('detail_title', L('Caption title', 'نص التعليق', 'Alt yazı başlığı', 'Titel der Bildunterschrift', 'Titre de la légende', 'Bildtextens titel'), 80, {
      description: L(
        'Empty = the title of the linked product. The price always comes from the product.',
        'فارغ = اسم المنتج المرتبط. السعر يأتي دائماً من المنتج.',
        'Boş = bağlı ürünün adı. Fiyat her zaman üründen gelir.',
        'Leer = der Titel des verlinkten Produkts. Der Preis kommt immer vom Produkt.',
        'Vide = le titre du produit lié. Le prix vient toujours du produit.',
        'Tomt = den länkade produktens titel. Priset kommer alltid från produkten.',
      ),
    }),
    text('alt', L('Large photograph, alt text', 'النص البديل للصورة الكبيرة', 'Büyük fotoğraf, alternatif metin', 'Großes Foto, Alt-Text', 'Grande photographie, texte alternatif', 'Stort fotografi, alt-text'), 160),
    text('detail_alt', L('Small photograph, alt text', 'النص البديل للصورة الصغيرة', 'Küçük fotoğraf, alternatif metin', 'Kleines Foto, Alt-Text', 'Petite photographie, texte alternatif', 'Litet fotografi, alt-text'), 160),
    // ── Settings ──
    image('image', L('Large photograph', 'الصورة الكبيرة', 'Büyük fotoğraf', 'Großes Foto', 'Grande photographie', 'Stort fotografi')),
    select('image_focus_x', L('Photograph focus, horizontal', 'تركيز الصورة أفقياً', 'Fotoğraf odağı, yatay', 'Bildfokus, horizontal', 'Cadrage de la photo, horizontal', 'Bildfokus, horisontellt'), 'center', [
      ['left', L('Left', 'يسار', 'Sol', 'Links', 'Gauche', 'Vänster')],
      ['center', L('Centre', 'وسط', 'Orta', 'Mitte', 'Centre', 'Mitten')],
      ['right', L('Right', 'يمين', 'Sağ', 'Rechts', 'Droite', 'Höger')],
    ]),
    select('image_focus_y', L('Photograph focus, vertical', 'تركيز الصورة عمودياً', 'Fotoğraf odağı, dikey', 'Bildfokus, vertikal', 'Cadrage de la photo, vertical', 'Bildfokus, vertikalt'), 'top', [
      ['top', L('Top', 'أعلى', 'Üst', 'Oben', 'Haut', 'Överkant')],
      ['center', L('Centre', 'وسط', 'Orta', 'Mitte', 'Centre', 'Mitten')],
      ['bottom', L('Bottom', 'أسفل', 'Alt', 'Unten', 'Bas', 'Nederkant')],
    ]),
    image('detail_image', L('Small photograph', 'الصورة الصغيرة', 'Küçük fotoğraf', 'Kleines Foto', 'Petite photographie', 'Litet fotografi')),
    url('detail_url', L('Caption link (product)', 'رابط التعليق (منتج)', 'Alt yazı bağlantısı (ürün)', 'Link der Bildunterschrift (Produkt)', 'Lien de la légende (produit)', 'Bildtextens länk (produkt)'), {
      description: L(
        'A product link (/products/…) shows its title and live price in the caption.',
        'رابط منتج (‎/products/…) يُظهر اسمه وسعره الحالي في التعليق.',
        'Bir ürün bağlantısı (/products/…) alt yazıda ürünün adını ve güncel fiyatını gösterir.',
        'Ein Produktlink (/products/…) zeigt Titel und aktuellen Preis in der Bildunterschrift.',
        'Un lien de produit (/products/…) affiche son titre et son prix actuel dans la légende.',
        'En produktlänk (/products/…) visar titel och aktuellt pris i bildtexten.',
      ),
    }),
    image('seal_image', L('Seal (symbol on the masthead line)', 'الختم (رمز على خط الترويسة)', 'Mühür (künye çizgisindeki simge)', 'Siegel (Symbol auf der Kopfzeile)', 'Sceau (symbole sur la ligne de titre)', 'Sigill (symbol på redaktionsraden)')),
    select('seal_size', L('Seal size', 'حجم الختم', 'Mühür boyutu', 'Größe des Siegels', 'Taille du sceau', 'Sigillets storlek'), 'md', [
      ['sm', L('Small', 'صغير', 'Küçük', 'Klein', 'Petit', 'Liten')],
      ['md', L('Medium', 'متوسط', 'Orta', 'Mittel', 'Moyen', 'Medel')],
    ]),
    image('edge_image', L('Woven edge (narrow tile)', 'الحاشية المنسوجة (بلاطة ضيقة)', 'Dokuma kenar (dar karo)', 'Webkante (schmale Kachel)', 'Lisière tissée (motif étroit)', 'Vävd kant (smal ruta)'), {
      description: L(
        'A narrow tile repeated along the edge of the large photograph. Empty = no edge.',
        'بلاطة ضيقة تتكرر على حافة الصورة الكبيرة. فارغ = بلا حاشية.',
        'Büyük fotoğrafın kenarı boyunca tekrarlanan dar bir karo. Boş = kenar yok.',
        'Eine schmale Kachel, die sich entlang der Kante des großen Fotos wiederholt. Leer = keine Kante.',
        'Un motif étroit répété le long du bord de la grande photographie. Vide = pas de lisière.',
        'En smal ruta som upprepas längs det stora fotografiets kant. Tomt = ingen kant.',
      ),
    }),
    url('cta_url', L('Button link', 'رابط الزر', 'Düğme bağlantısı', 'Button-Link', 'Lien du bouton', 'Knapplänk')),
    url('cta_secondary_url', L('Second button link', 'رابط الزر الثاني', 'İkinci düğme bağlantısı', 'Link des zweiten Buttons', 'Lien du second bouton', 'Länk för andra knappen')),
    select('cta_tone', L('Button colour', 'لون الزر', 'Düğme rengi', 'Button-Farbe', 'Couleur du bouton', 'Knappfärg'), 'accent', [
      ['accent', L('Accent', 'لون التمييز', 'Vurgu', 'Akzent', 'Accent', 'Accent')],
      ['primary', L('Primary', 'اللون الأساسي', 'Ana renk', 'Primär', 'Principale', 'Primär')],
    ]),
    select('heading_level', L('Heading level', 'مستوى العنوان', 'Başlık düzeyi', 'Überschriftenebene', 'Niveau du titre', 'Rubriknivå'), 'h1', [
      ['h1', L('H1', 'H1', 'H1', 'H1', 'H1', 'H1')],
      ['h2', L('H2', 'H2', 'H2', 'H2', 'H2', 'H2')],
    ]),
    select('mobile_order', L('Order on phones', 'الترتيب على الهاتف', 'Telefonda sıra', 'Reihenfolge auf Telefonen', 'Ordre sur téléphone', 'Ordning på telefoner'), 'image-first', [
      ['image-first', L('Photographs first', 'الصور أولاً', 'Önce fotoğraflar', 'Fotos zuerst', 'Photographies d’abord', 'Fotografier först')],
      ['text-first', L('Text first', 'النص أولاً', 'Önce metin', 'Text zuerst', 'Texte d’abord', 'Text först')],
    ]),
    color('bg_color', L('Background colour', 'لون الخلفية', 'Arka plan rengi', 'Hintergrundfarbe', 'Couleur de fond', 'Bakgrundsfärg'), {
      description: L(
        'Empty = the theme surface colour.',
        'فارغ = لون السطح في الثيم.',
        'Boş = temanın yüzey rengi.',
        'Leer = die Flächenfarbe des Themes.',
        'Vide = la couleur de surface du thème.',
        'Tomt = temats ytfärg.',
      ),
    }),
    color('text_color', L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'), {
      description: L(
        'Empty = the theme text colour.',
        'فارغ = لون النص في الثيم.',
        'Boş = temanın metin rengi.',
        'Leer = die Textfarbe des Themes.',
        'Vide = la couleur de texte du thème.',
        'Tomt = temats textfärg.',
      ),
    }),
    color('accent_color', L('Accent colour', 'لون التمييز', 'Vurgu rengi', 'Akzentfarbe', 'Couleur d’accent', 'Accentfärg'), {
      description: L(
        'Empty = the theme accent colour.',
        'فارغ = لون التمييز في الثيم.',
        'Boş = temanın vurgu rengi.',
        'Leer = die Akzentfarbe des Themes.',
        'Vide = la couleur d’accent du thème.',
        'Tomt = temats accentfärg.',
      ),
    }),
  ],
  defaultSettings: {
    image_focus_x: 'center',
    image_focus_y: 'top',
    seal_size: 'md',
    cta_tone: 'accent',
    heading_level: 'h1',
    mobile_order: 'image-first',
  },
  // No brand words in the defaults.
  defaultContent: {},
};
