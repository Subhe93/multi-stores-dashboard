// Builder schemas of the scroll-driven creative sections: story-pinned,
// sticky-steps, motion-path and marquee-band, plus hero-outline, hero-sunrise
// and stage-scenes. Hand-made mirror, field by
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

const ALT_DESCRIPTION = L(
  'Read by screen readers and search engines. Leave empty when the image is only decoration.',
  'يقرؤه قارئ الشاشة ومحركات البحث. اتركه فارغاً إذا كانت الصورة للزينة فقط.',
  'Ekran okuyucular ve arama motorları okur. Görsel yalnızca süs ise boş bırakın.',
  'Wird von Screenreadern und Suchmaschinen gelesen. Leer lassen, wenn das Bild nur Dekoration ist.',
  'Lu par les lecteurs d’écran et les moteurs de recherche. Laissez vide si l’image est purement décorative.',
  'Läses av skärmläsare och sökmotorer. Lämna tomt om bilden bara är dekoration.',
);
const IMAGE_FOCUS_LABEL = L('Image focus', 'تركيز الصورة', 'Görsel odağı', 'Bildfokus', 'Point focal de l’image', 'Bildens fokus');

// Hero compositions and the travelling stage: hero-outline, hero-sunrise,
// stage-scenes (mirror of the same file on the storefront).
const HERO_SCHEMAS: SectionSchema[] = [
  {
    id: 'hero-outline',
    label: L('Outline accent hero', 'واجهة بكلمة محدَّدة', 'Konturlu vurgu hero’su', 'Hero mit Kontur-Akzent', 'Hero à accent en contour', 'Hero med konturaccent'),
    icon: 'sparkles',
    category: 'showcase',
    description: L(
      'A hero built around one photo or cut-out, with a modest outlined brand word as a quiet layer behind it.',
      'واجهة تتمحور حول صورة واحدة أو عنصر مقصوص، مع كلمة العلامة بخط محدَّد وحجم معتدل كطبقة هادئة خلفها.',
      'Tek bir fotoğrafın veya dekupe görselin etrafında kurulan bir hero; arkasında sakin bir katman olarak ölçülü, konturlu bir marka sözcüğü.',
      'Ein Hero rund um ein Foto oder ein freigestelltes Motiv, mit einem dezenten Markenwort in Konturschrift als ruhiger Ebene dahinter.',
      'Un hero construit autour d’une photo ou d’un visuel détouré, avec un mot de marque discret en contour comme calque en arrière-plan.',
      'En hero kring ett foto eller ett frilagt motiv, med ett diskret varumärkesord i kontur som ett stilla lager bakom.',
    ),
    pageTypes: [...CX_PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'accent_text', 'cta_text', 'cta_secondary_text', 'alt', 'stats'],
    schema: [
      cxImage('image', IMAGE_LABEL, {
        description: L(
          'A cut-out on a transparent background or a photo.',
          'عنصر مقصوص بخلفية شفافة أو صورة.',
          'Şeffaf arka planlı dekupe bir görsel veya bir fotoğraf.',
          'Ein freigestelltes Motiv auf transparentem Hintergrund oder ein Foto.',
          'Un visuel détouré sur fond transparent ou une photo.',
          'Ett frilagt motiv på genomskinlig bakgrund eller ett foto.',
        ),
      }),
      cxText('alt', ALT_LABEL, 160, { description: ALT_DESCRIPTION }),
      cxSelect('image_fit', L('Image fit', 'ملاءمة الصورة', 'Görsel sığdırma', 'Bildanpassung', 'Ajustement de l’image', 'Bildanpassning'), 'contain', [
        ['contain', L('Whole image (cut-out)', 'الصورة كاملة (عنصر مقصوص)', 'Görselin tamamı (dekupe)', 'Ganzes Bild (freigestellt)', 'Image entière (détourée)', 'Hela bilden (frilagd)')],
        ['cover', L('Photo card', 'بطاقة صورة', 'Fotoğraf kartı', 'Fotokarte', 'Carte photo', 'Fotokort')],
      ]),
      cxSelect('image_focus', IMAGE_FOCUS_LABEL, 'center', CX_FOCUS, { showIf: { key: 'image_fit', in: ['cover'] } }),
      cxSelect('layout', L('Layout', 'التخطيط', 'Düzen', 'Layout', 'Mise en page', 'Layout'), 'center', [
        ['center', L('Image in the centre', 'الصورة في الوسط', 'Görsel ortada', 'Bild in der Mitte', 'Image au centre', 'Bilden i mitten')],
        ['split', L('Split', 'مقسوم', 'Bölünmüş', 'Geteilt', 'Scindé', 'Delad')],
      ]),
      cxSelect('height', L('Height', 'الارتفاع', 'Yükseklik', 'Höhe', 'Hauteur', 'Höjd'), 'lg', [
        ['md', CX_MEDIUM],
        ['lg', L('Tall', 'طويل', 'Yüksek', 'Hoch', 'Haute', 'Hög')],
      ]),
      ...cxHeadingTrio(),
      ...cxEmphasisFields('italic'),
      cxText('accent_text', L('Accent word', 'الكلمة الزخرفية', 'Vurgu sözcüğü', 'Akzentwort', 'Mot d’accent', 'Accentord'), 16, {
        description: L(
          'A short brand word shown as a quiet graphic layer. Decorative: screen readers skip it.',
          'كلمة قصيرة للعلامة تظهر كطبقة زخرفية هادئة. للزينة فقط: يتجاوزها قارئ الشاشة.',
          'Sakin bir grafik katman olarak gösterilen kısa bir marka sözcüğü. Süs amaçlıdır: ekran okuyucular atlar.',
          'Ein kurzes Markenwort als ruhige grafische Ebene. Dekorativ: Screenreader überspringen es.',
          'Un mot de marque court, affiché comme un calque graphique discret. Décoratif : les lecteurs d’écran l’ignorent.',
          'Ett kort varumärkesord som visas som ett stilla grafiskt lager. Dekorativt: skärmläsare hoppar över det.',
        ),
      }),
      cxSelect('accent_style', L('Accent word style', 'نمط الكلمة الزخرفية', 'Vurgu sözcüğü stili', 'Stil des Akzentworts', 'Style du mot d’accent', 'Accentordets stil'), 'outline', [
        ['outline', L('Outline', 'محدَّدة', 'Kontur', 'Kontur', 'Contour', 'Kontur')],
        ['faint', L('Faint', 'باهتة', 'Soluk', 'Blass', 'Estompé', 'Svag')],
        ['none', L('Hidden', 'مخفية', 'Gizli', 'Ausgeblendet', 'Masqué', 'Dold')],
      ]),
      cxSelect('accent_size', L('Accent word size', 'حجم الكلمة الزخرفية', 'Vurgu sözcüğü boyutu', 'Größe des Akzentworts', 'Taille du mot d’accent', 'Accentordets storlek'), 'md', CX_SIZE_SM_MD),
      cxSelect('accent_position', L('Accent word position', 'موضع الكلمة الزخرفية', 'Vurgu sözcüğü konumu', 'Position des Akzentworts', 'Position du mot d’accent', 'Accentordets placering'), 'behind', [
        ['behind', L('Behind the image', 'خلف الصورة', 'Görselin arkasında', 'Hinter dem Bild', 'Derrière l’image', 'Bakom bilden')],
        ['below', L('Below the image', 'تحت الصورة', 'Görselin altında', 'Unter dem Bild', 'Sous l’image', 'Under bilden')],
      ]),
      cL('accent_color', L('Accent word colour', 'لون الكلمة الزخرفية', 'Vurgu sözcüğü rengi', 'Farbe des Akzentworts', 'Couleur du mot d’accent', 'Accentordets färg'), { description: CX_EMPTY_ACCENT }),
      cxSelect('shape', L('Shape behind the image', 'شكل خلف الصورة', 'Görselin arkasındaki şekil', 'Form hinter dem Bild', 'Forme derrière l’image', 'Form bakom bilden'), 'none', CX_SHAPE_BASE),
      cL('shape_color', CX_SHAPE_COLOUR, { description: CX_EMPTY_SURFACE }),
      cxSelect('halo', L('Halo', 'الهالة', 'Hale', 'Halo', 'Halo', 'Halo'), 'dots', [
        ['none', CX_NONE],
        ['dots', L('Dots', 'نقاط', 'Noktalar', 'Punkte', 'Points', 'Prickar')],
        ['glow', L('Glow', 'توهّج', 'Parıltı', 'Leuchten', 'Lueur', 'Sken')],
        ['rings', L('Rings', 'حلقات', 'Halkalar', 'Ringe', 'Anneaux', 'Ringar')],
      ]),
      cL('halo_color_1', L('Halo colour 1', 'لون الهالة 1', 'Hale rengi 1', 'Halo-Farbe 1', 'Couleur du halo 1', 'Halofärg 1'), { description: CX_EMPTY_ACCENT }),
      cL('halo_color_2', L('Halo colour 2', 'لون الهالة 2', 'Hale rengi 2', 'Halo-Farbe 2', 'Couleur du halo 2', 'Halofärg 2'), { description: CX_EMPTY_SECONDARY }),
      cxRepeater('stats', L('Figures', 'الأرقام', 'Rakamlar', 'Kennzahlen', 'Chiffres', 'Siffror'), 3, [
        cxText('label', CX_LABEL, 24),
        cxText('value', L('Value', 'القيمة', 'Değer', 'Wert', 'Valeur', 'Värde'), 24),
      ]),
      cxBool('pointer_parallax', L('Follow the pointer', 'تتبّع المؤشر', 'İmleci takip et', 'Dem Mauszeiger folgen', 'Suivre le pointeur', 'Följ pekaren'), true),
      cxBool('scroll_cue', L('Scroll cue', 'إشارة التمرير', 'Kaydırma işareti', 'Scroll-Hinweis', 'Indice de défilement', 'Rullningsmarkering'), false),
      ...cxSceneFields('none'),
      ...CX_CTA_FIELDS,
    ],
    defaultSettings: {
      image_fit: 'contain',
      layout: 'center',
      height: 'lg',
      heading_emphasis: 'italic',
      accent_style: 'outline',
      accent_size: 'md',
      accent_position: 'behind',
      shape: 'none',
      halo: 'dots',
      pointer_parallax: true,
      scroll_cue: false,
      scene: 'none',
      cta_tone: 'primary',
    },
    defaultContent: { heading: 'Your headline here', cta_text: 'Shop now' },
  },
  {
    id: 'hero-sunrise',
    label: L('Rising emblem hero', 'واجهة الشعار الصاعد', 'Yükselen amblem hero’su', 'Hero mit aufsteigendem Emblem', 'Hero à emblème levant', 'Hero med stigande emblem'),
    icon: 'sparkles',
    category: 'showcase',
    description: L(
      'A hero where your own artwork rises into place on load, with an optional photo card.',
      'واجهة يصعد فيها عملك الفني إلى مكانه عند التحميل، مع بطاقة صورة اختيارية.',
      'Kendi görsel öğenizin yüklenirken yerine yükseldiği bir hero; isteğe bağlı bir fotoğraf kartıyla.',
      'Ein Hero, in dem Ihr eigenes Motiv beim Laden an seinen Platz aufsteigt, mit optionaler Fotokarte.',
      'Un hero où votre propre visuel s’élève à sa place au chargement, avec une carte photo facultative.',
      'En hero där ditt eget motiv stiger på plats när sidan laddas, med ett valfritt fotokort.',
    ),
    pageTypes: [...CX_PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text', 'alt'],
    schema: [
      cxImage('sun_core', L('Rising artwork', 'العمل الفني الصاعد', 'Yükselen görsel öğe', 'Aufsteigendes Motiv', 'Visuel levant', 'Stigande motiv')),
      cxImage('sun_rays', L('Rays (optional)', 'الأشعة (اختياري)', 'Işınlar (isteğe bağlı)', 'Strahlen (optional)', 'Rayons (facultatif)', 'Strålar (valfritt)'), {
        description: L(
          'Drawn behind the rising artwork.',
          'تُرسم خلف العمل الفني الصاعد.',
          'Yükselen görsel öğenin arkasına çizilir.',
          'Wird hinter dem aufsteigenden Motiv gezeichnet.',
          'Dessinés derrière le visuel levant.',
          'Ritas bakom det stigande motivet.',
        ),
      }),
      cxImage('foreground', L('Foreground (optional)', 'المقدّمة (اختياري)', 'Ön plan (isteğe bağlı)', 'Vordergrund (optional)', 'Premier plan (facultatif)', 'Förgrund (valfritt)')),
      cxSelect(
        'foreground_mode',
        L('Foreground mode', 'نمط المقدّمة', 'Ön plan modu', 'Vordergrund-Modus', 'Mode du premier plan', 'Förgrundsläge'),
        'ridge',
        [
          ['ridge', L('Ridge along the bottom', 'حافة أسفل القسم', 'Alt kenar boyunca sırt', 'Kamm am unteren Rand', 'Crête le long du bas', 'Kam längs nederkanten')],
          ['emblem', L('Emblem (same box as the artwork)', 'شعار (نفس إطار العمل الفني)', 'Amblem (görsel öğeyle aynı kutu)', 'Emblem (gleicher Rahmen wie das Motiv)', 'Emblème (même cadre que le visuel)', 'Emblem (samma ruta som motivet)')],
        ],
        {
          description: L(
            'Emblem: export both artworks with the same square viewBox so they register exactly.',
            'شعار: صدِّر العملين بنفس إطار العرض المربع ليتطابقا تماماً.',
            'Amblem: tam üst üste gelmeleri için iki görsel öğeyi de aynı kare viewBox ile dışa aktarın.',
            'Emblem: Exportieren Sie beide Motive mit derselben quadratischen viewBox, damit sie exakt übereinanderliegen.',
            'Emblème : exportez les deux visuels avec la même viewBox carrée pour qu’ils se superposent exactement.',
            'Emblem: exportera båda motiven med samma kvadratiska viewBox så att de passar exakt.',
          ),
        },
      ),
      cxSelect('foreground_height', L('Foreground height', 'ارتفاع المقدّمة', 'Ön plan yüksekliği', 'Höhe des Vordergrunds', 'Hauteur du premier plan', 'Förgrundens höjd'), 'md', CX_SIZE_SM_MD, {
        showIf: { key: 'foreground_mode', in: ['ridge'] },
      }),
      cxSelect('plate', L('Plate', 'القرص الخلفي', 'Arka disk', 'Scheibe', 'Disque de fond', 'Bakgrundsskiva'), 'none', [
        ['none', CX_NONE],
        ['disc', L('Round plate', 'قرص دائري', 'Yuvarlak disk', 'Runde Scheibe', 'Disque rond', 'Rund skiva')],
      ]),
      cL('plate_color', L('Plate colour', 'لون القرص', 'Disk rengi', 'Farbe der Scheibe', 'Couleur du disque', 'Skivans färg'), {
        description: CX_EMPTY_SURFACE,
        showIf: { key: 'plate', in: ['disc'] },
      }),
      cxImage('image', L('Photo (optional)', 'الصورة (اختياري)', 'Fotoğraf (isteğe bağlı)', 'Foto (optional)', 'Photo (facultatif)', 'Foto (valfritt)')),
      cxText('alt', ALT_LABEL, 160, { description: ALT_DESCRIPTION }),
      cxSelect('image_focus', IMAGE_FOCUS_LABEL, 'center', CX_FOCUS),
      cxSelect('sun_size', CX_ARTWORK_SIZE, 'md', CX_SIZE_SM_MD),
      cxSelect('sun_position', L('Artwork position', 'موضع العمل الفني', 'Görsel öğe konumu', 'Position des Motivs', 'Position du visuel', 'Motivets placering'), 'center', [
        ['start', START_LABEL],
        ['center', CENTER_LABEL],
        ['end', END_LABEL],
        ['seam', L('On the photo corner', 'على زاوية الصورة', 'Fotoğrafın köşesinde', 'Auf der Fotoecke', 'Sur le coin de la photo', 'På fotots hörn')],
      ]),
      cxSelect('rays_motion', L('Rays motion', 'حركة الأشعة', 'Işın hareketi', 'Bewegung der Strahlen', 'Mouvement des rayons', 'Strålarnas rörelse'), 'rotate', [
        ['rotate', L('Slow rotation', 'دوران بطيء', 'Yavaş dönüş', 'Langsame Drehung', 'Rotation lente', 'Långsam rotation')],
        ['pulse', L('Pulse', 'نبض', 'Nabız', 'Pulsieren', 'Pulsation', 'Puls')],
        ['none', L('Still', 'ثابتة', 'Sabit', 'Still', 'Fixe', 'Stilla')],
      ]),
      cxBool('scroll_parallax', L('Move with scrolling', 'التحرّك مع التمرير', 'Kaydırmayla birlikte hareket et', 'Beim Scrollen mitbewegen', 'Bouger avec le défilement', 'Rör sig med rullningen'), true),
      cxBool('glow', L('Glow', 'التوهّج', 'Parıltı', 'Leuchten', 'Lueur', 'Sken'), true),
      cL('glow_color', L('Glow colour', 'لون التوهّج', 'Parıltı rengi', 'Farbe des Leuchtens', 'Couleur de la lueur', 'Skenets färg'), { description: CX_EMPTY_ACCENT }),
      cxSelect('mobile_order', L('Order on phones', 'الترتيب على الهاتف', 'Telefonda sıra', 'Reihenfolge auf dem Handy', 'Ordre sur mobile', 'Ordning på mobilen'), 'image-first', [
        ['image-first', L('Image first', 'الصورة أولاً', 'Önce görsel', 'Bild zuerst', 'Image d’abord', 'Bilden först')],
        ['text-first', L('Text first', 'النص أولاً', 'Önce metin', 'Text zuerst', 'Texte d’abord', 'Texten först')],
      ]),
      ...cxHeadingTrio(),
      ...cxEmphasisFields('italic'),
      ...cxSceneFields('light'),
      ...CX_CTA_FIELDS,
    ],
    defaultSettings: {
      foreground_mode: 'ridge',
      foreground_height: 'md',
      plate: 'none',
      image_focus: 'center',
      sun_size: 'md',
      sun_position: 'center',
      rays_motion: 'rotate',
      scroll_parallax: true,
      glow: true,
      mobile_order: 'image-first',
      heading_emphasis: 'italic',
      scene: 'light',
      cta_tone: 'primary',
    },
    defaultContent: { heading: 'Your headline here', cta_text: 'Shop now' },
  },
  {
    id: 'stage-scenes',
    label: L('Travelling object scenes', 'مشاهد العنصر المتنقّل', 'Gezen nesne sahneleri', 'Szenen mit wanderndem Objekt', 'Scènes à objet voyageur', 'Scener med vandrande objekt'),
    icon: 'layout',
    category: 'showcase',
    description: L(
      'One cut-out stays on stage and travels, tilts and changes side while the page scrolls through colour scenes. Needs at least two scenes. Root sections only.',
      'عنصر مقصوص واحد يبقى على المسرح ويتنقّل ويميل ويبدّل جانبه أثناء تمرير الصفحة عبر مشاهد ملوّنة. يحتاج مشهدين على الأقل. للأقسام الجذرية فقط.',
      'Sayfa renk sahneleri boyunca kaydırılırken tek bir dekupe görsel sahnede kalır; yer değiştirir, eğilir ve taraf değiştirir. En az iki sahne gerekir. Yalnızca kök bölümler için.',
      'Ein freigestelltes Motiv bleibt auf der Bühne, wandert, neigt sich und wechselt die Seite, während die Seite durch Farbszenen scrollt. Mindestens zwei Szenen nötig. Nur als Abschnitt der obersten Ebene.',
      'Un visuel détouré reste en scène : il voyage, s’incline et change de côté pendant que la page défile à travers des scènes de couleur. Deux scènes au minimum. Sections de premier niveau uniquement.',
      'Ett frilagt motiv stannar på scenen och vandrar, lutar och byter sida medan sidan rullar genom färgscener. Kräver minst två scener. Endast som avsnitt på översta nivån.',
    ),
    pageTypes: [...CX_PAGE],
    translatable: ['artwork_alt', 'scenes'],
    schema: [
      cxImage('artwork', L('Artwork', 'العمل الفني', 'Görsel öğe', 'Motiv', 'Visuel', 'Motiv'), {
        description: L(
          'A cut-out product, model or brand symbol on a transparent background.',
          'منتج أو عارض أو رمز العلامة مقصوص بخلفية شفافة.',
          'Şeffaf arka planlı dekupe bir ürün, model veya marka simgesi.',
          'Ein freigestelltes Produkt, Model oder Markensymbol auf transparentem Hintergrund.',
          'Un produit, un modèle ou un symbole de marque détouré sur fond transparent.',
          'En frilagd produkt, modell eller varumärkessymbol på genomskinlig bakgrund.',
        ),
      }),
      cxText('artwork_alt', L('Artwork description (alt text)', 'وصف العمل الفني (النص البديل)', 'Görsel öğe açıklaması (alt metni)', 'Beschreibung des Motivs (Alt-Text)', 'Description du visuel (texte alternatif)', 'Beskrivning av motivet (alt-text)'), 160, {
        description: ALT_DESCRIPTION,
      }),
      cxImage('artwork_2', L('Second view (optional)', 'زاوية ثانية (اختياري)', 'İkinci görünüm (isteğe bağlı)', 'Zweite Ansicht (optional)', 'Seconde vue (facultatif)', 'Andra vyn (valfritt)'), {
        description: L(
          'Same proportions as the first artwork.',
          'بنفس أبعاد العمل الفني الأول.',
          'İlk görsel öğeyle aynı oranlarda.',
          'Gleiche Proportionen wie das erste Motiv.',
          'Mêmes proportions que le premier visuel.',
          'Samma proportioner som det första motivet.',
        ),
      }),
      cxSelect('artwork_size', CX_ARTWORK_SIZE, 'md', CX_SIZE_SM_MD),
      cxSelect('artwork_aspect', L('Artwork proportions', 'أبعاد العمل الفني', 'Görsel öğe oranları', 'Proportionen des Motivs', 'Proportions du visuel', 'Motivets proportioner'), 'portrait', [
        ['portrait', L('Portrait (3:4)', 'طولي (3:4)', 'Dikey (3:4)', 'Hochformat (3:4)', 'Portrait (3:4)', 'Stående (3:4)')],
        ['square', CX_SQUARE],
      ]),
      cxBool('float', L('Gentle idle drift', 'انجراف هادئ عند السكون', 'Dururken hafif süzülme', 'Sanftes Schweben im Ruhezustand', 'Légère dérive au repos', 'Mjuk drift i vila'), true),
      cxSelect('scene_height', L('Scene height', 'ارتفاع المشهد', 'Sahne yüksekliği', 'Höhe der Szene', 'Hauteur de la scène', 'Scenens höjd'), 'lg', [
        ['md', CX_MEDIUM],
        ['lg', L('Full screen', 'ملء الشاشة', 'Tam ekran', 'Bildschirmfüllend', 'Plein écran', 'Helskärm')],
      ]),
      cxImage('marker_image', L('Bullet marker', 'علامة التعداد', 'Madde işareti', 'Aufzählungszeichen', 'Puce', 'Punktmarkör'), {
        description: L(
          'A small brand symbol; empty = an accent dot.',
          'رمز صغير للعلامة؛ فارغ = نقطة بلون التمييز.',
          'Küçük bir marka simgesi; boş = vurgu renginde bir nokta.',
          'Ein kleines Markensymbol; leer = ein Punkt in Akzentfarbe.',
          'Un petit symbole de marque ; vide = un point de couleur d’accent.',
          'En liten varumärkessymbol; tomt = en prick i accentfärg.',
        ),
      }),
      ...cxEmphasisFields('italic'),
      cxRepeater(
        'scenes',
        L('Scenes', 'المشاهد', 'Sahneler', 'Szenen', 'Scènes', 'Scener'),
        5,
        [
          cxSelect('scene', CX_SCENE_LABEL, 'dark', CX_SCENE_OPTIONS),
          cL('scene_bg', CX_SCENE_BG_LABEL, { description: CX_EMPTY_SCENE }),
          cxSelect('side', L('Artwork side', 'جانب العمل الفني', 'Görsel öğenin tarafı', 'Seite des Motivs', 'Côté du visuel', 'Motivets sida'), 'auto', [
            ['auto', L('Alternate', 'بالتناوب', 'Dönüşümlü', 'Abwechselnd', 'En alternance', 'Växlande')],
            ['start', START_LABEL],
            ['end', END_LABEL],
          ]),
          cxSelect('tilt', L('Tilt', 'الميلان', 'Eğim', 'Neigung', 'Inclinaison', 'Lutning'), 'soft', [
            ['none', CX_NONE],
            ['soft', L('Soft', 'خفيف', 'Hafif', 'Leicht', 'Légère', 'Lätt')],
            ['strong', L('Strong', 'قوي', 'Belirgin', 'Stark', 'Marquée', 'Kraftig')],
          ]),
          cxSelect('scale', L('Artwork scale', 'مقياس العمل الفني', 'Görsel öğe ölçeği', 'Maßstab des Motivs', 'Échelle du visuel', 'Motivets skala'), 'md', CX_SIZE_SM_MD),
          cxSelect('view', L('View', 'الزاوية', 'Görünüm', 'Ansicht', 'Vue', 'Vy'), '1', [
            ['1', L('First', 'الأولى', 'Birinci', 'Erste', 'Première', 'Första')],
            ['2', L('Second', 'الثانية', 'İkinci', 'Zweite', 'Seconde', 'Andra')],
          ]),
          cxSelect('shape', L('Shape behind the artwork', 'شكل خلف العمل الفني', 'Görsel öğenin arkasındaki şekil', 'Form hinter dem Motiv', 'Forme derrière le visuel', 'Form bakom motivet'), 'none', [
            ...CX_SHAPE_BASE,
            ['blob', L('Blob', 'شكل حرّ', 'Serbest şekil', 'Freie Form', 'Forme libre', 'Fri form')],
          ]),
          cL('shape_color', CX_SHAPE_COLOUR, {
            description: L(
              'Empty = the scene’s surface colour.',
              'فارغ = لون سطح المشهد.',
              'Boş = sahnenin yüzey rengi.',
              'Leer = die Flächenfarbe der Szene.',
              'Vide = la couleur de surface de la scène.',
              'Tomt = scenens ytfärg.',
            ),
          }),
          cxSelect('pattern', L('Pattern', 'النقش', 'Desen', 'Muster', 'Motif', 'Mönster'), 'none', [
            ['none', CX_NONE],
            ['dots', L('Dots', 'نقاط', 'Noktalar', 'Punkte', 'Points', 'Prickar')],
            ['particles', L('Particles', 'جزيئات', 'Parçacıklar', 'Partikel', 'Particules', 'Partiklar')],
          ]),
          cxText('eyebrow', CX_EYEBROW, 60),
          cxArea('heading', HEADING_LABEL, 120, { description: HEADING_MULTILINE_HINT }),
          cxText('lead', L('Lead line', 'السطر الافتتاحي', 'Giriş satırı', 'Einleitungszeile', 'Ligne d’accroche', 'Ingressrad'), 160),
          cxArea('text', CX_TEXT, 400),
          cxText('chips', L('Chips (comma separated)', 'الوسوم (مفصولة بفواصل)', 'Etiketler (virgülle ayrılmış)', 'Chips (durch Kommas getrennt)', 'Pastilles (séparées par des virgules)', 'Etiketter (kommaseparerade)'), 80),
          cxArea('bullets', L('Bullets (one per line)', 'النقاط (واحدة في كل سطر)', 'Maddeler (her satıra bir tane)', 'Aufzählungspunkte (einer pro Zeile)', 'Puces (une par ligne)', 'Punkter (en per rad)'), 300),
          cxText('cta_text', CX_BUTTON_TEXT, 40),
          cxUrl('cta_url', CX_BUTTON_URL),
          cxText('cta_secondary_text', CX_BUTTON_2_TEXT, 40),
          cxUrl('cta_secondary_url', CX_BUTTON_2_URL),
        ],
        {
          description: L(
            'Two to five scenes.',
            'من مشهدين إلى خمسة مشاهد.',
            'İki ila beş sahne.',
            'Zwei bis fünf Szenen.',
            'De deux à cinq scènes.',
            'Två till fem scener.',
          ),
        },
      ),
    ],
    defaultSettings: {
      artwork_size: 'md',
      artwork_aspect: 'portrait',
      float: true,
      scene_height: 'lg',
      heading_emphasis: 'italic',
    },
    defaultContent: { scenes: [] },
  },
];

export const HERO_SECTION_SCHEMAS = HERO_SCHEMAS;
