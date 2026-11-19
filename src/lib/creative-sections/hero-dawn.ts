// Builder schema of "hero-dawn": a night sky turning into dawn, a sun that
// rises behind a ridge, an arch photograph, an optional photo card and the
// copy. Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/hero-dawn.schema.ts (same
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

const ALT_HINT = L(
  'Leave empty when the image is decorative.',
  'اتركه فارغاً إذا كانت الصورة للزينة فقط.',
  'Görsel yalnızca süs amaçlıysa boş bırakın.',
  'Leer lassen, wenn das Bild nur dekorativ ist.',
  'Laissez vide si l’image est purement décorative.',
  'Lämna tomt om bilden bara är dekorativ.',
);
const EMPTY_DAWN = L(
  'Empty = the built-in dawn palette.',
  'فارغ = ألوان الفجر المدمجة.',
  'Boş = yerleşik şafak paleti.',
  'Leer = die eingebaute Morgenrot-Palette.',
  'Vide = la palette d’aube intégrée.',
  'Tomt = den inbyggda gryningspaletten.',
);

const FIELDS: FieldDefinition[] = [
  {
    key: 'arch_image',
    type: 'image',
    label: L('Arch photo', 'صورة القوس', 'Kemer fotoğrafı', 'Bogenfoto', 'Photo en arche', 'Valvfoto'),
    description: L(
      'The large photo in the arch in front of the sun. Portrait, at least 900 px wide.',
      'الصورة الكبيرة داخل القوس أمام الشمس. طولية، بعرض 900 بكسل على الأقل.',
      'Güneşin önündeki kemerin içindeki büyük fotoğraf. Dikey, en az 900 px genişliğinde.',
      'Das große Foto im Bogen vor der Sonne. Hochformat, mindestens 900 px breit.',
      'La grande photo dans l’arche devant le soleil. Portrait, au moins 900 px de large.',
      'Det stora fotot i valvet framför solen. Stående, minst 900 px brett.',
    ),
  },
  {
    key: 'arch_alt',
    type: 'text',
    label: L(
      'Arch photo description (alt text)',
      'وصف صورة القوس (النص البديل)',
      'Kemer fotoğrafı açıklaması (alternatif metin)',
      'Beschreibung des Bogenfotos (Alt-Text)',
      'Description de la photo en arche (texte alternatif)',
      'Beskrivning av valvfotot (alt-text)',
    ),
    maxLength: 160,
    description: ALT_HINT,
  },
  {
    key: 'card',
    type: 'boolean',
    label: L('Small photo card', 'بطاقة الصورة الصغيرة', 'Küçük fotoğraf kartı', 'Kleine Fotokarte', 'Petite carte photo', 'Litet fotokort'),
    defaultValue: true,
  },
  {
    key: 'card_image',
    type: 'image',
    label: L('Card photo', 'صورة البطاقة', 'Kart fotoğrafı', 'Kartenfoto', 'Photo de la carte', 'Kortets foto'),
    description: L(
      'Portrait (4:5). It is toned into the night colours.',
      'طولية (4:5). تُلوَّن بألوان الليل.',
      'Dikey (4:5). Gece renklerine göre tonlanır.',
      'Hochformat (4:5). Es wird in die Nachtfarben getönt.',
      'Portrait (4:5). Elle prend les teintes de la nuit.',
      'Stående (4:5). Det tonas i nattens färger.',
    ),
  },
  {
    key: 'card_alt',
    type: 'text',
    label: L(
      'Card photo description (alt text)',
      'وصف صورة البطاقة (النص البديل)',
      'Kart fotoğrafı açıklaması (alternatif metin)',
      'Beschreibung des Kartenfotos (Alt-Text)',
      'Description de la photo de la carte (texte alternatif)',
      'Beskrivning av kortets foto (alt-text)',
    ),
    maxLength: 160,
    description: ALT_HINT,
  },
  {
    key: 'emblem',
    type: 'image',
    label: L('Sun emblem', 'شعار الشمس', 'Güneş amblemi', 'Sonnenemblem', 'Emblème du soleil', 'Solemblem'),
    description: L(
      'Your sun or logo with its rays as one file (SVG or PNG on a transparent, square artboard, the sun centred). It rises and opens as one piece. Empty = the built-in sun. For the full motion upload the layers below instead.',
      'شمسك أو شعارك مع أشعته في ملف واحد (SVG أو PNG بخلفية شفافة ولوحة مربعة، والشمس في المنتصف). يصعد ويتفتّح كقطعة واحدة. فارغ = الشمس المدمجة. للحركة الكاملة ارفع الطبقات أدناه بدلاً منه.',
      'Işınlarıyla birlikte güneşiniz veya logonuz tek dosya olarak (şeffaf, kare çalışma alanında SVG veya PNG, güneş ortada). Tek parça olarak yükselir ve açılır. Boş = yerleşik güneş. Tam hareket için bunun yerine aşağıdaki katmanları yükleyin.',
      'Ihre Sonne oder Ihr Logo mit Strahlen als eine Datei (SVG oder PNG auf transparenter, quadratischer Zeichenfläche, Sonne mittig). Es steigt und öffnet sich als ein Stück. Leer = die eingebaute Sonne. Für die volle Bewegung laden Sie stattdessen die Ebenen unten hoch.',
      'Votre soleil ou logo avec ses rayons en un seul fichier (SVG ou PNG sur un plan de travail carré et transparent, soleil centré). Il se lève et s’ouvre d’un seul tenant. Vide = le soleil intégré. Pour le mouvement complet, importez plutôt les calques ci-dessous.',
      'Din sol eller logotyp med strålar som en fil (SVG eller PNG på en transparent, kvadratisk rityta, solen centrerad). Den stiger och öppnar sig i ett stycke. Tomt = den inbyggda solen. För full rörelse laddar du upp lagren nedan i stället.',
    ),
  },
  {
    key: 'emblem_rays',
    type: 'image',
    label: L(
      'Sun layer: rays (optional)',
      'طبقة الشمس: الأشعة (اختياري)',
      'Güneş katmanı: ışınlar (isteğe bağlı)',
      'Sonnenebene: Strahlen (optional)',
      'Calque du soleil : rayons (facultatif)',
      'Sollager: strålar (valfritt)',
    ),
    description: L(
      'Only the rays. They open, turn slowly and fade towards their tips; the inner 56 % of the radius stays clear for the disc. Same square artboard as the other sun layers, the sun centred. Any layer replaces the single emblem above.',
      'الأشعة فقط. تتفتّح وتدور ببطء وتخفت نحو أطرافها، ويبقى 56٪ من نصف القطر الداخلي فارغاً للقرص. نفس لوحة الرسم المربعة لطبقات الشمس الأخرى، والشمس في المنتصف. أي طبقة تحلّ محلّ الشعار الواحد أعلاه.',
      'Yalnızca ışınlar. Açılır, yavaşça döner ve uçlarına doğru solar; yarıçapın içteki %56’sı disk için boş kalır. Diğer güneş katmanlarıyla aynı kare çalışma alanı, güneş ortada. Herhangi bir katman yukarıdaki tek amblemin yerini alır.',
      'Nur die Strahlen. Sie öffnen sich, drehen sich langsam und laufen zu den Spitzen hin aus; die inneren 56 % des Radius bleiben für die Scheibe frei. Gleiche quadratische Zeichenfläche wie die anderen Sonnenebenen, Sonne mittig. Jede Ebene ersetzt das einzelne Emblem oben.',
      'Seulement les rayons. Ils s’ouvrent, tournent lentement et s’estompent vers leurs pointes ; les 56 % intérieurs du rayon restent libres pour le disque. Même plan de travail carré que les autres calques du soleil, soleil centré. Tout calque remplace l’emblème unique ci-dessus.',
      'Bara strålarna. De öppnar sig, vrids långsamt och tonar ut mot spetsarna; de inre 56 % av radien hålls fria för skivan. Samma kvadratiska rityta som de andra sollagren, solen centrerad. Varje lager ersätter det enskilda emblemet ovan.',
    ),
  },
  {
    key: 'emblem_disc',
    type: 'image',
    label: L(
      'Sun layer: disc (optional)',
      'طبقة الشمس: القرص (اختياري)',
      'Güneş katmanı: disk (isteğe bağlı)',
      'Sonnenebene: Scheibe (optional)',
      'Calque du soleil : disque (facultatif)',
      'Sollager: skiva (valfritt)',
    ),
    description: L(
      'The disc of the sun, its radius 28 % of the artboard width. Empty = a round disc in the gold colour. Same square artboard as the other sun layers, the sun centred.',
      'قرص الشمس، نصف قطره 28٪ من عرض لوحة الرسم. فارغ = قرص دائري باللون الذهبي. نفس لوحة الرسم المربعة لطبقات الشمس الأخرى، والشمس في المنتصف.',
      'Güneş diski; yarıçapı çalışma alanı genişliğinin %28’i. Boş = altın renginde yuvarlak bir disk. Diğer güneş katmanlarıyla aynı kare çalışma alanı, güneş ortada.',
      'Die Sonnenscheibe, ihr Radius 28 % der Breite der Zeichenfläche. Leer = eine runde Scheibe in der Goldfarbe. Gleiche quadratische Zeichenfläche wie die anderen Sonnenebenen, Sonne mittig.',
      'Le disque du soleil, de rayon 28 % de la largeur du plan de travail. Vide = un disque rond de couleur or. Même plan de travail carré que les autres calques du soleil, soleil centré.',
      'Solens skiva, med en radie på 28 % av ritytans bredd. Tomt = en rund skiva i guldfärgen. Samma kvadratiska rityta som de andra sollagren, solen centrerad.',
    ),
  },
  {
    key: 'emblem_front',
    type: 'image',
    label: L(
      'Sun layer: intro detail (optional)',
      'طبقة الشمس: تفصيل البداية (اختياري)',
      'Güneş katmanı: giriş ayrıntısı (isteğe bağlı)',
      'Sonnenebene: Detail des Auftakts (optional)',
      'Calque du soleil : détail d’ouverture (facultatif)',
      'Sollager: detalj i inledningen (valfritt)',
    ),
    description: L(
      'A detail drawn over the disc during the intro only (the mountain of a logo, an initial); it fades out after 1.7 s. Same square artboard as the other sun layers, the sun centred.',
      'تفصيل يُرسم فوق القرص أثناء البداية فقط (جبل الشعار أو حرف أول)، ويختفي بعد 1.7 ثانية. نفس لوحة الرسم المربعة لطبقات الشمس الأخرى، والشمس في المنتصف.',
      'Yalnızca giriş sırasında diskin üzerine çizilen bir ayrıntı (bir logonun dağı, bir baş harf); 1,7 sn sonra kaybolur. Diğer güneş katmanlarıyla aynı kare çalışma alanı, güneş ortada.',
      'Ein Detail, das nur während des Auftakts über der Scheibe liegt (der Berg eines Logos, eine Initiale); es blendet nach 1,7 s aus. Gleiche quadratische Zeichenfläche wie die anderen Sonnenebenen, Sonne mittig.',
      'Un détail dessiné sur le disque pendant l’ouverture seulement (la montagne d’un logo, une initiale) ; il disparaît après 1,7 s. Même plan de travail carré que les autres calques du soleil, soleil centré.',
      'En detalj som ritas över skivan bara under inledningen (berget i en logotyp, en initial); den tonas ut efter 1,7 s. Samma kvadratiska rityta som de andra sollagren, solen centrerad.',
    ),
  },
  {
    key: 'light',
    type: 'boolean',
    label: L('Living dawn light', 'ضوء الفجر الحي', 'Canlı şafak ışığı', 'Lebendiges Morgenlicht', 'Lumière d’aube vivante', 'Levande gryningsljus'),
    description: L(
      'A soft moving light in the sky (WebGL). Off, or on a device without it, the sky keeps its still gradients.',
      'ضوء ناعم متحرك في السماء (WebGL). عند إيقافه أو على جهاز لا يدعمه تبقى السماء بتدرّجاتها الثابتة.',
      'Gökyüzünde yumuşak, hareketli bir ışık (WebGL). Kapalıyken veya desteklemeyen bir cihazda gökyüzü sabit geçişlerini korur.',
      'Ein weiches, bewegtes Licht am Himmel (WebGL). Ausgeschaltet oder auf einem Gerät ohne WebGL behält der Himmel seine ruhigen Verläufe.',
      'Une lumière douce et mouvante dans le ciel (WebGL). Désactivée, ou sur un appareil qui ne la prend pas en charge, le ciel garde ses dégradés fixes.',
      'Ett mjukt, rörligt ljus på himlen (WebGL). Avstängt, eller på en enhet utan stöd, behåller himlen sina stilla toningar.',
    ),
    defaultValue: true,
  },
  {
    key: 'cue',
    type: 'boolean',
    label: L('Scroll cue', 'إشارة التمرير', 'Kaydırma işareti', 'Scroll-Hinweis', 'Indication de défilement', 'Rullningsindikator'),
    defaultValue: true,
  },
  {
    key: 'height',
    type: 'select',
    label: L('Height', 'الارتفاع', 'Yükseklik', 'Höhe', 'Hauteur', 'Höjd'),
    defaultValue: 'screen',
    options: [
      option('screen', L('First screen', 'الشاشة الأولى', 'İlk ekran', 'Erster Bildschirm', 'Premier écran', 'Första skärmen')),
      option('compact', L('Compact', 'مضغوط', 'Kompakt', 'Kompakt', 'Compacte', 'Kompakt')),
    ],
  },
  {
    key: 'sky_color',
    type: 'color',
    label: L('Night sky', 'سماء الليل', 'Gece gökyüzü', 'Nachthimmel', 'Ciel de nuit', 'Natthimmel'),
    description: EMPTY_DAWN,
  },
  {
    key: 'warm_color',
    type: 'color',
    label: L('Warm horizon', 'الأفق الدافئ', 'Sıcak ufuk', 'Warmer Horizont', 'Horizon chaud', 'Varm horisont'),
    description: EMPTY_DAWN,
  },
  {
    key: 'gold_color',
    type: 'color',
    label: L(
      'Gold (sun, second heading line)',
      'الذهبي (الشمس، السطر الثاني من العنوان)',
      'Altın (güneş, başlığın ikinci satırı)',
      'Gold (Sonne, zweite Zeile der Überschrift)',
      'Or (soleil, deuxième ligne du titre)',
      'Guld (solen, rubrikens andra rad)',
    ),
    description: EMPTY_DAWN,
  },
  {
    key: 'accent_color',
    type: 'color',
    label: L(
      'Accent (button, ember)',
      'لون التمييز (الزر، الجمر)',
      'Vurgu (düğme, kor)',
      'Akzent (Button, Glut)',
      'Accent (bouton, braise)',
      'Accent (knapp, glöd)',
    ),
    description: EMPTY_DAWN,
  },
  {
    key: 'cream_color',
    type: 'color',
    label: L(
      'Light colour (text, lower edge)',
      'اللون الفاتح (النص، الحافة السفلية)',
      'Açık renk (metin, alt kenar)',
      'Helle Farbe (Text, unterer Rand)',
      'Couleur claire (texte, bord inférieur)',
      'Ljus färg (text, nedre kant)',
    ),
    description: L(
      'The text and the curved lower edge. Give it the background colour of the next section. Empty = the built-in cream.',
      'النص والحافة السفلية المنحنية. اجعله بلون خلفية القسم التالي. فارغ = لون الكريم المدمج.',
      'Metin ve kavisli alt kenar. Bir sonraki bölümün arka plan rengini verin. Boş = yerleşik krem rengi.',
      'Der Text und der geschwungene untere Rand. Geben Sie ihm die Hintergrundfarbe des nächsten Abschnitts. Leer = das eingebaute Creme.',
      'Le texte et le bord inférieur courbe. Donnez-lui la couleur de fond de la section suivante. Vide = le crème intégré.',
      'Texten och den böjda nedre kanten. Ge den nästa sektions bakgrundsfärg. Tomt = den inbyggda krämfärgen.',
    ),
  },
  {
    key: 'eyebrow',
    type: 'text',
    label: L('Eyebrow', 'السطر التمهيدي', 'Üst başlık', 'Dachzeile', 'Surtitre', 'Överrubrik'),
    maxLength: 60,
  },
  {
    key: 'heading_1',
    type: 'text',
    label: L(
      'Heading, first line',
      'العنوان، السطر الأول',
      'Başlık, ilk satır',
      'Überschrift, erste Zeile',
      'Titre, première ligne',
      'Rubrik, första raden',
    ),
    maxLength: 80,
  },
  {
    key: 'heading_2',
    type: 'text',
    label: L(
      'Heading, second line (gold)',
      'العنوان، السطر الثاني (ذهبي)',
      'Başlık, ikinci satır (altın)',
      'Überschrift, zweite Zeile (Gold)',
      'Titre, deuxième ligne (or)',
      'Rubrik, andra raden (guld)',
    ),
    maxLength: 80,
  },
  {
    key: 'text',
    type: 'textarea',
    label: L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text'),
    maxLength: 280,
  },
  {
    key: 'cta_text',
    type: 'text',
    label: L('Button text', 'نص الزر', 'Düğme metni', 'Button-Text', 'Texte du bouton', 'Knapptext'),
    maxLength: 40,
  },
  {
    key: 'cta_url',
    type: 'url',
    label: L('Button URL', 'رابط الزر', 'Düğme bağlantısı', 'Button-Link', 'Lien du bouton', 'Knappens länk'),
  },
  {
    key: 'cta_secondary_text',
    type: 'text',
    label: L('Link text', 'نص الرابط', 'Bağlantı metni', 'Linktext', 'Texte du lien', 'Länktext'),
    maxLength: 40,
  },
  {
    key: 'cta_secondary_url',
    type: 'url',
    label: L('Link URL', 'رابط النص', 'Bağlantı adresi', 'Link-URL', 'URL du lien', 'Länkens adress'),
  },
  {
    key: 'cue_text',
    type: 'text',
    label: L(
      'Scroll cue text',
      'نص إشارة التمرير',
      'Kaydırma işareti metni',
      'Text des Scroll-Hinweises',
      'Texte de l’indication de défilement',
      'Text för rullningsindikatorn',
    ),
    maxLength: 24,
  },
];

export const schema: SectionSchema = {
  id: 'hero-dawn',
  label: L('Dawn hero', 'واجهة الفجر', 'Şafak hero', 'Morgenrot-Hero', 'Hero aube', 'Gryningshero'),
  icon: 'sparkles',
  category: 'showcase',
  description: L(
    'A night sky turning into dawn: your sun rises behind a ridge, an arch photo rises in front of it, the copy follows line by line. Best as the first section.',
    'سماء ليل تتحوّل إلى فجر: تصعد شمسك خلف التلال وترتفع صورة القوس أمامها ثم يتبعها النص سطراً بعد سطر. الأفضل أن يكون القسم الأول.',
    'Şafağa dönen bir gece gökyüzü: güneşiniz bir sırtın ardından yükselir, önünde bir kemer fotoğrafı yükselir, metin satır satır gelir. En iyisi ilk bölüm olarak.',
    'Ein Nachthimmel, der zum Morgenrot wird: Ihre Sonne geht hinter einem Höhenzug auf, ein Bogenfoto steigt davor auf, der Text folgt Zeile für Zeile. Am besten als erster Abschnitt.',
    'Un ciel de nuit qui devient aube : votre soleil se lève derrière une crête, une photo en arche monte devant lui, le texte suit ligne par ligne. Idéal en première section.',
    'En natthimmel som blir gryning: din sol stiger bakom en ås, ett valvfoto stiger framför den, texten följer rad för rad. Bäst som första sektion.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING'],
  translatable: ['arch_alt', 'card_alt', 'eyebrow', 'heading_1', 'heading_2', 'text', 'cta_text', 'cta_secondary_text', 'cue_text'],
  schema: FIELDS,
  defaultSettings: { card: true, light: true, cue: true, height: 'screen' },
  defaultContent: {
    eyebrow: 'A new day',
    heading_1: 'Your headline here.',
    heading_2: 'A second line in gold.',
    text: 'One or two sentences about what your store stands for.',
    cta_text: 'Shop now',
    cta_secondary_text: 'Our story',
    cue_text: 'Scroll',
  },
};

export default schema;
