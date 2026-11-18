import { schema as coverHeroSchema } from './creative-sections/cover-hero.ts';
import { schema as impactArcSchema } from './creative-sections/impact-arc.ts';
import { schema as lookSpreadSchema } from './creative-sections/look-spread.ts';
import { schema as objectStudySchema } from './creative-sections/object-study.ts';
import { schema as patternBandSchema } from './creative-sections/pattern-band.ts';
import { schema as scriptManifestoSchema } from './creative-sections/script-manifesto.ts';
// Section schemas mirror the storefront's theme registry. Kept in sync
// manually — these are content contracts (field keys + types + labels) that
// drive the Inspector forms. The runtime React components stay in
// multi-stores-web/src/themes/<theme>/sections/.

export type LocalizedString = Record<string, string>;

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'color'
  | 'image'
  | 'url'
  | 'select'
  | 'menuPicker'
  | 'productPicker'
  | 'collectionPicker'
  | 'repeater'
  // Image width / height / fit per breakpoint (`image_size` object).
  // Spec: plans/image-sizing/SPEC.md.
  | 'imageSize';

export interface FieldDefinition {
  key: string;
  type: FieldType;
  label: LocalizedString;
  description?: LocalizedString;
  required?: boolean;
  defaultValue?: unknown;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: { value: string; label: LocalizedString }[];
  fields?: FieldDefinition[];
  // Repeaters only: the most items the inspector lets the creator add (the
  // storefront renders no more than this). Omitted = unlimited.
  maxItems?: number;
  // Conditional visibility — show this field only when a sibling field's
  // value is one of `in`. Used inside repeaters (e.g. a content block shows
  // only the fields relevant to its selected `type`). The section inspector
  // also applies it to top-level fields, read against the section settings.
  showIf?: { key: string; in: string[] };
  // Page types where the inspector offers this field (the dynamic source
  // fields: PRODUCT_TEMPLATE only). Omitted = every page type.
  pageTypes?: SectionSchema['pageTypes'];
}

export interface SectionSchema {
  id: string;
  label: LocalizedString;
  icon?: string;
  // 'product': the separate product blocks of a PRODUCT_TEMPLATE.
  category: 'showcase' | 'content' | 'commerce' | 'social' | 'layout' | 'header' | 'footer' | 'product';
  description?: LocalizedString;
  translatable: string[];
  schema: FieldDefinition[];
  defaultSettings?: Record<string, unknown>;
  defaultContent?: Record<string, unknown>;
  // Page types this section is available on. When omitted, the section is
  // available on every page type EXCEPT HEADER/FOOTER (the chrome palettes).
  // Chrome-only sections set pageTypes: ['HEADER'] or ['FOOTER'] to avoid
  // polluting the regular HOME / LANDING / STATIC palettes.
  pageTypes?: Array<
    'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'CATALOG_TEMPLATE' | 'COLLECTION_TEMPLATE' | 'HEADER' | 'FOOTER'
  >;
  // Also allowed in the HEADER and FOOTER builders, on top of the page types
  // above (or of the default when `pageTypes` is omitted). Mirrors the web
  // SectionSchema; see lib/sectionAvailability.ts for the palette rule.
  chrome?: boolean;
  // Feature gate: the palette hides the section unless the builder enables
  // it (lib/sectionAvailability.ts AvailabilityOptions).
  gate?: 'layout-containers';
}

// Shared select options
// Platforms of the social-icons section and the Columns 'social' block.
const SOCIAL_PLATFORM_OPTIONS = [
  { value: 'instagram', label: { en: 'Instagram', ar: 'إنستغرام' } },
  { value: 'facebook', label: { en: 'Facebook', ar: 'فيسبوك' } },
  { value: 'twitter', label: { en: 'X (Twitter)', ar: 'إكس (تويتر)' } },
  { value: 'tiktok', label: { en: 'TikTok', ar: 'تيك توك' } },
  { value: 'youtube', label: { en: 'YouTube', ar: 'يوتيوب' } },
  { value: 'whatsapp', label: { en: 'WhatsApp', ar: 'واتساب' } },
  { value: 'snapchat', label: { en: 'Snapchat', ar: 'سناب شات' } },
  { value: 'telegram', label: { en: 'Telegram', ar: 'تيليغرام' } },
  { value: 'pinterest', label: { en: 'Pinterest', ar: 'بينترست' } },
  { value: 'linkedin', label: { en: 'LinkedIn', ar: 'لينكدإن' } },
  { value: 'discord', label: { en: 'Discord', ar: 'ديسكورد' } },
  { value: 'reddit', label: { en: 'Reddit', ar: 'ريديت' } },
  { value: 'twitch', label: { en: 'Twitch', ar: 'تويتش' } },
  { value: 'github', label: { en: 'GitHub', ar: 'غيت هاب' } },
  { value: 'threads', label: { en: 'Threads', ar: 'ثريدز' } },
  { value: 'email', label: { en: 'Email', ar: 'بريد إلكتروني' } },
  { value: 'phone', label: { en: 'Phone', ar: 'هاتف' } },
  { value: 'website', label: { en: 'Website', ar: 'موقع إلكتروني' } },
];

const ALIGNMENT_OPTIONS = [
  { value: 'left', label: { en: 'Left', ar: 'يسار' } },
  { value: 'center', label: { en: 'Center', ar: 'وسط' } },
  { value: 'right', label: { en: 'Right', ar: 'يمين' } },
];

const ICON_OPTIONS = [
  { value: 'truck', label: { en: 'Truck (shipping)', ar: 'شاحنة (شحن)', tr: 'Kamyon (kargo)', de: 'Lkw (Versand)', fr: 'Camion (livraison)', sv: 'Lastbil (frakt)' } },
  { value: 'refresh', label: { en: 'Refresh (returns)', ar: 'تحديث (إرجاع)', tr: 'Yenile (iade)', de: 'Pfeile (Rückgabe)', fr: 'Flèches (retours)', sv: 'Pilar (returer)' } },
  { value: 'shield', label: { en: 'Shield (secure)', ar: 'درع (آمن)', tr: 'Kalkan (güvenli)', de: 'Schild (sicher)', fr: 'Bouclier (sécurisé)', sv: 'Sköld (säkert)' } },
  { value: 'card', label: { en: 'Card (payment)', ar: 'بطاقة (دفع)', tr: 'Kart (ödeme)', de: 'Karte (Zahlung)', fr: 'Carte (paiement)', sv: 'Kort (betalning)' } },
  { value: 'award', label: { en: 'Award (quality)', ar: 'جائزة (جودة)', tr: 'Ödül (kalite)', de: 'Auszeichnung (Qualität)', fr: 'Récompense (qualité)', sv: 'Utmärkelse (kvalitet)' } },
  { value: 'star', label: { en: 'Star (rated)', ar: 'نجمة (مقيّم)', tr: 'Yıldız (puanlı)', de: 'Stern (bewertet)', fr: 'Étoile (noté)', sv: 'Stjärna (betyg)' } },
  { value: 'headphones', label: { en: 'Headphones (support)', ar: 'سماعات (دعم)', tr: 'Kulaklık (destek)', de: 'Kopfhörer (Support)', fr: 'Casque (assistance)', sv: 'Hörlurar (support)' } },
  { value: 'leaf', label: { en: 'Leaf (eco)', ar: 'ورقة (بيئي)', tr: 'Yaprak (çevreci)', de: 'Blatt (umweltfreundlich)', fr: 'Feuille (écologique)', sv: 'Löv (miljövänligt)' } },
];

// Icons of the trust badge repeaters (trust-badges, product-page,
// product-trust) and of progress-spotlight. They all render through the
// storefront's shared map (multi-stores-web/src/lib/trustBadgeIcons.ts), which
// knows the six keys added here. ICON_OPTIONS itself stays as it is: the
// feature grid spreads it and cannot render the extra keys.
const TRUST_BADGE_ICON_OPTIONS = [
  ...ICON_OPTIONS,
  { value: 'graduation', label: { en: 'Graduation cap (education)', ar: 'قبعة تخرّج (تعليم)', tr: 'Mezuniyet kepi (eğitim)', de: 'Doktorhut (Bildung)', fr: 'Toque de diplômé (éducation)', sv: 'Studentmössa (utbildning)' } },
  { value: 'gem', label: { en: 'Gem (quality)', ar: 'جوهرة (جودة)', tr: 'Mücevher (kalite)', de: 'Edelstein (Qualität)', fr: 'Gemme (qualité)', sv: 'Ädelsten (kvalitet)' } },
  { value: 'globe', label: { en: 'Globe (worldwide)', ar: 'كرة أرضية (عالمي)', tr: 'Küre (dünya çapında)', de: 'Globus (weltweit)', fr: 'Globe (monde entier)', sv: 'Jordglob (hela världen)' } },
  { value: 'book', label: { en: 'Book (learning)', ar: 'كتاب (تعلّم)', tr: 'Kitap (öğrenme)', de: 'Buch (Lernen)', fr: 'Livre (apprentissage)', sv: 'Bok (lärande)' } },
  { value: 'heart', label: { en: 'Heart (care)', ar: 'قلب (عناية)', tr: 'Kalp (özen)', de: 'Herz (Fürsorge)', fr: 'Cœur (attention)', sv: 'Hjärta (omtanke)' } },
  { value: 'sparkles', label: { en: 'Sparkles (new)', ar: 'بريق (جديد)', tr: 'Parıltı (yeni)', de: 'Funkeln (neu)', fr: 'Étincelles (nouveau)', sv: 'Gnistor (nytt)' } },
];

// Image sizing (single-image section + layout-columns image block). One
// object under `image_size`, edited by the imageSize field. Identical in the
// web registry; spec: plans/image-sizing/SPEC.md.
export const IMAGE_SIZE_FIELD: FieldDefinition = {
  key: 'image_size',
  type: 'imageSize',
  label: { en: 'Image size', ar: 'حجم الصورة', tr: 'Görsel boyutu', de: 'Bildgröße', fr: 'Taille de l’image', sv: 'Bildstorlek' },
};

// ── Shared field builders ──────────────────────────────────────────────
// Per-element color and button-style fields. Spread into a section's
// `schema` array. All overrides are optional — empty means "use theme
// default", which the storefront resolves at render time.

const c = (key: string, en: string, ar: string): FieldDefinition => ({
  key, type: 'color', label: { en, ar },
});

const n = (
  key: string, en: string, ar: string,
  opts: { min?: number; max?: number; defaultValue?: number } = {},
): FieldDefinition => ({
  key, type: 'number', label: { en, ar }, ...opts,
});

/** Text-color overrides. Pick which roles a section actually has. */
function textColorFields(roles: { eyebrow?: boolean; heading?: boolean; subheading?: boolean; body?: boolean }): FieldDefinition[] {
  const out: FieldDefinition[] = [];
  if (roles.eyebrow) out.push(c('eyebrow_color', 'Eyebrow color', 'لون التسمية الصغيرة'));
  if (roles.heading) out.push(c('heading_color', 'Heading color', 'لون العنوان'));
  if (roles.subheading) out.push(c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'));
  if (roles.body) out.push(c('body_color', 'Body color', 'لون النص'));
  return out;
}

/**
 * Full button-style group: bg / text / border (color + width) / radius.
 * `prefix` distinguishes primary vs secondary CTAs (e.g. 'cta', 'cta_secondary').
 * `arLabel` is appended to the Arabic labels — e.g. 'الرئيسي' / 'الثاني'.
 */
function buttonStyleFields(prefix: string, en: { suffix?: string } = {}, ar: { suffix?: string } = {}): FieldDefinition[] {
  const enS = en.suffix ? ` ${en.suffix}` : '';
  const arS = ar.suffix ? ` ${ar.suffix}` : '';
  return [
    c(`${prefix}_bg_color`, `Button background${enS}`, `خلفية الزر${arS}`),
    c(`${prefix}_text_color`, `Button text color${enS}`, `لون نص الزر${arS}`),
    c(`${prefix}_border_color`, `Button border color${enS}`, `لون حدود الزر${arS}`),
    n(`${prefix}_border_width`, `Button border width (px)${enS}`, `سماكة حدود الزر (px)${arS}`, { min: 0, max: 8, defaultValue: 0 }),
    n(`${prefix}_border_radius`, `Button corner radius (px)${enS}`, `انحناء زوايا الزر (px)${arS}`, { min: 0, max: 100 }),
  ];
}

// ── Editorial set (category-tiles, progress-spotlight, project-cards and the
// edge-to-edge variants of hero-split / image-with-text / trust-badges) ──────
// Every label here carries all six dashboard locales. Keys, option values and
// defaults mirror the storefront sections of the same names
// (multi-stores-web/src/themes/minimal/sections/); the value sets are shared
// with multi-stores-web/.../_shared/tone.ts, cta.ts, StatusBadge.tsx.

/** Six-locale label, in the order en, ar, tr, de, fr, sv. */
const L = (en: string, ar: string, tr: string, de: string, fr: string, sv: string): LocalizedString => ({
  en, ar, tr, de, fr, sv,
});

/** Colour override with a six-locale label. Empty = theme colour. */
const cL = (key: string, label: LocalizedString, extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key, type: 'color', label, ...extra,
});

/**
 * Same keys, types and limits as buttonStyleFields, with six-locale labels.
 * `suffix` (already in brackets) tells two buttons of one section apart.
 */
function buttonStyleFieldsL(prefix: string, suffix?: LocalizedString): FieldDefinition[] {
  const s = (label: LocalizedString): LocalizedString =>
    suffix
      ? (Object.fromEntries(Object.entries(label).map(([loc, text]) => [loc, `${text} ${suffix[loc] ?? suffix.en}`])) as LocalizedString)
      : label;
  return [
    cL(`${prefix}_bg_color`, s(L('Button background', 'خلفية الزر', 'Buton arka planı', 'Button-Hintergrund', 'Fond du bouton', 'Knappens bakgrund'))),
    cL(`${prefix}_text_color`, s(L('Button text color', 'لون نص الزر', 'Buton metin rengi', 'Button-Textfarbe', 'Couleur du texte du bouton', 'Knappens textfärg'))),
    cL(`${prefix}_border_color`, s(L('Button border color', 'لون حدود الزر', 'Buton kenarlık rengi', 'Button-Rahmenfarbe', 'Couleur de bordure du bouton', 'Knappens kantfärg'))),
    {
      key: `${prefix}_border_width`,
      type: 'number',
      label: s(L('Button border width (px)', 'سماكة حدود الزر (px)', 'Buton kenarlık kalınlığı (px)', 'Button-Rahmenbreite (px)', 'Épaisseur de bordure du bouton (px)', 'Knappens kantbredd (px)')),
      min: 0,
      max: 8,
      defaultValue: 0,
    },
    {
      key: `${prefix}_border_radius`,
      type: 'number',
      label: s(L('Button corner radius (px)', 'انحناء زوايا الزر (px)', 'Buton köşe yuvarlaklığı (px)', 'Button-Eckenradius (px)', 'Rayon des coins du bouton (px)', 'Knappens hörnradie (px)')),
      min: 0,
      max: 100,
    },
  ];
}

const SECONDARY_SUFFIX = L('(secondary)', '(ثانوي)', '(ikincil)', '(sekundär)', '(secondaire)', '(sekundär)');

// Logical sides: "start" is the right-hand side in a right-to-left language.
const START_LABEL = L('Start', 'البداية', 'Başlangıç', 'Anfang', 'Début', 'Start');
const END_LABEL = L('End', 'النهاية', 'Bitiş', 'Ende', 'Fin', 'Slut');
const CENTER_LABEL = L('Center', 'الوسط', 'Orta', 'Mitte', 'Centre', 'Mitten');

const START_END_OPTIONS = [
  { value: 'start', label: START_LABEL },
  { value: 'end', label: END_LABEL },
];

const HEADING_ALIGN_OPTIONS = [
  { value: 'start', label: START_LABEL },
  { value: 'center', label: CENTER_LABEL },
];

// Tone = 'none' | 'surface' | 'primary' | 'accent' (section background).
const TONE_OPTIONS = [
  { value: 'none', label: L('None (page background)', 'بدون (خلفية الصفحة)', 'Yok (sayfa arka planı)', 'Keine (Seitenhintergrund)', 'Aucune (fond de la page)', 'Ingen (sidans bakgrund)') },
  { value: 'surface', label: L('Surface (soft tint)', 'سطح (لون هادئ)', 'Yüzey (yumuşak ton)', 'Fläche (sanfter Ton)', 'Surface (teinte douce)', 'Yta (mjuk ton)') },
  { value: 'primary', label: L('Primary color', 'اللون الأساسي', 'Ana renk', 'Primärfarbe', 'Couleur principale', 'Primärfärg') },
  { value: 'accent', label: L('Accent color', 'لون التمييز', 'Vurgu rengi', 'Akzentfarbe', 'Couleur d’accent', 'Accentfärg') },
];

// CtaTone = 'primary' | 'accent' (button colour).
const CTA_TONE_OPTIONS = [
  { value: 'primary', label: L('Primary color', 'اللون الأساسي', 'Ana renk', 'Primärfarbe', 'Couleur principale', 'Primärfärg') },
  { value: 'accent', label: L('Accent color', 'لون التمييز', 'Vurgu rengi', 'Akzentfarbe', 'Couleur d’accent', 'Accentfärg') },
];

// Focus = 'center' | 'top' | 'bottom' (which part of a cropped image stays visible).
const FOCUS_OPTIONS = [
  { value: 'center', label: CENTER_LABEL },
  { value: 'top', label: L('Top', 'الأعلى', 'Üst', 'Oben', 'Haut', 'Överkant') },
  { value: 'bottom', label: L('Bottom', 'الأسفل', 'Alt', 'Unten', 'Bas', 'Underkant') },
];

// Edge = 'soft' | 'hard' (how the image meets the text half).
const EDGE_OPTIONS = [
  { value: 'soft', label: L('Soft (fades into the background)', 'ناعمة (تتلاشى في الخلفية)', 'Yumuşak (arka plana karışır)', 'Weich (läuft in den Hintergrund aus)', 'Douce (se fond dans l’arrière-plan)', 'Mjuk (tonar ut i bakgrunden)') },
  { value: 'hard', label: L('Hard (straight edge)', 'حادّة (حافة مستقيمة)', 'Keskin (düz kenar)', 'Hart (gerade Kante)', 'Nette (bord droit)', 'Hård (rak kant)') },
];

// Status = 'none' | 'planned' | 'in_progress' | 'completed'.
const STATUS_OPTIONS = [
  { value: 'none', label: L('No status', 'بدون حالة', 'Durum yok', 'Kein Status', 'Aucun statut', 'Ingen status') },
  { value: 'planned', label: L('Planned', 'مخطَّط', 'Planlandı', 'Geplant', 'Planifié', 'Planerat') },
  { value: 'in_progress', label: L('In progress', 'قيد التنفيذ', 'Devam ediyor', 'In Arbeit', 'En cours', 'Pågår') },
  { value: 'completed', label: L('Completed', 'مكتمل', 'Tamamlandı', 'Abgeschlossen', 'Terminé', 'Slutfört') },
];

const ALT_LABEL = L('Image description (alt text)', 'وصف الصورة (النص البديل)', 'Görsel açıklaması (alt metni)', 'Bildbeschreibung (Alt-Text)', 'Description de l’image (texte alternatif)', 'Bildbeskrivning (alt-text)');
const ALT_DESCRIPTION = L(
  'Read by screen readers and search engines. Leave empty when the image is only decoration.',
  'يقرؤه قارئ الشاشة ومحركات البحث. اتركه فارغاً إذا كانت الصورة للزينة فقط.',
  'Ekran okuyucular ve arama motorları okur. Görsel yalnızca süs ise boş bırakın.',
  'Wird von Screenreadern und Suchmaschinen gelesen. Leer lassen, wenn das Bild nur Dekoration ist.',
  'Lu par les lecteurs d’écran et les moteurs de recherche. Laissez vide si l’image est purement décorative.',
  'Läses av skärmläsare och sökmotorer. Lämna tomt om bilden bara är dekoration.',
);

const BG_COLOR_LABEL = L('Background color', 'لون الخلفية', 'Arka plan rengi', 'Hintergrundfarbe', 'Couleur de fond', 'Bakgrundsfärg');
const BG_COLOR_DESCRIPTION = L(
  'Replaces the background of the chosen tone. Empty = the tone’s own color.',
  'يستبدل خلفية الدرجة المختارة. فارغ = لون الدرجة نفسه.',
  'Seçilen tonun arka planını değiştirir. Boş = tonun kendi rengi.',
  'Ersetzt den Hintergrund des gewählten Tons. Leer = die Farbe des Tons.',
  'Remplace le fond du ton choisi. Vide = la couleur du ton.',
  'Ersätter bakgrunden för den valda tonen. Tomt = tonens egen färg.',
);

const TONE_LABEL = L('Background tone', 'درجة الخلفية', 'Arka plan tonu', 'Hintergrundton', 'Ton du fond', 'Bakgrundston');
const IMAGE_FOCUS_LABEL = L('Image focus', 'تركيز الصورة', 'Görsel odağı', 'Bildfokus', 'Point focal de l’image', 'Bildens fokus');
const IMAGE_FOCUS_DESCRIPTION = L(
  'The part of the image that stays visible when it is cropped.',
  'الجزء الذي يبقى ظاهراً من الصورة عند قصّها.',
  'Görsel kırpıldığında görünür kalan bölüm.',
  'Der Teil des Bildes, der beim Zuschneiden sichtbar bleibt.',
  'La partie de l’image qui reste visible lorsqu’elle est rognée.',
  'Den del av bilden som syns när den beskärs.',
);
const EDGE_LABEL = L('Image edge', 'حافة الصورة', 'Görsel kenarı', 'Bildkante', 'Bord de l’image', 'Bildens kant');
const CTA_TONE_LABEL = L('Button color', 'لون الزر', 'Buton rengi', 'Button-Farbe', 'Couleur du bouton', 'Knappens färg');
const CTA_TONE_DESCRIPTION = L(
  'Takes the theme’s primary or accent color. The button color fields below still win.',
  'يأخذ اللون الأساسي أو لون التمييز من الثيم. حقول ألوان الزر في الأسفل لها الأولوية.',
  'Temanın ana veya vurgu rengini alır. Aşağıdaki buton renk alanları önceliklidir.',
  'Übernimmt die Primär- oder Akzentfarbe des Themes. Die Button-Farbfelder unten haben Vorrang.',
  'Reprend la couleur principale ou d’accent du thème. Les champs de couleur du bouton ci-dessous restent prioritaires.',
  'Tar temats primär- eller accentfärg. Knappens färgfält nedan gäller i första hand.',
);
const CTA_ARROW_LABEL = L('Arrow after the button text', 'سهم بعد نص الزر', 'Buton metninden sonra ok', 'Pfeil nach dem Button-Text', 'Flèche après le texte du bouton', 'Pil efter knapptexten');
const HEADING_ALIGN_LABEL = L('Heading alignment', 'محاذاة العنوان', 'Başlık hizalaması', 'Ausrichtung der Überschrift', 'Alignement du titre', 'Rubrikens justering');
const HEADING_RULE_LABEL = L('Lines beside the heading', 'خطوط بجانب العنوان', 'Başlığın yanında çizgiler', 'Linien neben der Überschrift', 'Lignes de part et d’autre du titre', 'Linjer bredvid rubriken');
const HEADING_RULE_DESCRIPTION = L(
  'Shown only with a centered heading.',
  'تظهر فقط مع العنوان الموسَّط.',
  'Yalnızca ortalanmış başlıkla gösterilir.',
  'Nur bei zentrierter Überschrift sichtbar.',
  'Affichées uniquement avec un titre centré.',
  'Visas bara med centrerad rubrik.',
);
const ROUNDED_LABEL = L('Rounded corners', 'زوايا مستديرة', 'Yuvarlatılmış köşeler', 'Abgerundete Ecken', 'Coins arrondis', 'Rundade hörn');
const HEADING_LABEL = L('Heading', 'العنوان', 'Başlık', 'Überschrift', 'Titre', 'Rubrik');
// Manual line breaks: these headings are textareas, the storefront keeps up to
// four typed lines (multi-stores-web/.../_shared/headingLines.ts).
const HEADING_MULTILINE_HINT = L(
  'Press Enter to start a new line (up to 4 lines).',
  'اضغط Enter لبدء سطر جديد (حتى 4 أسطر).',
  'Yeni bir satıra geçmek için Enter’a basın (en fazla 4 satır).',
  'Mit der Eingabetaste beginnen Sie eine neue Zeile (bis zu 4 Zeilen).',
  'Appuyez sur Entrée pour commencer une nouvelle ligne (4 lignes au maximum).',
  'Tryck på Enter för att börja på en ny rad (upp till 4 rader).',
);
// hero-split and image-with-text keep the typed lines in their edge-to-edge
// variant only; the framed variant renders the heading on one flowing line.
const HEADING_MULTILINE_BLEED_HINT = L(
  'Press Enter to start a new line (up to 4 lines). Line breaks show in the edge-to-edge style only.',
  'اضغط Enter لبدء سطر جديد (حتى 4 أسطر). تظهر فواصل الأسطر في نمط «من الحافة إلى الحافة» فقط.',
  'Yeni bir satıra geçmek için Enter’a basın (en fazla 4 satır). Satır sonları yalnızca “Kenardan kenara” stilinde görünür.',
  'Mit der Eingabetaste beginnen Sie eine neue Zeile (bis zu 4 Zeilen). Zeilenumbrüche erscheinen nur im Stil „Randlos“.',
  'Appuyez sur Entrée pour commencer une nouvelle ligne (4 lignes au maximum). Les sauts de ligne n’apparaissent que dans le style « Bord à bord ».',
  'Tryck på Enter för att börja på en ny rad (upp till 4 rader). Radbrytningarna visas bara i stilen ”Kant till kant”.',
);
const SUBHEADING_LABEL = L('Subheading', 'العنوان الفرعي', 'Alt başlık', 'Unterüberschrift', 'Sous-titre', 'Underrubrik');
const IMAGE_LABEL = L('Image', 'الصورة', 'Görsel', 'Bild', 'Image', 'Bild');
const TITLE_LABEL = L('Title', 'العنوان', 'Başlık', 'Titel', 'Titre', 'Titel');
const LINK_LABEL = L('Link', 'الرابط', 'Bağlantı', 'Link', 'Lien', 'Länk');
const COLUMNS_DESKTOP_LABEL = L('Columns — desktop', 'الأعمدة — سطح المكتب', 'Sütunlar — masaüstü', 'Spalten — Desktop', 'Colonnes — ordinateur', 'Kolumner — dator');
const COLUMNS_TABLET_LABEL = L('Columns — tablet', 'الأعمدة — تابلت', 'Sütunlar — tablet', 'Spalten — Tablet', 'Colonnes — tablette', 'Kolumner — surfplatta');
const COLUMNS_MOBILE_LABEL = L('Columns — mobile', 'الأعمدة — جوال', 'Sütunlar — mobil', 'Spalten — Mobil', 'Colonnes — mobile', 'Kolumner — mobil');
const IMAGE_ASPECT_LABEL = L('Image aspect', 'نسبة الصورة', 'Görsel oranı', 'Bildformat', 'Format de l’image', 'Bildformat');
const HEADING_COLOR_LABEL = L('Heading color', 'لون العنوان', 'Başlık rengi', 'Farbe der Überschrift', 'Couleur du titre', 'Rubrikens färg');
const SUBHEADING_COLOR_LABEL = L('Subheading color', 'لون العنوان الفرعي', 'Alt başlık rengi', 'Farbe der Unterüberschrift', 'Couleur du sous-titre', 'Underrubrikens färg');
const EYEBROW_COLOR_LABEL = L('Small label color', 'لون التسمية الصغيرة', 'Küçük etiket rengi', 'Farbe des kleinen Labels', 'Couleur du petit libellé', 'Den lilla etikettens färg');
const BODY_COLOR_LABEL = L('Body text color', 'لون النص', 'Metin rengi', 'Farbe des Fließtexts', 'Couleur du texte', 'Brödtextens färg');

const ASPECT_SQUARE = L('Square (1:1)', 'مربّع (1:1)', 'Kare (1:1)', 'Quadrat (1:1)', 'Carré (1:1)', 'Kvadrat (1:1)');
const ASPECT_PORTRAIT = L('Portrait (4:5)', 'طولي (4:5)', 'Dikey (4:5)', 'Hochformat (4:5)', 'Portrait (4:5)', 'Stående (4:5)');
const ASPECT_LANDSCAPE = L('Landscape (4:3)', 'عرضي (4:3)', 'Yatay (4:3)', 'Querformat (4:3)', 'Paysage (4:3)', 'Liggande (4:3)');
const ASPECT_WIDE = L('Wide (16:9)', 'عريض (16:9)', 'Geniş (16:9)', 'Breit (16:9)', 'Large (16:9)', 'Bred (16:9)');

// Cross-axis alignment of the children of a layout container.
// Mirrors ALIGN_OPTIONS in multi-stores-web/src/themes/minimal/sections/layout/options.ts.
const CONTAINER_ALIGN_OPTIONS = [
  { value: 'stretch', label: { en: 'Stretch', ar: 'تمدد' } },
  { value: 'start', label: { en: 'Start', ar: 'البداية' } },
  { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
  { value: 'end', label: { en: 'End', ar: 'النهاية' } },
];

/**
 * Fields of the "Layout in parent" inspector panel for a section that sits
 * inside a layout container. Keys are paths inside the CHILD's
 * settings._layout ('span.desktop' -> settings._layout.span.desktop); read and
 * write them with getChildLayoutValue / setChildLayoutValue from
 * lib/sectionTree.ts. Empty means "container default".
 */
export const CHILD_LAYOUT_FIELDS: FieldDefinition[] = [
  {
    key: 'span.desktop',
    type: 'number',
    label: { en: 'Width share — desktop', ar: 'حصة العرض — سطح المكتب' },
    description: {
      en: 'In a grid: how many columns it spans. In a row: its width ratio against the other columns.',
      ar: 'في الشبكة: عدد الأعمدة التي يمتد عليها. في الصف: نسبة عرضه مقارنة ببقية الأعمدة.',
    },
    min: 1,
    max: 12,
  },
  { key: 'span.tablet', type: 'number', label: { en: 'Width share — tablet', ar: 'حصة العرض — تابلت' }, min: 1, max: 12 },
  { key: 'span.mobile', type: 'number', label: { en: 'Width share — mobile', ar: 'حصة العرض — جوال' }, min: 1, max: 12 },
  {
    key: 'order.desktop',
    type: 'number',
    label: { en: 'Display order — desktop', ar: 'ترتيب العرض — سطح المكتب' },
    description: {
      en: 'Lower numbers show first. Leave empty to keep the order of the section list.',
      ar: 'الأرقام الأصغر تظهر أولاً. اتركه فارغاً للإبقاء على ترتيب قائمة الأقسام.',
    },
    min: -20,
    max: 20,
  },
  { key: 'order.tablet', type: 'number', label: { en: 'Display order — tablet', ar: 'ترتيب العرض — تابلت' }, min: -20, max: 20 },
  { key: 'order.mobile', type: 'number', label: { en: 'Display order — mobile', ar: 'ترتيب العرض — جوال' }, min: -20, max: 20 },
  {
    key: 'align_self',
    type: 'select',
    label: { en: 'Own alignment', ar: 'محاذاته الخاصة' },
    defaultValue: '',
    options: [{ value: '', label: { en: 'Container default', ar: 'افتراضي الحاوية' } }, ...CONTAINER_ALIGN_OPTIONS],
  },
  {
    key: 'sticky',
    type: 'boolean',
    label: { en: 'Stay in view while scrolling (desktop)', ar: 'تثبيت أثناء التمرير (سطح المكتب)' },
    defaultValue: false,
  },
];

// ── Dynamic sources (product template) ─────────────────────────────────
// Mirrors multi-stores-web/src/themes/minimal/sections/_shared/dynamicSourceFields.ts
// (same keys, option values and showIf rules; inspectorFields.test.mjs
// compares the two, and the options with the web renderer's
// dynamicSourceKeys.ts). The source fields are settings (never translatable)
// and the inspector offers them on PRODUCT_TEMPLATE pages only (`pageTypes`).
// A missing source means static, so existing sections are unchanged.

const PRODUCT_TEMPLATE_ONLY: FieldDefinition['pageTypes'] = ['PRODUCT_TEMPLATE'];

/** The static field (html / image) shows only while the source is static. */
export const STATIC_CONTENT_SHOW_IF = { key: 'content_source', in: ['', 'static'] };
export const STATIC_IMAGE_SHOW_IF = { key: 'image_source', in: ['', 'static'] };

export const CONTENT_SOURCE_FIELDS: FieldDefinition[] = [
  {
    key: 'content_source',
    type: 'select',
    label: { en: 'Content source', ar: 'مصدر المحتوى', tr: 'İçerik kaynağı', de: 'Inhaltsquelle', fr: 'Source du contenu', sv: 'Innehållskälla' },
    description: {
      en: 'Show this text from the product of the page instead of writing it here.',
      ar: 'اعرض هذا النص من بيانات المنتج في الصفحة بدلاً من كتابته هنا.',
      tr: 'Bu metni buraya yazmak yerine sayfadaki üründen göster.',
      de: 'Diesen Text aus dem Produkt der Seite anzeigen, statt ihn hier zu schreiben.',
      fr: 'Afficher ce texte depuis le produit de la page au lieu de l’écrire ici.',
      sv: 'Visa texten från sidans produkt i stället för att skriva den här.',
    },
    defaultValue: 'static',
    pageTypes: PRODUCT_TEMPLATE_ONLY,
    options: [
      { value: 'static', label: { en: 'Static (written here)', ar: 'ثابت (يُكتب هنا)', tr: 'Sabit (burada yazılır)', de: 'Statisch (hier geschrieben)', fr: 'Statique (écrit ici)', sv: 'Statisk (skrivs här)' } },
      { value: 'product_description', label: { en: 'Product description', ar: 'وصف المنتج', tr: 'Ürün açıklaması', de: 'Produktbeschreibung', fr: 'Description du produit', sv: 'Produktbeskrivning' } },
      { value: 'product_short_description', label: { en: 'Product short description', ar: 'الوصف المختصر للمنتج', tr: 'Ürün kısa açıklaması', de: 'Kurzbeschreibung des Produkts', fr: 'Description courte du produit', sv: 'Kort produktbeskrivning' } },
      { value: 'product_specifications', label: { en: 'Product specifications', ar: 'مواصفات المنتج', tr: 'Ürün özellikleri', de: 'Produktspezifikationen', fr: 'Caractéristiques du produit', sv: 'Produktspecifikationer' } },
      { value: 'product_attribute', label: { en: 'Product attribute (custom field)', ar: 'خاصية من المنتج (حقل مخصص)', tr: 'Ürün niteliği (özel alan)', de: 'Produktattribut (eigenes Feld)', fr: 'Attribut du produit (champ personnalisé)', sv: 'Produktattribut (eget fält)' } },
      { value: 'product_title', label: { en: 'Product title', ar: 'اسم المنتج', tr: 'Ürün adı', de: 'Produktname', fr: 'Nom du produit', sv: 'Produktnamn' } },
    ],
  },
  {
    key: 'attribute_key',
    type: 'text',
    label: { en: 'Attribute name', ar: 'اسم الخاصية', tr: 'Nitelik adı', de: 'Attributname', fr: 'Nom de l’attribut', sv: 'Attributnamn' },
    description: {
      en: 'The attribute name as shown in the product specifications.',
      ar: 'اسم الخاصية كما يظهر في مواصفات المنتج.',
      tr: 'Ürün özelliklerinde görünen nitelik adı.',
      de: 'Der Attributname wie in den Produktspezifikationen.',
      fr: 'Le nom de l’attribut tel qu’il apparaît dans les caractéristiques du produit.',
      sv: 'Attributets namn så som det visas i produktens specifikationer.',
    },
    pageTypes: PRODUCT_TEMPLATE_ONLY,
    showIf: { key: 'content_source', in: ['product_attribute'] },
  },
];

export const IMAGE_SOURCE_FIELDS: FieldDefinition[] = [
  {
    key: 'image_source',
    type: 'select',
    label: { en: 'Image source', ar: 'مصدر الصورة', tr: 'Görsel kaynağı', de: 'Bildquelle', fr: 'Source de l’image', sv: 'Bildkälla' },
    defaultValue: 'static',
    pageTypes: PRODUCT_TEMPLATE_ONLY,
    options: [
      { value: 'static', label: { en: 'Uploaded image', ar: 'صورة مرفوعة', tr: 'Yüklenen görsel', de: 'Hochgeladenes Bild', fr: 'Image importée', sv: 'Uppladdad bild' } },
      { value: 'product_featured', label: { en: 'Product featured image', ar: 'الصورة الرئيسية للمنتج', tr: 'Ürünün ana görseli', de: 'Hauptbild des Produkts', fr: 'Image principale du produit', sv: 'Produktens huvudbild' } },
      { value: 'product_image_n', label: { en: 'Product image by position', ar: 'صورة المنتج حسب الترتيب', tr: 'Sıraya göre ürün görseli', de: 'Produktbild nach Position', fr: 'Image du produit par position', sv: 'Produktbild efter position' } },
      { value: 'variant_image', label: { en: 'Selected variant image', ar: 'صورة الخيار المحدد', tr: 'Seçili varyant görseli', de: 'Bild der gewählten Variante', fr: 'Image de la variante choisie', sv: 'Bild för vald variant' } },
    ],
  },
  {
    key: 'image_index',
    type: 'number',
    label: { en: 'Image position (1 = first)', ar: 'ترتيب الصورة (1 = الأولى)', tr: 'Görsel sırası (1 = ilk)', de: 'Bildposition (1 = erstes)', fr: 'Position de l’image (1 = première)', sv: 'Bildposition (1 = första)' },
    min: 1,
    max: 20,
    defaultValue: 2,
    pageTypes: PRODUCT_TEMPLATE_ONLY,
    showIf: { key: 'image_source', in: ['product_image_n'] },
  },
];

// ── Section catalog (mirrors multi-stores-web/src/themes/minimal/sections/*) ─

const BASE_SECTION_SCHEMAS: SectionSchema[] = [
  {
    id: 'hero-banner',
    label: { en: 'Hero Banner', ar: 'بانر رئيسي' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'Top-of-page banner. Three layouts: centered, full-bleed image background, or side-by-side.',
      ar: 'بانر أعلى الصفحة. ثلاث تخطيطات: في الوسط، خلفية صورة كاملة، أو صورة بجانب نص.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'centered',
        options: [
          { value: 'centered', label: { en: 'Centered', ar: 'وسط' } },
          { value: 'image-background', label: { en: 'Image background', ar: 'صورة كخلفية' } },
          { value: 'side-by-side', label: { en: 'Side-by-side', ar: 'جنبًا إلى جنب' } },
        ],
      },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height (for image background)', ar: 'الارتفاع (لخلفية الصورة)' },
        defaultValue: 'md',
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة' }, min: 0, max: 1, defaultValue: 0.35 },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
      // Per-element colors + button styles. All optional; empty = theme default.
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta', { suffix: '(primary)' }, { suffix: '(رئيسي)' }),
      ...buttonStyleFields('cta_secondary', { suffix: '(secondary)' }, { suffix: '(ثانوي)' }),
    ],
    defaultSettings: { layout: 'centered', alignment: 'center', height: 'md', overlay_opacity: 0.35 },
    defaultContent: {
      heading: 'Welcome to our store',
      subheading: 'Discover our latest collection',
      cta_text: 'Shop now',
    },
  },
  {
    id: 'hero-slider',
    label: { en: 'Hero Slider', ar: 'سلايدر البانر الرئيسي' },
    icon: 'images',
    category: 'showcase',
    description: {
      en: 'Multi-slide hero carousel. Full-bleed image + text + CTA per slide, with autoplay/arrows/dots.',
      ar: 'سلايدر بانر متعدد الشرائح. صورة كاملة العرض مع نص وزر لكل شريحة، مع تشغيل تلقائي وأسهم ونقاط.',
    },
    translatable: ['slides'],
    schema: [
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'sm', label: { en: 'Small (320px)', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium (480px)', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large (640px)', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة' }, min: 0, max: 1, defaultValue: 0.4 },
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 5000 },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: true },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: true },
      {
        key: 'slides',
        type: 'repeater',
        label: { en: 'Slides', ar: 'الشرائح' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Background image', ar: 'صورة الخلفية' } },
          { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
          { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
          { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
          { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
          { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
          { key: 'alignment', type: 'select', label: { en: 'Text alignment', ar: 'محاذاة النص' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
        ],
      },
      // Section-level styling — applied to all slides for consistency.
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: {
      height: 'lg',
      overlay_opacity: 0.4,
      autoplay_ms: 5000,
      show_arrows: true,
      show_dots: true,
      loop: true,
    },
    defaultContent: {
      slides: [
        {
          eyebrow: 'New season',
          heading: 'Welcome to our store',
          subheading: 'Discover the latest collection — handpicked just for you.',
          cta_text: 'Shop now',
          cta_url: '#',
          alignment: 'center',
        },
        {
          eyebrow: 'Limited time',
          heading: 'Spring sale up to 40% off',
          subheading: 'Save on best-sellers across every category.',
          cta_text: 'See offers',
          cta_url: '#',
          alignment: 'center',
        },
      ],
    },
  },
  {
    id: 'aurora-hero',
    label: { en: 'Aurora Hero', ar: 'بانر أورورا' },
    icon: 'sparkles',
    category: 'showcase',
    description: {
      en: 'A modern full-bleed hero with soft animated SVG gradient blobs drifting behind the headline.',
      ar: 'بانر عصري كامل العرض بأشكال SVG متدرّجة متحرّكة تنساب خلف العنوان.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text'],
    schema: [
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
      c('bg_color', 'Background color', 'لون الخلفية'),
      c('color_1', 'Aurora color 1', 'لون أورورا 1'),
      c('color_2', 'Aurora color 2', 'لون أورورا 2'),
      c('color_3', 'Aurora color 3', 'لون أورورا 3'),
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
      c('eyebrow_color', 'Eyebrow color', 'لون التسمية الصغيرة'),
      c('cta_bg_color', 'Button background', 'خلفية الزر'),
      c('cta_text_color', 'Button text color', 'لون نص الزر'),
      n('cta_border_radius', 'Button corner radius (px)', 'انحناء زوايا الزر (px)', { min: 0, max: 100 }),
      c('cta_secondary_border_color', 'Secondary button border', 'حدود الزر الثاني'),
    ],
    defaultSettings: { height: 'lg', bg_color: '#0b1020', color_1: '#6366f1', color_2: '#ec4899', color_3: '#06b6d4' },
    defaultContent: {
      eyebrow: 'New',
      heading: 'Build something people love',
      subheading: 'A modern hero with a living gradient backdrop.',
      cta_text: 'Get started',
      cta_secondary_text: 'Learn more',
    },
  },
  {
    id: 'hero-video',
    label: { en: 'Video Hero', ar: 'بانر فيديو' },
    icon: 'video',
    category: 'showcase',
    description: {
      en: 'Full-bleed background video with a dark overlay, headline and CTA. Poster image shows while the video loads.',
      ar: 'فيديو خلفية بعرض كامل مع طبقة تعتيم وعنوان وزر. تظهر صورة الغلاف أثناء تحميل الفيديو.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text'],
    schema: [
      { key: 'video_url', type: 'url', label: { en: 'Video URL (mp4)', ar: 'رابط الفيديو (mp4)' } },
      { key: 'poster_image', type: 'image', label: { en: 'Poster image', ar: 'صورة الغلاف' } },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة' }, min: 0, max: 1, defaultValue: 0.35 },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { overlay_opacity: 0.35, height: 'lg', alignment: 'center' },
    defaultContent: {
      eyebrow: 'The 2026 collection',
      heading: 'Crafted for the way you live',
      subheading: "Every piece starts with better materials and ends with obsessive attention to detail. Watch the story behind this season's collection.",
      cta_text: 'Shop the collection',
      cta_url: '/products',
    },
  },
  {
    id: 'hero-split',
    label: { en: 'Split Hero', ar: 'بانر منقسم' },
    icon: 'columns',
    category: 'showcase',
    description: {
      en: 'Half image, half text hero with primary and secondary CTAs. The image can sit on either side.',
      ar: 'بانر نصفه صورة ونصفه نص مع زرّين رئيسي وثانوي. يمكن وضع الصورة في أي من الجهتين.',
    },
    // `alt` is the only addition; URL keys stay in settings.
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text', 'alt'],
    schema: [
      // Unset = framed (the boxed image with radius and shadow, as before).
      // 'bleed' runs the image to the viewport edge; the fields gated on it
      // below do nothing in the framed variant.
      {
        key: 'variant',
        type: 'select',
        label: L('Style', 'النمط', 'Stil', 'Stil', 'Style', 'Stil'),
        description: L(
          'Framed keeps the image in a rounded box inside the page width. Edge to edge runs the image to the side of the screen.',
          'المؤطَّر يُبقي الصورة في صندوق بزوايا مستديرة داخل عرض الصفحة. من الحافة إلى الحافة يمدّ الصورة حتى طرف الشاشة.',
          'Çerçeveli, görseli sayfa genişliği içinde yuvarlatılmış bir kutuda tutar. Kenardan kenara, görseli ekranın kenarına kadar uzatır.',
          'Gerahmt hält das Bild in einem abgerundeten Kasten innerhalb der Seitenbreite. Randlos führt das Bild bis an den Bildschirmrand.',
          'Encadré garde l’image dans un cadre arrondi à l’intérieur de la largeur de page. Bord à bord étend l’image jusqu’au bord de l’écran.',
          'Inramad håller bilden i en rundad ruta inom sidbredden. Kant till kant drar ut bilden till skärmens kant.',
        ),
        defaultValue: 'framed',
        options: [
          { value: 'framed', label: L('Framed', 'مؤطَّر', 'Çerçeveli', 'Gerahmt', 'Encadré', 'Inramad') },
          { value: 'bleed', label: L('Edge to edge', 'من الحافة إلى الحافة', 'Kenardan kenara', 'Randlos', 'Bord à bord', 'Kant till kant') },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'alt',
        type: 'text',
        label: ALT_LABEL,
        description: L(
          'Read by screen readers and search engines. Empty = the heading is used.',
          'يقرؤه قارئ الشاشة ومحركات البحث. فارغ = يُستخدم العنوان.',
          'Ekran okuyucular ve arama motorları okur. Boş = başlık kullanılır.',
          'Wird von Screenreadern und Suchmaschinen gelesen. Leer = die Überschrift wird verwendet.',
          'Lu par les lecteurs d’écran et les moteurs de recherche. Vide = le titre est utilisé.',
          'Läses av skärmläsare och sökmotorer. Tomt = rubriken används.',
        ),
        maxLength: 160,
      },
      {
        key: 'image_side',
        type: 'select',
        label: { en: 'Image side', ar: 'جهة الصورة' },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'md',
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      {
        key: 'image_width',
        type: 'select',
        label: L('Image width', 'عرض الصورة', 'Görsel genişliği', 'Bildbreite', 'Largeur de l’image', 'Bildens bredd'),
        defaultValue: 'half',
        showIf: { key: 'variant', in: ['bleed'] },
        options: [
          { value: 'half', label: L('Half', 'النصف', 'Yarım', 'Hälfte', 'Moitié', 'Halva') },
          { value: 'wide', label: L('Wide (58%)', 'عريضة (58%)', 'Geniş (%58)', 'Breit (58 %)', 'Large (58 %)', 'Bred (58 %)') },
        ],
      },
      {
        key: 'image_focus',
        type: 'select',
        label: IMAGE_FOCUS_LABEL,
        description: IMAGE_FOCUS_DESCRIPTION,
        defaultValue: 'center',
        showIf: { key: 'variant', in: ['bleed'] },
        options: FOCUS_OPTIONS,
      },
      {
        key: 'tone',
        type: 'select',
        label: TONE_LABEL,
        defaultValue: 'surface',
        showIf: { key: 'variant', in: ['bleed'] },
        options: TONE_OPTIONS,
      },
      cL('bg_color', BG_COLOR_LABEL, { description: BG_COLOR_DESCRIPTION, showIf: { key: 'variant', in: ['bleed'] } }),
      {
        key: 'edge',
        type: 'select',
        label: EDGE_LABEL,
        defaultValue: 'soft',
        showIf: { key: 'variant', in: ['bleed'] },
        options: EDGE_OPTIONS,
      },
      {
        key: 'mobile_order',
        type: 'select',
        label: L('Order on mobile', 'الترتيب على الجوال', 'Mobilde sıra', 'Reihenfolge auf Mobilgeräten', 'Ordre sur mobile', 'Ordning på mobil'),
        defaultValue: 'image-first',
        showIf: { key: 'variant', in: ['bleed'] },
        options: [
          { value: 'image-first', label: L('Image first', 'الصورة أولاً', 'Önce görsel', 'Bild zuerst', 'Image d’abord', 'Bilden först') },
          { value: 'text-first', label: L('Text first', 'النص أولاً', 'Önce metin', 'Text zuerst', 'Texte d’abord', 'Texten först') },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'textarea', label: { en: 'Heading', ar: 'العنوان' }, description: HEADING_MULTILINE_BLEED_HINT, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
      // Both variants. Unset or 'primary' = the button as it was.
      {
        key: 'cta_tone',
        type: 'select',
        label: CTA_TONE_LABEL,
        description: CTA_TONE_DESCRIPTION,
        defaultValue: 'primary',
        options: CTA_TONE_OPTIONS,
      },
      {
        key: 'cta_arrow',
        type: 'boolean',
        label: CTA_ARROW_LABEL,
        defaultValue: false,
        showIf: { key: 'variant', in: ['bleed'] },
      },
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta', { suffix: '(primary)' }, { suffix: '(رئيسي)' }),
      ...buttonStyleFields('cta_secondary', { suffix: '(secondary)' }, { suffix: '(ثانوي)' }),
    ],
    defaultSettings: { image_side: 'start', height: 'md' },
    defaultContent: {
      eyebrow: 'New arrivals',
      heading: 'Everyday essentials, elevated',
      subheading: 'Thoughtfully designed pieces that work as hard as you do — premium materials, honest prices, and a guarantee we actually stand behind.',
      cta_text: 'Shop new arrivals',
      cta_url: '/products',
      cta_secondary_text: 'Our story',
      cta_secondary_url: '/pages/about',
    },
  },
  {
    id: 'parallax-banner',
    label: { en: 'Parallax Banner', ar: 'بانر بارالاكس' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'Full-width image band with a fixed parallax scroll effect, overlay text and CTA.',
      ar: 'شريط صورة بعرض كامل بتأثير بارالاكس ثابت أثناء التمرير، مع نص وزر فوق الصورة.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'md',
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة' }, min: 0, max: 1, defaultValue: 0.3 },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      ...textColorFields({ eyebrow: true, heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { height: 'md', overlay_opacity: 0.3 },
    defaultContent: {
      eyebrow: 'Limited edition',
      heading: 'Designed to be noticed',
      subheading: 'A statement piece for every space — released in small batches and gone before you know it.',
      cta_text: 'Explore the drop',
      cta_url: '/products',
    },
  },
  {
    // Closing brand band: a photo with a dark overlay, the mark, the wordmark
    // and a tagline, centred. Mirrors
    // multi-stores-web/src/themes/minimal/sections/BrandBand.tsx. The heading
    // tag and the heading accent pair are injected below (withHeadingLevel,
    // withHeadingAccent).
    id: 'brand-band',
    label: L('Brand Band', 'شريط العلامة', 'Marka bandı', 'Markenband', 'Bandeau de marque', 'Varumärkesband'),
    icon: 'image',
    category: 'showcase',
    description: L(
      'Full-width photo band with your logo, brand name and a short tagline, centred. A calm close for a page.',
      'شريط صورة بعرض كامل يحمل شعارك واسم علامتك وعبارة قصيرة في الوسط. ختام هادئ للصفحة.',
      'Logonuzu, marka adınızı ve kısa bir sloganı ortada gösteren tam genişlikte fotoğraf bandı. Sayfa için sakin bir kapanış.',
      'Fotoband in voller Breite mit Logo, Markenname und kurzem Slogan, zentriert. Ein ruhiger Abschluss für eine Seite.',
      'Bandeau photo pleine largeur avec votre logo, le nom de la marque et un court slogan, centrés. Une fin de page apaisée.',
      'Fotoband i full bredd med logotyp, varumärkesnamn och en kort tagline, centrerat. Ett lugnt avslut på en sida.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'FOOTER'],
    translatable: ['alt', 'heading', 'tagline', 'cta_text'],
    schema: [
      { key: 'image', type: 'image', label: IMAGE_LABEL },
      { key: 'alt', type: 'text', label: ALT_LABEL, description: ALT_DESCRIPTION, maxLength: 160 },
      {
        key: 'image_focus',
        type: 'select',
        label: IMAGE_FOCUS_LABEL,
        description: IMAGE_FOCUS_DESCRIPTION,
        defaultValue: 'center',
        options: FOCUS_OPTIONS,
      },
      {
        key: 'overlay_opacity',
        type: 'number',
        label: L('Overlay darkness (%)', 'تعتيم الصورة (%)', 'Kaplama koyuluğu (%)', 'Abdunklung (%)', 'Assombrissement (%)', 'Mörkläggning (%)'),
        description: L(
          'How much black is laid over the photo, 0 to 80. More darkness makes the text easier to read.',
          'مقدار السواد فوق الصورة، من 0 إلى 80. كلما زاد التعتيم سهلت قراءة النص.',
          'Fotoğrafın üzerine binen siyahın oranı, 0 ile 80 arası. Koyuluk arttıkça metin daha kolay okunur.',
          'Wie viel Schwarz über dem Foto liegt, 0 bis 80. Mehr Abdunklung macht den Text besser lesbar.',
          'Part de noir posée sur la photo, de 0 à 80. Plus elle est sombre, plus le texte est lisible.',
          'Hur mycket svart som läggs över fotot, 0 till 80. Mer mörker gör texten lättare att läsa.',
        ),
        min: 0,
        max: 80,
        defaultValue: 40,
      },
      {
        key: 'height',
        type: 'select',
        label: L('Height', 'الارتفاع', 'Yükseklik', 'Höhe', 'Hauteur', 'Höjd'),
        defaultValue: 'md',
        options: [
          { value: 'sm', label: L('Small', 'صغير', 'Küçük', 'Klein', 'Petite', 'Liten') },
          { value: 'md', label: L('Medium', 'متوسط', 'Orta', 'Mittel', 'Moyenne', 'Medel') },
          { value: 'lg', label: L('Large', 'كبير', 'Büyük', 'Groß', 'Grande', 'Stor') },
        ],
      },
      {
        key: 'logo',
        type: 'image',
        label: L('Logo (optional)', 'الشعار (اختياري)', 'Logo (isteğe bağlı)', 'Logo (optional)', 'Logo (facultatif)', 'Logotyp (valfritt)'),
        description: L(
          'Shown above the brand name. Use a version that reads well on a dark photo.',
          'يظهر فوق اسم العلامة. استخدم نسخة واضحة فوق صورة داكنة.',
          'Marka adının üstünde gösterilir. Koyu bir fotoğraf üzerinde iyi okunan bir sürüm kullanın.',
          'Wird über dem Markennamen angezeigt. Verwenden Sie eine Version, die auf einem dunklen Foto gut erkennbar ist.',
          'Affiché au-dessus du nom de la marque. Utilisez une version lisible sur une photo sombre.',
          'Visas ovanför varumärkesnamnet. Använd en version som syns bra på ett mörkt foto.',
        ),
      },
      {
        key: 'logo_height',
        type: 'number',
        label: L('Logo height (px)', 'ارتفاع الشعار (px)', 'Logo yüksekliği (px)', 'Logo-Höhe (px)', 'Hauteur du logo (px)', 'Logotypens höjd (px)'),
        min: 32,
        max: 160,
        defaultValue: 72,
      },
      {
        key: 'heading',
        type: 'text',
        label: L('Brand name', 'اسم العلامة', 'Marka adı', 'Markenname', 'Nom de la marque', 'Varumärkesnamn'),
        maxLength: 80,
      },
      {
        key: 'heading_style',
        type: 'select',
        label: L('Brand name style', 'نمط اسم العلامة', 'Marka adı stili', 'Stil des Markennamens', 'Style du nom de la marque', 'Varumärkesnamnets stil'),
        defaultValue: 'ruled',
        options: [
          { value: 'ruled', label: L('With a line on each side', 'مع خط على كل جانب', 'Her iki yanında çizgi', 'Mit einer Linie auf jeder Seite', 'Avec une ligne de chaque côté', 'Med en linje på varje sida') },
          { value: 'plain', label: L('Plain', 'بسيط', 'Sade', 'Schlicht', 'Simple', 'Enkel') },
        ],
      },
      {
        key: 'tagline',
        type: 'text',
        label: L('Tagline', 'العبارة التعريفية', 'Slogan', 'Slogan', 'Slogan', 'Tagline'),
        maxLength: 160,
      },
      cL('text_color', L('Text color', 'لون النص', 'Metin rengi', 'Textfarbe', 'Couleur du texte', 'Textfärg'), {
        description: L('Empty = white.', 'فارغ = أبيض.', 'Boş = beyaz.', 'Leer = Weiß.', 'Vide = blanc.', 'Tomt = vitt.'),
      }),
      {
        key: 'cta_text',
        type: 'text',
        label: L('Button text', 'نص الزر', 'Buton metni', 'Button-Text', 'Texte du bouton', 'Knapptext'),
        maxLength: 40,
      },
      {
        key: 'cta_url',
        type: 'url',
        label: L('Button URL', 'رابط الزر', 'Buton bağlantısı', 'Button-Link', 'Lien du bouton', 'Knappens länk'),
      },
    ],
    defaultSettings: { image_focus: 'center', overlay_opacity: 40, height: 'md', logo_height: 72, heading_style: 'ruled' },
    defaultContent: { heading: 'Your brand', tagline: 'A short line about what you stand for' },
  },
  {
    id: 'before-after',
    label: { en: 'Before / After', ar: 'قبل / بعد' },
    icon: 'columns',
    category: 'showcase',
    description: {
      en: 'Two images compared with a draggable divider — perfect for transformations and results.',
      ar: 'مقارنة صورتين بفاصل قابل للسحب — مثالي لعرض التحوّلات والنتائج.',
    },
    translatable: ['heading', 'subheading', 'label_before', 'label_after'],
    schema: [
      { key: 'image_before', type: 'image', label: { en: 'Before image', ar: 'صورة "قبل"' } },
      { key: 'image_after', type: 'image', label: { en: 'After image', ar: 'صورة "بعد"' } },
      { key: 'start_position', type: 'number', label: { en: 'Divider start position (%)', ar: 'موضع الفاصل الابتدائي (%)' }, min: 0, max: 100, defaultValue: 50 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'label_before', type: 'text', label: { en: 'Before label', ar: 'تسمية "قبل"' }, maxLength: 30 },
      { key: 'label_after', type: 'text', label: { en: 'After label', ar: 'تسمية "بعد"' }, maxLength: 30 },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { start_position: 50 },
    defaultContent: {
      heading: 'See the difference',
      subheading: 'Drag the slider to compare — same space, thirty days later.',
      label_before: 'Before',
      label_after: 'After',
    },
  },
  {
    id: 'bento-grid',
    label: { en: 'Bento Grid', ar: 'شبكة بنتو' },
    icon: 'layout-grid',
    category: 'content',
    description: {
      en: 'A modern asymmetric grid of mixed-size tiles with images or text. Tiles reveal in a stagger and lift on hover.',
      ar: 'شبكة عصرية غير متماثلة من بطاقات بأحجام مختلفة بصور أو نصوص. تظهر بالتتابع وترتفع عند المرور.',
    },
    translatable: ['heading', 'subheading', 'tiles'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'tiles',
        type: 'repeater',
        label: { en: 'Tiles', ar: 'البطاقات' },
        fields: [
          { key: 'size', type: 'select', label: { en: 'Size', ar: 'الحجم' }, defaultValue: 'small', options: [
            { value: 'small', label: { en: 'Small (1×1)', ar: 'صغير (1×1)' } },
            { value: 'wide', label: { en: 'Wide (2×1)', ar: 'عريض (2×1)' } },
            { value: 'tall', label: { en: 'Tall (1×2)', ar: 'طويل (1×2)' } },
            { value: 'large', label: { en: 'Large (2×2)', ar: 'كبير (2×2)' } },
          ] },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'text', type: 'textarea', label: { en: 'Text', ar: 'النص' } },
          { key: 'image', type: 'image', label: { en: 'Background image (optional)', ar: 'صورة خلفية (اختياري)' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          c('bg_color', 'Tile color (no image)', 'لون البطاقة (بدون صورة)'),
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
    ],
    defaultSettings: {},
    defaultContent: {
      tiles: [
        { size: 'large', title: 'Featured', text: 'Your headline highlight goes here.' },
        { size: 'small', title: 'Fast' },
        { size: 'small', title: 'Secure' },
        { size: 'wide', title: 'Loved by thousands', text: 'Add a supporting line.' },
        { size: 'tall', title: 'Quality' },
      ],
    },
  },
  {
    // Editorial set. Mirrors multi-stores-web/.../sections/CategoryTiles.tsx:
    // translatable keys live in the per-locale content, the rest in settings.
    // A boolean reads as off when unset, so `true` defaults are written into
    // defaultSettings explicitly.
    id: 'category-tiles',
    label: L('Category tiles', 'بطاقات الفئات', 'Kategori kartları', 'Kategorie-Kacheln', 'Tuiles de catégories', 'Kategoribrickor'),
    icon: 'layout-grid',
    category: 'commerce',
    description: L(
      'Equal image cards with a title, a subtitle and a link. Good for collections and categories.',
      'بطاقات صور متساوية بعنوان وعنوان فرعي ورابط. مناسبة للمجموعات والفئات.',
      'Başlık, alt başlık ve bağlantı içeren eşit görsel kartlar. Koleksiyonlar ve kategoriler için uygundur.',
      'Gleich große Bildkarten mit Titel, Untertitel und Link. Gut für Kollektionen und Kategorien.',
      'Cartes d’images de même taille avec un titre, un sous-titre et un lien. Idéal pour les collections et les catégories.',
      'Lika stora bildkort med titel, undertitel och länk. Passar för kollektioner och kategorier.',
    ),
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'textarea', label: HEADING_LABEL, description: HEADING_MULTILINE_HINT, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: SUBHEADING_LABEL, maxLength: 240 },
      {
        key: 'items',
        type: 'repeater',
        label: L('Tiles', 'البطاقات', 'Kartlar', 'Kacheln', 'Tuiles', 'Brickor'),
        description: L(
          'Up to 12 tiles. A tile shows when it has a title or an image.',
          'حتى 12 بطاقة. تظهر البطاقة عندما يكون لها عنوان أو صورة.',
          'En fazla 12 kart. Bir kart, başlığı veya görseli olduğunda gösterilir.',
          'Bis zu 12 Kacheln. Eine Kachel erscheint, sobald sie einen Titel oder ein Bild hat.',
          'Jusqu’à 12 tuiles. Une tuile s’affiche dès qu’elle a un titre ou une image.',
          'Upp till 12 brickor. En bricka visas när den har en titel eller en bild.',
        ),
        maxItems: 12,
        fields: [
          { key: 'image', type: 'image', label: IMAGE_LABEL },
          { key: 'title', type: 'text', label: TITLE_LABEL, maxLength: 60 },
          { key: 'subtitle', type: 'text', label: L('Subtitle', 'العنوان الفرعي', 'Alt başlık', 'Untertitel', 'Sous-titre', 'Undertitel'), maxLength: 80 },
          {
            key: 'url',
            type: 'url',
            label: LINK_LABEL,
            description: L(
              'Where the tile leads, for example /collections/your-collection. Without a link the tile is not clickable.',
              'إلى أين تقود البطاقة، مثلاً /collections/your-collection. بدون رابط لا تكون البطاقة قابلة للنقر.',
              'Kartın yönlendirdiği yer, örneğin /collections/your-collection. Bağlantı yoksa kart tıklanamaz.',
              'Wohin die Kachel führt, zum Beispiel /collections/your-collection. Ohne Link ist die Kachel nicht klickbar.',
              'La destination de la tuile, par exemple /collections/your-collection. Sans lien, la tuile n’est pas cliquable.',
              'Vart brickan leder, till exempel /collections/your-collection. Utan länk går brickan inte att klicka på.',
            ),
          },
          { key: 'alt', type: 'text', label: ALT_LABEL, description: ALT_DESCRIPTION, maxLength: 160 },
        ],
      },
      {
        key: 'card_style',
        type: 'select',
        label: L('Card style', 'نمط البطاقة', 'Kart stili', 'Kartenstil', 'Style de carte', 'Kortstil'),
        defaultValue: 'caption',
        options: [
          { value: 'caption', label: L('Text below the image', 'النص تحت الصورة', 'Metin görselin altında', 'Text unter dem Bild', 'Texte sous l’image', 'Text under bilden') },
          { value: 'overlay', label: L('Text over the image', 'النص فوق الصورة', 'Metin görselin üzerinde', 'Text über dem Bild', 'Texte sur l’image', 'Text över bilden') },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: IMAGE_ASPECT_LABEL,
        defaultValue: 'square',
        options: [
          { value: 'square', label: ASPECT_SQUARE },
          { value: 'portrait', label: ASPECT_PORTRAIT },
          { value: 'landscape', label: ASPECT_LANDSCAPE },
        ],
      },
      { key: 'columns', type: 'number', label: COLUMNS_DESKTOP_LABEL, min: 2, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: COLUMNS_TABLET_LABEL, min: 2, max: 4, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: COLUMNS_MOBILE_LABEL, min: 1, max: 2, defaultValue: 2 },
      {
        key: 'mobile_scroll',
        type: 'boolean',
        label: L('Swipeable row on mobile', 'صف قابل للسحب على الجوال', 'Mobilde kaydırılabilir satır', 'Wischbare Reihe auf Mobilgeräten', 'Rangée défilante sur mobile', 'Svepbar rad på mobil'),
        description: L(
          'On phones the tiles sit in one row that is swiped sideways, instead of wrapping.',
          'على الهواتف تصطف البطاقات في صف واحد يُسحب جانبياً بدل أن تنزل إلى أسطر.',
          'Telefonlarda kartlar alt alta sarmak yerine yana kaydırılan tek bir satırda durur.',
          'Auf Smartphones stehen die Kacheln in einer Reihe, die seitlich gewischt wird, statt umzubrechen.',
          'Sur téléphone, les tuiles tiennent sur une seule rangée que l’on fait défiler, au lieu de passer à la ligne.',
          'På mobilen ligger brickorna i en rad som sveps i sidled i stället för att radbrytas.',
        ),
        defaultValue: false,
      },
      { key: 'heading_align', type: 'select', label: HEADING_ALIGN_LABEL, defaultValue: 'center', options: HEADING_ALIGN_OPTIONS },
      { key: 'heading_rule', type: 'boolean', label: HEADING_RULE_LABEL, description: HEADING_RULE_DESCRIPTION, defaultValue: false },
      {
        key: 'show_arrow',
        type: 'boolean',
        label: L('Show arrow', 'إظهار السهم', 'Oku göster', 'Pfeil anzeigen', 'Afficher la flèche', 'Visa pil'),
        defaultValue: true,
      },
      {
        key: 'card_surface',
        type: 'boolean',
        label: L('Card background', 'خلفية البطاقة', 'Kart arka planı', 'Kartenhintergrund', 'Fond de la carte', 'Kortets bakgrund'),
        description: L(
          'A soft tint behind the image and the text.',
          'لون هادئ خلف الصورة والنص.',
          'Görselin ve metnin arkasında yumuşak bir ton.',
          'Ein sanfter Ton hinter Bild und Text.',
          'Une teinte douce derrière l’image et le texte.',
          'En mjuk ton bakom bilden och texten.',
        ),
        defaultValue: true,
        showIf: { key: 'card_style', in: ['', 'caption'] },
      },
      { key: 'rounded', type: 'boolean', label: ROUNDED_LABEL, defaultValue: true },
      cL('heading_color', HEADING_COLOR_LABEL),
      cL('subheading_color', SUBHEADING_COLOR_LABEL),
      cL('title_color', L('Tile title color', 'لون عنوان البطاقة', 'Kart başlığı rengi', 'Farbe des Kacheltitels', 'Couleur du titre de la tuile', 'Brickans titelfärg')),
      cL('subtitle_color', L('Tile subtitle color', 'لون العنوان الفرعي للبطاقة', 'Kart alt başlığı rengi', 'Farbe des Kacheluntertitels', 'Couleur du sous-titre de la tuile', 'Brickans undertitelfärg')),
      cL('arrow_bg_color', L('Arrow background', 'خلفية السهم', 'Ok arka planı', 'Pfeil-Hintergrund', 'Fond de la flèche', 'Pilens bakgrund')),
      cL('arrow_color', L('Arrow color', 'لون السهم', 'Ok rengi', 'Pfeilfarbe', 'Couleur de la flèche', 'Pilens färg')),
    ],
    defaultSettings: {
      card_style: 'caption',
      aspect: 'square',
      columns: 4,
      columns_tablet: 3,
      columns_mobile: 2,
      mobile_scroll: false,
      heading_align: 'center',
      heading_rule: false,
      show_arrow: true,
      card_surface: true,
      rounded: true,
    },
    defaultContent: {
      heading: 'Shop by category',
      items: [
        { title: 'New in', subtitle: 'The latest arrivals', url: '/products' },
        { title: 'Clothing', subtitle: 'Everyday pieces', url: '/products' },
        { title: 'Accessories', subtitle: 'Finishing touches', url: '/products' },
        { title: 'Gifts', subtitle: 'Something for everyone', url: '/products' },
      ],
    },
  },
  {
    id: 'animated-features',
    label: { en: 'Animated Features', ar: 'مميزات متحرّكة' },
    icon: 'sparkles',
    category: 'content',
    description: {
      en: 'A row of features whose line-art SVG icons draw themselves when scrolled into view.',
      ar: 'صف من المميزات بأيقونات SVG خطية ترسم نفسها عند ظهورها أثناء التمرير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      n('columns', 'Columns', 'الأعمدة', { min: 2, max: 4, defaultValue: 4 }),
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Features', ar: 'المميزات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: [
            { value: 'bolt', label: { en: 'Bolt', ar: 'برق' } },
            { value: 'heart', label: { en: 'Heart', ar: 'قلب' } },
            { value: 'star', label: { en: 'Star', ar: 'نجمة' } },
            { value: 'gift', label: { en: 'Gift', ar: 'هدية' } },
            { value: 'shield', label: { en: 'Shield', ar: 'درع' } },
            { value: 'truck', label: { en: 'Truck', ar: 'شاحنة' } },
            { value: 'check', label: { en: 'Check', ar: 'صح' } },
            { value: 'spark', label: { en: 'Spark', ar: 'بريق' } },
          ] },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      c('icon_color', 'Icon color', 'لون الأيقونة'),
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
      c('title_color', 'Feature title color', 'لون عنوان الميزة'),
      c('description_color', 'Feature description color', 'لون وصف الميزة'),
    ],
    defaultSettings: { columns: 4 },
    defaultContent: {
      items: [
        { icon: 'bolt', title: 'Lightning fast', description: 'Built for speed from the ground up.' },
        { icon: 'shield', title: 'Secure', description: 'Protected with bank-level encryption.' },
        { icon: 'heart', title: 'Loved', description: 'Trusted by thousands of customers.' },
        { icon: 'spark', title: 'Delightful', description: 'Thoughtful details in every corner.' },
      ],
    },
  },
  {
    id: 'marquee-text',
    label: { en: 'Marquee Text', ar: 'نص متحرّك' },
    icon: 'type',
    category: 'showcase',
    description: {
      en: 'A bold oversized phrase that scrolls across the screen on a loop. Pauses on hover.',
      ar: 'عبارة ضخمة جريئة تمرّ أفقياً عبر الشاشة بشكل متكرّر. تتوقف عند المرور.',
    },
    translatable: ['text'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 60 },
      { key: 'separator', type: 'text', label: { en: 'Separator', ar: 'الفاصل' }, maxLength: 3, defaultValue: '✦' },
      {
        key: 'size',
        type: 'select',
        label: { en: 'Size', ar: 'الحجم' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'xl', label: { en: 'Extra large', ar: 'ضخم' } },
        ],
      },
      {
        key: 'speed',
        type: 'select',
        label: { en: 'Speed', ar: 'السرعة' },
        defaultValue: 'normal',
        options: [
          { value: 'slow', label: { en: 'Slow', ar: 'بطيء' } },
          { value: 'normal', label: { en: 'Normal', ar: 'متوسط' } },
          { value: 'fast', label: { en: 'Fast', ar: 'سريع' } },
        ],
      },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مصمت' } },
          { value: 'outline', label: { en: 'Outline', ar: 'مفرّغ' } },
        ],
      },
      c('text_color', 'Text color', 'لون النص'),
      c('bg_color', 'Background color', 'لون الخلفية'),
    ],
    defaultSettings: { separator: '✦', size: 'lg', speed: 'normal', style: 'solid' },
    defaultContent: { text: 'Welcome to our store' },
  },
  {
    id: 'rich-text',
    label: { en: 'Rich Text', ar: 'نص منسّق' },
    icon: 'text',
    category: 'content',
    description: {
      en: 'Long-form content with optional eyebrow, heading, and surface card style.',
      ar: 'محتوى مطوّل مع تسمية وعنوان وخيار بطاقة ملوّنة.',
    },
    translatable: ['eyebrow', 'heading', 'html'],
    schema: [
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'html', type: 'richtext', label: { en: 'Content', ar: 'المحتوى' }, showIf: STATIC_CONTENT_SHOW_IF },
      ...CONTENT_SOURCE_FIELDS,
      {
        key: 'width',
        type: 'select',
        label: { en: 'Content width', ar: 'عرض المحتوى' },
        defaultValue: 'normal',
        options: [
          { value: 'narrow', label: { en: 'Narrow', ar: 'ضيّق' } },
          { value: 'normal', label: { en: 'Normal', ar: 'عادي' } },
          { value: 'wide', label: { en: 'Wide', ar: 'واسع' } },
          { value: 'full', label: { en: 'Full width', ar: 'كامل العرض' } },
        ],
      },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'left', options: [
        { value: 'left', label: { en: 'Left', ar: 'يسار' } },
        { value: 'center', label: { en: 'Center', ar: 'وسط' } },
      ] },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Vertical padding', ar: 'الحشو العمودي' },
        defaultValue: 'medium',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'small', label: { en: 'Small', ar: 'صغير' } },
          { value: 'medium', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'large', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'surface', type: 'boolean', label: { en: 'Card background', ar: 'خلفية بطاقة' }, defaultValue: false },
    ],
    defaultSettings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
    defaultContent: {
      heading: 'About us',
      html: '<p>Tell your story here. This block supports rich formatting — headings, links, lists.</p>',
    },
  },
  {
    id: 'image-gallery',
    label: { en: 'Image Gallery', ar: 'معرض صور' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Visual grid, masonry or horizontal carousel. Each image can link and reveal a caption.',
      ar: 'شبكة، Masonry، أو شريط أفقي. كل صورة قابلة للربط مع تسمية تظهر عند المرور.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
          { value: 'masonry', label: { en: 'Masonry', ar: 'Masonry' } },
          { value: 'carousel', label: { en: 'Horizontal carousel', ar: 'شريط أفقي' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'auto', label: { en: 'Original', ar: 'الأصلي' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop (grid)', ar: 'الأعمدة — سطح المكتب (للشبكة)' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'show_caption', type: 'boolean', label: { en: 'Show captions on hover', ar: 'تسميات عند المرور' }, defaultValue: true },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'url', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية' } },
          { key: 'href', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
    defaultSettings: { layout: 'grid', aspect: 'square', columns: 3, columns_tablet: 2, columns_mobile: 2, show_caption: true, rounded: true },
    defaultContent: {
      heading: 'Gallery',
    },
  },
  {
    id: 'gallery-slider',
    label: { en: 'Gallery Slider', ar: 'سلايدر معرض الصور' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Horizontal image carousel. Independent slides-per-view per device, optional autoplay, captions on hover.',
      ar: 'شريط صور أفقي. عدد شرائح مستقل لكل جهاز، تشغيل تلقائي اختياري، تسميات عند المرور.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'slides_per_view', type: 'number', label: { en: 'Slides per view — desktop', ar: 'عدد الشرائح — سطح المكتب' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'slides_per_view_tablet', type: 'number', label: { en: 'Slides per view — tablet', ar: 'عدد الشرائح — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'slides_per_view_mobile', type: 'number', label: { en: 'Slides per view — mobile', ar: 'عدد الشرائح — جوال' }, min: 1, max: 4, defaultValue: 1 },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between slides (px)', ar: 'الفجوة بين الشرائح (px)' }, min: 0, max: 64, defaultValue: 16 },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      { key: 'show_caption', type: 'boolean', label: { en: 'Show captions on hover', ar: 'إظهار التسميات عند المرور' }, defaultValue: true },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 0 },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: true },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: false },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'url', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية' } },
          { key: 'href', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
    defaultSettings: {
      slides_per_view: 3,
      slides_per_view_tablet: 2,
      slides_per_view_mobile: 1,
      gap_px: 16,
      aspect: 'square',
      show_caption: true,
      rounded: true,
      autoplay_ms: 0,
      show_arrows: true,
      show_dots: true,
      loop: false,
    },
  },
  {
    id: 'masonry-gallery',
    label: { en: 'Masonry Gallery', ar: 'معرض متراصف' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Pinterest-style masonry of images at their natural heights, with captions and an optional lightbox.',
      ar: 'معرض متراصف بنمط Pinterest بصور بارتفاعها الطبيعي، مع تسميات ونافذة عرض مكبّرة اختيارية.',
    },
    translatable: ['heading', 'subheading', 'images'],
    schema: [
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'enable_lightbox', type: 'boolean', label: { en: 'Open images in a lightbox', ar: 'فتح الصور في نافذة مكبّرة' }, defaultValue: true },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'images',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'التسمية' }, maxLength: 120 },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { columns: 3, enable_lightbox: true },
    defaultContent: {
      heading: 'From our world',
      subheading: 'A rolling gallery of the products, people, and places that inspire us.',
      images: [
        { caption: 'Morning light in the studio' },
        { caption: 'Details worth slowing down for' },
        { caption: 'Behind the scenes of the new drop' },
        { caption: 'Our favorite corner of the workshop' },
      ],
    },
  },
  {
    id: 'image-with-text',
    label: { en: 'Image with Text', ar: 'صورة مع نص' },
    icon: 'columns',
    category: 'content',
    description: {
      en: '50/50 image and text. Common for "About", "Story", or feature spotlights.',
      ar: 'صورة 50/50 مع نص. مناسب لـ "من نحن"، "قصتنا"، أو ميزة.',
    },
    // `cta_secondary_text` and `alt` are the additions; URL keys stay in settings.
    translatable: ['eyebrow', 'heading', 'body', 'cta_text', 'cta_secondary_text', 'alt'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: STATIC_IMAGE_SHOW_IF },
      // Alt text of the uploaded image, in both styles. Unset = empty alt, as before.
      { key: 'alt', type: 'text', label: ALT_LABEL, description: ALT_DESCRIPTION, maxLength: 160, showIf: STATIC_IMAGE_SHOW_IF },
      ...IMAGE_SOURCE_FIELDS,
      {
        // Stored values stay 'left' / 'right': 'left' is the inline start and
        // 'right' the inline end (the storefront places the image through
        // grid order, so it mirrors in a right-to-left language).
        key: 'image_position',
        type: 'select',
        label: { en: 'Image position', ar: 'موقع الصورة' },
        defaultValue: 'left',
        options: [
          { value: 'left', label: START_LABEL },
          { value: 'right', label: END_LABEL },
        ],
      },
      {
        // Unset = framed (as before). 'bleed' applies to an uploaded image
        // only; with a product image source the storefront keeps the framed
        // layout.
        key: 'image_style',
        type: 'select',
        label: L('Image style', 'نمط الصورة', 'Görsel stili', 'Bildstil', 'Style de l’image', 'Bildstil'),
        description: L(
          'Framed keeps the image inside the page width. Edge to edge runs it to the side of the screen (uploaded images only).',
          'المؤطَّر يُبقي الصورة داخل عرض الصفحة. من الحافة إلى الحافة يمدّها حتى طرف الشاشة (للصور المرفوعة فقط).',
          'Çerçeveli, görseli sayfa genişliği içinde tutar. Kenardan kenara, onu ekranın kenarına kadar uzatır (yalnızca yüklenen görseller).',
          'Gerahmt hält das Bild innerhalb der Seitenbreite. Randlos führt es bis an den Bildschirmrand (nur hochgeladene Bilder).',
          'Encadré garde l’image à l’intérieur de la largeur de page. Bord à bord l’étend jusqu’au bord de l’écran (images importées uniquement).',
          'Inramad håller bilden inom sidbredden. Kant till kant drar ut den till skärmens kant (endast uppladdade bilder).',
        ),
        defaultValue: 'framed',
        options: [
          { value: 'framed', label: L('Framed', 'مؤطَّر', 'Çerçeveli', 'Gerahmt', 'Encadré', 'Inramad') },
          { value: 'bleed', label: L('Edge to edge', 'من الحافة إلى الحافة', 'Kenardan kenara', 'Randlos', 'Bord à bord', 'Kant till kant') },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect', ar: 'نسبة الصورة' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      {
        key: 'min_height',
        type: 'select',
        label: L('Minimum height', 'أدنى ارتفاع', 'En az yükseklik', 'Mindesthöhe', 'Hauteur minimale', 'Minsta höjd'),
        description: L(
          'On tablets and computers. On phones the image keeps the aspect chosen above.',
          'على التابلت والحاسوب. على الهواتف تحتفظ الصورة بالنسبة المختارة في الأعلى.',
          'Tablet ve bilgisayarda. Telefonlarda görsel yukarıda seçilen oranı korur.',
          'Auf Tablets und Computern. Auf Smartphones behält das Bild das oben gewählte Format.',
          'Sur tablette et ordinateur. Sur téléphone, l’image garde le format choisi ci-dessus.',
          'På surfplatta och dator. På mobilen behåller bilden formatet som valts ovan.',
        ),
        defaultValue: 'md',
        showIf: { key: 'image_style', in: ['bleed'] },
        options: [
          { value: 'sm', label: L('Small (360px)', 'صغير (360px)', 'Küçük (360px)', 'Klein (360px)', 'Petite (360px)', 'Liten (360px)') },
          { value: 'md', label: L('Medium (480px)', 'متوسط (480px)', 'Orta (480px)', 'Mittel (480px)', 'Moyenne (480px)', 'Medel (480px)') },
          { value: 'lg', label: L('Large (600px)', 'كبير (600px)', 'Büyük (600px)', 'Groß (600px)', 'Grande (600px)', 'Stor (600px)') },
        ],
      },
      {
        key: 'image_focus',
        type: 'select',
        label: IMAGE_FOCUS_LABEL,
        description: IMAGE_FOCUS_DESCRIPTION,
        defaultValue: 'center',
        showIf: { key: 'image_style', in: ['bleed'] },
        options: FOCUS_OPTIONS,
      },
      {
        key: 'tone',
        type: 'select',
        label: TONE_LABEL,
        defaultValue: 'none',
        showIf: { key: 'image_style', in: ['bleed'] },
        options: TONE_OPTIONS,
      },
      cL('bg_color', BG_COLOR_LABEL, { description: BG_COLOR_DESCRIPTION, showIf: { key: 'image_style', in: ['bleed'] } }),
      {
        key: 'edge',
        type: 'select',
        label: EDGE_LABEL,
        defaultValue: 'hard',
        showIf: { key: 'image_style', in: ['bleed'] },
        options: EDGE_OPTIONS,
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'textarea', label: { en: 'Heading', ar: 'العنوان' }, description: HEADING_MULTILINE_BLEED_HINT },
      { key: 'body', type: 'textarea', label: { en: 'Body text', ar: 'النص' } },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' } },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      // Second button, both styles. It appears only when it has a text.
      {
        key: 'cta_secondary_text',
        type: 'text',
        label: L('Second button text', 'نص الزر الثاني', 'İkinci buton metni', 'Text des zweiten Buttons', 'Texte du second bouton', 'Text på andra knappen'),
        description: L(
          'The second button shows only when this text is filled in.',
          'يظهر الزر الثاني فقط عند تعبئة هذا النص.',
          'İkinci buton yalnızca bu metin doldurulduğunda görünür.',
          'Der zweite Button erscheint nur, wenn dieser Text ausgefüllt ist.',
          'Le second bouton n’apparaît que si ce texte est renseigné.',
          'Den andra knappen visas bara när den här texten är ifylld.',
        ),
        maxLength: 40,
      },
      {
        key: 'cta_secondary_url',
        type: 'url',
        label: L('Second button URL', 'رابط الزر الثاني', 'İkinci buton bağlantısı', 'URL des zweiten Buttons', 'URL du second bouton', 'Länk för andra knappen'),
      },
      // Both styles. Unset or 'primary' = the button as it was.
      {
        key: 'cta_tone',
        type: 'select',
        label: CTA_TONE_LABEL,
        description: CTA_TONE_DESCRIPTION,
        defaultValue: 'primary',
        options: CTA_TONE_OPTIONS,
      },
      ...textColorFields({ eyebrow: true, heading: true, body: true }),
      ...buttonStyleFields('cta'),
      ...buttonStyleFieldsL('cta_secondary', SECONDARY_SUFFIX),
    ],
    defaultSettings: { image_position: 'left', aspect: 'square' },
    defaultContent: {
      eyebrow: 'Our story',
      heading: 'Crafted with care',
      body: 'Replace this with a short paragraph about your brand, process, or mission.',
      cta_text: 'Learn more',
    },
  },
  {
    id: 'single-image',
    label: { en: 'Image', ar: 'صورة', tr: 'Görsel', de: 'Bild', fr: 'Image', sv: 'Bild' },
    icon: 'image',
    category: 'content',
    description: {
      en: 'A single image. On the product template it can show the product or selected variant image.',
      ar: 'صورة واحدة. في قالب المنتج يمكن أن تعرض صورة المنتج أو صورة الخيار المحدد.',
      tr: 'Tek bir görsel. Ürün şablonunda ürünün veya seçili varyantın görselini gösterebilir.',
      de: 'Ein einzelnes Bild. In der Produktvorlage kann es das Produktbild oder das Bild der gewählten Variante zeigen.',
      fr: 'Une seule image. Sur le modèle de produit, elle peut afficher l’image du produit ou de la variante choisie.',
      sv: 'En enda bild. I produktmallen kan den visa produktens bild eller den valda variantens bild.',
    },
    translatable: ['alt'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: STATIC_IMAGE_SHOW_IF },
      ...IMAGE_SOURCE_FIELDS,
      IMAGE_SIZE_FIELD,
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'زوايا مستديرة', tr: 'Yuvarlak köşeler', de: 'Abgerundete Ecken', fr: 'Coins arrondis', sv: 'Rundade hörn' }, defaultValue: true },
      { key: 'link_url', type: 'url', label: { en: 'Link', ar: 'الرابط', tr: 'Bağlantı', de: 'Link', fr: 'Lien', sv: 'Länk' } },
      { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل', tr: 'Alternatif metin', de: 'Alt-Text', fr: 'Texte alternatif', sv: 'Alt-text' } },
    ],
    defaultSettings: { image_source: 'static', aspect: 'auto', fit: 'cover', rounded: true },
    defaultContent: {},
  },
  {
    id: 'quote-banner',
    label: { en: 'Quote Banner', ar: 'بانر اقتباس' },
    icon: 'quote',
    category: 'content',
    description: {
      en: 'A single large pull-quote with author and role — a calm, editorial break between sections.',
      ar: 'اقتباس واحد كبير مع اسم القائل وصفته — استراحة هادئة بطابع تحريري بين الأقسام.',
    },
    translatable: ['quote', 'author', 'role'],
    schema: [
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
      { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' }, maxLength: 300 },
      { key: 'author', type: 'text', label: { en: 'Author', ar: 'القائل' }, maxLength: 60 },
      { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' }, maxLength: 60 },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { alignment: 'center' },
    defaultContent: {
      quote: "We don't chase trends. We build things worth keeping — and let the work speak for itself.",
      author: 'Sofia Bergman',
      role: 'Founder & Creative Director',
    },
  },
  {
    id: 'faq-list',
    label: { en: 'FAQ List', ar: 'الأسئلة الشائعة' },
    icon: 'help',
    category: 'content',
    description: {
      en: 'Smooth-animated accordion. One or two columns; single or multiple open.',
      ar: 'أكورديون بحركة ناعمة. عمود أو عمودان.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'stacked',
        options: [
          { value: 'stacked', label: { en: 'Stacked (1 column)', ar: 'عمود واحد' } },
          { value: 'two-column', label: { en: 'Two columns', ar: 'عمودان' } },
        ],
      },
      { key: 'allow_multiple', type: 'boolean', label: { en: 'Allow multiple open', ar: 'السماح بفتح عدة' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Questions', ar: 'الأسئلة' },
        fields: [
          { key: 'question', type: 'text', label: { en: 'Question', ar: 'السؤال' } },
          { key: 'answer', type: 'textarea', label: { en: 'Answer', ar: 'الإجابة' } },
        ],
      },
    ],
    defaultSettings: { layout: 'stacked', allow_multiple: true },
    defaultContent: {
      heading: 'Frequently asked questions',
      items: [
        { question: 'How long does shipping take?', answer: 'Most orders arrive within 3–5 business days.' },
        { question: 'What is your return policy?', answer: 'We accept returns within 30 days of delivery.' },
        { question: 'Do you ship internationally?', answer: 'Yes — international shipping rates appear at checkout.' },
      ],
    },
  },
  {
    id: 'call-to-action',
    label: { en: 'Call to Action', ar: 'دعوة لإجراء' },
    icon: 'megaphone',
    category: 'showcase',
    description: {
      en: 'Highlighted block with a button. Four styles: solid, gradient, image background, or split.',
      ar: 'بطاقة بارزة مع زر. أربعة أنماط.',
    },
    translatable: ['heading', 'subheading', 'cta_text'],
    schema: [
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid color', ar: 'لون صلب' } },
          { value: 'gradient', label: { en: 'Gradient', ar: 'تدرّج' } },
          { value: 'image-bg', label: { en: 'Image background', ar: 'صورة كخلفية' } },
          { value: 'split', label: { en: 'Split (text + image)', ar: 'منقسم' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 100 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      ...textColorFields({ heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { style: 'solid' },
    defaultContent: {
      heading: 'Ready to start?',
      subheading: 'Browse the full collection and find something you love.',
      cta_text: 'Shop now',
    },
  },
  {
    id: 'sticky-cta-bar',
    label: { en: 'Sticky CTA Bar', ar: 'شريط دعوة لاصق' },
    icon: 'megaphone',
    category: 'showcase',
    description: {
      en: 'A call-to-action bar that slides up and pins to the bottom of the screen after the visitor scrolls. Dismissible.',
      ar: 'شريط دعوة لإجراء ينزلق ويلتصق بأسفل الشاشة بعد أن يمرّر الزائر. قابل للإغلاق.',
    },
    translatable: ['text', 'cta_text'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 120 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      n('show_after_px', 'Show after scrolling (px)', 'يظهر بعد التمرير (px)', { min: 0, max: 4000, defaultValue: 500 }),
      { key: 'show_close', type: 'boolean', label: { en: 'Show dismiss button', ar: 'إظهار زر الإغلاق' }, defaultValue: true },
      c('bar_bg_color', 'Bar background', 'خلفية الشريط'),
      c('text_color', 'Text color', 'لون النص'),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { show_after_px: 500, show_close: true },
    defaultContent: { text: 'Ready to get started?', cta_text: 'Shop now' },
  },
  {
    id: 'trust-badges',
    label: { en: 'Trust Badges', ar: 'شارات الثقة' },
    icon: 'shield',
    category: 'social',
    description: {
      en: 'Row of reassurance points (shipping, returns, payment). Cards or inline.',
      ar: 'صف من نقاط الثقة. بطاقات أو سطر.',
    },
    translatable: ['items'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'cards',
        options: [
          { value: 'cards', label: { en: 'Cards', ar: 'بطاقات' } },
          { value: 'inline', label: { en: 'Inline row', ar: 'سطر' } },
          // One row of line icons with thin dividers (two per row on phones).
          { value: 'strip', label: L('Strip', 'شريط', 'Şerit', 'Leiste', 'Bandeau', 'Remsa') },
        ],
      },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Padding', ar: 'الحشو' },
        defaultValue: 'comfortable',
        options: [
          { value: 'compact', label: { en: 'Compact', ar: 'مدمج' } },
          { value: 'comfortable', label: { en: 'Comfortable', ar: 'مريح' } },
        ],
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Badges', ar: 'الشارات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: TRUST_BADGE_ICON_OPTIONS },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      cL('icon_color', L('Icon color', 'لون الأيقونة', 'Simge rengi', 'Symbolfarbe', 'Couleur de l’icône', 'Ikonfärg'), {
        showIf: { key: 'layout', in: ['strip'] },
      }),
    ],
    defaultSettings: { layout: 'cards', padding: 'comfortable' },
    defaultContent: {
      items: [
        { icon: 'shield', label: 'Secure payment', description: 'Card payments via Stripe' },
        { icon: 'refresh', label: '30-day returns', description: 'Easy and free' },
        { icon: 'shield', label: 'Secure checkout', description: 'Protected payments' },
        { icon: 'headphones', label: 'Friendly support', description: 'Available 7 days a week' },
      ],
    },
  },
  {
    id: 'newsletter-signup',
    label: { en: 'Newsletter Signup', ar: 'الاشتراك بالنشرة' },
    icon: 'mail',
    category: 'social',
    description: {
      en: 'Email capture form. Three styles: surface card, plain inline, or gradient banner.',
      ar: 'نموذج بريد إلكتروني. ثلاثة أنماط.',
    },
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'FOOTER'],
    translatable: ['heading', 'subheading', 'placeholder', 'button_label', 'success_message'],
    schema: [
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'card',
        options: [
          { value: 'card', label: { en: 'Card', ar: 'بطاقة' } },
          { value: 'inline', label: { en: 'Inline', ar: 'سطر' } },
          { value: 'banner', label: { en: 'Banner', ar: 'بانر' } },
        ],
      },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'placeholder', type: 'text', label: { en: 'Input placeholder', ar: 'النص داخل الحقل' } },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
      { key: 'success_message', type: 'text', label: { en: 'Success message', ar: 'رسالة النجاح' } },
      ...textColorFields({ heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: { style: 'card' },
    defaultContent: {
      heading: 'Join our newsletter',
      subheading: 'Get exclusive offers and product launches straight to your inbox.',
      placeholder: 'your@email.com',
      button_label: 'Subscribe',
      success_message: "Thanks — you're subscribed.",
    },
  },
  {
    id: 'social-icons',
    label: { en: 'Social Icons', ar: 'أيقونات التواصل الاجتماعي' },
    icon: 'share',
    category: 'social',
    description: {
      en: '18 platforms (Instagram, TikTok, X, …) with brand colors or your own palette. Horizontal/vertical/grid layouts, three shapes, hover effects.',
      ar: '18 منصّة (إنستغرام، تيك توك، إكس، …) بألوان كل منصّة أو لوحة ألوانك. تخطيطات أفقي/عمودي/شبكة، ثلاثة أشكال، تأثيرات تمرير.',
    },
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'HEADER', 'FOOTER'],
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading (optional)', ar: 'العنوان الفرعي (اختياري)' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Social links', ar: 'الروابط الاجتماعية' },
        fields: [
          {
            key: 'platform',
            type: 'select',
            label: { en: 'Platform', ar: 'المنصّة' },
            defaultValue: 'instagram',
            options: SOCIAL_PLATFORM_OPTIONS,
          },
          { key: 'url', type: 'text', label: { en: 'URL or handle', ar: 'الرابط أو المُعرّف' } },
          { key: 'label', type: 'text', label: { en: 'Custom label (optional)', ar: 'تسمية مخصّصة (اختياري)' } },
        ],
      },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'horizontal',
        options: [
          { value: 'horizontal', label: { en: 'Horizontal row', ar: 'صف أفقي' } },
          { value: 'vertical', label: { en: 'Vertical stack', ar: 'عمود عمودي' } },
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
        ],
      },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between icons (px)', ar: 'المسافة بين الأيقونات (px)' }, min: 0, max: 80, defaultValue: 12 },
      {
        key: 'icon_style',
        type: 'select',
        label: { en: 'Icon style', ar: 'نمط الأيقونة' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid chip', ar: 'بطاقة ملوّنة' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
          { value: 'plain', label: { en: 'Plain (no chip)', ar: 'بدون بطاقة' } },
        ],
      },
      {
        key: 'icon_shape',
        type: 'select',
        label: { en: 'Shape', ar: 'الشكل' },
        defaultValue: 'circle',
        options: [
          { value: 'circle', label: { en: 'Circle', ar: 'دائري' } },
          { value: 'rounded', label: { en: 'Rounded square', ar: 'مربع مدوّر' } },
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
        ],
      },
      {
        key: 'size',
        type: 'select',
        label: { en: 'Size preset', ar: 'الحجم' },
        defaultValue: 'md',
        options: [
          { value: 'xs', label: { en: 'XS (28px)', ar: 'صغير جداً (28px)' } },
          { value: 'sm', label: { en: 'Small (36px)', ar: 'صغير (36px)' } },
          { value: 'md', label: { en: 'Medium (44px)', ar: 'متوسط (44px)' } },
          { value: 'lg', label: { en: 'Large (56px)', ar: 'كبير (56px)' } },
          { value: 'xl', label: { en: 'XL (72px)', ar: 'كبير جداً (72px)' } },
        ],
      },
      { key: 'size_px', type: 'number', label: { en: 'Custom size (px, overrides preset)', ar: 'حجم مخصّص (px، يلغي الحجم المختار)' }, min: 16, max: 200 },
      {
        key: 'color_mode',
        type: 'select',
        label: { en: 'Color mode', ar: 'وضع الألوان' },
        defaultValue: 'brand',
        options: [
          { value: 'brand', label: { en: 'Brand colors (per platform)', ar: 'ألوان كل منصّة' } },
          { value: 'theme-primary', label: { en: 'Theme primary', ar: 'اللون الأساسي للثيم' } },
          { value: 'theme-accent', label: { en: 'Theme accent', ar: 'لون التمييز للثيم' } },
          { value: 'theme-text', label: { en: 'Theme text', ar: 'لون نص الثيم' } },
          { value: 'custom', label: { en: 'Custom', ar: 'مخصّص' } },
        ],
      },
      { key: 'custom_color', type: 'color', label: { en: 'Custom icon color', ar: 'لون الأيقونة المخصّص' } },
      { key: 'custom_bg_color', type: 'color', label: { en: 'Custom chip background (solid style)', ar: 'خلفية البطاقة المخصّصة (نمط مملوء)' } },
      {
        key: 'label_mode',
        type: 'select',
        label: { en: 'Show platform name', ar: 'إظهار اسم المنصّة' },
        defaultValue: 'never',
        options: [
          { value: 'never', label: { en: 'Never', ar: 'أبداً' } },
          { value: 'hover', label: { en: 'On hover', ar: 'عند المرور' } },
          { value: 'always', label: { en: 'Always', ar: 'دائماً' } },
        ],
      },
      {
        key: 'hover_effect',
        type: 'select',
        label: { en: 'Hover effect', ar: 'تأثير التمرير' },
        defaultValue: 'scale',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'scale', label: { en: 'Scale up', ar: 'تكبير' } },
          { value: 'lift', label: { en: 'Lift', ar: 'رفع' } },
          { value: 'invert', label: { en: 'Fade (solid only)', ar: 'تلاشٍ (للنمط المملوء فقط)' } },
        ],
      },
      { key: 'open_in_new_tab', type: 'boolean', label: { en: 'Open links in new tab', ar: 'فتح الروابط في نافذة جديدة' }, defaultValue: true },
      { key: 'nofollow', type: 'boolean', label: { en: 'Add rel="nofollow"', ar: 'إضافة rel="nofollow"' }, defaultValue: false },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: {
      layout: 'horizontal',
      alignment: 'center',
      gap_px: 12,
      icon_style: 'solid',
      icon_shape: 'circle',
      size: 'md',
      color_mode: 'brand',
      label_mode: 'never',
      hover_effect: 'scale',
      open_in_new_tab: true,
      nofollow: false,
    },
    defaultContent: {
      items: [
        { platform: 'instagram', url: 'https://instagram.com/' },
        { platform: 'facebook', url: 'https://facebook.com/' },
        { platform: 'tiktok', url: 'https://tiktok.com/' },
        { platform: 'whatsapp', url: 'https://wa.me/' },
      ],
    },
  },
  {
    id: 'testimonials',
    label: { en: 'Testimonials', ar: 'آراء العملاء' },
    icon: 'quote',
    category: 'social',
    description: {
      en: 'Customer quotes with name, role, avatar and star rating. Cards or plain layout.',
      ar: 'اقتباسات العملاء مع الاسم والصفة والصورة والتقييم بالنجوم. بطاقات أو تخطيط بسيط.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'cards',
        options: [
          { value: 'cards', label: { en: 'Cards', ar: 'بطاقات' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
        ],
      },
      n('columns', 'Columns', 'الأعمدة', { min: 1, max: 4, defaultValue: 3 }),
      { key: 'show_rating', type: 'boolean', label: { en: 'Show star rating', ar: 'إظهار التقييم بالنجوم' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Testimonials', ar: 'الآراء' },
        fields: [
          { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' } },
          { key: 'author', type: 'text', label: { en: 'Author name', ar: 'اسم صاحب الرأي' } },
          { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' } },
          { key: 'avatar', type: 'image', label: { en: 'Avatar', ar: 'الصورة' } },
          { key: 'rating', type: 'number', label: { en: 'Rating (0–5)', ar: 'التقييم (0–5)' }, min: 0, max: 5, defaultValue: 5 },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
      c('star_color', 'Star color', 'لون النجوم'),
      c('star_empty_color', 'Empty star color', 'لون النجوم الفارغة'),
      c('quote_icon_color', 'Quote icon color', 'لون أيقونة الاقتباس'),
      c('quote_color', 'Quote text color', 'لون نص الاقتباس'),
      c('author_color', 'Author name color', 'لون اسم الكاتب'),
      c('role_color', 'Role / company color', 'لون الصفة / الشركة'),
      c('card_bg_color', 'Card background (cards layout)', 'خلفية البطاقة (تخطيط البطاقات)'),
      c('card_border_color', 'Card border (cards layout)', 'حد البطاقة (تخطيط البطاقات)'),
    ],
    defaultSettings: { layout: 'cards', columns: 3, show_rating: true },
    defaultContent: {
      heading: 'What our customers say',
      items: [
        { quote: 'Absolutely love the quality — exceeded my expectations.', author: 'Sarah M.', role: 'Verified buyer', rating: 5 },
        { quote: 'Fast shipping and great support. Will order again.', author: 'Ahmed K.', role: 'Verified buyer', rating: 5 },
        { quote: 'Beautiful products at a fair price. Highly recommend.', author: 'Lena P.', role: 'Verified buyer', rating: 4 },
      ],
    },
  },
  {
    id: 'testimonial-carousel',
    label: { en: 'Testimonial Carousel', ar: 'سلايدر آراء العملاء' },
    icon: 'quote',
    category: 'social',
    description: {
      en: 'One large rotating testimonial at a time — quote, avatar, name, role and star rating, with autoplay.',
      ar: 'رأي واحد كبير يتبدّل تلقائياً — اقتباس وصورة واسم وصفة وتقييم بالنجوم، مع تشغيل تلقائي.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 6000 },
      { key: 'show_rating', type: 'boolean', label: { en: 'Show star rating', ar: 'إظهار التقييم بالنجوم' }, defaultValue: true },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Testimonials', ar: 'الآراء' },
        fields: [
          { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' }, maxLength: 300 },
          { key: 'author', type: 'text', label: { en: 'Author name', ar: 'اسم صاحب الرأي' }, maxLength: 60 },
          { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' }, maxLength: 60 },
          { key: 'avatar', type: 'image', label: { en: 'Avatar', ar: 'الصورة' } },
          { key: 'rating', type: 'number', label: { en: 'Rating (1–5)', ar: 'التقييم (1–5)' }, min: 1, max: 5, defaultValue: 5 },
        ],
      },
      ...textColorFields({ heading: true }),
    ],
    defaultSettings: { autoplay_ms: 6000, show_rating: true, show_arrows: true },
    defaultContent: {
      heading: 'Loved by thousands',
      items: [
        { quote: "I've tried a dozen alternatives and nothing comes close. The quality is unreal for the price — I'm a customer for life.", author: 'Maya R.', role: 'Verified buyer', rating: 5 },
        { quote: 'From checkout to delivery, the whole experience felt premium. My order arrived two days early, beautifully packaged.', author: 'James T.', role: 'Verified buyer', rating: 5 },
        { quote: 'Support replied within minutes and sorted out my sizing swap for free. That kind of service is rare these days.', author: 'Aisha B.', role: 'Verified buyer', rating: 5 },
        { quote: 'Six months of daily use and it still looks brand new. Easily the best purchase I have made this year.', author: 'Daniel K.', role: 'Verified buyer', rating: 4 },
      ],
    },
  },
  {
    id: 'logo-list',
    label: { en: 'Logo List', ar: 'قائمة الشعارات' },
    icon: 'image',
    category: 'social',
    description: {
      en: 'Row of partner or brand logos. Optional grayscale that colours on hover.',
      ar: 'صف من شعارات الشركاء أو الماركات. خيار تدرّج رمادي يتلوّن عند المرور.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      n('columns', 'Columns', 'الأعمدة', { min: 2, max: 8, defaultValue: 5 }),
      { key: 'grayscale', type: 'boolean', label: { en: 'Grayscale (colour on hover)', ar: 'رمادي (يتلوّن عند المرور)' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Logos', ar: 'الشعارات' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Logo image', ar: 'صورة الشعار' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل' } },
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
    ],
    defaultSettings: { columns: 5, grayscale: true },
    defaultContent: { heading: 'Trusted by leading brands', items: [] },
  },
  {
    id: 'logo-marquee',
    label: { en: 'Logo Marquee', ar: 'شريط شعارات متحرك' },
    icon: 'image',
    category: 'social',
    description: {
      en: 'Auto-scrolling row of partner or brand logos. Pauses on hover; grayscale colours on hover.',
      ar: 'صف شعارات يتحرك تلقائياً للشركاء أو الماركات. يتوقف عند المرور؛ ويتلوّن الرمادي عند المرور.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      {
        key: 'speed',
        type: 'select',
        label: { en: 'Scroll speed', ar: 'سرعة التمرير' },
        defaultValue: 'normal',
        options: [
          { value: 'slow', label: { en: 'Slow', ar: 'بطيء' } },
          { value: 'normal', label: { en: 'Normal', ar: 'متوسط' } },
          { value: 'fast', label: { en: 'Fast', ar: 'سريع' } },
        ],
      },
      { key: 'grayscale', type: 'boolean', label: { en: 'Grayscale (colour on hover)', ar: 'رمادي (يتلوّن عند المرور)' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Logos', ar: 'الشعارات' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Logo image', ar: 'صورة الشعار' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل' } },
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
    ],
    defaultSettings: { speed: 'normal', grayscale: true },
    defaultContent: { heading: 'Trusted by leading brands', items: [] },
  },
  {
    id: 'stats-bar',
    label: { en: 'Stats', ar: 'إحصائيات' },
    icon: 'bar-chart',
    category: 'content',
    description: {
      en: 'Row of big numbers with labels — customers, orders, ratings, anything.',
      ar: 'صف من الأرقام الكبيرة مع تسميات — عملاء، طلبات، تقييمات، أي شيء.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'plain',
        options: [
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
          { value: 'surface', label: { en: 'Surface card', ar: 'بطاقة' } },
        ],
      },
      n('columns', 'Columns', 'الأعمدة', { min: 2, max: 4, defaultValue: 3 }),
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Stats', ar: 'الأرقام' },
        fields: [
          { key: 'value', type: 'text', label: { en: 'Value', ar: 'القيمة' } },
          { key: 'prefix', type: 'text', label: { en: 'Prefix (optional)', ar: 'بادئة (اختياري)' } },
          { key: 'suffix', type: 'text', label: { en: 'Suffix (optional)', ar: 'لاحقة (اختياري)' } },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
        ],
      },
      c('value_color', 'Number color', 'لون الرقم'),
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { style: 'plain', columns: 3 },
    defaultContent: {
      items: [
        { value: '10K', suffix: '+', label: 'Happy customers' },
        { value: '50K', suffix: '+', label: 'Orders delivered' },
        { value: '4.9', suffix: '/5', label: 'Average rating' },
      ],
    },
  },
  {
    id: 'feature-grid',
    label: { en: 'Features', ar: 'المميزات' },
    icon: 'sparkles',
    category: 'content',
    description: {
      en: 'Grid of features, each with an icon, title and short description.',
      ar: 'شبكة من المميزات، كل منها بأيقونة وعنوان ووصف قصير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      n('columns', 'Columns', 'الأعمدة', { min: 1, max: 4, defaultValue: 3 }),
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: [
        { value: 'left', label: { en: 'Left', ar: 'يسار' } },
        { value: 'center', label: { en: 'Center', ar: 'وسط' } },
      ] },
      {
        key: 'icon_style',
        type: 'select',
        label: { en: 'Icon style', ar: 'نمط الأيقونة' },
        defaultValue: 'chip',
        options: [
          { value: 'chip', label: { en: 'Chip', ar: 'بطاقة ملوّنة' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بدون بطاقة' } },
        ],
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Features', ar: 'المميزات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: [
            ...ICON_OPTIONS,
            { value: 'gift', label: { en: 'Gift', ar: 'هدية' } },
            { value: 'heart', label: { en: 'Heart', ar: 'قلب' } },
            { value: 'package', label: { en: 'Package', ar: 'صندوق' } },
            { value: 'sparkles', label: { en: 'Sparkles', ar: 'بريق' } },
            { value: 'zap', label: { en: 'Lightning', ar: 'برق' } },
          ] },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
      c('icon_color', 'Icon color', 'لون الأيقونة'),
      c('icon_bg_color', 'Icon background (chip style)', 'خلفية الأيقونة (نمط البطاقة)'),
      c('title_color', 'Feature title color', 'لون عنوان الميزة'),
      c('description_color', 'Feature description color', 'لون وصف الميزة'),
    ],
    defaultSettings: { columns: 3, alignment: 'center', icon_style: 'chip' },
    defaultContent: {
      items: [
        { icon: 'truck', title: 'Fast delivery', description: 'Get your order in record time with our express shipping.' },
        { icon: 'shield', title: 'Secure payments', description: 'Your data is protected with bank-level encryption.' },
        { icon: 'headphones', title: 'Friendly support', description: 'Our team is here for you seven days a week.' },
      ],
    },
  },
  {
    id: 'steps',
    label: { en: 'Steps', ar: 'خطوات' },
    icon: 'list-ordered',
    category: 'content',
    description: {
      en: 'Numbered "how it works" process — each step with a title and short description.',
      ar: 'خطوات مرقّمة لشرح "كيف تعمل" — كل خطوة بعنوان ووصف قصير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'show_connector', type: 'boolean', label: { en: 'Show connector line', ar: 'إظهار خط الوصل' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Steps', ar: 'الخطوات' },
        fields: [
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'badge_color', type: 'color', label: { en: 'Number badge color', ar: 'لون شارة الرقم' } },
      { key: 'badge_text_color', type: 'color', label: { en: 'Number text color', ar: 'لون رقم الشارة' } },
      { key: 'title_color', type: 'color', label: { en: 'Step title color', ar: 'لون عنوان الخطوة' } },
      { key: 'description_color', type: 'color', label: { en: 'Step description color', ar: 'لون وصف الخطوة' } },
    ],
    defaultSettings: { columns: 3, show_connector: true },
    defaultContent: {
      items: [
        { title: 'Tap', description: 'Tap your card on any smartphone — no app required.' },
        { title: 'Share', description: 'Your details and links appear instantly on their phone.' },
        { title: 'Save', description: 'They save you to their contacts with a single click.' },
      ],
    },
  },
  {
    id: 'team-grid',
    label: { en: 'Team Grid', ar: 'شبكة الفريق' },
    icon: 'layout-grid',
    category: 'content',
    description: {
      en: 'Grid of team members — photo, name, role, short bio and an optional profile link.',
      ar: 'شبكة بأعضاء الفريق — صورة واسم وصفة ونبذة قصيرة ورابط اختياري للملف الشخصي.',
    },
    translatable: ['heading', 'subheading', 'members'],
    schema: [
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'members',
        type: 'repeater',
        label: { en: 'Team members', ar: 'أعضاء الفريق' },
        fields: [
          { key: 'photo', type: 'image', label: { en: 'Photo', ar: 'الصورة' } },
          { key: 'name', type: 'text', label: { en: 'Name', ar: 'الاسم' }, maxLength: 60 },
          { key: 'role', type: 'text', label: { en: 'Role', ar: 'الصفة' }, maxLength: 60 },
          { key: 'bio', type: 'textarea', label: { en: 'Short bio', ar: 'نبذة قصيرة' }, maxLength: 200 },
          { key: 'link_url', type: 'url', label: { en: 'Profile link (optional)', ar: 'رابط الملف الشخصي (اختياري)' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { columns: 3 },
    defaultContent: {
      heading: 'Meet the team',
      subheading: 'The small, obsessive group of people behind everything we make.',
      members: [
        { name: 'Sofia Bergman', role: 'Founder & Creative Director', bio: 'Started the studio in 2018 with a sketchbook and a stubborn belief that everyday objects deserve better design.' },
        { name: 'Omar Haddad', role: 'Head of Product', bio: 'Turns wild ideas into things you can actually hold. Obsessed with materials, tolerances, and tiny details.' },
        { name: 'Elena Petrova', role: 'Customer Experience Lead', bio: 'Makes sure every order, question, and return feels effortless. Probably answering your email right now.' },
      ],
    },
  },
  {
    // Editorial set. Mirrors multi-stores-web/.../sections/ProgressSpotlight.tsx.
    // The bar is computed by the storefront from `goal` and `reached`; there
    // is no typed percentage. Unset booleans read as off, so the `true`
    // defaults are written into defaultSettings.
    id: 'progress-spotlight',
    label: L('Progress spotlight', 'تسليط الضوء على التقدّم', 'İlerleme vitrini', 'Fortschritt im Fokus', 'Progression à la une', 'Framsteg i fokus'),
    icon: 'target',
    category: 'content',
    description: L(
      'A goal with its status and a progress bar calculated from two numbers you enter.',
      'هدف مع حالته وشريط تقدّم يُحسب من رقمين تُدخلهما.',
      'Durumuyla birlikte bir hedef ve girdiğiniz iki sayıdan hesaplanan bir ilerleme çubuğu.',
      'Ein Ziel mit seinem Status und einem Fortschrittsbalken, der aus zwei von Ihnen eingegebenen Zahlen berechnet wird.',
      'Un objectif avec son statut et une barre de progression calculée à partir de deux nombres que vous saisissez.',
      'Ett mål med sin status och en förloppsindikator som beräknas från två tal som du anger.',
    ),
    translatable: ['eyebrow', 'heading', 'body', 'item_title', 'item_meta', 'unit_label', 'note', 'cta_text', 'alt'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: L('Layout', 'التخطيط', 'Düzen', 'Layout', 'Disposition', 'Layout'),
        defaultValue: 'split',
        options: [
          { value: 'split', label: L('Image beside text (edge to edge)', 'صورة بجانب النص (من الحافة إلى الحافة)', 'Metnin yanında görsel (kenardan kenara)', 'Bild neben Text (randlos)', 'Image à côté du texte (bord à bord)', 'Bild bredvid text (kant till kant)') },
          { value: 'card', label: L('Compact card (no image)', 'بطاقة مدمجة (بدون صورة)', 'Kompakt kart (görselsiz)', 'Kompakte Karte (ohne Bild)', 'Carte compacte (sans image)', 'Kompakt kort (utan bild)') },
        ],
      },
      { key: 'image', type: 'image', label: IMAGE_LABEL, showIf: { key: 'layout', in: ['', 'split'] } },
      { key: 'alt', type: 'text', label: ALT_LABEL, description: ALT_DESCRIPTION, maxLength: 160, showIf: { key: 'layout', in: ['', 'split'] } },
      {
        key: 'image_side',
        type: 'select',
        label: L('Image side', 'جهة الصورة', 'Görsel tarafı', 'Bildseite', 'Côté de l’image', 'Bildens sida'),
        defaultValue: 'start',
        showIf: { key: 'layout', in: ['', 'split'] },
        options: START_END_OPTIONS,
      },
      {
        key: 'image_focus',
        type: 'select',
        label: IMAGE_FOCUS_LABEL,
        description: IMAGE_FOCUS_DESCRIPTION,
        defaultValue: 'center',
        showIf: { key: 'layout', in: ['', 'split'] },
        options: FOCUS_OPTIONS,
      },
      { key: 'tone', type: 'select', label: TONE_LABEL, defaultValue: 'surface', options: TONE_OPTIONS },
      cL('bg_color', BG_COLOR_LABEL, { description: BG_COLOR_DESCRIPTION }),
      { key: 'eyebrow', type: 'text', label: L('Small label', 'تسمية صغيرة', 'Küçük etiket', 'Kleines Label', 'Petit libellé', 'Liten etikett'), maxLength: 40 },
      { key: 'heading', type: 'textarea', label: HEADING_LABEL, description: HEADING_MULTILINE_HINT, maxLength: 120 },
      { key: 'body', type: 'textarea', label: L('Body text', 'النص', 'Metin', 'Fließtext', 'Texte', 'Brödtext'), maxLength: 400 },
      {
        key: 'item_title',
        type: 'text',
        label: L('Goal name', 'اسم الهدف', 'Hedef adı', 'Name des Ziels', 'Nom de l’objectif', 'Målets namn'),
        maxLength: 120,
      },
      {
        key: 'item_meta',
        type: 'text',
        label: L('Place or date', 'المكان أو التاريخ', 'Yer veya tarih', 'Ort oder Datum', 'Lieu ou date', 'Plats eller datum'),
        description: L(
          'A short second line under the goal name.',
          'سطر ثانٍ قصير تحت اسم الهدف.',
          'Hedef adının altında kısa bir ikinci satır.',
          'Eine kurze zweite Zeile unter dem Namen des Ziels.',
          'Une courte seconde ligne sous le nom de l’objectif.',
          'En kort andra rad under målets namn.',
        ),
        maxLength: 80,
      },
      {
        key: 'icon',
        type: 'select',
        label: L('Icon', 'الأيقونة', 'Simge', 'Symbol', 'Icône', 'Ikon'),
        defaultValue: 'none',
        options: [
          { value: 'none', label: L('No icon', 'بدون أيقونة', 'Simge yok', 'Kein Symbol', 'Aucune icône', 'Ingen ikon') },
          ...TRUST_BADGE_ICON_OPTIONS,
        ],
      },
      {
        key: 'status',
        type: 'select',
        label: L('Status', 'الحالة', 'Durum', 'Status', 'Statut', 'Status'),
        description: L(
          'Planned shows the goal only, never a bar or a percentage. In progress and Completed show the bar from your numbers.',
          'المخطَّط يعرض الهدف فقط دون شريط أو نسبة. قيد التنفيذ والمكتمل يعرضان الشريط من أرقامك.',
          'Planlandı yalnızca hedefi gösterir; çubuk veya yüzde göstermez. Devam ediyor ve Tamamlandı, çubuğu sayılarınızdan gösterir.',
          'Geplant zeigt nur das Ziel, nie einen Balken oder Prozentwert. In Arbeit und Abgeschlossen zeigen den Balken aus Ihren Zahlen.',
          'Planifié affiche seulement l’objectif, jamais de barre ni de pourcentage. En cours et Terminé affichent la barre d’après vos nombres.',
          'Planerat visar bara målet, aldrig en indikator eller procent. Pågår och Slutfört visar indikatorn utifrån dina tal.',
        ),
        defaultValue: 'in_progress',
        options: STATUS_OPTIONS,
      },
      {
        key: 'goal',
        type: 'number',
        label: L('Goal (number)', 'الهدف (رقم)', 'Hedef (sayı)', 'Ziel (Zahl)', 'Objectif (nombre)', 'Mål (antal)'),
        description: L(
          'The target amount. Without a goal above 0 no bar is shown.',
          'الكمية المستهدفة. بدون هدف أكبر من 0 لا يظهر الشريط.',
          'Hedef miktar. 0’dan büyük bir hedef olmadan çubuk gösterilmez.',
          'Die Zielmenge. Ohne ein Ziel über 0 wird kein Balken angezeigt.',
          'La quantité visée. Sans objectif supérieur à 0, aucune barre n’est affichée.',
          'Målmängden. Utan ett mål över 0 visas ingen indikator.',
        ),
        min: 0,
        defaultValue: 100,
      },
      {
        key: 'reached',
        type: 'number',
        label: L('Reached so far (number)', 'المُنجَز حتى الآن (رقم)', 'Şimdiye kadar ulaşılan (sayı)', 'Bisher erreicht (Zahl)', 'Atteint à ce jour (nombre)', 'Uppnått hittills (antal)'),
        description: L(
          'Enter a figure you can verify. The percentage is calculated from this number and the goal, and it reads 100% only when the goal is met.',
          'أدخل رقماً يمكنك التحقق منه. تُحسب النسبة من هذا الرقم ومن الهدف، ولا تصل إلى 100% إلا عند بلوغ الهدف.',
          'Doğrulayabileceğiniz bir rakam girin. Yüzde, bu sayı ile hedeften hesaplanır ve yalnızca hedefe ulaşıldığında %100 olur.',
          'Geben Sie eine Zahl ein, die Sie belegen können. Der Prozentwert wird aus dieser Zahl und dem Ziel berechnet und zeigt erst 100 %, wenn das Ziel erreicht ist.',
          'Saisissez un chiffre que vous pouvez vérifier. Le pourcentage est calculé à partir de ce nombre et de l’objectif, et n’affiche 100 % que lorsque l’objectif est atteint.',
          'Ange en siffra som du kan styrka. Procenten beräknas från det här talet och målet och visar 100 % först när målet är nått.',
        ),
        min: 0,
        defaultValue: 0,
      },
      {
        key: 'unit_label',
        type: 'text',
        label: L('Unit text', 'نص الوحدة', 'Birim metni', 'Text der Einheit', 'Texte de l’unité', 'Enhetstext'),
        description: L(
          'Follows the numbers, as in “60 of 100 completed”.',
          'يأتي بعد الأرقام، كما في «60 من 100 مكتمل».',
          'Sayılardan sonra gelir; örneğin “60 / 100 tamamlandı”.',
          'Folgt auf die Zahlen, wie in „60 von 100 abgeschlossen“.',
          'Suit les nombres, comme dans « 60 sur 100 terminés ».',
          'Följer efter talen, som i ”60 av 100 slutförda”.',
        ),
        maxLength: 40,
      },
      {
        key: 'show_progress',
        type: 'boolean',
        label: L('Show progress bar', 'إظهار شريط التقدّم', 'İlerleme çubuğunu göster', 'Fortschrittsbalken anzeigen', 'Afficher la barre de progression', 'Visa förloppsindikator'),
        defaultValue: true,
      },
      {
        key: 'show_percent',
        type: 'boolean',
        label: L('Show percentage', 'إظهار النسبة المئوية', 'Yüzdeyi göster', 'Prozentwert anzeigen', 'Afficher le pourcentage', 'Visa procent'),
        defaultValue: true,
      },
      {
        key: 'note',
        type: 'text',
        label: L('Note', 'ملاحظة', 'Not', 'Hinweis', 'Note', 'Notering'),
        description: L(
          'For example the source of the figures or the date they were last updated.',
          'مثلاً مصدر الأرقام أو تاريخ آخر تحديث لها.',
          'Örneğin rakamların kaynağı veya son güncellendikleri tarih.',
          'Zum Beispiel die Quelle der Zahlen oder das Datum der letzten Aktualisierung.',
          'Par exemple la source des chiffres ou la date de leur dernière mise à jour.',
          'Till exempel källan till siffrorna eller datumet då de senast uppdaterades.',
        ),
        maxLength: 160,
      },
      { key: 'cta_text', type: 'text', label: L('Button text', 'نص الزر', 'Buton metni', 'Button-Text', 'Texte du bouton', 'Knapptext'), maxLength: 40 },
      { key: 'cta_url', type: 'url', label: L('Button URL', 'رابط الزر', 'Buton bağlantısı', 'Button-URL', 'URL du bouton', 'Knappens länk') },
      { key: 'cta_tone', type: 'select', label: CTA_TONE_LABEL, description: CTA_TONE_DESCRIPTION, defaultValue: 'primary', options: CTA_TONE_OPTIONS },
      { key: 'cta_arrow', type: 'boolean', label: CTA_ARROW_LABEL, defaultValue: false },
      cL('eyebrow_color', EYEBROW_COLOR_LABEL),
      cL('heading_color', HEADING_COLOR_LABEL),
      cL('body_color', BODY_COLOR_LABEL),
      cL('bar_color', L('Progress bar color', 'لون شريط التقدّم', 'İlerleme çubuğu rengi', 'Farbe des Fortschrittsbalkens', 'Couleur de la barre de progression', 'Förloppsindikatorns färg')),
      ...buttonStyleFieldsL('cta'),
    ],
    defaultSettings: {
      layout: 'split',
      image_side: 'start',
      image_focus: 'center',
      tone: 'surface',
      icon: 'none',
      status: 'in_progress',
      goal: 100,
      // 0 by default: the bar is visible in the builder without claiming progress.
      reached: 0,
      show_progress: true,
      show_percent: true,
      cta_tone: 'primary',
      cta_arrow: false,
    },
    defaultContent: {
      eyebrow: 'Our goal',
      heading: 'Follow our progress',
      body: 'Describe what you are working towards and why it matters. The bar is calculated from the two numbers you enter.',
      item_title: 'Name of the goal',
      item_meta: 'Where or when',
      unit_label: 'completed',
      cta_text: 'Learn more',
    },
  },
  {
    // Editorial set. Mirrors multi-stores-web/.../sections/ProjectCards.tsx.
    // Image and status live inside each locale's copy of `items` (the
    // repeater is translatable), so a status changed in one language has to
    // be changed in the others too.
    id: 'project-cards',
    label: L('Project cards', 'بطاقات المشاريع', 'Proje kartları', 'Projektkarten', 'Cartes de projets', 'Projektkort'),
    icon: 'layout-grid',
    category: 'content',
    description: L(
      'Cards with an image, a status, a category, a location and a link.',
      'بطاقات بصورة وحالة وفئة وموقع ورابط.',
      'Görsel, durum, kategori, konum ve bağlantı içeren kartlar.',
      'Karten mit Bild, Status, Kategorie, Ort und Link.',
      'Cartes avec une image, un statut, une catégorie, un lieu et un lien.',
      'Kort med bild, status, kategori, plats och länk.',
    ),
    translatable: ['heading', 'subheading', 'link_label', 'items'],
    schema: [
      { key: 'heading', type: 'textarea', label: HEADING_LABEL, description: HEADING_MULTILINE_HINT, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: SUBHEADING_LABEL, maxLength: 240 },
      {
        key: 'items',
        type: 'repeater',
        label: L('Cards', 'البطاقات', 'Kartlar', 'Karten', 'Cartes', 'Kort'),
        description: L(
          'Up to 24 cards. A card shows when it has a title or an image. Image and status are saved per language: change them in every language you publish.',
          'حتى 24 بطاقة. تظهر البطاقة عندما يكون لها عنوان أو صورة. الصورة والحالة تُحفظان لكل لغة: غيّرهما في كل لغة تنشرها.',
          'En fazla 24 kart. Bir kart, başlığı veya görseli olduğunda gösterilir. Görsel ve durum her dil için ayrı kaydedilir: yayınladığınız her dilde değiştirin.',
          'Bis zu 24 Karten. Eine Karte erscheint, sobald sie einen Titel oder ein Bild hat. Bild und Status werden pro Sprache gespeichert: Ändern Sie sie in jeder veröffentlichten Sprache.',
          'Jusqu’à 24 cartes. Une carte s’affiche dès qu’elle a un titre ou une image. L’image et le statut sont enregistrés par langue : modifiez-les dans chaque langue publiée.',
          'Upp till 24 kort. Ett kort visas när det har en titel eller en bild. Bild och status sparas per språk: ändra dem i varje språk du publicerar.',
        ),
        maxItems: 24,
        fields: [
          { key: 'image', type: 'image', label: IMAGE_LABEL },
          // `title` sits before `alt` so the collapsed item shows the title
          // (the repeater previews its first text field).
          { key: 'title', type: 'text', label: TITLE_LABEL, maxLength: 120 },
          { key: 'alt', type: 'text', label: ALT_LABEL, description: ALT_DESCRIPTION, maxLength: 160 },
          { key: 'category', type: 'text', label: L('Category', 'الفئة', 'Kategori', 'Kategorie', 'Catégorie', 'Kategori'), maxLength: 60 },
          { key: 'location', type: 'text', label: L('Location', 'الموقع', 'Konum', 'Ort', 'Lieu', 'Plats'), maxLength: 80 },
          { key: 'status', type: 'select', label: L('Status', 'الحالة', 'Durum', 'Status', 'Statut', 'Status'), defaultValue: 'none', options: STATUS_OPTIONS },
          { key: 'description', type: 'textarea', label: L('Short text', 'نص قصير', 'Kısa metin', 'Kurzer Text', 'Texte court', 'Kort text'), maxLength: 240 },
          {
            key: 'url',
            type: 'url',
            label: LINK_LABEL,
            description: L(
              'With a link the whole card is clickable.',
              'مع الرابط تصبح البطاقة كلها قابلة للنقر.',
              'Bağlantı varsa kartın tamamı tıklanabilir olur.',
              'Mit einem Link ist die ganze Karte klickbar.',
              'Avec un lien, toute la carte est cliquable.',
              'Med en länk blir hela kortet klickbart.',
            ),
          },
        ],
      },
      { key: 'columns', type: 'number', label: COLUMNS_DESKTOP_LABEL, min: 1, max: 4, defaultValue: 3 },
      { key: 'columns_tablet', type: 'number', label: COLUMNS_TABLET_LABEL, min: 1, max: 3, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: COLUMNS_MOBILE_LABEL, min: 1, max: 2, defaultValue: 1 },
      {
        key: 'aspect',
        type: 'select',
        label: IMAGE_ASPECT_LABEL,
        defaultValue: 'landscape',
        options: [
          { value: 'landscape', label: ASPECT_LANDSCAPE },
          { value: 'square', label: ASPECT_SQUARE },
          { value: 'portrait', label: ASPECT_PORTRAIT },
          { value: 'wide', label: ASPECT_WIDE },
        ],
      },
      {
        key: 'card_style',
        type: 'select',
        label: L('Card style', 'نمط البطاقة', 'Kart stili', 'Kartenstil', 'Style de carte', 'Kortstil'),
        defaultValue: 'bordered',
        options: [
          { value: 'plain', label: L('Plain', 'بسيط', 'Sade', 'Schlicht', 'Simple', 'Enkel') },
          { value: 'bordered', label: L('Bordered', 'بإطار', 'Kenarlıklı', 'Mit Rahmen', 'Avec bordure', 'Med ram') },
          { value: 'surface', label: L('Tinted background', 'بخلفية هادئة', 'Tonlu arka plan', 'Getönter Hintergrund', 'Fond teinté', 'Tonad bakgrund') },
        ],
      },
      {
        key: 'show_status',
        type: 'boolean',
        label: L('Show status badge', 'إظهار شارة الحالة', 'Durum rozetini göster', 'Status-Abzeichen anzeigen', 'Afficher le badge de statut', 'Visa statusmärke'),
        defaultValue: true,
      },
      { key: 'heading_align', type: 'select', label: HEADING_ALIGN_LABEL, defaultValue: 'start', options: HEADING_ALIGN_OPTIONS },
      { key: 'heading_rule', type: 'boolean', label: HEADING_RULE_LABEL, description: HEADING_RULE_DESCRIPTION, defaultValue: false },
      { key: 'rounded', type: 'boolean', label: ROUNDED_LABEL, defaultValue: true },
      {
        key: 'link_label',
        type: 'text',
        label: L('“View all” link text', 'نص رابط «عرض الكل»', '“Tümünü gör” bağlantı metni', 'Text des „Alle ansehen“-Links', 'Texte du lien « Tout voir »', 'Text för länken ”Visa alla”'),
        description: L(
          'A link under the cards. It shows only when both the text and the address are filled in.',
          'رابط تحت البطاقات. يظهر فقط عند تعبئة النص والعنوان معاً.',
          'Kartların altında bir bağlantı. Yalnızca metin ve adres birlikte doldurulduğunda görünür.',
          'Ein Link unter den Karten. Er erscheint nur, wenn Text und Adresse ausgefüllt sind.',
          'Un lien sous les cartes. Il n’apparaît que si le texte et l’adresse sont renseignés.',
          'En länk under korten. Den visas bara när både text och adress är ifyllda.',
        ),
        maxLength: 40,
      },
      {
        key: 'link_url',
        type: 'url',
        label: L('“View all” link address', 'عنوان رابط «عرض الكل»', '“Tümünü gör” bağlantı adresi', 'Adresse des „Alle ansehen“-Links', 'Adresse du lien « Tout voir »', 'Adress för länken ”Visa alla”'),
      },
      cL('heading_color', HEADING_COLOR_LABEL),
      cL('subheading_color', SUBHEADING_COLOR_LABEL),
      cL('title_color', L('Card title color', 'لون عنوان البطاقة', 'Kart başlığı rengi', 'Farbe des Kartentitels', 'Couleur du titre de la carte', 'Kortets titelfärg')),
      cL('body_color', L('Card text color', 'لون نص البطاقة', 'Kart metni rengi', 'Farbe des Kartentexts', 'Couleur du texte de la carte', 'Kortets textfärg')),
      cL('link_color', L('Link color', 'لون الرابط', 'Bağlantı rengi', 'Linkfarbe', 'Couleur du lien', 'Länkfärg')),
    ],
    defaultSettings: {
      columns: 3,
      columns_tablet: 2,
      columns_mobile: 1,
      aspect: 'landscape',
      card_style: 'bordered',
      show_status: true,
      heading_align: 'start',
      heading_rule: false,
      rounded: true,
    },
    defaultContent: {
      heading: 'Our projects',
      subheading: 'What is planned, what is under way and what is done.',
      items: [
        { title: 'First project', category: 'Category', location: 'Location', status: 'completed', description: 'Describe the project in one or two sentences.' },
        { title: 'Second project', category: 'Category', location: 'Location', status: 'in_progress', description: 'Describe the project in one or two sentences.' },
        { title: 'Third project', category: 'Category', location: 'Location', status: 'planned', description: 'Describe the project in one or two sentences.' },
      ],
    },
  },
  {
    id: 'timeline',
    label: { en: 'Timeline', ar: 'الخط الزمني' },
    icon: 'list-ordered',
    category: 'content',
    description: {
      en: 'Vertical milestone timeline — year, title, description and an optional image per entry.',
      ar: 'خط زمني عمودي للمحطات المهمة — سنة وعنوان ووصف وصورة اختيارية لكل محطة.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'alternate', type: 'boolean', label: { en: 'Alternate sides (desktop)', ar: 'تبادل الجهات (سطح المكتب)' }, defaultValue: true },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Milestones', ar: 'المحطات' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label (e.g. year)', ar: 'التسمية (مثل السنة)' }, maxLength: 20 },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, maxLength: 80 },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' }, maxLength: 240 },
          { key: 'image', type: 'image', label: { en: 'Image (optional)', ar: 'الصورة (اختياري)' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { alternate: true },
    defaultContent: {
      heading: 'Our journey',
      subheading: 'From a kitchen-table idea to a brand shipped to 40+ countries.',
      items: [
        { label: '2018', title: 'The first sketch', description: 'What started as a side project on a kitchen table became a working prototype — and a conviction that we were onto something.' },
        { label: '2020', title: 'First 10,000 customers', description: 'Word of mouth carried us further than any ad ever could. We moved into our first real workshop and doubled the team.' },
        { label: '2023', title: 'Going international', description: 'We opened worldwide shipping and translated the store into five languages. Same products, much bigger family.' },
        { label: '2026', title: 'The next chapter', description: 'A new collection, a new studio, and the same promise: build things worth keeping.' },
      ],
    },
  },
  {
    id: 'comparison-table',
    label: { en: 'Comparison', ar: 'مقارنة' },
    icon: 'table',
    category: 'content',
    description: {
      en: 'Two-column feature comparison ("us" vs "others") with check / cross marks and a highlighted column.',
      ar: 'مقارنة من عمودين ("نحن" مقابل "الآخرون") بعلامات صح / خطأ وعمود مميَّز.',
    },
    translatable: ['heading', 'subheading', 'col_a_label', 'col_b_label', 'rows'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'col_a_label', type: 'text', label: { en: 'Your column label', ar: 'تسمية عمودك' } },
      { key: 'col_b_label', type: 'text', label: { en: 'Other column label', ar: 'تسمية العمود الآخر' } },
      {
        key: 'rows',
        type: 'repeater',
        label: { en: 'Rows', ar: 'الصفوف' },
        fields: [
          { key: 'feature', type: 'text', label: { en: 'Feature', ar: 'الميزة' } },
          { key: 'a', type: 'select', label: { en: 'Your column', ar: 'عمودك' }, defaultValue: 'yes', options: [
            { value: 'yes', label: { en: 'Yes (check)', ar: 'نعم (صح)' } },
            { value: 'no', label: { en: 'No (cross)', ar: 'لا (خطأ)' } },
          ] },
          { key: 'b', type: 'select', label: { en: 'Other column', ar: 'العمود الآخر' }, defaultValue: 'no', options: [
            { value: 'yes', label: { en: 'Yes (check)', ar: 'نعم (صح)' } },
            { value: 'no', label: { en: 'No (cross)', ar: 'لا (خطأ)' } },
          ] },
        ],
      },
      { key: 'highlight_color', type: 'color', label: { en: 'Highlight color', ar: 'لون التمييز' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
    defaultSettings: {},
    defaultContent: {
      col_a_label: 'Smart card',
      col_b_label: 'Paper card',
      rows: [
        { feature: 'Share instantly with one tap', a: 'yes', b: 'no' },
        { feature: 'Always up to date', a: 'yes', b: 'no' },
        { feature: 'Never runs out', a: 'yes', b: 'no' },
        { feature: 'Eco-friendly', a: 'yes', b: 'no' },
      ],
    },
  },
  {
    id: 'countdown',
    label: { en: 'Countdown Timer', ar: 'عدّاد تنازلي' },
    icon: 'timer',
    category: 'showcase',
    description: {
      en: 'A live countdown to a deadline — perfect for sales and launches. Shows an expired message after the date passes.',
      ar: 'عدّاد حيّ يتناقص حتى موعد محدّد — مثالي للعروض والإطلاقات. يعرض رسالة انتهاء بعد مرور الموعد.',
    },
    translatable: ['heading', 'subheading', 'expired_text'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'target_date', type: 'text', label: { en: 'End date & time (e.g. 2026-12-31T23:59)', ar: 'تاريخ ووقت الانتهاء (مثال: 2026-12-31T23:59)' } },
      { key: 'expired_text', type: 'text', label: { en: 'Expired message', ar: 'رسالة الانتهاء' } },
      { key: 'alignment', type: 'select', label: { en: 'Alignment', ar: 'المحاذاة' }, defaultValue: 'center', options: ALIGNMENT_OPTIONS },
      c('digit_color', 'Digit color', 'لون الأرقام'),
      c('box_bg_color', 'Box background', 'خلفية الصندوق'),
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { alignment: 'center' },
    defaultContent: {
      heading: 'Sale ends soon',
      subheading: "Don't miss out — limited time only.",
    },
  },
  {
    id: 'video',
    label: { en: 'Video', ar: 'فيديو' },
    icon: 'video',
    category: 'content',
    description: {
      en: 'Embed a YouTube/Vimeo video or a direct file. Optional poster image with a play overlay.',
      ar: 'تضمين فيديو يوتيوب/فيميو أو ملف مباشر. صورة غلاف اختيارية مع زر تشغيل.',
    },
    translatable: ['heading', 'subheading'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'video_url', type: 'url', label: { en: 'Video URL (YouTube, Vimeo, or .mp4)', ar: 'رابط الفيديو (يوتيوب، فيميو، أو .mp4)' } },
      { key: 'poster', type: 'image', label: { en: 'Poster image (optional)', ar: 'صورة الغلاف (اختياري)' } },
      {
        key: 'aspect_ratio',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: '16/9',
        options: [
          { value: '16/9', label: { en: '16:9 (widescreen)', ar: '16:9 (عريض)' } },
          { value: '4/3', label: { en: '4:3', ar: '4:3' } },
          { value: '1/1', label: { en: '1:1 (square)', ar: '1:1 (مربّع)' } },
          { value: '9/16', label: { en: '9:16 (vertical)', ar: '9:16 (عمودي)' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: { aspect_ratio: '16/9' },
  },
  {
    id: 'spacer',
    label: { en: 'Spacer / Divider', ar: 'فاصل / مسافة' },
    icon: 'minus',
    category: 'layout',
    description: {
      en: 'Adds vertical breathing room between sections, with an optional divider line.',
      ar: 'يضيف مسافة عمودية بين السكشنات، مع خط فاصل اختياري.',
    },
    translatable: [],
    schema: [
      n('height_px', 'Height (px)', 'الارتفاع (px)', { min: 0, max: 400, defaultValue: 48 }),
      { key: 'show_divider', type: 'boolean', label: { en: 'Show divider line', ar: 'إظهار خط فاصل' }, defaultValue: false },
      {
        key: 'divider_style',
        type: 'select',
        label: { en: 'Divider style', ar: 'نمط الخط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'متصل' } },
          { value: 'dashed', label: { en: 'Dashed', ar: 'متقطّع' } },
          { value: 'dotted', label: { en: 'Dotted', ar: 'منقّط' } },
        ],
      },
      c('divider_color', 'Divider color', 'لون الخط'),
    ],
    defaultSettings: { height_px: 48, show_divider: false, divider_style: 'solid' },
  },
  {
    id: 'embed-code',
    label: { en: 'Embed Code', ar: 'كود مخصّص' },
    icon: 'code',
    category: 'content',
    description: {
      en: 'Paste custom HTML, CSS and JavaScript. Render isolated in a sandboxed iframe (auto-resizing) or inline in the page.',
      ar: 'الصق HTML و CSS و JavaScript مخصّص. اعرضه معزولاً في إطار آمن (يضبط ارتفاعه تلقائياً) أو مضمّناً في الصفحة.',
    },
    translatable: [],
    // Content pages (default) plus the HEADER / FOOTER builders, so a snippet
    // can run on every page of the store.
    chrome: true,
    schema: [
      { key: 'html', type: 'textarea', label: { en: 'HTML', ar: 'HTML' }, description: { en: 'Markup to render.', ar: 'الكود البنائي.' } },
      { key: 'css', type: 'textarea', label: { en: 'CSS', ar: 'CSS' }, description: { en: 'Styles for the markup above.', ar: 'تنسيقات الكود أعلاه.' } },
      { key: 'js', type: 'textarea', label: { en: 'JavaScript', ar: 'JavaScript' }, description: { en: 'Script to run. In isolated mode it runs inside the sandbox.', ar: 'سكربت يُشغّل. في الوضع المعزول يعمل داخل الإطار الآمن.' } },
      {
        key: 'mode',
        type: 'select',
        label: { en: 'Render mode', ar: 'وضع العرض' },
        defaultValue: 'isolated',
        options: [
          { value: 'isolated', label: { en: 'Isolated (sandboxed iframe)', ar: 'معزول (إطار آمن)' } },
          { value: 'inline', label: { en: 'Inline (in page)', ar: 'مضمّن (داخل الصفحة)' } },
        ],
      },
      n('min_height', 'Minimum height (px)', 'أدنى ارتفاع (px)', { min: 0, max: 2000, defaultValue: 0 }),
    ],
    defaultSettings: { mode: 'isolated', min_height: 0 },
  },
  {
    id: 'map',
    label: { en: 'Map', ar: 'الخريطة' },
    icon: 'map-pin',
    category: 'content',
    description: {
      en: 'A modern store locator: one or more branches with a switcher, styled Google map, info card (address, phone, hours) and one-tap directions.',
      ar: 'محدّد مواقع عصري: فرع أو أكثر مع مبدّل، خريطة Google منسّقة، بطاقة معلومات (العنوان، الهاتف، الساعات) واتجاهات بنقرة.',
    },
    translatable: ['heading', 'subheading', 'locations'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'split-right',
        options: [
          { value: 'split-right', label: { en: 'Info + map (map right)', ar: 'معلومات + خريطة (يمين)' } },
          { value: 'split-left', label: { en: 'Info + map (map left)', ar: 'معلومات + خريطة (يسار)' } },
          { value: 'overlay', label: { en: 'Map with floating card', ar: 'خريطة مع بطاقة عائمة' } },
          { value: 'full', label: { en: 'Full-width map', ar: 'خريطة بعرض كامل' } },
        ],
      },
      {
        key: 'map_style',
        type: 'select',
        label: { en: 'Map style', ar: 'نمط الخريطة' },
        defaultValue: 'standard',
        options: [
          { value: 'standard', label: { en: 'Standard', ar: 'قياسي' } },
          { value: 'grayscale', label: { en: 'Grayscale', ar: 'رمادي' } },
          { value: 'muted', label: { en: 'Muted', ar: 'هادئ' } },
          { value: 'dark', label: { en: 'Dark', ar: 'داكن' } },
        ],
      },
      {
        key: 'card_style',
        type: 'select',
        label: { en: 'Info card style', ar: 'نمط بطاقة المعلومات' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مصمت' } },
          { value: 'glass', label: { en: 'Glass (blur)', ar: 'زجاجي (ضبابي)' } },
        ],
      },
      n('zoom', 'Zoom level', 'مستوى التقريب', { min: 1, max: 20, defaultValue: 14 }),
      n('height', 'Map height (px)', 'ارتفاع الخريطة (px)', { min: 220, max: 900, defaultValue: 440 }),
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      { key: 'show_directions', type: 'boolean', label: { en: 'Show "Get directions" button', ar: 'إظهار زر الاتجاهات' }, defaultValue: true },
      {
        key: 'locations',
        type: 'repeater',
        label: { en: 'Locations', ar: 'المواقع' },
        fields: [
          { key: 'name', type: 'text', label: { en: 'Branch name', ar: 'اسم الفرع' } },
          { key: 'address', type: 'textarea', label: { en: 'Address (used for the map)', ar: 'العنوان (يُستخدم للخريطة)' } },
          { key: 'lat', type: 'text', label: { en: 'Latitude (optional, precise pin)', ar: 'خط العرض (اختياري، تحديد دقيق)' } },
          { key: 'lng', type: 'text', label: { en: 'Longitude (optional)', ar: 'خط الطول (اختياري)' } },
          { key: 'phone', type: 'text', label: { en: 'Phone', ar: 'الهاتف' } },
          { key: 'email', type: 'text', label: { en: 'Email', ar: 'البريد الإلكتروني' } },
          { key: 'hours', type: 'textarea', label: { en: 'Opening hours (one per line)', ar: 'ساعات العمل (سطر لكل يوم)' } },
        ],
      },
      c('heading_color', 'Heading color', 'لون العنوان'),
      c('subheading_color', 'Subheading color', 'لون العنوان الفرعي'),
    ],
    defaultSettings: {
      layout: 'split-right', map_style: 'standard', card_style: 'solid',
      zoom: 14, height: 440, rounded: true, show_directions: true,
    },
    defaultContent: {
      heading: 'Visit us',
      locations: [
        { name: 'Flagship Store', address: '350 5th Ave, New York, NY 10118', phone: '+1 (212) 555-0100', hours: 'Mon–Fri: 9:00 – 20:00\nSat–Sun: 10:00 – 18:00' },
      ],
    },
  },
  {
    id: 'layout-columns',
    label: { en: 'Columns / Layout', ar: 'أعمدة / تخطيط' },
    icon: 'layout',
    category: 'layout',
    description: {
      en: 'Divide the page into a responsive grid or flex row. Each column holds inline blocks: heading, text, image, image row (logos), social icons, button, divider, spacer, or HTML.',
      ar: 'قسّم الصفحة إلى شبكة متجاوبة أو صف flex. كل عمود يحتوي بلوكات: عنوان، نص، صورة، صف صور (شعارات)، أيقونات تواصل، زر، فاصل، مسافة، أو HTML.',
    },
    translatable: ['cells'],
    schema: [
      {
        key: 'mode',
        type: 'select',
        label: { en: 'Mode', ar: 'الوضع' },
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: { en: 'Grid (equal columns)', ar: 'شبكة (أعمدة متساوية)' } },
          { value: 'flex', label: { en: 'Flex (flexible widths)', ar: 'مرن (عرض متغيّر)' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 1 },
      {
        key: 'direction',
        type: 'select',
        label: { en: 'Flex direction', ar: 'اتجاه flex' },
        defaultValue: 'row',
        options: [
          { value: 'row', label: { en: 'Row', ar: 'صف' } },
          { value: 'column', label: { en: 'Column', ar: 'عمود' } },
        ],
      },
      { key: 'wrap', type: 'boolean', label: { en: 'Wrap (flex)', ar: 'التفاف (flex)' }, defaultValue: true },
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'الفجوة (px)' }, min: 0, max: 80, defaultValue: 24 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical align', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: [
          { value: 'start', label: { en: 'Top', ar: 'أعلى' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'end', label: { en: 'Bottom', ar: 'أسفل' } },
          { value: 'stretch', label: { en: 'Stretch', ar: 'تمدّد' } },
        ],
      },
      {
        key: 'justify',
        type: 'select',
        label: { en: 'Horizontal distribution', ar: 'التوزيع الأفقي' },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'موزّع' } },
          { value: 'around', label: { en: 'Space around', ar: 'محيطي' } },
        ],
      },
      {
        key: 'cells',
        type: 'repeater',
        label: { en: 'Columns', ar: 'الأعمدة' },
        fields: [
          { key: 'col_span', type: 'number', label: { en: 'Column span / flex ratio', ar: 'امتداد العمود / نسبة flex' }, min: 1, max: 6, defaultValue: 1 },
          {
            key: 'align',
            type: 'select',
            label: { en: 'Block alignment', ar: 'محاذاة البلوكات' },
            defaultValue: 'stretch',
            options: [
              { value: 'start', label: { en: 'Start', ar: 'البداية' } },
              { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
              { value: 'end', label: { en: 'End', ar: 'النهاية' } },
              { value: 'stretch', label: { en: 'Stretch', ar: 'تمدّد' } },
            ],
          },
          {
            key: 'blocks',
            type: 'repeater',
            label: { en: 'Content blocks', ar: 'بلوكات المحتوى' },
            fields: [
              {
                key: 'type',
                type: 'select',
                label: { en: 'Block type', ar: 'نوع البلوك' },
                defaultValue: 'text',
                options: [
                  { value: 'heading', label: { en: 'Heading', ar: 'عنوان' } },
                  { value: 'text', label: { en: 'Text', ar: 'نص' } },
                  { value: 'image', label: { en: 'Image', ar: 'صورة' } },
                  { value: 'images', label: { en: 'Image row (logos)', ar: 'صف صور (شعارات)' } },
                  { value: 'social', label: { en: 'Social icons', ar: 'أيقونات التواصل' } },
                  { value: 'button', label: { en: 'Button', ar: 'زر' } },
                  { value: 'divider', label: { en: 'Divider', ar: 'فاصل' } },
                  { value: 'spacer', label: { en: 'Spacer', ar: 'مسافة' } },
                  { value: 'html', label: { en: 'Custom HTML', ar: 'HTML مخصّص' } },
                ],
              },
              { key: 'text', type: 'text', label: { en: 'Heading text', ar: 'نص العنوان' }, showIf: { key: 'type', in: ['heading'] } },
              {
                key: 'level',
                type: 'select',
                label: { en: 'Heading level', ar: 'مستوى العنوان' },
                defaultValue: 'h2',
                options: [
                  { value: 'h1', label: { en: 'H1 (page title)', ar: 'H1 (عنوان الصفحة)' } },
                  { value: 'h2', label: { en: 'H2', ar: 'H2' } },
                  { value: 'h3', label: { en: 'H3', ar: 'H3' } },
                  { value: 'h4', label: { en: 'H4', ar: 'H4' } },
                ],
                showIf: { key: 'type', in: ['heading'] },
              },
              {
                key: 'heading_style',
                type: 'select',
                label: { en: 'Heading style', ar: 'شكل العنوان' },
                defaultValue: 'default',
                options: [
                  { value: 'default', label: { en: 'Theme heading', ar: 'عنوان الثيم' } },
                  { value: 'label', label: { en: 'Small uppercase label (footer column title)', ar: 'تسمية صغيرة بأحرف كبيرة (عنوان عمود الفوتر)' } },
                ],
                showIf: { key: 'type', in: ['heading'] },
              },
              { key: 'link', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' }, showIf: { key: 'type', in: ['heading', 'image'] } },
              { key: 'html', type: 'richtext', label: { en: 'Text', ar: 'النص' }, showIf: { key: 'type', in: ['text'] } },
              { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: { key: 'type', in: ['image'] } },
              { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' }, showIf: { key: 'type', in: ['image'] } },
              { ...IMAGE_SIZE_FIELD, showIf: { key: 'type', in: ['image'] } },
              {
                key: 'images',
                type: 'repeater',
                label: { en: 'Images', ar: 'الصور' },
                fields: [
                  { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
                  { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
                  { key: 'link', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
                ],
                showIf: { key: 'type', in: ['images'] },
              },
              { key: 'item_height_px', type: 'number', label: { en: 'Image height (px)', ar: 'ارتفاع الصورة (px)' }, min: 16, max: 200, defaultValue: 40, showIf: { key: 'type', in: ['images'] } },
              {
                key: 'socials',
                type: 'repeater',
                label: { en: 'Social links', ar: 'روابط التواصل' },
                fields: [
                  { key: 'platform', type: 'select', label: { en: 'Platform', ar: 'المنصّة' }, defaultValue: 'instagram', options: SOCIAL_PLATFORM_OPTIONS },
                  { key: 'url', type: 'text', label: { en: 'URL or handle', ar: 'الرابط أو المُعرّف' } },
                ],
                showIf: { key: 'type', in: ['social'] },
              },
              { key: 'icon_size_px', type: 'number', label: { en: 'Icon size (px)', ar: 'حجم الأيقونة (px)' }, min: 12, max: 48, defaultValue: 20, showIf: { key: 'type', in: ['social'] } },
              {
                key: 'icon_color',
                type: 'select',
                label: { en: 'Icon colour', ar: 'لون الأيقونات' },
                defaultValue: 'theme',
                options: [
                  { value: 'theme', label: { en: 'Theme (tone / colour below)', ar: 'الثيم (النبرة / اللون أدناه)' } },
                  { value: 'brand', label: { en: 'Brand colours', ar: 'ألوان المنصّات' } },
                ],
                showIf: { key: 'type', in: ['social'] },
              },
              { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true, showIf: { key: 'type', in: ['image'] } },
              { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' }, showIf: { key: 'type', in: ['button'] } },
              { key: 'button_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' }, showIf: { key: 'type', in: ['button'] } },
              {
                key: 'button_variant',
                type: 'select',
                label: { en: 'Button style', ar: 'نمط الزر' },
                defaultValue: 'solid',
                options: [
                  { value: 'solid', label: { en: 'Solid', ar: 'صلب' } },
                  { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
                ],
                showIf: { key: 'type', in: ['button'] },
              },
              { key: 'height_px', type: 'number', label: { en: 'Height (px)', ar: 'الارتفاع (px)' }, min: 4, max: 200, defaultValue: 24, showIf: { key: 'type', in: ['spacer'] } },
              { key: 'raw_html', type: 'textarea', label: { en: 'HTML', ar: 'HTML' }, showIf: { key: 'type', in: ['html'] } },
              {
                key: 'align',
                type: 'select',
                label: { en: 'Align', ar: 'المحاذاة' },
                defaultValue: 'start',
                options: ALIGNMENT_OPTIONS,
                showIf: { key: 'type', in: ['heading', 'text', 'button', 'html', 'images', 'social'] },
              },
              {
                key: 'tone',
                type: 'select',
                label: { en: 'Text tone', ar: 'درجة النص' },
                defaultValue: 'default',
                options: [
                  { value: 'default', label: { en: 'Theme text', ar: 'نص الثيم' } },
                  { value: 'muted', label: { en: 'Muted (softer)', ar: 'خافت (أهدأ)' } },
                ],
                showIf: { key: 'type', in: ['heading', 'text', 'social'] },
              },
              { key: 'color', type: 'color', label: { en: 'Color', ar: 'اللون' }, showIf: { key: 'type', in: ['heading', 'text', 'divider', 'social'] } },
            ],
          },
        ],
      },
    ],
    defaultSettings: {
      mode: 'grid',
      columns: 2,
      columns_tablet: 2,
      columns_mobile: 1,
      direction: 'row',
      wrap: true,
      gap_px: 24,
      align: 'stretch',
      justify: 'start',
    },
    defaultContent: {
      cells: [
        {
          col_span: 1,
          align: 'stretch',
          blocks: [
            { type: 'heading', text: 'Column one', level: 'h3', align: 'start' },
            { type: 'text', html: '<p>Describe something here. This block supports rich text.</p>', align: 'start' },
            { type: 'button', button_label: 'Learn more', button_url: '#', button_variant: 'solid', align: 'start' },
          ],
        },
        {
          col_span: 1,
          align: 'stretch',
          blocks: [
            { type: 'heading', text: 'Column two', level: 'h3', align: 'start' },
            { type: 'text', html: '<p>Another column of content sitting side by side.</p>', align: 'start' },
          ],
        },
      ],
    },
  },
  // ── Layout containers ──────────────────────────────────────────────
  // Sections that hold other sections (children carry parent_id). Only these
  // three keys may be parents; see lib/sectionTree.ts for the nesting rules.
  // Each child's placement lives in its own settings._layout (CHILD_LAYOUT_FIELDS).
  {
    id: 'layout-row',
    label: { en: 'Row', ar: 'صف' },
    icon: 'columns',
    category: 'layout',
    description: {
      en: 'Places sections side by side in columns. Stacks on smaller screens.',
      ar: 'يضع الأقسام جنباً إلى جنب في أعمدة، وتتكدّس على الشاشات الأصغر.',
    },
    translatable: [],
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    schema: [
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'المسافة بين الأعمدة (px)' }, min: 0, max: 200, defaultValue: 32 },
      // Optional: empty = same gap as the wider screen (no default on purpose).
      {
        key: 'gap_tablet_px',
        type: 'number',
        label: { en: 'Gap on tablet (px)', ar: 'المسافة على الجهاز اللوحي (px)' },
        description: { en: 'Empty = same as desktop.', ar: 'فارغ = مثل الكمبيوتر.' },
        min: 0,
        max: 200,
      },
      {
        key: 'gap_mobile_px',
        type: 'number',
        label: { en: 'Gap on mobile (px)', ar: 'المسافة على الجوال (px)' },
        description: { en: 'Empty = same as tablet.', ar: 'فارغ = مثل الجهاز اللوحي.' },
        min: 0,
        max: 200,
      },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical alignment', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: CONTAINER_ALIGN_OPTIONS,
      },
      {
        key: 'child_width',
        type: 'select',
        label: { en: 'Column width', ar: 'عرض الأعمدة' },
        defaultValue: 'fill',
        options: [
          { value: 'fill', label: { en: 'Fill the row (by ratio)', ar: 'ملء الصف (حسب النسبة)' } },
          { value: 'auto', label: { en: 'Fit the content', ar: 'بحسب المحتوى' } },
        ],
      },
      {
        key: 'justify',
        type: 'select',
        label: { en: 'Horizontal alignment', ar: 'المحاذاة الأفقية' },
        description: {
          en: 'Applies when columns fit their content.',
          ar: 'تُطبَّق عندما يكون عرض الأعمدة بحسب المحتوى.',
        },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'توزيع بالتساوي' } },
        ],
      },
      { key: 'wrap', type: 'boolean', label: { en: 'Wrap to new lines', ar: 'الالتفاف إلى سطر جديد' }, defaultValue: false },
      {
        key: 'stack_on',
        type: 'select',
        label: { en: 'Stack columns on', ar: 'تكديس الأعمدة على' },
        defaultValue: 'tablet',
        options: [
          { value: 'tablet', label: { en: 'Tablet and mobile', ar: 'الجهاز اللوحي والجوال' } },
          { value: 'mobile', label: { en: 'Mobile only', ar: 'الجوال فقط' } },
          { value: 'never', label: { en: 'Never', ar: 'أبداً' } },
        ],
      },
      { key: 'reverse_on_mobile', type: 'boolean', label: { en: 'Reverse order on mobile', ar: 'عكس الترتيب على الجوال' }, defaultValue: false },
    ],
    defaultSettings: {
      gap_px: 32,
      align: 'stretch',
      child_width: 'fill',
      justify: 'start',
      wrap: false,
      stack_on: 'tablet',
      reverse_on_mobile: false,
    },
    defaultContent: {},
  },
  {
    id: 'layout-column',
    label: { en: 'Column', ar: 'عمود' },
    icon: 'rows',
    category: 'layout',
    description: {
      en: 'Stacks sections vertically. Can stay in view while scrolling on desktop, e.g. a gallery column.',
      ar: 'يضع الأقسام فوق بعضها، ويمكن تثبيته أثناء التمرير على الكمبيوتر، مثل عمود الصور.',
    },
    translatable: [],
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    schema: [
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'المسافة بين الأقسام (px)' }, min: 0, max: 200, defaultValue: 16 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Horizontal alignment', ar: 'المحاذاة الأفقية' },
        defaultValue: 'stretch',
        options: CONTAINER_ALIGN_OPTIONS,
      },
      {
        key: 'sticky_desktop',
        type: 'boolean',
        label: { en: 'Sticky on desktop', ar: 'تثبيت أثناء التمرير على الكمبيوتر' },
        description: {
          en: 'Keeps the column in view while the next column scrolls.',
          ar: 'يبقى العمود ظاهراً بينما يتحرك العمود المجاور مع التمرير.',
        },
        defaultValue: false,
      },
      { key: 'sticky_top_px', type: 'number', label: { en: 'Sticky top offset (px)', ar: 'المسافة من الأعلى عند التثبيت (px)' }, min: 0, max: 400, defaultValue: 24 },
      {
        key: 'sticky_from',
        type: 'select',
        label: { en: 'Sticky from', ar: 'التثبيت ابتداءً من' },
        description: {
          en: 'Use "Tablet and desktop" when the row stacks on mobile only.',
          ar: 'اختر "الجهاز اللوحي والكمبيوتر" عندما يتكدّس الصف على الجوال فقط.',
        },
        defaultValue: 'desktop',
        options: [
          { value: 'desktop', label: { en: 'Desktop', ar: 'الكمبيوتر' } },
          { value: 'tablet', label: { en: 'Tablet and desktop', ar: 'الجهاز اللوحي والكمبيوتر' } },
        ],
      },
    ],
    defaultSettings: { gap_px: 16, align: 'stretch', sticky_desktop: false, sticky_top_px: 24, sticky_from: 'desktop' },
    defaultContent: {},
  },
  {
    id: 'layout-grid',
    label: { en: 'Grid', ar: 'شبكة' },
    icon: 'grid',
    category: 'layout',
    description: {
      en: 'Arranges sections in a responsive grid with its own column count per device.',
      ar: 'يرتّب الأقسام في شبكة متجاوبة بعدد أعمدة خاص لكل جهاز.',
    },
    translatable: [],
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    schema: [
      { key: 'columns_desktop', type: 'number', label: { en: 'Columns on desktop', ar: 'الأعمدة على الكمبيوتر' }, min: 1, max: 12, defaultValue: 2 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns on tablet', ar: 'الأعمدة على الجهاز اللوحي' }, min: 1, max: 12, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns on mobile', ar: 'الأعمدة على الجوال' }, min: 1, max: 12, defaultValue: 1 },
      { key: 'gap_px', type: 'number', label: { en: 'Column gap (px)', ar: 'المسافة بين الأعمدة (px)' }, min: 0, max: 200, defaultValue: 24 },
      { key: 'row_gap_px', type: 'number', label: { en: 'Row gap (px)', ar: 'المسافة بين الصفوف (px)' }, min: 0, max: 200, defaultValue: 24 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical alignment', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: CONTAINER_ALIGN_OPTIONS,
      },
    ],
    defaultSettings: { columns_desktop: 2, columns_tablet: 2, columns_mobile: 1, gap_px: 24, row_gap_px: 24, align: 'stretch' },
    defaultContent: {},
  },
  {
    id: 'featured-products',
    label: { en: 'Featured Products', ar: 'منتجات مميّزة' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'Auto-loads a row of products from your catalogue.',
      ar: 'يجلب صف من المنتجات من كتالوجك.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'filter',
        type: 'select',
        label: { en: 'Pick from', ar: 'اختر من' },
        defaultValue: 'newest',
        options: [
          { value: 'newest', label: { en: 'Newest', ar: 'الأحدث' } },
          { value: 'featured', label: { en: 'Featured only', ar: 'المميّزة فقط' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect ratio', ar: 'نسبة أبعاد الصور' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 12, defaultValue: 4 },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص الرابط' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      ...textColorFields({ heading: true, subheading: true }),
      c('link_color', 'See-all link color', 'لون رابط الكل'),
    ],
    defaultSettings: { filter: 'newest', aspect: 'square', limit: 4, columns: 4, columns_tablet: 3, columns_mobile: 2 },
    defaultContent: {
      heading: 'Featured products',
      subheading: 'Handpicked picks from our latest catalogue.',
      link_label: 'View all',
    },
  },
  {
    id: 'product-slider',
    label: { en: 'Product Slider', ar: 'سلايدر المنتجات' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'Auto-loaded products in a horizontal carousel. Per-device slides-per-view, optional autoplay.',
      ar: 'منتجات يتم جلبها تلقائياً ضمن سلايدر أفقي. عدد شرائح مستقل لكل جهاز وتشغيل تلقائي اختياري.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'filter',
        type: 'select',
        label: { en: 'Pick from', ar: 'اختر من' },
        defaultValue: 'newest',
        options: [
          { value: 'newest', label: { en: 'Newest', ar: 'الأحدث' } },
          { value: 'featured', label: { en: 'Featured only', ar: 'المميّزة فقط' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect ratio', ar: 'نسبة أبعاد الصور' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 24, defaultValue: 8 },
      { key: 'slides_per_view', type: 'number', label: { en: 'Slides per view — desktop', ar: 'عدد الشرائح — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'slides_per_view_tablet', type: 'number', label: { en: 'Slides per view — tablet', ar: 'عدد الشرائح — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'slides_per_view_mobile', type: 'number', label: { en: 'Slides per view — mobile', ar: 'عدد الشرائح — جوال' }, min: 1, max: 4, defaultValue: 1.5 },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between slides (px)', ar: 'الفجوة بين الشرائح (px)' }, min: 0, max: 64, defaultValue: 16 },
      { key: 'autoplay_ms', type: 'number', label: { en: 'Autoplay (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' }, min: 0, max: 30000, defaultValue: 0 },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: false },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: false },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص رابط الكل' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      ...textColorFields({ heading: true, subheading: true }),
      c('link_color', 'See-all link color', 'لون رابط الكل'),
    ],
    defaultSettings: {
      filter: 'newest',
      aspect: 'square',
      limit: 8,
      slides_per_view: 4,
      slides_per_view_tablet: 3,
      slides_per_view_mobile: 1.5,
      gap_px: 16,
      autoplay_ms: 0,
      show_arrows: true,
      show_dots: false,
      loop: false,
    },
    defaultContent: { heading: 'Featured products' },
  },
  {
    id: 'collection-products',
    label: { en: 'Collection products', ar: 'منتجات مجموعة' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'A grid of products from one storefront collection or tag. Independent column counts per breakpoint.',
      ar: 'شبكة منتجات من مجموعة في المتجر أو وسم. عدد أعمدة مستقل لكل جهاز.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'category', type: 'collectionPicker', label: { en: 'Collection', ar: 'المجموعة' }, description: { en: 'Pick a storefront collection or a tag — its products fill the grid.', ar: 'اختر مجموعة من المتجر أو وسماً — تُعرض منتجاته في الشبكة.' } },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect ratio', ar: 'نسبة أبعاد الصور' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 24, defaultValue: 8 },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص رابط الكل' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' }, description: { en: 'Usually the collection page. Left empty with a collection picked, the link is hidden (it no longer falls back to all products).', ar: 'عادةً صفحة المجموعة. إن تُرك فارغاً مع اختيار مجموعة يُخفى الرابط (لم يعد يذهب إلى كل المنتجات).' } },
      ...textColorFields({ heading: true, subheading: true }),
      c('link_color', 'See-all link color', 'لون رابط الكل'),
    ],
    defaultSettings: { aspect: 'square', limit: 8, columns: 4, columns_tablet: 3, columns_mobile: 2 },
    defaultContent: { heading: 'Shop the collection' },
  },
  {
    id: 'image-hotspots',
    label: { en: 'Image Hotspots', ar: 'نقاط تسوّق على الصورة' },
    icon: 'map-pin',
    category: 'commerce',
    description: {
      en: 'A lifestyle image with clickable markers — "shop the look" pins that reveal a title, note and link.',
      ar: 'صورة لايف ستايل بعلامات قابلة للنقر — دبابيس "تسوّق الإطلالة" تعرض عنواناً وملاحظة ورابطاً.',
    },
    translatable: ['heading', 'subheading', 'hotspots'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'hotspots',
        type: 'repeater',
        label: { en: 'Hotspots', ar: 'النقاط' },
        fields: [
          { key: 'x', type: 'number', label: { en: 'Horizontal position (%)', ar: 'الموضع الأفقي (%)' }, min: 0, max: 100 },
          { key: 'y', type: 'number', label: { en: 'Vertical position (%)', ar: 'الموضع العمودي (%)' }, min: 0, max: 100 },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, maxLength: 60 },
          { key: 'subtitle', type: 'text', label: { en: 'Subtitle', ar: 'العنوان الفرعي' }, maxLength: 80 },
          { key: 'url', type: 'url', label: { en: 'Link URL', ar: 'الرابط' } },
        ],
      },
      ...textColorFields({ heading: true, subheading: true }),
    ],
    defaultSettings: {},
    defaultContent: {
      heading: 'Shop the look',
      subheading: 'Tap a marker to explore every piece in this setup.',
      hotspots: [
        { x: 28, y: 34, title: 'Linen throw pillow', subtitle: 'Stonewashed, three colors', url: '/products' },
        { x: 55, y: 66, title: 'Oak coffee table', subtitle: 'Solid wood, hand-finished', url: '/products' },
        { x: 76, y: 22, title: 'Ceramic table lamp', subtitle: 'Warm, dimmable glow', url: '/products' },
      ],
    },
  },
  {
    id: 'pricing-table',
    label: { en: 'Pricing Table', ar: 'جدول الأسعار' },
    icon: 'table',
    category: 'commerce',
    description: {
      en: 'Side-by-side pricing plans with feature lists, badges, and a highlighted recommended plan.',
      ar: 'خطط أسعار متجاورة مع قوائم مزايا وشارات وخطة موصى بها مميّزة.',
    },
    translatable: ['heading', 'subheading', 'plans'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'plans',
        type: 'repeater',
        label: { en: 'Plans', ar: 'الخطط' },
        fields: [
          { key: 'name', type: 'text', label: { en: 'Plan name', ar: 'اسم الخطة' }, maxLength: 40 },
          { key: 'price', type: 'text', label: { en: 'Price', ar: 'السعر' }, maxLength: 20 },
          { key: 'period', type: 'text', label: { en: 'Period (e.g. /month)', ar: 'الفترة (مثل /شهرياً)' }, maxLength: 20 },
          { key: 'features', type: 'textarea', label: { en: 'Features', ar: 'المزايا' }, description: { en: 'One feature per line', ar: 'ميزة واحدة في كل سطر' }, maxLength: 400 },
          { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 30 },
          { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
          { key: 'badge', type: 'text', label: { en: 'Badge (optional)', ar: 'الشارة (اختياري)' }, maxLength: 20 },
          { key: 'highlighted', type: 'boolean', label: { en: 'Highlight this plan', ar: 'تمييز هذه الخطة' } },
        ],
      },
      // House overrides only — layout comes from the theme.
      ...textColorFields({ heading: true, subheading: true }),
      ...buttonStyleFields('cta'),
    ],
    defaultSettings: {},
    defaultContent: {
      heading: 'Simple, honest pricing',
      subheading: 'Pick the plan that fits — upgrade, downgrade, or cancel anytime.',
      plans: [
        {
          name: 'Starter',
          price: '$9',
          period: '/month',
          features: 'All core features\n10 projects\nEmail support\nBasic analytics',
          cta_text: 'Get started',
          cta_url: '#',
          highlighted: false,
        },
        {
          name: 'Growth',
          price: '$29',
          period: '/month',
          features: 'Everything in Starter\nUnlimited projects\nPriority support\nAdvanced analytics\nCustom domain',
          cta_text: 'Start free trial',
          cta_url: '#',
          badge: 'Most popular',
          highlighted: true,
        },
        {
          name: 'Scale',
          price: '$79',
          period: '/month',
          features: 'Everything in Growth\nDedicated manager\nSLA & uptime guarantee\nCustom integrations',
          cta_text: 'Contact sales',
          cta_url: '#',
          highlighted: false,
        },
      ],
    },
  },
  // ── Magic sections (product page templates only) ─────────────
  {
    id: 'product-page',
    label: { en: 'Product Page', ar: 'صفحة المنتج' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'The complete product body — gallery, price, bundles, variants, custom fields, shipping and tabs. Matches the full storefront product design.',
      ar: 'جسم المنتج الكامل — المعرض، السعر، الباندلز، الخيارات، الحقول المخصّصة، الشحن والتابات. مطابق لتصميم صفحة المنتج الكامل.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    // `trust_badges` is per-locale content: the owner writes each claim
    // themselves, so nothing is asserted on their behalf. Legacy sections may
    // still carry `settings.show_trust_badges`; it is ignored everywhere.
    translatable: ['trust_badges'],
    schema: [
      {
        key: 'trust_badges',
        type: 'repeater',
        label: { en: 'Trust badges', ar: 'شارات الثقة' },
        description: {
          en: 'Only state what is true for this store (e.g. shipping terms, returns, payment). Nothing is shown until you add badges.',
          ar: 'اذكر فقط ما ينطبق فعلاً على متجرك (مثل شروط الشحن، الإرجاع، الدفع). لا يظهر شيء حتى تضيف شارات.',
        },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: TRUST_BADGE_ICON_OPTIONS },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description (optional)', ar: 'الوصف (اختياري)' } },
        ],
      },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping & delivery', ar: 'إظهار الشحن والتوصيل' }, defaultValue: true },
      { key: 'show_tabs', type: 'boolean', label: { en: 'Show tabs (description / specs / FAQ)', ar: 'إظهار التابات (الوصف / المواصفات / الأسئلة)' }, defaultValue: true },
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Add-to-cart button style', ar: 'نمط زر الإضافة للسلة' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
      {
        key: 'gallery_aspect',
        type: 'select',
        label: { en: 'Gallery aspect ratio', ar: 'نسبة أبعاد المعرض' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
    ],
    defaultSettings: {
      show_shipping: true,
      show_tabs: true,
      button_style: 'solid',
      gallery_aspect: 'square',
    },
  },
  {
    id: 'product-listing',
    label: { en: 'Product Listing', ar: 'قائمة المنتجات' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: "The complete catalog body — banner, search, collections, sorting and the product grid. Renders the store's live products.",
      ar: 'جسم الكتالوج الكامل — البانر، البحث، التصنيفات، الفرز وشبكة المنتجات. يعرض منتجات المتجر الفعلية.',
    },
    pageTypes: ['CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE'],
    // Heading/subheading are optional overrides used by the catalog page only;
    // a collection page always shows the collection's own name/description.
    translatable: ['heading', 'subheading'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading override (catalog only)', ar: 'عنوان بديل (للكتالوج فقط)' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading (catalog only)', ar: 'عنوان فرعي (للكتالوج فقط)' } },
      { key: 'show_hero', type: 'boolean', label: { en: 'Show page banner', ar: 'إظهار بانر الصفحة' }, defaultValue: true },
      {
        key: 'hero_height',
        type: 'select',
        label: { en: 'Banner height', ar: 'ارتفاع البانر' },
        defaultValue: 'auto',
        options: [
          { value: 'auto', label: { en: 'Auto (store setting)', ar: 'تلقائي (إعداد المتجر)' } },
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'show_count', type: 'boolean', label: { en: 'Show product count', ar: 'إظهار عدد المنتجات' }, defaultValue: true },
      { key: 'show_search', type: 'boolean', label: { en: 'Show search box', ar: 'إظهار مربع البحث' }, defaultValue: true },
      { key: 'show_collections', type: 'boolean', label: { en: 'Show collection filters / sub-collections', ar: 'إظهار فلاتر التصنيفات / التصنيفات الفرعية' }, defaultValue: true },
      { key: 'show_sort', type: 'boolean', label: { en: 'Show sort options', ar: 'إظهار خيارات الفرز' }, defaultValue: true },
      { key: 'show_description', type: 'boolean', label: { en: 'Show collection description (collection page)', ar: 'إظهار وصف التصنيف (صفحة التصنيف)' }, defaultValue: true },
      {
        key: 'description_collapsed',
        type: 'boolean',
        label: { en: 'Collapse collection description (show more button)', ar: 'طيّ وصف التصنيف (زر عرض المزيد)' },
        defaultValue: true,
      },
      {
        key: 'description_lines',
        type: 'number',
        label: { en: 'Description lines visible when collapsed', ar: 'أسطر الوصف الظاهرة عند الطيّ' },
        min: 2,
        max: 12,
        defaultValue: 3,
      },
      { key: 'show_back_link', type: 'boolean', label: { en: 'Show "All collections" link (collection page)', ar: 'إظهار رابط "كل التصنيفات" (صفحة التصنيف)' }, defaultValue: true },
      {
        key: 'show_long_description',
        type: 'boolean',
        label: { en: 'Show long description (collection page)', ar: 'إظهار الوصف الطويل (صفحة التصنيف)' },
        defaultValue: true,
      },
      {
        key: 'long_description_position',
        type: 'select',
        label: { en: 'Long description position', ar: 'موضع الوصف الطويل' },
        defaultValue: 'below',
        options: [
          { value: 'below', label: { en: 'Below the products', ar: 'أسفل المنتجات' } },
          { value: 'above', label: { en: 'Above the products (under the banner)', ar: 'أعلى المنتجات (تحت البانر)' } },
        ],
      },
      {
        key: 'long_description_collapsed',
        type: 'boolean',
        label: { en: 'Collapse long description (show more button)', ar: 'طيّ الوصف الطويل (زر عرض المزيد)' },
        defaultValue: false,
      },
      {
        key: 'long_description_lines',
        type: 'number',
        label: { en: 'Visible lines when collapsed', ar: 'عدد الأسطر الظاهرة عند الطيّ' },
        min: 2,
        max: 12,
        defaultValue: 3,
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect ratio', ar: 'نسبة أبعاد الصور' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
    ],
    defaultSettings: {
      show_hero: true,
      hero_height: 'auto',
      show_count: true,
      show_search: true,
      show_collections: true,
      show_sort: true,
      show_description: true,
      description_collapsed: true,
      description_lines: 3,
      show_back_link: true,
      show_long_description: true,
      long_description_position: 'below',
      long_description_collapsed: false,
      long_description_lines: 3,
      aspect: 'square',
      columns: 4,
      columns_tablet: 3,
      columns_mobile: 2,
    },
  },
  {
    id: 'product-gallery',
    label: { en: 'Product Gallery', ar: 'معرض المنتج' },
    icon: 'gallery',
    category: 'product',
    description: {
      en: 'Product images that follow the chosen variant and colour. Classic (as the product page), main+thumbnails, grid, stacked or carousel, with optional hover-zoom.',
      ar: 'صور المنتج تتبع الخيار واللون المختار. كلاسيكي (كصفحة المنتج)، رئيسي+مصغرات، شبكة، مكدّس أو شريط، مع تكبير عند المرور.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'main-thumbnails',
        options: [
          { value: 'classic', label: { en: 'Classic (as the product page)', ar: 'كلاسيكي (كصفحة المنتج)' } },
          { value: 'main-thumbnails', label: { en: 'Main + Thumbnails', ar: 'رئيسي + مصغرات' } },
          { value: 'carousel', label: { en: 'Carousel', ar: 'شريط' } },
          { value: 'grid', label: { en: 'Two-column grid', ar: 'شبكة عمودين' } },
          { value: 'stacked', label: { en: 'Stacked', ar: 'مكدّس' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
        ],
      },
      { key: 'enable_zoom', type: 'boolean', label: { en: 'Hover to zoom', ar: 'تكبير عند المرور' }, defaultValue: true },
    ],
    defaultSettings: { layout: 'main-thumbnails', aspect: 'square', enable_zoom: true },
  },
  {
    id: 'product-details',
    label: { en: 'Product Details', ar: 'تفاصيل المنتج' },
    icon: 'info',
    category: 'product',
    description: {
      en: 'Title, price and description of the product, following the chosen variant, with optional sale badge and share buttons.',
      ar: 'عنوان المنتج وسعره ووصفه، يتبع الخيار المختار، مع شارة خصم وأزرار مشاركة اختيارية.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    // `show_rating` (a placeholder rating row) is no longer offered or
    // rendered; saved templates may still carry it and it is ignored.
    schema: [
      { key: 'show_sale_badge', type: 'boolean', label: { en: 'Show sale badge', ar: 'شارة الخصم' }, defaultValue: true },
      { key: 'show_price', type: 'boolean', label: { en: 'Show price', ar: 'إظهار السعر' }, defaultValue: true },
      { key: 'show_compare_at', type: 'boolean', label: { en: 'Show compare-at price', ar: 'السعر قبل الخصم' }, defaultValue: true },
      { key: 'show_description', type: 'boolean', label: { en: 'Show description', ar: 'إظهار الوصف' }, defaultValue: true },
      { key: 'show_share', type: 'boolean', label: { en: 'Show share/wishlist', ar: 'مشاركة/قائمة الأمنيات' }, defaultValue: false },
    ],
    defaultSettings: {
      show_sale_badge: true,
      show_price: true,
      show_compare_at: true,
      show_description: true,
      show_share: false,
    },
  },
  {
    id: 'product-tabs',
    label: { en: 'Product Tabs', ar: 'تبويبات المنتج' },
    icon: 'tabs',
    category: 'product',
    description: {
      en: 'Tabbed view of description, specifications, FAQs, shipping and returns.',
      ar: 'تبويبات للوصف، المواصفات، الأسئلة الشائعة، الشحن والإرجاع.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [
      'tab_description_label',
      'tab_specifications_label',
      'tab_faqs_label',
      'tab_shipping_label',
      'tab_returns_label',
      'shipping_html',
      'returns_html',
    ],
    schema: [
      { key: 'show_description', type: 'boolean', label: { en: 'Show description tab', ar: 'تبويب الوصف' }, defaultValue: true },
      { key: 'show_specifications', type: 'boolean', label: { en: 'Show specifications tab', ar: 'تبويب المواصفات' }, defaultValue: true },
      { key: 'show_faqs', type: 'boolean', label: { en: 'Show FAQs tab', ar: 'تبويب الأسئلة الشائعة' }, defaultValue: true },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping tab', ar: 'تبويب الشحن' }, defaultValue: false },
      { key: 'show_returns', type: 'boolean', label: { en: 'Show returns tab', ar: 'تبويب الإرجاع' }, defaultValue: false },
      { key: 'tab_description_label', type: 'text', label: { en: 'Description tab label', ar: 'عنوان تبويب الوصف' } },
      { key: 'tab_specifications_label', type: 'text', label: { en: 'Specifications tab label', ar: 'عنوان تبويب المواصفات' } },
      { key: 'tab_faqs_label', type: 'text', label: { en: 'FAQs tab label', ar: 'عنوان تبويب الأسئلة' } },
      { key: 'tab_shipping_label', type: 'text', label: { en: 'Shipping tab label', ar: 'عنوان تبويب الشحن' } },
      { key: 'tab_returns_label', type: 'text', label: { en: 'Returns tab label', ar: 'عنوان تبويب الإرجاع' } },
      { key: 'shipping_html', type: 'richtext', label: { en: 'Shipping content', ar: 'محتوى الشحن' } },
      { key: 'returns_html', type: 'richtext', label: { en: 'Returns content', ar: 'محتوى الإرجاع' } },
    ],
    defaultSettings: { show_description: true, show_specifications: true, show_faqs: true, show_shipping: false, show_returns: false },
  },
  {
    id: 'add-to-cart',
    label: { en: 'Add to Cart', ar: 'إضافة للسلة' },
    icon: 'shopping-cart',
    category: 'product',
    description: {
      en: 'Options (swatches, size pills), personalization fields, price, quantity and the add-to-cart button in one block, following the page’s product state. Optional sticky mobile CTA.',
      ar: 'الخيارات (دوائر الألوان، المقاسات) وحقول التخصيص والسعر والكمية وزر الإضافة للسلة في قسم واحد، يتبع حالة المنتج في الصفحة. زر ثابت أسفل الجوال اختياري.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: ['button_label'],
    schema: [
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Button style', ar: 'نمط الزر' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'صلب' } },
          { value: 'outline', label: { en: 'Outline', ar: 'مخطّط' } },
        ],
      },
      { key: 'full_width', type: 'boolean', label: { en: 'Full width button', ar: 'زر بعرض كامل' }, defaultValue: true },
      { key: 'show_quantity', type: 'boolean', label: { en: 'Show quantity picker', ar: 'إظهار اختيار الكمية' }, defaultValue: true },
      { key: 'show_stock', type: 'boolean', label: { en: 'Show stock level', ar: 'إظهار الكمية المتوفرة' }, defaultValue: false },
      { key: 'sticky_on_mobile', type: 'boolean', label: { en: 'Sticky CTA on mobile', ar: 'زر ثابت أسفل الجوال' }, defaultValue: false },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
    ],
    defaultSettings: {
      button_style: 'solid',
      full_width: true,
      show_quantity: true,
      show_stock: false,
      sticky_on_mobile: false,
    },
  },
  // ── Product blocks (PRODUCT_TEMPLATE only) ─────────────────────────
  // Separate blocks that all read the storefront's shared product page state
  // (web: themes/minimal/sections/product/blocks/registryB1.ts + registryB2.ts).
  // Gated together with the layout containers so one per-store flag turns the
  // whole block-based product page on. The four older split sections above
  // (product-gallery, product-details, product-tabs, add-to-cart) stay ungated.
  {
    id: 'product-breadcrumb',
    label: { en: 'Product breadcrumb', ar: 'مسار تنقل المنتج' },
    icon: 'chevrons-right',
    category: 'product',
    description: {
      en: 'Home › collection › product, from the product’s primary collection.',
      ar: 'الرئيسية › المجموعة › المنتج، حسب المجموعة الأساسية للمنتج.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [
      { key: 'show_current', type: 'boolean', label: { en: 'Show product name', ar: 'إظهار اسم المنتج' }, defaultValue: true },
    ],
    defaultSettings: { show_current: true },
  },
  {
    id: 'product-title',
    label: { en: 'Product title', ar: 'عنوان المنتج' },
    icon: 'type',
    category: 'product',
    description: {
      en: 'The product name (H1), with its primary collection above and the seller below.',
      ar: 'اسم المنتج (H1)، مع مجموعته الأساسية فوقه والبائع تحته.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [
      { key: 'show_collection', type: 'boolean', label: { en: 'Show primary collection', ar: 'إظهار المجموعة الأساسية' }, defaultValue: true },
      { key: 'show_vendor', type: 'boolean', label: { en: 'Show seller', ar: 'إظهار البائع' }, defaultValue: true },
    ],
    defaultSettings: { show_collection: true, show_vendor: true },
  },
  {
    id: 'product-price',
    label: { en: 'Product price', ar: 'سعر المنتج' },
    icon: 'tag',
    category: 'product',
    description: {
      en: 'Price of the chosen variant × quantity, with compare-at price, savings and tax note. Follows bundles and personalization.',
      ar: 'سعر الخيار المختار × الكمية، مع السعر قبل الخصم والتوفير وملاحظة الضريبة. يتبع العروض والتخصيص.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [
      { key: 'show_compare_at', type: 'boolean', label: { en: 'Show compare-at price', ar: 'إظهار السعر قبل الخصم' }, defaultValue: true },
      { key: 'show_savings', type: 'boolean', label: { en: 'Show savings', ar: 'إظهار مبلغ التوفير' }, defaultValue: true },
      { key: 'show_unit_price', type: 'boolean', label: { en: 'Show unit price × quantity', ar: 'إظهار سعر القطعة × الكمية' }, defaultValue: true },
      { key: 'show_sku', type: 'boolean', label: { en: 'Show SKU', ar: 'إظهار رمز المنتج (SKU)' }, defaultValue: true },
      { key: 'show_coupon', type: 'boolean', label: { en: 'Show coupon banner (campaign link / applied code)', ar: 'إظهار شريط كود الخصم (رابط الحملة / الكود المطبَّق)' }, defaultValue: true },
    ],
    defaultSettings: { show_compare_at: true, show_savings: true, show_unit_price: true, show_sku: true, show_coupon: true },
  },
  {
    id: 'product-short-description',
    label: { en: 'Short description', ar: 'الوصف المختصر' },
    icon: 'text',
    category: 'product',
    description: {
      en: 'The product’s short summary.',
      ar: 'الملخص القصير للمنتج.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [],
    defaultSettings: {},
  },
  {
    id: 'product-promotions',
    label: { en: 'Promotions', ar: 'العروض' },
    icon: 'tag',
    category: 'product',
    description: {
      en: 'Active promotions on the product: flash sale, buy X get Y, free shipping, discounts.',
      ar: 'العروض الفعّالة على المنتج: تخفيض سريع، اشترِ X واحصل على Y، شحن مجاني، خصومات.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [
      { key: 'show_end_date', type: 'boolean', label: { en: 'Show end date', ar: 'إظهار تاريخ الانتهاء' }, defaultValue: true },
    ],
    defaultSettings: { show_end_date: true },
  },
  {
    id: 'product-bundles',
    label: { en: 'Bundle offers', ar: 'عروض الباقات' },
    icon: 'layers',
    category: 'product',
    description: {
      en: 'Quantity-tier bundle offers. Picking one sets the quantity and the price.',
      ar: 'عروض الباقات حسب الكمية. اختيار عرض يضبط الكمية والسعر.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [],
    defaultSettings: {},
  },
  {
    id: 'product-variants',
    label: { en: 'Variant picker', ar: 'اختيار الخيارات' },
    icon: 'palette',
    category: 'product',
    description: {
      en: 'Colour swatches, size pills and option cards. The gallery and price follow the choice.',
      ar: 'دوائر الألوان وأزرار المقاسات وبطاقات الخيارات. المعرض والسعر يتبعان الاختيار.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [],
    defaultSettings: {},
  },
  {
    id: 'product-personalization',
    label: { en: 'Personalization', ar: 'التخصيص' },
    icon: 'edit',
    category: 'product',
    description: {
      en: 'Personalization fields, custom fields, customer upload and the designer form.',
      ar: 'حقول التخصيص، الحقول المخصّصة، رفع ملف العميل ونموذج المصمّم.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [
      {
        key: 'placement',
        type: 'select',
        label: { en: 'Show', ar: 'العرض' },
        description: {
          en: 'Split the form around the variants block: add one block set to "Before variants" above it and one set to "After variants" below it.',
          ar: 'قسّم النموذج حول قسم الخيارات: أضف قسماً بـ"قبل الخيارات" فوقه وقسماً بـ"بعد الخيارات" تحته.',
        },
        defaultValue: 'all',
        options: [
          { value: 'all', label: { en: 'Everything', ar: 'الكل' } },
          { value: 'before_variants', label: { en: 'Before variants (fields only)', ar: 'قبل الخيارات (الحقول فقط)' } },
          { value: 'after_variants', label: { en: 'After variants', ar: 'بعد الخيارات' } },
        ],
      },
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Designer button style', ar: 'نمط زر المصمّم' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
    ],
    defaultSettings: { placement: 'all', show_heading: true, button_style: 'solid' },
  },
  {
    id: 'product-buy',
    label: { en: 'Quantity + add to cart', ar: 'الكمية + إضافة للسلة' },
    icon: 'shopping-cart',
    category: 'product',
    description: {
      en: 'Quantity picker (stock and bundle aware) and the add-to-cart button, with an optional sticky button on mobile.',
      ar: 'اختيار الكمية (حسب المخزون والعروض) وزر الإضافة للسلة، مع زر ثابت اختياري أسفل الجوال.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: ['button_label'],
    schema: [
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Button style', ar: 'نمط الزر' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
      { key: 'show_quantity', type: 'boolean', label: { en: 'Show quantity picker', ar: 'إظهار اختيار الكمية' }, defaultValue: true },
      { key: 'sticky_on_mobile', type: 'boolean', label: { en: 'Sticky button on mobile', ar: 'زر ثابت أسفل الجوال' }, defaultValue: false },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
    ],
    defaultSettings: { button_style: 'solid', show_quantity: true, sticky_on_mobile: false },
  },
  {
    id: 'product-trust',
    label: { en: 'Trust badges (product)', ar: 'شارات الثقة (المنتج)' },
    icon: 'shield',
    category: 'product',
    description: {
      en: 'Your own reassurance badges next to the product. Nothing is shown until you add badges.',
      ar: 'شارات الثقة الخاصة بك بجانب المنتج. لا يظهر شيء حتى تضيف شارات.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    // Per-locale content: the owner writes each claim themselves.
    translatable: ['trust_badges'],
    schema: [
      {
        key: 'trust_badges',
        type: 'repeater',
        label: { en: 'Trust badges', ar: 'شارات الثقة' },
        description: {
          en: 'Only state what is true for this store (e.g. shipping terms, returns, payment).',
          ar: 'اذكر فقط ما ينطبق فعلاً على متجرك (مثل شروط الشحن، الإرجاع، الدفع).',
        },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: TRUST_BADGE_ICON_OPTIONS },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description (optional)', ar: 'الوصف (اختياري)' } },
        ],
      },
      {
        key: 'columns',
        type: 'select',
        label: { en: 'Columns', ar: 'الأعمدة' },
        defaultValue: '2',
        options: [
          { value: '1', label: { en: 'One', ar: 'عمود واحد' } },
          { value: '2', label: { en: 'Two', ar: 'عمودان' } },
        ],
      },
    ],
    defaultSettings: { columns: '2' },
  },
  {
    id: 'product-shipping',
    label: { en: 'Shipping info', ar: 'معلومات الشحن' },
    icon: 'truck',
    category: 'product',
    description: {
      en: 'Shipping zones and methods of the product: cost, delivery days, free-shipping threshold.',
      ar: 'مناطق وطرق شحن المنتج: التكلفة، أيام التوصيل، حد الشحن المجاني.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: [],
    schema: [
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
    ],
    defaultSettings: { show_heading: true },
  },
  // Standalone pieces of product-tabs (web registryB3.ts); product-tabs stays.
  // Each gets a heading tag select via HEADING_LEVEL_DEFAULTS below.
  {
    id: 'product-description',
    label: { en: 'Product description', ar: 'وصف المنتج' },
    icon: 'align-left',
    category: 'product',
    description: {
      en: 'The product’s full description.',
      ar: 'الوصف الكامل للمنتج.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: ['heading'],
    schema: [
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      {
        key: 'heading',
        type: 'text',
        label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' },
        description: {
          en: 'Leave empty to use the default word in the page language.',
          ar: 'اتركه فارغاً لاستخدام الكلمة الافتراضية بلغة الصفحة.',
        },
      },
    ],
    defaultSettings: { show_heading: true },
  },
  {
    id: 'product-specifications',
    label: { en: 'Specifications', ar: 'المواصفات' },
    icon: 'list',
    category: 'product',
    description: {
      en: 'The product’s specifications table.',
      ar: 'جدول مواصفات المنتج.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: ['heading'],
    schema: [
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      {
        key: 'heading',
        type: 'text',
        label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' },
        description: {
          en: 'Leave empty to use the default word in the page language.',
          ar: 'اتركه فارغاً لاستخدام الكلمة الافتراضية بلغة الصفحة.',
        },
      },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'الشكل' },
        defaultValue: 'striped',
        options: [
          { value: 'striped', label: { en: 'Striped table', ar: 'جدول مخطّط' } },
          { value: 'table', label: { en: 'Plain table', ar: 'جدول عادي' } },
          { value: 'list', label: { en: 'List', ar: 'قائمة' } },
        ],
      },
    ],
    defaultSettings: { show_heading: true, style: 'striped' },
  },
  {
    id: 'product-faq',
    label: { en: 'Product FAQ', ar: 'الأسئلة الشائعة للمنتج' },
    icon: 'help-circle',
    category: 'product',
    description: {
      en: 'The product’s FAQs as questions that open and close.',
      ar: 'أسئلة المنتج الشائعة كقائمة تُفتح وتُغلق.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: ['heading'],
    schema: [
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      {
        key: 'heading',
        type: 'text',
        label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' },
        description: {
          en: 'Leave empty to use the default word in the page language.',
          ar: 'اتركه فارغاً لاستخدام الكلمة الافتراضية بلغة الصفحة.',
        },
      },
      { key: 'open_first', type: 'boolean', label: { en: 'Open the first question', ar: 'فتح السؤال الأول تلقائياً' }, defaultValue: false },
      {
        key: 'allow_multiple',
        type: 'boolean',
        label: { en: 'Allow several open at once', ar: 'السماح بفتح أكثر من سؤال' },
        defaultValue: true,
      },
    ],
    defaultSettings: { show_heading: true, open_first: false, allow_multiple: true },
  },
  // Customer stories (plans/customer-stories/CONTRACT.md 7.2 / 7.6). Keys and
  // defaults equal the web registry (registryB3.ts).
  {
    id: 'product-stories',
    label: { en: 'Customer stories', ar: 'قصص العملاء' },
    icon: 'quote',
    category: 'product',
    description: {
      en: 'Photo and video stories of real customers, entered in the product editor.',
      ar: 'قصص عملاء حقيقيين بالصور والفيديو، تُدخل من محرر المنتج.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: ['heading', 'subheading'],
    schema: [
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      {
        key: 'heading',
        type: 'text',
        label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' },
        description: {
          en: 'Leave empty to use the default word in the page language.',
          ar: 'اتركه فارغاً لاستخدام الكلمة الافتراضية بلغة الصفحة.',
        },
        defaultValue: '',
      },
      { key: 'subheading', type: 'text', label: { en: 'Subheading (optional)', ar: 'العنوان الفرعي (اختياري)' }, defaultValue: '' },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'طريقة العرض' },
        defaultValue: 'slider',
        options: [
          { value: 'slider', label: { en: 'Slider', ar: 'شريط متحرك' } },
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
          { value: 'overlay', label: { en: 'Cards with text on the media', ar: 'بطاقات والنص فوق الصورة' } },
        ],
      },
      {
        key: 'card_aspect',
        type: 'select',
        label: { en: 'Card shape', ar: 'شكل البطاقة' },
        defaultValue: 'portrait',
        options: [
          { value: 'portrait', label: { en: 'Portrait (9:16)', ar: 'طولي (9:16)' } },
          { value: 'portrait_4_5', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربع (1:1)' } },
          { value: 'landscape', label: { en: 'Landscape (16:9)', ar: 'عرضي (16:9)' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns (desktop)', ar: 'الأعمدة (سطح المكتب)' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns (tablet)', ar: 'الأعمدة (الجهاز اللوحي)' }, min: 1, max: 4, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns (mobile)', ar: 'الأعمدة (الجوال)' }, min: 1, max: 2, defaultValue: 1 },
      {
        key: 'text_position',
        type: 'select',
        label: { en: 'Text position', ar: 'موضع النص' },
        defaultValue: 'below',
        showIf: { key: 'layout', in: ['slider', 'grid'] },
        options: [
          { value: 'below', label: { en: 'Below the media', ar: 'أسفل الصورة' } },
          { value: 'overlay', label: { en: 'On the media', ar: 'فوق الصورة' } },
        ],
      },
      { key: 'show_rating', type: 'boolean', label: { en: 'Show stars', ar: 'إظهار النجوم' }, defaultValue: true },
      { key: 'show_subtitle', type: 'boolean', label: { en: 'Show role / company / city', ar: 'إظهار الوظيفة / الشركة / المدينة' }, defaultValue: true },
      { key: 'show_verified', type: 'boolean', label: { en: 'Show verified-buyer check', ar: 'إظهار علامة المشتري الموثّق' }, defaultValue: true },
    ],
    defaultSettings: {
      show_heading: true,
      heading: '',
      subheading: '',
      layout: 'slider',
      card_aspect: 'portrait',
      columns: 4,
      columns_tablet: 3,
      columns_mobile: 1,
      text_position: 'below',
      show_rating: true,
      show_subtitle: true,
      show_verified: true,
    },
  },
  {
    id: 'product-shipping-returns',
    label: { en: 'Shipping & returns', ar: 'الشحن والإرجاع' },
    icon: 'package',
    category: 'product',
    description: {
      en: 'Your shipping and returns texts, written in this block.',
      ar: 'نصّا الشحن والإرجاع الخاصّان بك، تكتبهما في هذا القسم.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    gate: 'layout-containers',
    translatable: ['shipping_heading', 'returns_heading', 'shipping_html', 'returns_html'],
    schema: [
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping', ar: 'إظهار الشحن' }, defaultValue: true },
      { key: 'show_returns', type: 'boolean', label: { en: 'Show returns', ar: 'إظهار الإرجاع' }, defaultValue: true },
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      { key: 'shipping_heading', type: 'text', label: { en: 'Shipping heading (optional)', ar: 'عنوان الشحن (اختياري)' } },
      { key: 'shipping_html', type: 'richtext', label: { en: 'Shipping content', ar: 'محتوى الشحن' } },
      { key: 'returns_heading', type: 'text', label: { en: 'Returns heading (optional)', ar: 'عنوان الإرجاع (اختياري)' } },
      { key: 'returns_html', type: 'richtext', label: { en: 'Returns content', ar: 'محتوى الإرجاع' } },
    ],
    defaultSettings: { show_shipping: true, show_returns: true, show_heading: true },
  },
  // ── Chrome sections (HEADER / FOOTER pages only) ────────────────
  {
    id: 'header-bar',
    label: { en: 'Header Bar', ar: 'شريط الهيدر' },
    icon: 'menu',
    category: 'header',
    description: {
      en: 'Logo, navigation, search, cart, account, and locale switcher in one bar. Falls back to store pages when no nav links are entered.',
      ar: 'شعار وروابط تنقل وبحث وسلة وحساب ومبدّل لغة في شريط واحد. يستخدم صفحات المتجر تلقائياً عند عدم إدخال روابط مخصّصة.',
    },
    pageTypes: ['HEADER'],
    translatable: ['items'],
    schema: [
      { key: 'show_logo', type: 'boolean', label: { en: 'Show logo', ar: 'إظهار الشعار' }, defaultValue: true },
      { key: 'show_store_name', type: 'boolean', label: { en: 'Show store name', ar: 'إظهار اسم المتجر' }, defaultValue: true },
      { key: 'logo_url', type: 'image', label: { en: 'Logo override (desktop, optional)', ar: 'استبدال الشعار (سطح المكتب، اختياري)' } },
      { key: 'logo_url_mobile', type: 'image', label: { en: 'Mobile logo (optional)', ar: 'شعار الجوال (اختياري)' } },
      { key: 'store_name_override', type: 'text', label: { en: 'Store name override (optional)', ar: 'استبدال اسم المتجر (اختياري)' } },
      { key: 'logo_size', type: 'number', label: { en: 'Logo size (px)', ar: 'حجم الشعار (px)' }, min: 16, max: 96, defaultValue: 32 },
      {
        // Unset reads as 'box' on the storefront (the square logo box every
        // stored header has today); new headers start with 'height'.
        key: 'logo_fit',
        type: 'select',
        label: L('Logo fit', 'ملاءمة الشعار', 'Logo sığdırma', 'Logo-Anpassung', 'Ajustement du logo', 'Logotypens anpassning'),
        description: L(
          'For a wide wordmark choose "Keep proportions": the logo is as tall as the logo size (at most 56 px) and as wide as it needs, up to five times its height.',
          'للشعار العريض اختر «الحفاظ على النِّسب»: يكون ارتفاع الشعار بحجم الشعار (56 بكسل كحد أقصى) وعرضه بحسب حاجته حتى خمسة أضعاف ارتفاعه.',
          'Geniş bir yazı logosu için "Oranları koru" seçeneğini kullanın: logo, logo boyutu kadar yüksek (en fazla 56 px) ve gerektiği kadar geniş olur (yüksekliğinin en fazla beş katı).',
          'Für eine breite Wortmarke „Proportionen beibehalten“ wählen: Das Logo ist so hoch wie die Logo-Größe (höchstens 56 px) und so breit wie nötig, bis zum Fünffachen seiner Höhe.',
          'Pour un logo large, choisissez « Conserver les proportions » : le logo a la hauteur de la taille du logo (56 px au maximum) et la largeur nécessaire, jusqu’à cinq fois sa hauteur.',
          'För en bred ordlogotyp, välj ”Behåll proportionerna”: logotypen blir lika hög som logotypstorleken (högst 56 px) och så bred som den behöver, upp till fem gånger sin höjd.',
        ),
        defaultValue: 'box',
        options: [
          { value: 'box', label: L('Inside a square', 'داخل مربع', 'Kare içinde', 'In einem Quadrat', 'Dans un carré', 'I en kvadrat') },
          { value: 'height', label: L('Keep proportions', 'الحفاظ على النِّسب', 'Oranları koru', 'Proportionen beibehalten', 'Conserver les proportions', 'Behåll proportionerna') },
        ],
      },
      { key: 'show_search', type: 'boolean', label: { en: 'Show search', ar: 'إظهار البحث' }, defaultValue: true },
      { key: 'show_cart', type: 'boolean', label: { en: 'Show cart', ar: 'إظهار السلة' }, defaultValue: true },
      {
        key: 'cart_action',
        type: 'select',
        label: { en: 'Cart click action', ar: 'سلوك زر السلة' },
        defaultValue: 'page',
        options: [
          { value: 'page', label: { en: 'Go to cart page', ar: 'الذهاب لصفحة السلة' } },
          { value: 'popup', label: { en: 'Open cart popup (drawer)', ar: 'فتح نافذة السلة المنبثقة' } },
        ],
      },
      { key: 'show_account', type: 'boolean', label: { en: 'Show account', ar: 'إظهار الحساب' }, defaultValue: false },
      { key: 'show_locale', type: 'boolean', label: { en: 'Show locale switcher', ar: 'إظهار مبدّل اللغة' }, defaultValue: true },
      {
        key: 'sticky_mode',
        type: 'select',
        label: { en: 'Sticky on scroll', ar: 'التثبيت عند التمرير' },
        defaultValue: 'always',
        options: [
          { value: 'always', label: { en: 'Always', ar: 'دائماً' } },
          { value: 'desktop', label: { en: 'Desktop only', ar: 'سطح المكتب فقط' } },
          { value: 'mobile', label: { en: 'Mobile only', ar: 'الجوال فقط' } },
          { value: 'none', label: { en: 'Never', ar: 'أبداً' } },
        ],
      },
      {
        // Opt-in: unset or false renders the bar as before. The storefront
        // ignores it when the bar is not sticky.
        key: 'compact_on_scroll',
        type: 'boolean',
        label: L('Compact on scroll', 'تصغير عند التمرير', 'Kaydırınca küçült', 'Beim Scrollen verkleinern', 'Compact au défilement', 'Kompakt vid rullning'),
        description: L(
          'The bar gets lower and the logo smaller once the page is scrolled. Needs "Sticky on scroll".',
          'يصبح الشريط أقل ارتفاعاً والشعار أصغر بعد تمرير الصفحة. يتطلب «التثبيت عند التمرير».',
          'Sayfa kaydırıldığında çubuk alçalır ve logo küçülür. "Sticky on scroll" ayarı gerekir.',
          'Sobald die Seite gescrollt wird, wird die Leiste niedriger und das Logo kleiner. Erfordert „Sticky on scroll“.',
          'La barre devient plus basse et le logo plus petit dès que la page défile. Nécessite « Sticky on scroll ».',
          'Fältet blir lägre och logotypen mindre när sidan har rullats. Kräver ”Sticky on scroll”.',
        ),
        defaultValue: false,
      },
      {
        key: 'submenu_style',
        type: 'select',
        label: { en: 'Submenu style (desktop)', ar: 'نمط القوائم الفرعية (سطح المكتب)' },
        description: {
          en: 'Mega menu: a top-level item whose sub-items have their own children opens a full-width panel (sub-items as column headings). Items without a third level keep the dropdown.',
          ar: 'القائمة الموسّعة: العنصر الرئيسي الذي تحتوي عناصره الفرعية على عناصر أبناء يفتح لوحة بعرض كامل (العناصر الفرعية كعناوين أعمدة). العناصر بدون مستوى ثالث تبقى قائمة منسدلة.',
        },
        defaultValue: 'dropdown',
        options: [
          { value: 'dropdown', label: { en: 'Dropdown list', ar: 'قائمة منسدلة' } },
          { value: 'mega', label: { en: 'Mega menu (columns)', ar: 'قائمة موسّعة (أعمدة)' } },
        ],
      },
      {
        key: 'active_style',
        type: 'select',
        label: { en: 'Active menu item style', ar: 'نمط عنصر القائمة النشط' },
        description: {
          en: 'Pill: the current page gets a filled rounded background in the accent colour (or the theme primary).',
          ar: 'كبسولة: تحصل الصفحة الحالية على خلفية دائرية مملوءة بلون التمييز (أو اللون الأساسي للثيم).',
        },
        defaultValue: 'text',
        options: [
          { value: 'text', label: { en: 'Accent text', ar: 'نص بلون التمييز' } },
          { value: 'pill', label: { en: 'Filled pill', ar: 'كبسولة مملوءة' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Bottom border color', ar: 'لون الحد السفلي' } },
      { key: 'accent_color', type: 'color', label: { en: 'Accent (active link / locale)', ar: 'لون التمييز (الرابط النشط / اللغة)' } },
      { key: 'menu_key', type: 'menuPicker', label: { en: 'Menu', ar: 'القائمة' }, description: { en: 'Pick a menu built in the Menus page. Leave as None to use the inline links below.', ar: 'اختر قائمة من صفحة القوائم. اتركها بدون لاستخدام الروابط أدناه.' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Inline links (used when no menu is selected)', ar: 'روابط مباشرة (تُستخدم عند عدم اختيار قائمة)' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
        ],
      },
    ],
    defaultSettings: {
      show_logo: true,
      show_store_name: true,
      show_search: true,
      show_cart: true,
      cart_action: 'page',
      show_account: false,
      show_locale: true,
      sticky_mode: 'always',
      submenu_style: 'dropdown',
      active_style: 'text',
      logo_size: 32,
      logo_fit: 'height',
    },
  },
  {
    id: 'footer-columns',
    label: { en: 'Footer Columns', ar: 'أعمدة الفوتر' },
    icon: 'columns',
    category: 'footer',
    description: {
      en: 'Responsive column-based link list. Auto-fits columns to width.',
      ar: 'قائمة روابط متعدّدة الأعمدة. تتكيّف الأعمدة مع العرض تلقائياً.',
    },
    pageTypes: ['FOOTER'],
    translatable: ['columns'],
    schema: [
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'heading_color', type: 'color', label: { en: 'Column heading color', ar: 'لون عناوين الأعمدة' } },
      { key: 'link_color', type: 'color', label: { en: 'Link color', ar: 'لون الروابط' } },
      {
        key: 'columns',
        type: 'repeater',
        label: { en: 'Columns', ar: 'الأعمدة' },
        fields: [
          { key: 'heading', type: 'text', label: { en: 'Column heading', ar: 'عنوان العمود' } },
          { key: 'menu_key', type: 'menuPicker', label: { en: 'Menu (optional — overrides links)', ar: 'القائمة (اختياري — تلغي الروابط)' } },
          {
            key: 'links',
            type: 'repeater',
            label: { en: 'Links (used when no menu key)', ar: 'الروابط (عند عدم وجود مفتاح قائمة)' },
            fields: [
              { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
              { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
            ],
          },
        ],
      },
    ],
    defaultSettings: {},
    // Links valid on every store; keep identical to the storefront copy
    // (multi-stores-web FooterColumns.tsx).
    defaultContent: {
      columns: [
        {
          heading: 'Shop',
          links: [
            { label: 'All products', url: '/products' },
            { label: 'Collections', url: '/collections' },
          ],
        },
        {
          heading: 'Help',
          links: [
            { label: 'Shipping', url: '/legal/shipping' },
            { label: 'Returns', url: '/legal/refund' },
            { label: 'Track my order', url: '/account/orders' },
          ],
        },
        {
          heading: 'Store',
          links: [
            { label: 'Terms', url: '/legal/terms' },
            { label: 'Privacy', url: '/legal/privacy' },
          ],
        },
      ],
    },
  },
  {
    id: 'copyright-bar',
    label: { en: 'Copyright Bar', ar: 'شريط حقوق النشر' },
    icon: 'copyright',
    category: 'footer',
    description: {
      en: 'Thin bottom strip. Tokens {year} and {store} auto-fill with the current year and store name.',
      ar: 'شريط سفلي رفيع. الرمزان {year} و {store} يُملآن تلقائياً.',
    },
    pageTypes: ['FOOTER'],
    translatable: ['text', 'payment_methods'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Copyright text (use {year} and {store})', ar: 'نص حقوق النشر (استخدم {year} و {store})' } },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'between',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'موزّع' } },
        ],
      },
      { key: 'show_payment_icons', type: 'boolean', label: { en: 'Show payment badges', ar: 'إظهار شارات الدفع' }, defaultValue: false },
      {
        key: 'payment_methods',
        type: 'repeater',
        label: { en: 'Payment badges', ar: 'شارات الدفع' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label (e.g. Visa, Mada)', ar: 'التسمية (مثل Visa, مدى)' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Top border color', ar: 'لون الحد العلوي' } },
    ],
    defaultSettings: { alignment: 'between', show_payment_icons: false },
    defaultContent: { text: '© {year} {store}' },
  },
  // ── Phase 2 chrome sections ─────────────────────────────────────
  {
    id: 'announcement-bar',
    label: { en: 'Announcement Bar', ar: 'شريط الإعلان' },
    icon: 'megaphone',
    category: 'header',
    description: {
      en: 'Thin promotional strip above the header. Single, marquee, or auto-rotate. Optional dismiss button persists per browser.',
      ar: 'شريط ترويجي رفيع فوق الهيدر. مفرد، متحرّك، أو تدوير تلقائي. زر إخفاء اختياري يتذكّر اختيار المستخدم.',
    },
    pageTypes: ['HEADER'],
    translatable: ['messages'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'simple',
        options: [
          { value: 'simple', label: { en: 'Single message', ar: 'رسالة واحدة' } },
          { value: 'marquee', label: { en: 'Scrolling marquee', ar: 'شريط متحرّك' } },
          { value: 'rotating', label: { en: 'Auto-rotate', ar: 'تدوير تلقائي' } },
        ],
      },
      {
        key: 'messages',
        type: 'repeater',
        label: { en: 'Messages', ar: 'الرسائل' },
        fields: [
          { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 160 },
          { key: 'link_label', type: 'text', label: { en: 'Inline link label (optional)', ar: 'نص الرابط داخل النص (اختياري)' }, maxLength: 40 },
          { key: 'link_url', type: 'url', label: { en: 'Link URL', ar: 'رابط الرابط' } },
          {
            key: 'badge',
            type: 'select',
            label: { en: 'Payment badge after the text', ar: 'شارة الدفع بعد النص' },
            defaultValue: 'none',
            options: [
              { value: 'none', label: { en: 'None', ar: 'بدون' } },
              { value: 'klarna', label: { en: 'Klarna', ar: 'Klarna' } },
            ],
          },
        ],
      },
      { key: 'rotate_ms', type: 'number', label: { en: 'Rotate interval (ms, rotating layout)', ar: 'فاصل التدوير (ms)' }, min: 2000, max: 30000, defaultValue: 5000 },
      { key: 'marquee_speed_s', type: 'number', label: { en: 'Marquee duration (s, marquee layout)', ar: 'مدة الشريط المتحرّك (s)' }, min: 8, max: 120, defaultValue: 25 },
      { key: 'dismissible', type: 'boolean', label: { en: 'Show close button', ar: 'إظهار زر الإغلاق' }, defaultValue: false },
      { key: 'dismiss_key', type: 'text', label: { en: 'Dismiss key (change to "show again")', ar: 'مفتاح الإخفاء (غيّره لإعادة الإظهار)' }, defaultValue: 'default' },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'link_color', type: 'color', label: { en: 'Inline link color', ar: 'لون الرابط الداخلي' } },
      {
        key: 'link_style',
        type: 'select',
        label: { en: 'Inline link style', ar: 'نمط الرابط الداخلي' },
        defaultValue: 'text',
        options: [
          { value: 'text', label: { en: 'Underlined text', ar: 'نص مسطّر' } },
          { value: 'button', label: { en: 'Outlined button', ar: 'زر بإطار' } },
        ],
      },
    ],
    defaultSettings: {
      layout: 'simple',
      rotate_ms: 5000,
      marquee_speed_s: 25,
      dismissible: false,
      dismiss_key: 'default',
      link_style: 'text',
    },
    defaultContent: {
      messages: [{ text: 'Welcome to our store', link_label: 'Shop now', link_url: '/products' }],
    },
  },
  {
    id: 'mega-menu',
    label: { en: 'Mega Menu', ar: 'القائمة الموسّعة' },
    icon: 'layout-grid',
    category: 'header',
    description: {
      en: 'Top-bar triggers that open a full-width panel with link columns + an optional feature card. Mobile collapses to an accordion.',
      ar: 'محفّزات في الشريط العلوي تكشف لوحة بعرض كامل بأعمدة روابط + بطاقة ميزة اختيارية. على الجوال تتحوّل إلى أكورديون.',
    },
    pageTypes: ['HEADER'],
    translatable: ['triggers'],
    schema: [
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Trigger alignment', ar: 'محاذاة المحفّزات' },
        defaultValue: 'center',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      {
        key: 'triggers',
        type: 'repeater',
        label: { en: 'Triggers', ar: 'المحفّزات' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Trigger label', ar: 'تسمية المحفّز' }, maxLength: 40 },
          { key: 'url', type: 'url', label: { en: 'Trigger URL', ar: 'رابط المحفّز' } },
          {
            key: 'columns',
            type: 'repeater',
            label: { en: 'Link columns', ar: 'أعمدة الروابط' },
            fields: [
              { key: 'heading', type: 'text', label: { en: 'Column heading', ar: 'عنوان العمود' } },
              {
                key: 'links',
                type: 'repeater',
                label: { en: 'Links', ar: 'الروابط' },
                fields: [
                  { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
                  { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
                ],
              },
            ],
          },
          {
            key: 'feature',
            type: 'repeater',
            label: { en: 'Feature card', ar: 'بطاقة ميزة' },
            fields: [
              { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
              { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'التسمية' } },
              { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
            ],
          },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Bar background color', ar: 'لون خلفية الشريط' } },
      { key: 'text_color', type: 'color', label: { en: 'Bar text color', ar: 'لون نص الشريط' } },
      { key: 'panel_bg_color', type: 'color', label: { en: 'Panel background color', ar: 'لون خلفية اللوحة' } },
      { key: 'panel_text_color', type: 'color', label: { en: 'Panel text color', ar: 'لون نص اللوحة' } },
      { key: 'accent_color', type: 'color', label: { en: 'Column heading color', ar: 'لون عنوان العمود' } },
      { key: 'border_color', type: 'color', label: { en: 'Border color', ar: 'لون الحدود' } },
    ],
    defaultSettings: { alignment: 'center' },
    // Links valid on every store; keep identical to the storefront copy
    // (multi-stores-web MegaMenu.tsx).
    defaultContent: {
      triggers: [
        {
          label: 'Shop',
          url: '/products',
          columns: [
            {
              heading: 'Browse',
              links: [
                { label: 'All products', url: '/products' },
                { label: 'New arrivals', url: '/products?sort=newest' },
                { label: 'Collections', url: '/collections' },
              ],
            },
            {
              heading: 'Help',
              links: [
                { label: 'Shipping', url: '/legal/shipping' },
                { label: 'Returns', url: '/legal/refund' },
                { label: 'Track my order', url: '/account/orders' },
              ],
            },
          ],
        },
        { label: 'Collections', url: '/collections' },
      ],
    },
  },
  {
    id: 'mobile-bottom-nav',
    label: { en: 'Mobile Bottom Nav', ar: 'شريط الجوال السفلي' },
    icon: 'smartphone',
    category: 'header',
    description: {
      en: 'Fixed icon bar at the bottom of the viewport on mobile only. Built-in destinations (Home, Search, Categories, Cart, Account, Menu) + a custom-link slot. Hidden ≥ md.',
      ar: 'شريط أيقونات ثابت أسفل الشاشة على الجوال فقط. وجهات جاهزة (الرئيسية، البحث، الفئات، السلة، الحساب، القائمة) + خانة رابط مخصّص. مخفي على الشاشات الأكبر.',
    },
    pageTypes: ['HEADER', 'FOOTER'],
    translatable: ['items'],
    schema: [
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Items (3–5 recommended)', ar: 'العناصر (3-5 موصى به)' },
        fields: [
          {
            key: 'type',
            type: 'select',
            label: { en: 'Type', ar: 'النوع' },
            defaultValue: 'home',
            options: [
              { value: 'home', label: { en: 'Home', ar: 'الرئيسية' } },
              { value: 'search', label: { en: 'Search', ar: 'البحث' } },
              { value: 'categories', label: { en: 'Categories', ar: 'الفئات' } },
              { value: 'cart', label: { en: 'Cart', ar: 'السلة' } },
              { value: 'account', label: { en: 'Account', ar: 'الحساب' } },
              { value: 'menu', label: { en: 'Menu (opens the header menu)', ar: 'القائمة (تفتح قائمة الهيدر)' } },
              { value: 'custom', label: { en: 'Custom link', ar: 'رابط مخصّص' } },
            ],
          },
          { key: 'label', type: 'text', label: { en: 'Label (optional override)', ar: 'التسمية (اختياري)' } },
          { key: 'url', type: 'url', label: { en: 'URL (optional override)', ar: 'الرابط (اختياري)' } },
        ],
      },
      { key: 'show_labels', type: 'boolean', label: { en: 'Show labels under icons', ar: 'إظهار التسمية أسفل الأيقونة' }, defaultValue: true },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Inactive color', ar: 'اللون غير النشط' } },
      { key: 'active_color', type: 'color', label: { en: 'Active color', ar: 'اللون النشط' } },
      { key: 'border_color', type: 'color', label: { en: 'Top border color', ar: 'لون الحد العلوي' } },
    ],
    defaultSettings: { show_labels: true },
    defaultContent: {
      items: [
        { type: 'home' },
        { type: 'search' },
        { type: 'cart' },
        { type: 'account' },
      ],
    },
  },
];

// Builder-selectable HTML tag of each section's texts. The storefront reads
// settings.heading_level / subheading_tag / eyebrow_tag; only the element
// changes, the look stays (texts keep their heading or body typography).
// Value = the tag the section renders when unset. Hero sections open the
// page with an h1; a hero slider applies the heading tag to its first slide
// (later slides step down to h2 when it is h1).
type TextTagValue = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div' | 'span';

const HEADING_LEVEL_DEFAULTS: Record<string, 'h1' | 'h2'> = {
  'hero-banner': 'h1',
  'hero-split': 'h1',
  'hero-video': 'h1',
  'aurora-hero': 'h1',
  'hero-slider': 'h1',
  'parallax-banner': 'h2',
  'brand-band': 'h2',
  'rich-text': 'h2',
  'image-with-text': 'h2',
  'collection-products': 'h2',
  'featured-products': 'h2',
  'faq-list': 'h2',
  'product-slider': 'h2',
  'gallery-slider': 'h2',
  countdown: 'h2',
  'image-gallery': 'h2',
  'social-icons': 'h2',
  video: 'h2',
  'animated-features': 'h2',
  map: 'h2',
  'newsletter-signup': 'h2',
  'before-after': 'h2',
  'bento-grid': 'h2',
  'comparison-table': 'h2',
  'feature-grid': 'h2',
  'image-hotspots': 'h2',
  'masonry-gallery': 'h2',
  'pricing-table': 'h2',
  'stats-bar': 'h2',
  steps: 'h2',
  'team-grid': 'h2',
  // Editorial set.
  'category-tiles': 'h2',
  'progress-spotlight': 'h2',
  'project-cards': 'h2',
  'testimonial-carousel': 'h2',
  testimonials: 'h2',
  timeline: 'h2',
  // Standalone product-tabs pieces: the select lands after `heading` (or at
  // the end for shipping & returns, where it applies to both headings).
  'product-description': 'h2',
  'product-specifications': 'h2',
  'product-faq': 'h2',
  'product-shipping-returns': 'h2',
  'product-stories': 'h2',
};

// Sections whose eyebrow (small label above the heading) honours eyebrow_tag.
const EYEBROW_SECTIONS = new Set([
  'aurora-hero',
  'hero-banner',
  'hero-slider',
  'hero-split',
  'hero-video',
  'image-with-text',
  'parallax-banner',
  'progress-spotlight',
  'rich-text',
]);
const EYEBROW_P_SECTIONS = new Set(['rich-text', 'image-with-text']);
// Sections without a subheading text.
const NO_SUBHEADING_SECTIONS = new Set([
  'brand-band',
  'image-with-text',
  'progress-spotlight',
  'rich-text',
  'testimonial-carousel',
  'product-description',
  'product-specifications',
  'product-faq',
  'product-shipping-returns',
]);

const TEXT_TAG_OPTIONS: { value: TextTagValue; label: LocalizedString }[] = [
  { value: 'h1', label: { en: 'H1 — page title', ar: 'H1 — عنوان الصفحة', tr: 'H1 — sayfa başlığı', de: 'H1 — Seitentitel', fr: 'H1 — titre de la page', sv: 'H1 — sidans titel' } },
  { value: 'h2', label: { en: 'H2 — section title', ar: 'H2 — عنوان قسم', tr: 'H2 — bölüm başlığı', de: 'H2 — Abschnittstitel', fr: 'H2 — titre de section', sv: 'H2 — avsnittsrubrik' } },
  { value: 'h3', label: { en: 'H3 — sub-title', ar: 'H3 — عنوان فرعي', tr: 'H3 — alt başlık', de: 'H3 — Untertitel', fr: 'H3 — sous-titre', sv: 'H3 — underrubrik' } },
  { value: 'h4', label: { en: 'H4', ar: 'H4', tr: 'H4', de: 'H4', fr: 'H4', sv: 'H4' } },
  { value: 'h5', label: { en: 'H5', ar: 'H5', tr: 'H5', de: 'H5', fr: 'H5', sv: 'H5' } },
  { value: 'h6', label: { en: 'H6', ar: 'H6', tr: 'H6', de: 'H6', fr: 'H6', sv: 'H6' } },
  { value: 'p', label: { en: 'P — paragraph', ar: 'P — فقرة', tr: 'P — paragraf', de: 'P — Absatz', fr: 'P — paragraphe', sv: 'P — stycke' } },
  { value: 'div', label: { en: 'DIV — plain block', ar: 'DIV — كتلة عادية', tr: 'DIV — düz blok', de: 'DIV — einfacher Block', fr: 'DIV — bloc simple', sv: 'DIV — vanligt block' } },
  { value: 'span', label: { en: 'SPAN — plain text', ar: 'SPAN — نص عادي', tr: 'SPAN — düz metin', de: 'SPAN — einfacher Text', fr: 'SPAN — texte simple', sv: 'SPAN — vanlig text' } },
];

function textTagField(key: string, label: LocalizedString, fallback: TextTagValue): FieldDefinition {
  return {
    key,
    type: 'select',
    label,
    description: {
      en: 'HTML tag for SEO. Use H1 once per page, for its main title. The look does not change.',
      ar: 'وسم HTML لتحسين الظهور. استخدم H1 مرة واحدة في الصفحة لعنوانها الرئيسي. الشكل لا يتغير.',
      tr: 'SEO için HTML etiketi. H1’i sayfada bir kez, ana başlık için kullanın. Görünüm değişmez.',
      de: 'HTML-Tag für SEO. Verwenden Sie H1 einmal pro Seite, für den Haupttitel. Das Aussehen ändert sich nicht.',
      fr: 'Balise HTML pour le SEO. Utilisez H1 une seule fois par page, pour son titre principal. L’apparence ne change pas.',
      sv: 'HTML-tagg för SEO. Använd H1 en gång per sida, för huvudrubriken. Utseendet ändras inte.',
    },
    defaultValue: fallback,
    options: TEXT_TAG_OPTIONS,
  };
}

/** Inserts a field right after `afterKey` (or at the end when absent). */
function insertAfter(fields: FieldDefinition[], afterKey: string, field: FieldDefinition) {
  if (fields.some((f) => f.key === field.key)) return;
  const at = fields.findIndex((f) => f.key === afterKey);
  fields.splice(at >= 0 ? at + 1 : fields.length, 0, field);
}

// Sections without a `heading` field: the heading tag select goes after this key.
const HEADING_LEVEL_ANCHOR: Record<string, string> = {
  'product-shipping-returns': 'show_heading',
};

/** Adds the text-tag selects (heading, subheading, eyebrow) after their texts. */
function withHeadingLevel(schema: SectionSchema): SectionSchema {
  const fallback = HEADING_LEVEL_DEFAULTS[schema.id];
  if (!fallback) return schema;
  const fields = [...schema.schema];
  insertAfter(fields, HEADING_LEVEL_ANCHOR[schema.id] ?? 'heading', textTagField('heading_level', { en: 'Heading tag (SEO)', ar: 'وسم العنوان (SEO)', tr: 'Başlık etiketi (SEO)', de: 'Überschriften-Tag (SEO)', fr: 'Balise du titre (SEO)', sv: 'Rubriktagg (SEO)' }, fallback));
  if (!NO_SUBHEADING_SECTIONS.has(schema.id)) {
    insertAfter(fields, 'subheading', textTagField('subheading_tag', { en: 'Subheading tag (SEO)', ar: 'وسم العنوان الفرعي (SEO)', tr: 'Alt başlık etiketi (SEO)', de: 'Unterüberschriften-Tag (SEO)', fr: 'Balise du sous-titre (SEO)', sv: 'Underrubrikstagg (SEO)' }, 'p'));
  }
  if (EYEBROW_SECTIONS.has(schema.id)) {
    // rich-text and image-with-text render their eyebrow as a p.
    const eyebrowDefault = EYEBROW_P_SECTIONS.has(schema.id) ? 'p' : 'span';
    insertAfter(fields, 'eyebrow', textTagField('eyebrow_tag', { en: 'Small label tag (SEO)', ar: 'وسم التسمية الصغيرة (SEO)', tr: 'Küçük etiketin HTML etiketi (SEO)', de: 'Tag des kleinen Labels (SEO)', fr: 'Balise du petit libellé (SEO)', sv: 'Tagg för den lilla etiketten (SEO)' }, eyebrowDefault));
  }
  return { ...schema, schema: fields };
}

// ── Heading accent ─────────────────────────────────────────────────────────
// A small decoration under the big heading of the hero-type sections and the
// brand band: nothing, a short line or a brush stroke. Unset or 'none' renders
// nothing on the storefront. The two fields mirror HEADING_ACCENT_FIELDS in
// multi-stores-web/src/themes/minimal/sections/_shared/headingAccentFields.ts
// (same keys, types, option values and showIf); they are settings, never
// translatable and never part of a section's defaultSettings.
const HEADING_ACCENT_SECTIONS = new Set([
  'hero-banner',
  'hero-split',
  'hero-slider',
  'hero-video',
  'parallax-banner',
  'image-with-text',
  'brand-band',
]);

const HEADING_ACCENT_FIELD: FieldDefinition = {
  key: 'heading_accent',
  type: 'select',
  label: L('Heading accent', 'زخرفة العنوان', 'Başlık vurgusu', 'Akzent der Überschrift', 'Accent du titre', 'Rubrikens accent'),
  defaultValue: 'none',
  options: [
    { value: 'none', label: L('None', 'بدون', 'Yok', 'Keiner', 'Aucun', 'Ingen') },
    { value: 'line', label: L('Line', 'خط', 'Çizgi', 'Linie', 'Ligne', 'Linje') },
    { value: 'brush', label: L('Brush stroke', 'ضربة فرشاة', 'Fırça darbesi', 'Pinselstrich', 'Coup de pinceau', 'Penseldrag') },
  ],
};

const HEADING_ACCENT_COLOR_FIELD: FieldDefinition = cL(
  'heading_accent_color',
  L('Accent colour', 'لون الزخرفة', 'Vurgu rengi', 'Akzentfarbe', 'Couleur de l’accent', 'Accentfärg'),
  {
    description: L(
      'Empty = the theme accent colour.',
      'فارغ = لون التمييز في القالب.',
      'Boş = temanın vurgu rengi.',
      'Leer = die Akzentfarbe des Themes.',
      'Vide = la couleur d’accent du thème.',
      'Tomt = temats accentfärg.',
    ),
    showIf: { key: 'heading_accent', in: ['line', 'brush'] },
  },
);

/** Adds the heading accent pair right after the heading tag select. */
function withHeadingAccent(schema: SectionSchema): SectionSchema {
  if (!HEADING_ACCENT_SECTIONS.has(schema.id)) return schema;
  const fields = [...schema.schema];
  insertAfter(fields, 'heading_level', HEADING_ACCENT_FIELD);
  insertAfter(fields, 'heading_accent', HEADING_ACCENT_COLOR_FIELD);
  return { ...schema, schema: fields };
}

// ── Hero emblem ────────────────────────────────────────────────────────────
// Optional decor of hero-split and hero-banner: a small symbol the owner
// uploads (an SVG mark), shown in a fixed square box above the small label.
// It moves gently only when the store's motion style is on; without it the
// emblem is a still image. The four fields mirror the emblem fields in
// multi-stores-web/src/themes/minimal/sections/_shared/emblemFields.ts (same
// keys, order, types, option values and defaults). They are appended at the
// END of the schema, are settings (never translatable) and never part of a
// section's defaultSettings: an empty image renders nothing.
const HERO_EMBLEM_SECTIONS = new Set(['hero-split', 'hero-banner']);

const HERO_EMBLEM_FIELDS: FieldDefinition[] = [
  {
    key: 'emblem_image',
    type: 'image',
    label: L('Emblem (small symbol)', 'الرمز (شعار صغير)', 'Amblem (küçük sembol)', 'Emblem (kleines Symbol)', 'Emblème (petit symbole)', 'Emblem (liten symbol)'),
    description: L(
      'Optional. A small symbol above the text, best as an SVG with a transparent background. Decoration only: screen readers skip it. Empty = nothing is shown.',
      'اختياري. رمز صغير فوق النص، والأفضل ملف SVG بخلفية شفافة. للزينة فقط ويتجاوزه قارئ الشاشة. فارغ = لا يظهر شيء.',
      'İsteğe bağlı. Metnin üzerinde küçük bir sembol; en iyisi şeffaf arka planlı bir SVG. Yalnızca süs: ekran okuyucular atlar. Boş = hiçbir şey gösterilmez.',
      'Optional. Ein kleines Symbol über dem Text, am besten als SVG mit transparentem Hintergrund. Nur Dekoration: Screenreader überspringen es. Leer = es wird nichts angezeigt.',
      'Facultatif. Un petit symbole au-dessus du texte, idéalement un SVG à fond transparent. Décoration uniquement : les lecteurs d’écran l’ignorent. Vide = rien n’est affiché.',
      'Valfritt. En liten symbol ovanför texten, helst en SVG med transparent bakgrund. Endast dekoration: skärmläsare hoppar över den. Tomt = inget visas.',
    ),
  },
  {
    key: 'emblem_motion',
    type: 'select',
    label: L('Emblem movement', 'حركة الرمز', 'Amblem hareketi', 'Bewegung des Emblems', 'Mouvement de l’emblème', 'Emblemets rörelse'),
    description: L(
      'Moves only while the store’s Motion style is on; otherwise the emblem is still.',
      'يتحرك فقط عندما يكون «نمط الحركة» مفعّلاً في المتجر، وإلا يبقى الرمز ساكناً.',
      'Yalnızca mağazanın Hareket stili açıkken hareket eder; aksi halde amblem sabittir.',
      'Bewegt sich nur, wenn der Bewegungsstil des Shops eingeschaltet ist; sonst steht das Emblem still.',
      'Ne bouge que si le Style de mouvement de la boutique est activé ; sinon l’emblème reste immobile.',
      'Rör sig bara när butikens Rörelsestil är på; annars står emblemet stilla.',
    ),
    defaultValue: 'rise',
    options: [
      { value: 'none', label: L('None', 'بدون', 'Yok', 'Keine', 'Aucun', 'Ingen') },
      { value: 'rise', label: L('Slow rise', 'صعود بطيء', 'Yavaş yükseliş', 'Langsames Aufsteigen', 'Lente montée', 'Långsam stigning') },
      { value: 'turn', label: L('Slow turn', 'دوران بطيء', 'Yavaş dönüş', 'Langsame Drehung', 'Lente rotation', 'Långsam vridning') },
    ],
  },
  {
    key: 'emblem_size',
    type: 'select',
    label: L('Emblem size', 'حجم الرمز', 'Amblem boyutu', 'Größe des Emblems', 'Taille de l’emblème', 'Emblemets storlek'),
    defaultValue: 'md',
    options: [
      { value: 'sm', label: L('Small', 'صغير', 'Küçük', 'Klein', 'Petit', 'Liten') },
      { value: 'md', label: L('Medium', 'متوسط', 'Orta', 'Mittel', 'Moyen', 'Medel') },
    ],
  },
  {
    key: 'emblem_position',
    type: 'select',
    label: L('Emblem position', 'موضع الرمز', 'Amblem konumu', 'Position des Emblems', 'Position de l’emblème', 'Emblemets position'),
    description: L(
      'Side of the text block. With centred text the emblem stays centred.',
      'جهة كتلة النص. مع النص المتوسط يبقى الرمز في الوسط.',
      'Metin bloğunun tarafı. Ortalanmış metinde amblem ortada kalır.',
      'Seite des Textblocks. Bei zentriertem Text bleibt das Emblem in der Mitte.',
      'Côté du bloc de texte. Avec un texte centré, l’emblème reste centré.',
      'Textblockets sida. Med centrerad text förblir emblemet centrerat.',
    ),
    defaultValue: 'start',
    options: START_END_OPTIONS,
  },
];

/** Appends the four emblem fields at the end of the two hero schemas. */
function withHeroEmblem(schema: SectionSchema): SectionSchema {
  if (!HERO_EMBLEM_SECTIONS.has(schema.id)) return schema;
  const have = new Set(schema.schema.map((f) => f.key));
  return { ...schema, schema: [...schema.schema, ...HERO_EMBLEM_FIELDS.filter((f) => !have.has(f.key))] };
}

// ── Creative engine ────────────────────────────────────────────────────────
// Hand-made mirror of multi-stores-web/src/themes/creative/schemas.ts: the
// ornament divider, field for field (same keys, order, types, option values,
// limits, translatable keys, page types and defaults), with six-locale texts.
// The storefront's creative.contract.test.tsx compares the two files.

type CxExtra = Partial<Pick<FieldDefinition, 'description' | 'showIf' | 'defaultValue'>>;
type CxOption = [value: string, label: LocalizedString];

const cxArea = (key: string, label: LocalizedString, maxLength: number, extra: CxExtra = {}): FieldDefinition => ({
  key, type: 'textarea', label, maxLength, ...extra,
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

const CX_EMPTY_ACCENT = L(
  'Empty = the theme accent colour.',
  'فارغ = لون التمييز في القالب.',
  'Boş = temanın vurgu rengi.',
  'Leer = die Akzentfarbe des Themes.',
  'Vide = la couleur d’accent du thème.',
  'Tomt = temats accentfärg.',
);
const CX_EMPTY_SECONDARY = L(
  'Empty = the theme secondary colour.',
  'فارغ = اللون الثانوي في القالب.',
  'Boş = temanın ikincil rengi.',
  'Leer = die Sekundärfarbe des Themes.',
  'Vide = la couleur secondaire du thème.',
  'Tomt = temats sekundärfärg.',
);

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

// Brand sections: one file per section (lib/creative-sections), each a mirror
// of the storefront's themes/creative/schemas/<key>.schema.ts.
const BRAND_SECTION_SCHEMAS: SectionSchema[] = [
  coverHeroSchema,
  lookSpreadSchema,
  objectStudySchema,
  scriptManifestoSchema,
  impactArcSchema,
  patternBandSchema,
];

const CREATIVE_SECTION_SCHEMAS: SectionSchema[] = [
  {
    id: 'ornament-line',
    label: L('Ornament line', 'خط زخرفي', 'Süsleme çizgisi', 'Ornamentlinie', 'Ligne ornementale', 'Ornamentlinje'),
    icon: 'minus',
    category: 'content',
    description: L(
      'A thin divider drawn from your own motif (SVG path data), which draws itself as it scrolls into view.',
      'فاصل رفيع مرسوم من نقشك الخاص (بيانات مسار SVG) يرسم نفسه عند ظهوره.',
      'Kendi motifinizden (SVG yol verisi) çizilen, görünüme girerken kendini çizen ince bir ayırıcı.',
      'Ein feiner Trenner aus Ihrem eigenen Motiv (SVG-Pfaddaten), der sich beim Erscheinen selbst zeichnet.',
      'Un fin séparateur dessiné à partir de votre propre motif (données de tracé SVG), qui se trace en entrant dans l’écran.',
      'En tunn avdelare ritad av ditt eget mönster (SVG-bandata), som ritar sig själv när den kommer i bild.',
    ),
    pageTypes: [...CX_PAGE_AND_FOOTER],
    translatable: [],
    schema: [
      cxNum('tile_width', L('Tile width', 'عرض البلاطة', 'Karo genişliği', 'Kachelbreite', 'Largeur du motif', 'Rutans bredd'), 120, 24, 400),
      cxNum('tile_height', L('Tile height', 'ارتفاع البلاطة', 'Karo yüksekliği', 'Kachelhöhe', 'Hauteur du motif', 'Rutans höjd'), 48, 8, 120),
      cxRepeater('paths', L('Motif paths', 'مسارات النقش', 'Motif yolları', 'Pfade des Motivs', 'Tracés du motif', 'Mönstrets banor'), 12, CX_ORNAMENT_PATH_FIELDS),
      cL('color_a', L('Colour A', 'اللون أ', 'Renk A', 'Farbe A', 'Couleur A', 'Färg A'), {
        description: L(
          'Empty = the theme text colour.',
          'فارغ = لون النص في القالب.',
          'Boş = temanın metin rengi.',
          'Leer = die Textfarbe des Themes.',
          'Vide = la couleur de texte du thème.',
          'Tomt = temats textfärg.',
        ),
      }),
      cL('color_b', L('Colour B', 'اللون ب', 'Renk B', 'Farbe B', 'Couleur B', 'Färg B'), { description: CX_EMPTY_ACCENT }),
      cL('color_c', L('Colour C', 'اللون ج', 'Renk C', 'Farbe C', 'Couleur C', 'Färg C'), { description: CX_EMPTY_SECONDARY }),
      cxSelect('stroke', L('Line weight', 'سماكة الخط', 'Çizgi kalınlığı', 'Linienstärke', 'Épaisseur du trait', 'Linjetjocklek'), 'regular', [
        ['thin', L('Thin', 'رفيع', 'İnce', 'Dünn', 'Fin', 'Tunn')],
        ['regular', L('Regular', 'عادي', 'Normal', 'Normal', 'Normal', 'Normal')],
      ]),
      cxSelect('width', L('Width', 'العرض', 'Genişlik', 'Breite', 'Largeur', 'Bredd'), 'contained', [
        ['contained', L('Contained', 'ضمن الحاوية', 'Kapsayıcı içinde', 'Im Container', 'Dans le conteneur', 'Inom containern')],
        ['full', L('Full width', 'عرض كامل', 'Tam genişlik', 'Volle Breite', 'Pleine largeur', 'Full bredd')],
      ]),
      cxSelect('draw', L('Drawing', 'الرسم', 'Çizim', 'Zeichnung', 'Tracé', 'Ritning'), 'once', [
        ['once', L('Draws once', 'يُرسم مرة واحدة', 'Bir kez çizilir', 'Zeichnet sich einmal', 'Se trace une fois', 'Ritas en gång')],
        ['scroll', L('Follows scrolling', 'يتبع التمرير', 'Kaydırmayı takip eder', 'Folgt dem Scrollen', 'Suit le défilement', 'Följer rullningen')],
        ['none', L('Static', 'ثابت', 'Sabit', 'Statisch', 'Statique', 'Statisk')],
      ]),
    ],
    defaultSettings: {
      tile_width: 120,
      tile_height: 48,
      stroke: 'regular',
      width: 'contained',
      draw: 'once',
    },
    defaultContent: {},
  },
];

export const SECTION_SCHEMAS: SectionSchema[] = [...BASE_SECTION_SCHEMAS, ...CREATIVE_SECTION_SCHEMAS, ...BRAND_SECTION_SCHEMAS]
  .map(withHeadingLevel)
  .map(withHeadingAccent)
  .map(withHeroEmblem);

export function findSectionSchema(id: string): SectionSchema | undefined {
  return SECTION_SCHEMAS.find((s) => s.id === id);
}

/**
 * Picks a schema label in `uiLocale`, falling back to English and then to the
 * first value. Schema labels are dashboard chrome, so `uiLocale` must be the
 * dashboard UI locale (next-intl useLocale / useUiLabel), never the store
 * content locale being edited.
 */
export function labelOf(loc: LocalizedString, uiLocale: string): string {
  return loc[uiLocale] || loc.en || Object.values(loc)[0] || '';
}
