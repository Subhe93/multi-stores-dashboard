// Builder schema of "impact-arc": a goal drawn as an arc over a horizon (the
// filled part is the reached figure) with up to three steps under it.
// Field-by-field mirror of
// multi-stores-web/src/themes/creative/schemas/impact-arc.schema.ts (same
// keys, order, types, options, defaults, translatable, pageTypes and
// maxItems), with every text in the six dashboard locales.
//
// Type-only import: section-schemas.ts imports this file.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../section-schemas';

/** Six-locale text, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});

type Extra = Partial<Pick<FieldDefinition, 'description' | 'min' | 'max' | 'defaultValue'>>;

const text = (key: string, label: LocalizedString, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key, type: 'text', label, maxLength, ...extra,
});
const area = (key: string, label: LocalizedString, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key, type: 'textarea', label, maxLength, ...extra,
});
const simple = (
  type: 'image' | 'url' | 'color' | 'number', key: string, label: LocalizedString, extra: Extra = {},
): FieldDefinition => ({ key, type, label, ...extra });

const EMPTY_BACKGROUND = L(
  'Empty = the theme background colour.',
  'فارغ = لون الخلفية في القالب.',
  'Boş = temanın arka plan rengi.',
  'Leer = die Hintergrundfarbe des Themes.',
  'Vide = la couleur de fond du thème.',
  'Tomt = temats bakgrundsfärg.',
);
const EMPTY_TEXT = L(
  'Empty = the theme text colour.',
  'فارغ = لون النص في القالب.',
  'Boş = temanın metin rengi.',
  'Leer = die Textfarbe des Themes.',
  'Vide = la couleur de texte du thème.',
  'Tomt = temats textfärg.',
);
const EMPTY_ACCENT = L(
  'Empty = the theme accent colour.',
  'فارغ = لون التمييز في القالب.',
  'Boş = temanın vurgu rengi.',
  'Leer = die Akzentfarbe des Themes.',
  'Vide = la couleur d’accent du thème.',
  'Tomt = temats accentfärg.',
);

const STEP_FIELDS: FieldDefinition[] = [
  text('title', L('Title', 'العنوان', 'Başlık', 'Titel', 'Titre', 'Titel'), 50),
  area('text', L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text'), 120),
];

export const schema: SectionSchema = {
  id: 'impact-arc',
  label: L('Impact arc', 'قوس الأثر', 'Etki yayı', 'Wirkungsbogen', 'Arc d’impact', 'Effektbåge'),
  icon: 'sunrise',
  category: 'content',
  description: L(
    'A goal drawn as an arc over a horizon: the filled part is the figure you reached, with up to three steps under it.',
    'هدف مرسوم كقوس فوق أفق: الجزء المملوء هو الرقم الذي تحقّق، وتحته حتى ثلاث خطوات.',
    'Ufkun üzerinde bir yay olarak çizilen hedef: dolu kısım ulaştığınız rakamdır, altında en fazla üç adım yer alır.',
    'Ein Ziel als Bogen über einem Horizont: Der gefüllte Teil ist der erreichte Wert, darunter bis zu drei Schritte.',
    'Un objectif dessiné comme un arc au-dessus d’un horizon : la partie remplie est le chiffre atteint, avec jusqu’à trois étapes en dessous.',
    'Ett mål ritat som en båge över en horisont: den fyllda delen är det du har uppnått, med upp till tre steg under.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING'],
  translatable: [
    'eyebrow',
    'heading',
    'body',
    'status_label',
    'unit_label',
    'item_title',
    'item_meta',
    'note',
    'cta_text',
    'steps',
  ],
  schema: [
    // Content
    text('eyebrow', L('Eyebrow', 'العنوان التمهيدي', 'Üst başlık', 'Dachzeile', 'Surtitre', 'Överrubrik'), 60),
    area('heading', L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik'), 100),
    area('body', L('Text', 'النص', 'Metin', 'Text', 'Texte', 'Text'), 320),
    text('status_label', L('Status label', 'تسمية الحالة', 'Durum etiketi', 'Statusbezeichnung', 'Libellé du statut', 'Statusetikett'), 30, {
      description: L(
        'The word shown in the small pill, e.g. Planned.',
        'الكلمة الظاهرة في الشارة الصغيرة، مثل: مخطَّط.',
        'Küçük rozette görünen kelime, örn. Planlandı.',
        'Das Wort in der kleinen Plakette, z. B. Geplant.',
        'Le mot affiché dans la petite pastille, p. ex. Prévu.',
        'Ordet som visas i den lilla etiketten, t.ex. Planerat.',
      ),
    }),
    text('unit_label', L('Unit', 'الوحدة', 'Birim', 'Einheit', 'Unité', 'Enhet'), 60, {
      description: L(
        'What the number counts.',
        'ما الذي يعدّه الرقم.',
        'Sayının neyi saydığı.',
        'Was die Zahl zählt.',
        'Ce que le nombre compte.',
        'Vad siffran räknar.',
      ),
    }),
    text('item_title', L('Name', 'الاسم', 'Ad', 'Name', 'Nom', 'Namn'), 100),
    text('item_meta', L('Detail', 'تفصيل', 'Ayrıntı', 'Detail', 'Détail', 'Detalj'), 60, {
      description: L(
        'A place or a date.',
        'مكان أو تاريخ.',
        'Bir yer veya tarih.',
        'Ein Ort oder ein Datum.',
        'Un lieu ou une date.',
        'En plats eller ett datum.',
      ),
    }),
    area('note', L('Note', 'ملاحظة', 'Not', 'Hinweis', 'Note', 'Notering'), 200),
    text('cta_text', L('Button text', 'نص الزر', 'Düğme metni', 'Button-Text', 'Texte du bouton', 'Knapptext'), 40),
    {
      key: 'steps',
      type: 'repeater',
      label: L('Steps', 'الخطوات', 'Adımlar', 'Schritte', 'Étapes', 'Steg'),
      maxItems: 3,
      fields: STEP_FIELDS,
    },
    // Settings
    simple('number', 'goal', L('Goal', 'الهدف', 'Hedef', 'Ziel', 'Objectif', 'Mål'), {
      min: 1,
      description: L(
        'Needed for the arc. Without it only the steps are shown.',
        'مطلوب لرسم القوس. بدونه تظهر الخطوات فقط.',
        'Yay için gereklidir. Olmadan yalnızca adımlar gösterilir.',
        'Für den Bogen erforderlich. Ohne Ziel werden nur die Schritte gezeigt.',
        'Nécessaire pour l’arc. Sans lui, seules les étapes sont affichées.',
        'Krävs för bågen. Utan det visas bara stegen.',
      ),
    }),
    simple('number', 'reached', L('Reached', 'ما تحقّق', 'Ulaşılan', 'Erreicht', 'Atteint', 'Uppnått'), {
      min: 0,
      description: L(
        'Enter verified figures only. Empty = the planned state (a dashed arc, no progress).',
        'أدخل الأرقام الموثَّقة فقط. فارغ = حالة التخطيط (قوس متقطّع بلا تقدّم).',
        'Yalnızca doğrulanmış rakamları girin. Boş = planlama durumu (kesikli yay, ilerleme yok).',
        'Nur geprüfte Zahlen eintragen. Leer = geplanter Zustand (gestrichelter Bogen, kein Fortschritt).',
        'Saisissez uniquement des chiffres vérifiés. Vide = état prévu (arc en pointillés, sans progression).',
        'Ange endast verifierade siffror. Tomt = planerat läge (streckad båge, inga framsteg).',
      ),
    }),
    {
      key: 'status',
      type: 'select',
      label: L('Status', 'الحالة', 'Durum', 'Status', 'Statut', 'Status'),
      defaultValue: 'planned',
      options: [
        { value: 'planned', label: L('Planned', 'مخطَّط', 'Planlandı', 'Geplant', 'Prévu', 'Planerat') },
        { value: 'active', label: L('In progress', 'قيد التنفيذ', 'Devam ediyor', 'In Arbeit', 'En cours', 'Pågår') },
        { value: 'completed', label: L('Completed', 'مكتمل', 'Tamamlandı', 'Abgeschlossen', 'Terminé', 'Slutfört') },
      ],
    },
    simple('image', 'horizon_image', L('Horizon artwork', 'رسمة الأفق', 'Ufuk çizimi', 'Horizont-Grafik', 'Illustration de l’horizon', 'Horisontbild'), {
      description: L(
        'A wide line or silhouette (SVG or PNG) that sits on the horizon. Never mirrored.',
        'خط أو ظلّ عريض (SVG أو PNG) يستقر على الأفق. لا يُعكس أبداً.',
        'Ufka oturan geniş bir çizgi veya siluet (SVG veya PNG). Asla aynalanmaz.',
        'Eine breite Linie oder Silhouette (SVG oder PNG) auf dem Horizont. Wird nie gespiegelt.',
        'Une ligne ou une silhouette large (SVG ou PNG) posée sur l’horizon. Jamais inversée.',
        'En bred linje eller siluett (SVG eller PNG) som vilar på horisonten. Speglas aldrig.',
      ),
    }),
    simple('image', 'marker_image', L('Marker', 'العلامة', 'İşaret', 'Markierung', 'Repère', 'Markör'), {
      description: L(
        'A small mark on the arc at the reached point. Empty = a plain disc.',
        'علامة صغيرة على القوس عند نقطة التقدّم. فارغ = قرص بسيط.',
        'Yay üzerinde ulaşılan noktadaki küçük işaret. Boş = sade bir disk.',
        'Eine kleine Marke auf dem Bogen am erreichten Punkt. Leer = eine schlichte Scheibe.',
        'Un petit repère sur l’arc au point atteint. Vide = un simple disque.',
        'En liten markör på bågen vid den uppnådda punkten. Tomt = en enkel skiva.',
      ),
    }),
    simple('url', 'cta_url', L('Button link', 'رابط الزر', 'Düğme bağlantısı', 'Button-Link', 'Lien du bouton', 'Knapplänk')),
    simple('color', 'bg_color', L('Background colour', 'لون الخلفية', 'Arka plan rengi', 'Hintergrundfarbe', 'Couleur de fond', 'Bakgrundsfärg'), {
      description: EMPTY_BACKGROUND,
    }),
    simple('color', 'text_color', L('Text colour', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'), {
      description: EMPTY_TEXT,
    }),
    simple('color', 'arc_color', L('Arc colour', 'لون القوس', 'Yay rengi', 'Bogenfarbe', 'Couleur de l’arc', 'Bågens färg'), {
      description: EMPTY_ACCENT,
    }),
  ],
  defaultSettings: { status: 'planned' },
  defaultContent: {},
};
