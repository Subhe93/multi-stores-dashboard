// Builder schemas of the scroll-driven creative sections: story-pinned,
// sticky-steps, motion-path and marquee-band. Hand-made mirror, field by
// field, of multi-stores-web/src/themes/creative/schemas/scroll-sections.schema.ts
// (same keys, order, types, option values, limits, showIf, translatable keys,
// page types and defaults), with every text in the six dashboard locales.
// The storefront's creative.contract.test.tsx compares the two files. Owner
// decision: every size of a decorative word, numeral, marquee text or
// travelling artwork offers Small / Medium only.
//
// Type-only import: section-schemas.ts imports this file.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

/** Six-locale text, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});
/** Colour override with a six-locale label. Empty = theme colour. */
const cL = (key: string, label: LocalizedString, extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key, type: 'color', label, ...extra,
});
const IMAGE_LABEL = L('Image', 'الصورة', 'Görsel', 'Bild', 'Image', 'Bild');
const ALT_LABEL = L('Image description (alt text)', 'وصف الصورة (النص البديل)', 'Görsel açıklaması (alt metni)', 'Bildbeschreibung (Alt-Text)', 'Description de l’image (texte alternatif)', 'Bildbeskrivning (alt-text)');
const TITLE_LABEL = L('Title', 'العنوان', 'Başlık', 'Titel', 'Titre', 'Titel');
const START_LABEL = L('Start', 'البداية', 'Başlangıç', 'Anfang', 'Début', 'Start');
const END_LABEL = L('End', 'النهاية', 'Bitiş', 'Ende', 'Fin', 'Slut');
const CENTER_LABEL = L('Center', 'الوسط', 'Orta', 'Mitte', 'Centre', 'Mitten');

const HEADING_LABEL = L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik');
const HEADING_MULTILINE_HINT = L(
  'Press Enter to start a new line (up to 4 lines).',
  'اضغط Enter لبدء سطر جديد (حتى 4 أسطر).',
  'Yeni bir satıra geçmek için Enter’a basın (en fazla 4 satır).',
  'Mit der Eingabetaste beginnen Sie eine neue Zeile (bis zu 4 Zeilen).',
  'Appuyez sur Entrée pour commencer une nouvelle ligne (4 lignes au maximum).',
  'Tryck på Enter för att börja på en ny rad (upp till 4 rader).',
);
const SUBHEADING_LABEL = L('Subheading', 'العنوان الفرعي', 'Alt başlık', 'Unterüberschrift', 'Sous-titre', 'Underrubrik');
const CTA_TONE_LABEL = L('Button color', 'لون الزر', 'Buton rengi', 'Button-Farbe', 'Couleur du bouton', 'Knappens färg');
const CTA_TONE_OPTIONS = [
  { value: 'primary', label: L('Primary color', 'اللون الأساسي', 'Ana renk', 'Primärfarbe', 'Couleur principale', 'Primärfärg') },
  { value: 'accent', label: L('Accent color', 'لون التمييز', 'Vurgu rengi', 'Akzentfarbe', 'Couleur d’accent', 'Accentfärg') },
];
const FOCUS_OPTIONS = [
  { value: 'center', label: CENTER_LABEL },
  { value: 'top', label: L('Top', 'الأعلى', 'Üst', 'Oben', 'Haut', 'Överkant') },
  { value: 'bottom', label: L('Bottom', 'الأسفل', 'Alt', 'Unten', 'Bas', 'Underkant') },
];

type CxExtra = Partial<Pick<FieldDefinition, 'description' | 'showIf' | 'defaultValue'>>;
type CxOption = [value: string, label: LocalizedString];

const cxText = (key: string, label: LocalizedString, maxLength: number, extra: CxExtra = {}): FieldDefinition => ({
  key, type: 'text', label, maxLength, ...extra,
});
const cxArea = (key: string, label: LocalizedString, maxLength: number, extra: CxExtra = {}): FieldDefinition => ({
  key, type: 'textarea', label, maxLength, ...extra,
});
const cxImage = (key: string, label: LocalizedString, extra: CxExtra = {}): FieldDefinition => ({
  key, type: 'image', label, ...extra,
});
const cxUrl = (key: string, label: LocalizedString): FieldDefinition => ({ key, type: 'url', label });
const cxBool = (key: string, label: LocalizedString, defaultValue: boolean, extra: CxExtra = {}): FieldDefinition => ({
  key, type: 'boolean', label, defaultValue, ...extra,
});
const cxNum = (key: string, label: LocalizedString, defaultValue: number, min: number, max: number): FieldDefinition => ({
  key, type: 'number', label, defaultValue, min, max,
});
const cxSelect = (
  key: string, label: LocalizedString, defaultValue: string, options: CxOption[], extra: CxExtra = {},
): FieldDefinition => ({
  key, type: 'select', label, defaultValue,
  options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  ...extra,
});
const cxRepeater = (
  key: string, label: LocalizedString, maxItems: number, fields: FieldDefinition[], extra: CxExtra = {},
): FieldDefinition => ({ key, type: 'repeater', label, maxItems, fields, ...extra });

const CX_NONE = L('None', 'بدون', 'Yok', 'Keine', 'Aucun', 'Ingen');
const CX_SMALL = L('Small', 'صغير', 'Küçük', 'Klein', 'Petit', 'Liten');
const CX_MEDIUM = L('Medium', 'متوسط', 'Orta', 'Mittel', 'Moyen', 'Medel');
const CX_ACCENT_COLOUR = L('Accent colour', 'لون التمييز', 'Vurgu rengi', 'Akzentfarbe', 'Couleur d’accent', 'Accentfärg');
const CX_SQUARE = L('Square', 'مربع', 'Kare', 'Quadrat', 'Carré', 'Kvadrat');
const CX_EYEBROW = L('Small label', 'تسمية صغيرة', 'Küçük etiket', 'Kleines Label', 'Petit libellé', 'Liten etikett');
const CX_LABEL = L('Label', 'التسمية', 'Etiket', 'Label', 'Libellé', 'Etikett');
const CX_TEXT = L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text');
const CX_BUTTON_TEXT = L('Button text', 'نص الزر', 'Buton metni', 'Button-Text', 'Texte du bouton', 'Knapptext');
const CX_BUTTON_URL = L('Button URL', 'رابط الزر', 'Buton bağlantısı', 'Button-URL', 'URL du bouton', 'Knappens URL');
const CX_BUTTON_2_TEXT = L('Second button text', 'نص الزر الثاني', 'İkinci buton metni', 'Text des zweiten Buttons', 'Texte du second bouton', 'Text på andra knappen');
const CX_BUTTON_2_URL = L('Second button URL', 'رابط الزر الثاني', 'İkinci buton bağlantısı', 'URL des zweiten Buttons', 'URL du second bouton', 'Andra knappens URL');
const CX_LINK_TEXT = L('Link text', 'نص الرابط', 'Bağlantı metni', 'Linktext', 'Texte du lien', 'Länktext');
const CX_LINK_URL = L('Link URL', 'عنوان الرابط', 'Bağlantı adresi', 'Link-URL', 'URL du lien', 'Länkens URL');
const CX_ARTWORK_SIZE = L('Artwork size', 'حجم العمل الفني', 'Görsel öğe boyutu', 'Größe des Motivs', 'Taille du visuel', 'Motivets storlek');
const CX_SHAPE_COLOUR = L('Shape colour', 'لون الشكل', 'Şekil rengi', 'Farbe der Form', 'Couleur de la forme', 'Formens färg');
const CX_HEADING_POSITION = L('Heading position', 'موضع العنوان', 'Başlık konumu', 'Position der Überschrift', 'Position du titre', 'Rubrikens placering');

const CX_EMPTY_ACCENT = L(
  'Empty = the theme accent colour.',
  'فارغ = لون التمييز في القالب.',
  'Boş = temanın vurgu rengi.',
  'Leer = die Akzentfarbe des Themes.',
  'Vide = la couleur d’accent du thème.',
  'Tomt = temats accentfärg.',
);
const CX_EMPTY_SURFACE = L(
  'Empty = the theme surface colour.',
  'فارغ = لون السطح في القالب.',
  'Boş = temanın yüzey rengi.',
  'Leer = die Flächenfarbe des Themes.',
  'Vide = la couleur de surface du thème.',
  'Tomt = temats ytfärg.',
);
const CX_EMPTY_SECONDARY = L(
  'Empty = the theme secondary colour.',
  'فارغ = اللون الثانوي في القالب.',
  'Boş = temanın ikincil rengi.',
  'Leer = die Sekundärfarbe des Themes.',
  'Vide = la couleur secondaire du thème.',
  'Tomt = temats sekundärfärg.',
);
const CX_EMPTY_SCENE = L(
  'Empty = the scene’s own colour.',
  'فارغ = لون المشهد نفسه.',
  'Boş = sahnenin kendi rengi.',
  'Leer = die eigene Farbe der Szene.',
  'Vide = la couleur propre à la scène.',
  'Tomt = scenens egen färg.',
);

// Owner decision: these two values only, Medium by default.
const CX_SIZE_SM_MD: CxOption[] = [['sm', CX_SMALL], ['md', CX_MEDIUM]];
const CX_FOCUS: CxOption[] = FOCUS_OPTIONS.map((o) => [o.value, o.label]);
const CX_SCENE_LABEL = L('Colour scene', 'مشهد الألوان', 'Renk sahnesi', 'Farbszene', 'Scène de couleur', 'Färgscen');
const CX_SCENE_BG_LABEL = L('Scene background', 'خلفية المشهد', 'Sahne arka planı', 'Hintergrund der Szene', 'Fond de la scène', 'Scenens bakgrund');
const CX_SCENE_OPTIONS: CxOption[] = [
  ['dark', L('Dark', 'داكن', 'Koyu', 'Dunkel', 'Sombre', 'Mörk')],
  ['light', L('Light', 'فاتح', 'Açık', 'Hell', 'Clair', 'Ljus')],
  ['accent', CX_ACCENT_COLOUR],
];
const CX_SHAPE_BASE: CxOption[] = [
  ['none', CX_NONE],
  ['circle', L('Circle', 'دائرة', 'Daire', 'Kreis', 'Cercle', 'Cirkel')],
  ['arch', L('Arch', 'قوس', 'Kemer', 'Bogen', 'Arche', 'Båge')],
];

/** SCENE: the section's own colour theme. */
const cxSceneFields = (defaultValue: 'none' | 'dark' | 'light' | 'accent'): FieldDefinition[] => [
  cxSelect(
    'scene',
    CX_SCENE_LABEL,
    defaultValue,
    [
      ['none', L('None (page colours)', 'بدون (ألوان الصفحة)', 'Yok (sayfa renkleri)', 'Keine (Seitenfarben)', 'Aucune (couleurs de la page)', 'Ingen (sidans färger)')],
      ...CX_SCENE_OPTIONS,
    ],
    {
      description: L(
        'Gives the section its own background and text colours, taken from the theme.',
        'يمنح القسم خلفية وألوان نص خاصة به مأخوذة من القالب.',
        'Bölüme temadan alınan kendi arka plan ve metin renklerini verir.',
        'Gibt dem Abschnitt eigene Hintergrund- und Textfarben aus dem Theme.',
        'Donne à la section ses propres couleurs de fond et de texte, issues du thème.',
        'Ger avsnittet egna bakgrunds- och textfärger, hämtade från temat.',
      ),
    },
  ),
  cL('scene_bg', CX_SCENE_BG_LABEL, { description: CX_EMPTY_SCENE }),
  cL('scene_text', L('Scene text colour', 'لون نص المشهد', 'Sahne metin rengi', 'Textfarbe der Szene', 'Couleur du texte de la scène', 'Scenens textfärg'), { description: CX_EMPTY_SCENE }),
  cL('scene_accent', L('Scene accent colour', 'لون تمييز المشهد', 'Sahne vurgu rengi', 'Akzentfarbe der Szene', 'Couleur d’accent de la scène', 'Scenens accentfärg'), { description: CX_EMPTY_SCENE }),
];

const CX_EMPHASIS_LABEL = L('Accent phrase', 'العبارة المميَّزة', 'Vurgulu ifade', 'Akzentphrase', 'Expression accentuée', 'Accentfras');
const CX_EMPHASIS_DESCRIPTION = L(
  'Wrap a phrase of the heading in asterisks to accent it: More than *just a drink*. One phrase per line. Arabic text is coloured, never slanted.',
  'ضع عبارة من العنوان بين نجمتين لتمييزها: أكثر من *مجرد مشروب*. عبارة واحدة في كل سطر. النص العربي يُلوَّن ولا يُمال.',
  'Vurgulamak için başlıktaki bir ifadeyi yıldız işaretleri arasına alın: Bir *içecekten fazlası*. Her satırda bir ifade. Arapça metin renklendirilir, asla eğik yazılmaz.',
  'Setzen Sie eine Phrase der Überschrift zwischen Sternchen, um sie hervorzuheben: Mehr als *nur ein Getränk*. Eine Phrase pro Zeile. Arabischer Text wird eingefärbt, nie schräg gestellt.',
  'Entourez une expression du titre d’astérisques pour l’accentuer : Plus qu’*une simple boisson*. Une expression par ligne. Le texte arabe est coloré, jamais incliné.',
  'Sätt en fras i rubriken mellan asterisker för att framhäva den: Mer än *bara en dryck*. En fras per rad. Arabisk text färgas, lutas aldrig.',
);
const CX_EMPHASIS_OPTIONS: CxOption[] = [
  ['none', CX_NONE],
  ['color', CX_ACCENT_COLOUR],
  ['italic', L('Italic in accent colour', 'مائل بلون التمييز', 'Vurgu renginde italik', 'Kursiv in Akzentfarbe', 'Italique en couleur d’accent', 'Kursiv i accentfärg')],
];
const CX_EMPHASIS_COLOR_FIELD: FieldDefinition = cL(
  'heading_emphasis_color',
  L('Accent phrase colour', 'لون العبارة المميَّزة', 'Vurgulu ifade rengi', 'Farbe der Akzentphrase', 'Couleur de l’expression accentuée', 'Accentfrasens färg'),
  { description: CX_EMPTY_ACCENT, showIf: { key: 'heading_emphasis', in: ['color', 'italic'] } },
);

/** EMPHASIS: the `*phrase*` marked in the heading text. `fallback` = the unset value. */
const cxEmphasisFields = (fallback: 'none' | 'italic'): FieldDefinition[] => [
  cxSelect('heading_emphasis', CX_EMPHASIS_LABEL, fallback, CX_EMPHASIS_OPTIONS, { description: CX_EMPHASIS_DESCRIPTION }),
  CX_EMPHASIS_COLOR_FIELD,
];

/** CTA: two pill buttons (the second one outlined). */
const CX_CTA_FIELDS: FieldDefinition[] = [
  cxText('cta_text', CX_BUTTON_TEXT, 40),
  cxText('cta_secondary_text', CX_BUTTON_2_TEXT, 40),
  cxUrl('cta_url', CX_BUTTON_URL),
  cxUrl('cta_secondary_url', CX_BUTTON_2_URL),
  cxSelect('cta_tone', CTA_TONE_LABEL, 'primary', CTA_TONE_OPTIONS.map((o) => [o.value, o.label])),
];

const cxHeadingTrio = (): FieldDefinition[] => [
  cxText('eyebrow', CX_EYEBROW, 60),
  cxArea('heading', HEADING_LABEL, 120, { description: HEADING_MULTILINE_HINT }),
  cxArea('subheading', SUBHEADING_LABEL, 280),
];

const CX_ORNAMENT_PATH_FIELDS: FieldDefinition[] = [
  cxArea('d', L('Path data', 'بيانات المسار', 'Yol verisi', 'Pfaddaten', 'Données du tracé', 'Bandata'), 600, {
    description: L(
      'The "d" value of an SVG path (commands and numbers only).',
      'قيمة "d" لمسار SVG (أوامر وأرقام فقط).',
      'Bir SVG yolunun "d" değeri (yalnızca komutlar ve sayılar).',
      'Der „d“-Wert eines SVG-Pfads (nur Befehle und Zahlen).',
      'La valeur « d » d’un tracé SVG (commandes et nombres uniquement).',
      'Värdet ”d” i en SVG-bana (endast kommandon och siffror).',
    ),
  }),
  cxSelect('color', L('Colour', 'اللون', 'Renk', 'Farbe', 'Couleur', 'Färg'), 'a', [
    ['a', L('Colour A', 'اللون أ', 'Renk A', 'Farbe A', 'Couleur A', 'Färg A')],
    ['b', L('Colour B', 'اللون ب', 'Renk B', 'Farbe B', 'Couleur B', 'Färg B')],
    ['c', L('Colour C', 'اللون ج', 'Renk C', 'Farbe C', 'Couleur C', 'Färg C')],
  ]),
];

const CX_PAGE_AND_FOOTER: NonNullable<SectionSchema['pageTypes']> = ['HOME', 'STATIC', 'LANDING', 'FOOTER'];
const CX_PAGE: NonNullable<SectionSchema['pageTypes']> = ['HOME', 'STATIC', 'LANDING'];

const SCHEMAS: SectionSchema[] = [
  {
    id: 'story-pinned',
    label: L('Pinned story', 'قصة مثبّتة', 'Sabitlenmiş hikâye', 'Fixierte Story', 'Récit épinglé', 'Fäst berättelse'),
    icon: 'gallery',
    category: 'content',
    description: L(
      'A row of cards that moves sideways while the section stays in place. On phones it is a normal swipe row. Use it once per page.',
      'صف بطاقات يتحرّك أفقياً بينما يبقى القسم في مكانه. على الهاتف يصبح صفاً يُسحب بالإصبع. استخدمه مرة واحدة في الصفحة.',
      'Bölüm yerinde dururken yana doğru hareket eden bir kart sırası. Telefonlarda normal bir kaydırma sırasıdır. Sayfada bir kez kullanın.',
      'Eine Kartenreihe, die sich seitwärts bewegt, während der Abschnitt stehen bleibt. Auf dem Handy eine normale Wischreihe. Einmal pro Seite verwenden.',
      'Une rangée de cartes qui se déplace latéralement pendant que la section reste en place. Sur mobile, une rangée à faire glisser. À utiliser une fois par page.',
      'En rad kort som rör sig i sidled medan avsnittet står still. På mobilen är det en vanlig sveprad. Använd det en gång per sida.',
    ),
    pageTypes: [...CX_PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'items'],
    schema: [
      ...cxHeadingTrio(),
      ...cxEmphasisFields('italic'),
      cxRepeater('items', L('Cards', 'البطاقات', 'Kartlar', 'Karten', 'Cartes', 'Kort'), 8, [
        cxImage('image', IMAGE_LABEL),
        cxText('image_alt', ALT_LABEL, 160),
        cxImage('icon', L('Icon', 'الأيقونة', 'Simge', 'Symbol', 'Icône', 'Ikon')),
        cxText('label', CX_LABEL, 24),
        cxText('title', TITLE_LABEL, 80),
        cxArea('text', CX_TEXT, 240),
        cxText('cta_text', CX_LINK_TEXT, 40),
        cxUrl('cta_url', CX_LINK_URL),
      ]),
      cxSelect('card_style', L('Card style', 'نمط البطاقة', 'Kart stili', 'Kartenstil', 'Style de carte', 'Kortstil'), 'editorial', [
        ['editorial', L('Photo above text', 'صورة فوق النص', 'Metnin üstünde fotoğraf', 'Foto über dem Text', 'Photo au-dessus du texte', 'Foto ovanför texten')],
        ['overlay', L('Text over photo', 'نص فوق الصورة', 'Fotoğrafın üzerinde metin', 'Text auf dem Foto', 'Texte sur la photo', 'Text över fotot')],
        ['panel', L('Panel (no photo)', 'لوحة (بدون صورة)', 'Panel (fotoğrafsız)', 'Panel (ohne Foto)', 'Panneau (sans photo)', 'Panel (utan foto)')],
      ]),
      cxSelect('card_width', L('Card width', 'عرض البطاقة', 'Kart genişliği', 'Kartenbreite', 'Largeur de carte', 'Kortbredd'), 'md', [
        ['sm', CX_SMALL],
        ['md', CX_MEDIUM],
        ['lg', L('Large', 'كبير', 'Büyük', 'Groß', 'Grand', 'Stor')],
      ]),
      cxSelect('image_aspect', L('Image proportions', 'أبعاد الصورة', 'Görsel oranları', 'Bildproportionen', 'Proportions de l’image', 'Bildens proportioner'), 'portrait', [
        ['portrait', L('Portrait', 'طولي', 'Dikey', 'Hochformat', 'Portrait', 'Stående')],
        ['square', CX_SQUARE],
        ['landscape', L('Landscape', 'عرضي', 'Yatay', 'Querformat', 'Paysage', 'Liggande')],
      ]),
      cxSelect('numerals', L('Numerals', 'الأرقام', 'Rakamlar', 'Ziffern', 'Numéros', 'Siffror'), 'small', [
        ['none', CX_NONE],
        ['small', L('Small', 'صغيرة', 'Küçük', 'Klein', 'Petits', 'Små')],
        ['outline', L('Outlined', 'محدَّدة', 'Konturlu', 'Kontur', 'En contour', 'Kontur')],
      ]),
      cxSelect('progress', L('Progress', 'مؤشر التقدّم', 'İlerleme', 'Fortschritt', 'Progression', 'Förlopp'), 'bar', [
        ['bar', L('Bar', 'شريط', 'Çubuk', 'Balken', 'Barre', 'Stapel')],
        ['counter', L('Counter', 'عدّاد', 'Sayaç', 'Zähler', 'Compteur', 'Räknare')],
        ['both', L('Bar and counter', 'شريط وعدّاد', 'Çubuk ve sayaç', 'Balken und Zähler', 'Barre et compteur', 'Stapel och räknare')],
        ['none', CX_NONE],
      ]),
      cxBool('hint', L('"Keep scrolling" hint', 'تلميح «واصل التمرير»', '“Kaydırmaya devam et” ipucu', 'Hinweis „Weiter scrollen“', 'Indication « Continuez à défiler »', 'Tipset ”Fortsätt scrolla”'), true),
      cxSelect('heading_position', CX_HEADING_POSITION, 'above', [
        ['above', L('Above the row', 'فوق الصف', 'Sıranın üstünde', 'Über der Reihe', 'Au-dessus de la rangée', 'Ovanför raden')],
        ['start', L('First item of the row', 'أول عنصر في الصف', 'Sıranın ilk öğesi', 'Erstes Element der Reihe', 'Premier élément de la rangée', 'Första objektet i raden')],
      ]),
      cxSelect('mobile_layout', L('Layout on phones', 'التخطيط على الهاتف', 'Telefonda düzen', 'Layout auf dem Handy', 'Mise en page sur mobile', 'Layout på mobilen'), 'swipe', [
        ['swipe', L('Swipe row', 'صف يُسحب', 'Kaydırma sırası', 'Wischreihe', 'Rangée à faire glisser', 'Sveprad')],
        ['stack', L('Stack', 'عمودي', 'Alt alta', 'Gestapelt', 'Empilé', 'Staplat')],
      ]),
      cL('accent_color', CX_ACCENT_COLOUR, { description: CX_EMPTY_ACCENT }),
      ...cxSceneFields('none'),
    ],
    defaultSettings: {
      heading_emphasis: 'italic',
      card_style: 'editorial',
      card_width: 'md',
      image_aspect: 'portrait',
      numerals: 'small',
      progress: 'bar',
      hint: true,
      heading_position: 'above',
      mobile_layout: 'swipe',
      scene: 'none',
    },
    defaultContent: { heading: 'Our story' },
  },
  {
    id: 'sticky-steps',
    label: L('Sticky steps', 'خطوات مع عنوان ثابت', 'Sabit başlıklı adımlar', 'Schritte mit fixierter Überschrift', 'Étapes à titre fixe', 'Steg med fast rubrik'),
    icon: 'list-ordered',
    category: 'content',
    description: L(
      'A heading that stays in view beside a numbered list of steps with a progress line.',
      'عنوان يبقى ظاهراً بجانب قائمة خطوات مرقّمة مع خط تقدّم.',
      'İlerleme çizgili numaralı adım listesinin yanında görünür kalan bir başlık.',
      'Eine Überschrift, die neben einer nummerierten Schrittliste mit Fortschrittslinie im Blick bleibt.',
      'Un titre qui reste visible à côté d’une liste d’étapes numérotées avec une ligne de progression.',
      'En rubrik som stannar i bild bredvid en numrerad steglista med förloppslinje.',
    ),
    pageTypes: [...CX_PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'items'],
    schema: [
      ...cxHeadingTrio(),
      ...cxEmphasisFields('italic'),
      cxRepeater('items', L('Steps', 'الخطوات', 'Adımlar', 'Schritte', 'Étapes', 'Steg'), 8, [
        cxText('title', TITLE_LABEL, 80),
        cxArea('text', CX_TEXT, 240),
      ]),
      cxSelect('numeral_style', L('Numeral style', 'نمط الأرقام', 'Rakam stili', 'Ziffernstil', 'Style des numéros', 'Sifferstil'), 'outline', [
        ['outline', L('Outlined', 'محدَّدة', 'Konturlu', 'Kontur', 'En contour', 'Kontur')],
        ['solid', L('Solid', 'مصمتة', 'Dolu', 'Gefüllt', 'Pleins', 'Fyllda')],
        ['none', CX_NONE],
      ]),
      cxSelect('numeral_size', L('Numeral size', 'حجم الأرقام', 'Rakam boyutu', 'Zifferngröße', 'Taille des numéros', 'Sifferstorlek'), 'md', CX_SIZE_SM_MD),
      cxBool('progress_line', L('Progress line', 'خط التقدّم', 'İlerleme çizgisi', 'Fortschrittslinie', 'Ligne de progression', 'Förloppslinje'), true),
      cxSelect('heading_side', L('Heading side', 'جانب العنوان', 'Başlığın tarafı', 'Seite der Überschrift', 'Côté du titre', 'Rubrikens sida'), 'start', [
        ['start', START_LABEL],
        ['end', END_LABEL],
      ]),
      cxSelect('spacing', L('Spacing', 'التباعد', 'Boşluk', 'Abstand', 'Espacement', 'Avstånd'), 'md', [
        ['sm', L('Compact', 'متقارب', 'Sıkı', 'Kompakt', 'Compact', 'Kompakt')],
        ['md', L('Roomy', 'واسع', 'Ferah', 'Luftig', 'Aéré', 'Luftigt')],
      ]),
      cL('accent_color', CX_ACCENT_COLOUR, { description: CX_EMPTY_ACCENT }),
      cxText('cta_text', CX_BUTTON_TEXT, 40),
      cxUrl('cta_url', CX_BUTTON_URL),
      ...cxSceneFields('none'),
    ],
    defaultSettings: {
      heading_emphasis: 'italic',
      numeral_style: 'outline',
      numeral_size: 'md',
      progress_line: true,
      heading_side: 'start',
      spacing: 'md',
      scene: 'none',
    },
    defaultContent: { heading: 'How it works' },
  },
  {
    id: 'motion-path',
    label: L('Journey path', 'مسار الرحلة', 'Yolculuk rotası', 'Reisepfad', 'Parcours', 'Resans väg'),
    icon: 'map-pin',
    category: 'content',
    description: L(
      'Stops along a drawn line; a small artwork travels down the line as the page scrolls.',
      'محطات على خط مرسوم؛ عمل فني صغير ينتقل على الخط أثناء تمرير الصفحة.',
      'Çizilmiş bir hat boyunca duraklar; sayfa kaydırıldıkça küçük bir görsel öğe hat boyunca ilerler.',
      'Stationen entlang einer gezeichneten Linie; ein kleines Motiv wandert beim Scrollen die Linie hinab.',
      'Des étapes le long d’une ligne tracée ; un petit visuel descend la ligne au fil du défilement.',
      'Hållplatser längs en ritad linje; ett litet motiv färdas nedför linjen när sidan rullas.',
    ),
    pageTypes: [...CX_PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'stops'],
    schema: [
      ...cxHeadingTrio(),
      ...cxEmphasisFields('italic'),
      cxSelect('heading_position', CX_HEADING_POSITION, 'above', [
        ['above', L('Above the path', 'فوق المسار', 'Rotanın üstünde', 'Über dem Pfad', 'Au-dessus du parcours', 'Ovanför vägen')],
        ['sticky', L('Sticky beside the path', 'ثابت بجانب المسار', 'Rotanın yanında sabit', 'Fixiert neben dem Pfad', 'Fixe à côté du parcours', 'Fast bredvid vägen')],
      ]),
      cxRepeater('stops', L('Stops', 'المحطات', 'Duraklar', 'Stationen', 'Étapes', 'Hållplatser'), 7, [
        cxText('label', CX_LABEL, 24),
        cxText('title', TITLE_LABEL, 80),
        cxArea('text', CX_TEXT, 200),
        cxImage('image', IMAGE_LABEL),
        cxText('image_alt', ALT_LABEL, 160),
        cxText('cta_text', CX_LINK_TEXT, 40),
        cxUrl('cta_url', CX_LINK_URL),
      ]),
      cxImage('artwork', L('Travelling artwork', 'العمل الفني المتنقّل', 'Gezen görsel öğe', 'Wanderndes Motiv', 'Visuel voyageur', 'Vandrande motiv')),
      cxSelect('artwork_size', CX_ARTWORK_SIZE, 'md', CX_SIZE_SM_MD),
      cxBool('artwork_rotate', L('Turn with the path', 'الدوران مع المسار', 'Rotayla birlikte dön', 'Mit dem Pfad drehen', 'Tourner avec le parcours', 'Vrid med vägen'), false),
      cxBool('artwork_flip_rtl', L('Mirror in right-to-left', 'عكس الاتجاه في العربية', 'Sağdan sola yazımda yansıt', 'In Rechts-nach-links spiegeln', 'Inverser en lecture de droite à gauche', 'Spegla i höger-till-vänster'), false, {
        description: L(
          'For a vehicle or an arrow. Never for artwork that contains text.',
          'لمركبة أو سهم. لا تستخدمه مع عمل فني يحتوي نصاً.',
          'Bir araç veya ok için. Yazı içeren görsel öğelerde asla kullanmayın.',
          'Für ein Fahrzeug oder einen Pfeil. Nie für ein Motiv, das Text enthält.',
          'Pour un véhicule ou une flèche. Jamais pour un visuel contenant du texte.',
          'För ett fordon eller en pil. Aldrig för motiv som innehåller text.',
        ),
      }),
      cxSelect('path_shape', L('Path shape', 'شكل المسار', 'Rota şekli', 'Pfadform', 'Forme du parcours', 'Vägens form'), 'wave', [
        ['wave', L('Wave', 'متموّج', 'Dalga', 'Welle', 'Vague', 'Våg')],
        ['zigzag', L('Zigzag', 'متعرّج', 'Zikzak', 'Zickzack', 'Zigzag', 'Sicksack')],
        ['straight', L('Straight', 'مستقيم', 'Düz', 'Gerade', 'Droit', 'Rak')],
      ]),
      cxSelect('path_style', L('Path style', 'نمط المسار', 'Rota stili', 'Pfadstil', 'Style du parcours', 'Vägens stil'), 'line', [
        ['line', L('Line', 'خط', 'Çizgi', 'Linie', 'Ligne', 'Linje')],
        ['dashed', L('Dashed', 'متقطّع', 'Kesik çizgi', 'Gestrichelt', 'Tirets', 'Streckad')],
        ['band', L('Band', 'شريط', 'Bant', 'Band', 'Bande', 'Band')],
      ]),
      cL('path_color', L('Path colour', 'لون المسار', 'Rota rengi', 'Pfadfarbe', 'Couleur du parcours', 'Vägens färg'), {
        description: L(
          'Empty = the theme border colour.',
          'فارغ = لون الحدود في القالب.',
          'Boş = temanın kenarlık rengi.',
          'Leer = die Rahmenfarbe des Themes.',
          'Vide = la couleur de bordure du thème.',
          'Tomt = temats kantfärg.',
        ),
      }),
      cL('trail_color', L('Trail colour', 'لون الأثر', 'İz rengi', 'Farbe der Spur', 'Couleur de la traînée', 'Spårets färg'), { description: CX_EMPTY_ACCENT }),
      cL('marker_color', L('Marker colour', 'لون العلامات', 'İşaret rengi', 'Farbe der Markierungen', 'Couleur des repères', 'Markörernas färg'), { description: CX_EMPTY_ACCENT }),
      cxSelect('cards_side', L('Cards', 'البطاقات', 'Kartlar', 'Karten', 'Cartes', 'Kort'), 'alternate', [
        ['alternate', L('Alternate sides', 'بالتناوب على الجانبين', 'Dönüşümlü taraflar', 'Abwechselnde Seiten', 'Côtés alternés', 'Växlande sidor')],
        ['one-side', L('One side', 'جانب واحد', 'Tek taraf', 'Eine Seite', 'Un seul côté', 'En sida')],
      ]),
      ...cxSceneFields('none'),
    ],
    defaultSettings: {
      heading_emphasis: 'italic',
      heading_position: 'above',
      artwork_size: 'md',
      artwork_rotate: false,
      artwork_flip_rtl: false,
      path_shape: 'wave',
      path_style: 'line',
      cards_side: 'alternate',
      scene: 'none',
    },
    defaultContent: { heading: 'How it works' },
  },
  {
    id: 'marquee-band',
    label: L('Marquee band', 'شريط متحرّك', 'Kayan bant', 'Laufband', 'Bandeau défilant', 'Rullande band'),
    icon: 'megaphone',
    category: 'showcase',
    description: L(
      'One or two rows of words, chips or cards that glide past, with your symbol as the separator. No JavaScript.',
      'صف أو صفان من الكلمات أو الوسوم أو البطاقات تنساب أفقياً، ورمزك فاصل بينها. بدون جافاسكربت.',
      'Simgeniz ayırıcı olarak, süzülerek geçen bir veya iki sıra sözcük, etiket veya kart. JavaScript yok.',
      'Eine oder zwei Reihen aus Wörtern, Chips oder Karten, die vorbeigleiten, mit Ihrem Symbol als Trenner. Ohne JavaScript.',
      'Une ou deux rangées de mots, de pastilles ou de cartes qui défilent, avec votre symbole comme séparateur. Sans JavaScript.',
      'En eller två rader med ord, etiketter eller kort som glider förbi, med din symbol som avgränsare. Utan JavaScript.',
    ),
    pageTypes: [...CX_PAGE_AND_FOOTER],
    translatable: ['heading', 'items'],
    schema: [
      cxText('heading', L('Label above', 'تسمية أعلى الشريط', 'Üstteki etiket', 'Label darüber', 'Libellé au-dessus', 'Etikett ovanför'), 80),
      cxRepeater('items', L('Items', 'العناصر', 'Öğeler', 'Elemente', 'Éléments', 'Objekt'), 16, [
        cxText('text', CX_TEXT, 60),
        cxImage('image', IMAGE_LABEL),
        cxText('image_alt', ALT_LABEL, 160),
        cxUrl('url', CX_LINK_URL),
      ]),
      cxSelect('rows', L('Rows', 'الصفوف', 'Sıralar', 'Reihen', 'Rangées', 'Rader'), '2', [
        ['1', L('One', 'صف واحد', 'Bir', 'Eine', 'Une', 'En')],
        ['2', L('Two (opposite directions)', 'صفان (باتجاهين متعاكسين)', 'İki (zıt yönlerde)', 'Zwei (gegenläufig)', 'Deux (sens opposés)', 'Två (motsatta riktningar)')],
      ]),
      cxSelect('item_style', L('Item style', 'نمط العنصر', 'Öğe stili', 'Elementstil', 'Style des éléments', 'Objektstil'), 'text', [
        ['text', CX_TEXT],
        ['pill', L('Pill', 'وسم مستدير', 'Hap', 'Pille', 'Pastille', 'Piller')],
        ['card', L('Card', 'بطاقة', 'Kart', 'Karte', 'Carte', 'Kort')],
      ]),
      cxSelect('size', L('Text size', 'حجم النص', 'Metin boyutu', 'Textgröße', 'Taille du texte', 'Textstorlek'), 'md', CX_SIZE_SM_MD),
      cxSelect(
        'text_style',
        L('Text style', 'نمط النص', 'Metin stili', 'Textstil', 'Style du texte', 'Textstil'),
        'solid',
        [
          ['solid', L('Solid', 'مصمت', 'Dolu', 'Gefüllt', 'Plein', 'Fylld')],
          ['outline', L('Outlined', 'محدَّد', 'Konturlu', 'Kontur', 'En contour', 'Kontur')],
          ['mixed', L('Alternating', 'بالتناوب', 'Dönüşümlü', 'Abwechselnd', 'En alternance', 'Växlande')],
        ],
        {
          description: L(
            'Arabic text is always solid.',
            'النص العربي يبقى مصمتاً دائماً.',
            'Arapça metin her zaman doludur.',
            'Arabischer Text ist immer gefüllt.',
            'Le texte arabe est toujours plein.',
            'Arabisk text är alltid fylld.',
          ),
        },
      ),
      cxText('separator', L('Separator', 'الفاصل', 'Ayırıcı', 'Trenner', 'Séparateur', 'Avgränsare'), 3, { defaultValue: '•' }),
      cxImage('separator_image', L('Separator symbol', 'رمز الفاصل', 'Ayırıcı simgesi', 'Trennsymbol', 'Symbole séparateur', 'Avgränsarsymbol'), {
        description: L(
          'Your brand symbol, drawn small between the items.',
          'رمز علامتك، يُرسم صغيراً بين العناصر.',
          'Marka simgeniz; öğelerin arasına küçük çizilir.',
          'Ihr Markensymbol, klein zwischen den Elementen.',
          'Votre symbole de marque, dessiné en petit entre les éléments.',
          'Din varumärkessymbol, ritad liten mellan objekten.',
        ),
      }),
      cxSelect('speed', L('Speed', 'السرعة', 'Hız', 'Geschwindigkeit', 'Vitesse', 'Hastighet'), 'slow', [
        ['slow', L('Slow', 'بطيء', 'Yavaş', 'Langsam', 'Lente', 'Långsam')],
        ['normal', L('Normal', 'عادي', 'Normal', 'Normal', 'Normale', 'Normal')],
        ['fast', L('Fast', 'سريع', 'Hızlı', 'Schnell', 'Rapide', 'Snabb')],
      ]),
      cxBool('edge_fade', L('Fade at the edges', 'تلاشٍ عند الأطراف', 'Kenarlarda solma', 'An den Rändern ausblenden', 'Fondu sur les bords', 'Toning i kanterna'), true),
      cxBool('grayscale_images', L('Greyscale images', 'صور بالأبيض والأسود', 'Gri tonlamalı görseller', 'Bilder in Graustufen', 'Images en niveaux de gris', 'Bilder i gråskala'), false),
      cL('text_color', L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg')),
      cL('border_color', L('Border colour', 'لون الحدود', 'Kenarlık rengi', 'Rahmenfarbe', 'Couleur de bordure', 'Kantfärg')),
      ...cxSceneFields('none'),
    ],
    defaultSettings: {
      rows: '2',
      item_style: 'text',
      size: 'md',
      text_style: 'solid',
      separator: '•',
      speed: 'slow',
      edge_fade: true,
      grayscale_images: false,
      scene: 'none',
    },
    defaultContent: { items: [] },
  },
];

export const SCROLL_SECTION_SCHEMAS = SCHEMAS;
