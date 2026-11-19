'use client';

// Full editor for the store's THEME TOKENS (theme_customizations) — the
// token-shape overrides an imported template populates and that both the live
// preview and the storefront merge onto the active theme. Lets the creator
// fully tune the custom theme's palette and fonts. Edits preview live via
// onChange and persist via onSave (PUT /stores/my/theme-selection).

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Palette, Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { GOOGLE_FONT_OPTIONS } from '@/lib/google-fonts';
import { CUSTOM_CSS_MAX_LENGTH, customCssOf, isCustomCssTooLong, withCustomCss } from '@/lib/customCss';
import {
  ARABIC_FONT_FAMILIES,
  BUTTON_RADIUS_OPTIONS,
  CARD_ASPECTS,
  CARD_AVAILABILITY,
  CARD_BADGES,
  CARD_CORNERS,
  CARD_STYLES,
  LISTING_DENSITIES,
  LISTING_FILTER_KEYS,
  LISTING_MOBILE_DENSITIES,
  LISTING_STYLES,
  LOW_STOCK_CAP,
  MOTION_REVEAL_VALUES,
  MOTION_ZOOM_VALUES,
  arabicFontValue,
  buttonRadiusValue,
  cardStyleDefaults,
  creativeValue,
  keepOwnerSettings,
  listingValue,
  motionValue,
  productCardValue,
  withArabicFont,
  withButtonRadius,
  withCreative,
  withMotion,
  withListing,
  withProductCard,
  type ArabicFontSlot,
  type CreativeValue,
  type ListingFilterKey,
  type ListingStored,
  type ListingValue,
  type MotionKey,
  type ProductCardStored,
  type ProductCardValue,
} from '@/lib/themeTokens';
import { cn } from '@/lib/utils';

// ── Token shape (subset of the storefront's ThemeTokens we expose) ──
export interface ThemeTokenCustomizations {
  colors?: Partial<Record<ColorKey | TextColorKey, string>>;
  typography?: {
    fontFamily?: { heading?: string; body?: string };
    /**
     * Fallback fonts for Arabic-script text, placed after the Latin family in
     * the storefront's font stack. One of ARABIC_FONT_FAMILIES; unset = none.
     */
    fontFamilyArabic?: { heading?: string; body?: string };
    [key: string]: unknown; // preserve unrelated keys (scale, lineHeight…)
  };
  /**
   * `radius.button` is the one button shape of the page sections (a px string,
   * storefront `--theme-radius-button`); unset = each section's own shape.
   */
  spacing?: {
    radius?: { button?: string; [key: string]: unknown };
    [key: string]: unknown; // preserve unrelated keys (shadow, containerMaxWidth…)
  };
  /**
   * Product page: colour swatch shape (storefront `--theme-swatch-radius`).
   * `card` is the opt-in product card of every listing: the object exists
   * (even empty) = the enhanced card, absent = the classic card.
   */
  product?: { swatchShape?: SwatchShape; card?: ProductCardStored };
  /**
   * Store-wide motion profile (storefront `data-motion-reveal` /
   * `data-motion-zoom` on the store root). Unset = the standard movement;
   * the standard is never stored. `creative` is the store-level motion
   * style switch (storefront `data-creative*` attributes): absent = off,
   * and only options that differ from their default are stored.
   */
  motion?: {
    reveal?: 'calm' | 'off';
    zoom?: 'subtle' | 'off';
    creative?: {
      enabled: true;
      smooth?: 'off';
      magnetic?: 'off';
      transition?: 'curtain';
      progress?: 'bar';
      cursor?: 'dot';
    };
  };
  /**
   * Filtered product listing of /products and the collection pages: the
   * object exists (even empty) = on, absent = the listing as before.
   */
  listing?: ListingStored;
  /**
   * Store-wide custom CSS (owner content, not a token). The storefront
   * sanitizes it and renders it on every page of the store.
   */
  customCss?: string;
  [key: string]: unknown; // preserve unrelated keys (muted/border…)
}

interface ThemeCustomizerProps {
  value: ThemeTokenCustomizations;
  /** Live-preview callback — fired on every edit. */
  onChange: (next: ThemeTokenCustomizations) => void;
  /** Persist callback — fired on Save. */
  onSave: (next: ThemeTokenCustomizations) => Promise<void> | void;
  trigger: React.ReactNode;
}

// Every Google Fonts family, popularity-ordered (shared catalog).
const FONT_OPTIONS = GOOGLE_FONT_OPTIONS;

// The curated Arabic families; a family name is its own label in every locale.
const ARABIC_FONT_OPTIONS = ARABIC_FONT_FAMILIES.map((family) => ({ value: family, label: family }));

// Button shapes, in the order of BUTTON_RADIUS_OPTIONS (0px, 4px, 8px, 9999px).
const BUTTON_SHAPE_LABEL_KEYS = ['buttonShapeSquare', 'buttonShapeSlight', 'buttonShapeRounded', 'buttonShapePill'] as const;

// Motion choices, in the order of MOTION_REVEAL_VALUES (calm, off) and
// MOTION_ZOOM_VALUES (subtle, off).
const MOTION_REVEAL_LABEL_KEYS = ['motion.revealCalm', 'motion.revealOff'] as const;
const MOTION_ZOOM_LABEL_KEYS = ['motion.zoomSubtle', 'motion.zoomOff'] as const;

// Product card choices, in the order of the CARD_* value lists.
const CARD_STYLE_LABEL_KEYS = ['card.styleClassic', 'card.styleEditorial'] as const;
const CARD_ASPECT_LABEL_KEYS = ['card.aspectSquare', 'card.aspectPortrait', 'card.aspectLandscape'] as const;
const CARD_CORNERS_LABEL_KEYS = ['card.cornersTheme', 'card.cornersSquare'] as const;
const CARD_AVAILABILITY_LABEL_KEYS = ['card.availabilityOff', 'card.availabilitySoldOut', 'card.availabilitySoldOutAndLow'] as const;
const CARD_BADGE_LABEL_KEYS = ['card.badgePercent', 'card.badgeSale', 'card.badgeNone'] as const;
// Product listing choices, in the order of the LISTING_* value lists.
const LISTING_FILTER_LABEL_KEYS: Record<ListingFilterKey, string> = {
  collection: 'listing.filterCollection',
  type: 'listing.filterType',
  price: 'listing.filterPrice',
  availability: 'listing.filterAvailability',
  color: 'listing.filterColor',
  size: 'listing.filterSize',
};
const LISTING_STYLE_LABEL_KEYS = ['listing.styleBar', 'listing.styleRail'] as const;
// "Only N left" thresholds: 1 to the cap, shown as plain numbers.
const LOW_STOCK_OPTIONS = Array.from({ length: LOW_STOCK_CAP }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

type ColorKey = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text';
type SwatchShape = 'circle' | 'square';
// Text-on-colour tokens; empty = automatic on the storefront (readable
// contrast for the *Contrast keys, the primary colour for price).
type TextColorKey = 'primaryContrast' | 'accentContrast' | 'price' | 'priceBg' | 'priceShadow' | 'sale' | 'link';

// Color token keys (used as logic + theme token keys) paired with a default
// placeholder. Human-readable labels come from the translator, keyed by token.
const COLOR_FIELDS: { key: ColorKey; placeholder: string }[] = [
  { key: 'primary', placeholder: '#2563eb' },
  { key: 'secondary', placeholder: '#1e40af' },
  { key: 'accent', placeholder: '#f59e0b' },
  { key: 'background', placeholder: '#ffffff' },
  { key: 'surface', placeholder: '#f5f5f5' },
  { key: 'text', placeholder: '#111827' },
];

const TEXT_COLOR_FIELDS: { key: TextColorKey; placeholderKey: 'color.auto' | 'color.priceAuto' | 'color.linkAuto' | 'color.none' | 'color.saleAuto' }[] = [
  { key: 'primaryContrast', placeholderKey: 'color.auto' },
  { key: 'accentContrast', placeholderKey: 'color.auto' },
  { key: 'price', placeholderKey: 'color.priceAuto' },
  { key: 'priceBg', placeholderKey: 'color.none' },
  { key: 'priceShadow', placeholderKey: 'color.none' },
  { key: 'sale', placeholderKey: 'color.saleAuto' },
  { key: 'link', placeholderKey: 'color.linkAuto' },
];

export function ThemeCustomizer({ value, onChange, onSave, trigger }: ThemeCustomizerProps) {
  // Chrome text below is translated via the dashboard UI locale.
  const t = useTranslations('builder');
  const tc = useTranslations('common');
  // Ties each select to its label (the customizer is mounted in two places).
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ThemeTokenCustomizations>(value);
  const [saving, setSaving] = useState(false);
  // Custom CSS section: collapsed until opened, or open when CSS already exists.
  const [cssOpen, setCssOpen] = useState(false);

  const apply = (next: ThemeTokenCustomizations) => {
    setDraft(next);
    onChange(next); // live preview
  };

  const setColor = (key: ColorKey | TextColorKey, v: string) => {
    const colors = { ...(draft.colors || {}) };
    if (v) colors[key] = v;
    else delete colors[key];
    apply({ ...draft, colors });
  };

  const setFont = (key: 'heading' | 'body', v: string) => {
    const fontFamily = { ...(draft.typography?.fontFamily || {}) };
    if (v) fontFamily[key] = v;
    else delete fontFamily[key];
    apply({ ...draft, typography: { ...draft.typography, fontFamily } });
  };

  // '' removes the key (and the objects it emptied); other keys are kept.
  const setArabicFont = (slot: ArabicFontSlot, v: string) => apply(withArabicFont(draft, slot, v));
  const setButtonRadius = (v: string) => apply(withButtonRadius(draft, v));
  // '' (Standard) removes the key, and `motion` once it is empty.
  const setMotion = (key: MotionKey, v: string) => apply(withMotion(draft, key, v));
  // Off removes motion.creative (and `motion` once empty); defaults are never stored.
  const creative = creativeValue(draft);
  const setCreative = (patch: Partial<CreativeValue>) => apply(withCreative(draft, patch));
  // Calm and Off keep the page-level options (smooth scrolling, magnetic, curtain, bar, dot) from starting.
  const creativeMuted = creative.enabled && motionValue(draft, 'reveal') !== '';
  // Off removes product.card (and `product` once empty); on stores only what differs from the default.
  const card = productCardValue(draft);
  const setCard = (patch: Partial<ProductCardValue>) => apply(withProductCard(draft, patch));
  // Off removes `listing`; on stores only what differs from the default.
  const listing = listingValue(draft);
  const setListing = (patch: Partial<ListingValue>) => apply(withListing(draft, patch));
  // Shown filters in their order, then the hidden ones in the default order.
  const listingRows: Array<{ key: ListingFilterKey; shown: boolean }> = [
    ...listing.filters.map((key) => ({ key, shown: true })),
    ...LISTING_FILTER_KEYS.filter((k) => !listing.filters.includes(k)).map((key) => ({ key, shown: false })),
  ];
  const toggleListingFilter = (key: ListingFilterKey) =>
    setListing({
      filters: listing.filters.includes(key) ? listing.filters.filter((f) => f !== key) : [...listing.filters, key],
    });
  const moveListingFilter = (key: ListingFilterKey, step: -1 | 1) => {
    const list = [...listing.filters];
    const i = list.indexOf(key);
    const j = i + step;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setListing({ filters: list });
  };

  const buttonRadius = buttonRadiusValue(draft);
  // A valid stored radius outside the four shapes stays selectable as it is.
  const buttonRadiusIsCustom = buttonRadius !== '' && !(BUTTON_RADIUS_OPTIONS as readonly string[]).includes(buttonRadius);

  const setSwatchShape = (v: string) => {
    const product = { ...(draft.product || {}) };
    if (v === 'circle' || v === 'square') product.swatchShape = v;
    else delete product.swatchShape;
    if (Object.keys(product).length) apply({ ...draft, product });
    else {
      const next = { ...draft };
      delete next.product;
      apply(next);
    }
  };

  // Blank text deletes the key (same idea as setSwatchShape).
  const setCustomCss = (v: string) => apply(withCustomCss(draft, v));

  const customCss = customCssOf(draft);
  const cssTooLong = isCustomCssTooLong(customCss);

  // Resets the look tokens only. The store's own settings stay: the custom
  // CSS (owner content), the motion profile and product.card.
  const handleReset = () => apply(keepOwnerSettings(draft) as ThemeTokenCustomizations);

  const handleSave = async () => {
    // Over the cap: the message under the field explains what to do.
    if (cssTooLong) {
      setCssOpen(true);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onChange(value); // revert the live preview to the persisted value
    setDraft(value);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDraft(value);
          setCssOpen(customCssOf(value) !== '');
        }
        else onChange(value); // closing via overlay/esc reverts unsaved preview
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {t('customizeTheme')}
          </DialogTitle>
          <DialogDescription>
            {t('customizeThemeDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto">
          {/* Colors */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('colors')}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {COLOR_FIELDS.map((f) => (
                <ColorField
                  key={f.key}
                  label={t(`color.${f.key}`)}
                  value={draft.colors?.[f.key] || ''}
                  placeholder={f.placeholder}
                  onChange={(v) => setColor(f.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Text on colours (empty = automatic) */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('textColors')}
            </div>
            <p className="text-[11px] text-zinc-500">{t('textColorsHint')}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {TEXT_COLOR_FIELDS.map((f) => (
                <ColorField
                  key={f.key}
                  label={t(`color.${f.key}`)}
                  value={draft.colors?.[f.key] || ''}
                  placeholder={t(f.placeholderKey)}
                  onChange={(v) => setColor(f.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Fonts */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('fonts')}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-heading-font`} className="text-[11.5px] text-zinc-700">{t('headingFont')}</Label>
                <SearchableSelect
                  id={`${fieldId}-heading-font`}
                  value={draft.typography?.fontFamily?.heading || ''}
                  onChange={(v) => setFont('heading', v)}
                  options={[{ value: '', label: t('themeDefault') }, ...FONT_OPTIONS]}
                  placeholder={t('themeDefault')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-body-font`} className="text-[11.5px] text-zinc-700">{t('bodyFont')}</Label>
                <SearchableSelect
                  id={`${fieldId}-body-font`}
                  value={draft.typography?.fontFamily?.body || ''}
                  onChange={(v) => setFont('body', v)}
                  options={[{ value: '', label: t('themeDefault') }, ...FONT_OPTIONS]}
                  placeholder={t('themeDefault')}
                />
              </div>
              {/* Arabic-script fallback fonts (optional; unset loads nothing) */}
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-arabic-heading-font`} className="text-[11.5px] text-zinc-700">{t('arabicHeadingFont')}</Label>
                <SearchableSelect
                  id={`${fieldId}-arabic-heading-font`}
                  value={arabicFontValue(draft, 'heading')}
                  onChange={(v) => setArabicFont('heading', v)}
                  options={[{ value: '', label: t('arabicFontNone') }, ...ARABIC_FONT_OPTIONS]}
                  placeholder={t('arabicFontNone')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-arabic-body-font`} className="text-[11.5px] text-zinc-700">{t('arabicBodyFont')}</Label>
                <SearchableSelect
                  id={`${fieldId}-arabic-body-font`}
                  value={arabicFontValue(draft, 'body')}
                  onChange={(v) => setArabicFont('body', v)}
                  options={[{ value: '', label: t('arabicFontNone') }, ...ARABIC_FONT_OPTIONS]}
                  placeholder={t('arabicFontNone')}
                />
                <p className="text-[11px] text-zinc-500">{t('arabicFontHint')}</p>
              </div>
            </div>
          </section>

          {/* Buttons: one shape for the main buttons of the page sections */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('buttons')}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-button-shape`} className="text-[11.5px] text-zinc-700">{t('buttonShape')}</Label>
              <SearchableSelect
                id={`${fieldId}-button-shape`}
                value={buttonRadius}
                onChange={setButtonRadius}
                options={[
                  { value: '', label: t('themeDefault') },
                  ...BUTTON_RADIUS_OPTIONS.map((value, i) => ({ value, label: t(BUTTON_SHAPE_LABEL_KEYS[i]) })),
                  ...(buttonRadiusIsCustom
                    ? [{ value: buttonRadius, label: t('buttonShapeCustom', { value: buttonRadius }) }]
                    : []),
                ]}
                placeholder={t('themeDefault')}
              />
              <p className="text-[11px] text-zinc-500">{t('buttonShapeHint')}</p>
            </div>
          </section>

          {/* Product page controls */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('productPage')}
            </div>
            <div className="space-y-1">
              <Label className="text-[11.5px] text-zinc-700">{t('swatchShape')}</Label>
              <SearchableSelect
                value={draft.product?.swatchShape || ''}
                onChange={setSwatchShape}
                options={[
                  { value: '', label: t('themeDefault') },
                  { value: 'circle', label: t('swatchCircle') },
                  { value: 'square', label: t('swatchSquare') },
                ]}
                placeholder={t('themeDefault')}
              />
              <p className="text-[11px] text-zinc-500">{t('swatchShapeHint')}</p>
            </div>
          </section>

          {/* Product card: the opt-in card of every product listing */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('card.title')}
            </div>
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/50 p-2.5">
              <CreativeSwitchRow
                id={`${fieldId}-card`}
                label={t('card.enabled')}
                checked={card.enabled}
                onChange={(enabled) => setCard({ enabled })}
                strong
              />
              <p className="text-[11px] text-zinc-500">{t('card.enabledHint')}</p>
              {card.enabled && (
                <div className="space-y-3 border-t border-zinc-200 pt-2.5">
                  {/* Look: a small live sketch next to the three look selects */}
                  <div className="flex items-start gap-3">
                    <CardPreview
                      value={card}
                      label={t('card.preview')}
                      title={t('card.sampleTitle')}
                      sale={t('card.sampleSale')}
                      low={t('card.sampleLow')}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-card-style`} className="text-[11.5px] text-zinc-700">{t('card.style')}</Label>
                        <SearchableSelect
                          id={`${fieldId}-card-style`}
                          value={card.style}
                          onChange={(v) => setCard({ style: v as ProductCardValue['style'] })}
                          options={CARD_STYLES.map((value, i) => ({ value, label: t(CARD_STYLE_LABEL_KEYS[i]) }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-card-aspect`} className="text-[11.5px] text-zinc-700">{t('card.aspect')}</Label>
                        <SearchableSelect
                          id={`${fieldId}-card-aspect`}
                          value={card.aspect}
                          onChange={(v) => setCard({ aspect: v as ProductCardValue['aspect'] })}
                          options={[
                            { value: '', label: t('card.aspectAuto') },
                            ...CARD_ASPECTS.map((value, i) => ({ value, label: t(CARD_ASPECT_LABEL_KEYS[i]) })),
                          ]}
                          placeholder={t('card.aspectAuto')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-card-corners`} className="text-[11.5px] text-zinc-700">{t('card.corners')}</Label>
                        <SearchableSelect
                          id={`${fieldId}-card-corners`}
                          value={card.corners}
                          onChange={(v) => setCard({ corners: v as ProductCardValue['corners'] })}
                          options={[
                            { value: '', label: t('card.cornersAuto') },
                            ...CARD_CORNERS.map((value, i) => ({ value, label: t(CARD_CORNERS_LABEL_KEYS[i]) })),
                          ]}
                          placeholder={t('card.cornersAuto')}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">{t('card.styleHint')} {t('card.aspectHint')}</p>

                  {/* What the card shows */}
                  <div className="space-y-2 border-t border-zinc-200 pt-2.5">
                    <CreativeSwitchRow
                      id={`${fieldId}-card-hover`}
                      label={t('card.hoverImage')}
                      checked={card.hover_image}
                      onChange={(hover_image) => setCard({ hover_image })}
                    />
                    <p className="text-[11px] text-zinc-500">{t('card.hoverImageHint')}</p>
                    <CreativeSwitchRow
                      id={`${fieldId}-card-swatches`}
                      label={t('card.swatches')}
                      checked={card.swatches}
                      onChange={(swatches) => setCard({ swatches })}
                    />
                    <CreativeSwitchRow
                      id={`${fieldId}-card-sizes`}
                      label={t('card.sizesLine')}
                      checked={card.sizes_line}
                      onChange={(sizes_line) => setCard({ sizes_line })}
                    />
                    <p className="text-[11px] text-zinc-500">{t('card.optionsHint')}</p>
                    <CreativeSwitchRow
                      id={`${fieldId}-card-quick-add`}
                      label={t('card.quickAdd')}
                      checked={card.quick_add}
                      onChange={(quick_add) => setCard({ quick_add })}
                    />
                    <p className="text-[11px] text-zinc-500">{t('card.quickAddHint')}</p>
                  </div>

                  {/* Badge and availability */}
                  <div className="space-y-2 border-t border-zinc-200 pt-2.5">
                    <div className="space-y-1">
                      <Label htmlFor={`${fieldId}-card-badge`} className="text-[11.5px] text-zinc-700">{t('card.badge')}</Label>
                      <SearchableSelect
                        id={`${fieldId}-card-badge`}
                        value={card.badge}
                        onChange={(v) => setCard({ badge: v as ProductCardValue['badge'] })}
                        options={CARD_BADGES.map((value, i) => ({ value, label: t(CARD_BADGE_LABEL_KEYS[i]) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${fieldId}-card-availability`} className="text-[11.5px] text-zinc-700">{t('card.availability')}</Label>
                      <SearchableSelect
                        id={`${fieldId}-card-availability`}
                        value={card.availability}
                        onChange={(v) => setCard({ availability: v as ProductCardValue['availability'] })}
                        options={CARD_AVAILABILITY.map((value, i) => ({ value, label: t(CARD_AVAILABILITY_LABEL_KEYS[i]) }))}
                      />
                    </div>
                    {card.availability === 'sold_out_and_low' && (
                      <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-card-threshold`} className="text-[11.5px] text-zinc-700">{t('card.lowStockThreshold')}</Label>
                        <SearchableSelect
                          id={`${fieldId}-card-threshold`}
                          value={String(card.low_stock_threshold)}
                          onChange={(v) => setCard({ low_stock_threshold: Number(v) })}
                          options={LOW_STOCK_OPTIONS}
                        />
                        <p className="text-[11px] text-zinc-500">{t('card.lowStockThresholdHint', { max: LOW_STOCK_CAP })}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Product listing: filters, sort and columns of /products and the collection pages */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('listing.title')}
            </div>
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/50 p-2.5">
              <CreativeSwitchRow
                id={`${fieldId}-listing`}
                label={t('listing.enabled')}
                checked={listing.enabled}
                onChange={(enabled) => setListing({ enabled })}
                strong
              />
              <p className="text-[11px] text-zinc-500">{t('listing.enabledHint')}</p>
              {listing.enabled && (
                <div className="space-y-3 border-t border-zinc-200 pt-2.5">
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldId}-listing-style`} className="text-[11.5px] text-zinc-700">{t('listing.style')}</Label>
                    <SearchableSelect
                      id={`${fieldId}-listing-style`}
                      value={listing.style}
                      onChange={(v) => setListing({ style: v as ListingValue['style'] })}
                      options={LISTING_STYLES.map((value, i) => ({ value, label: t(LISTING_STYLE_LABEL_KEYS[i]) }))}
                    />
                    <p className="text-[11px] text-zinc-500">{t('listing.styleHint')}</p>
                  </div>

                  {/* Which filters, in which order */}
                  <div className="space-y-1.5 border-t border-zinc-200 pt-2.5">
                    <div id={`${fieldId}-listing-filters`} className="text-[11.5px] text-zinc-700">{t('listing.filters')}</div>
                    <ul aria-labelledby={`${fieldId}-listing-filters`} className="space-y-1">
                      {listingRows.map(({ key, shown }) => {
                        const index = listing.filters.indexOf(key);
                        const label = t(LISTING_FILTER_LABEL_KEYS[key]);
                        return (
                          <li key={key} className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1">
                            <input
                              id={`${fieldId}-listing-f-${key}`}
                              type="checkbox"
                              checked={shown}
                              onChange={() => toggleListingFilter(key)}
                              className="size-3.5 accent-indigo-600"
                            />
                            <label
                              htmlFor={`${fieldId}-listing-f-${key}`}
                              className={cn('flex-1 text-[11.5px]', shown ? 'text-zinc-800' : 'text-zinc-400')}
                            >
                              {label}
                            </label>
                            {shown && (
                              <span className="flex gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => moveListingFilter(key, -1)}
                                  disabled={index === 0}
                                  aria-label={t('listing.moveUp', { name: label })}
                                  className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                                >
                                  <ArrowUp className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveListingFilter(key, 1)}
                                  disabled={index === listing.filters.length - 1}
                                  aria-label={t('listing.moveDown', { name: label })}
                                  className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                                >
                                  <ArrowDown className="size-3" />
                                </button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-zinc-500">{t('listing.filtersHint')}</p>
                  </div>

                  {/* Columns */}
                  <div className="space-y-2 border-t border-zinc-200 pt-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-listing-density`} className="text-[11.5px] text-zinc-700">{t('listing.density')}</Label>
                        <SearchableSelect
                          id={`${fieldId}-listing-density`}
                          value={String(listing.density)}
                          onChange={(v) => setListing({ density: Number(v) as ListingValue['density'] })}
                          options={LISTING_DENSITIES.map((n) => ({ value: String(n), label: t('listing.columns', { count: n }) }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-listing-mobile`} className="text-[11.5px] text-zinc-700">{t('listing.mobileDensity')}</Label>
                        <SearchableSelect
                          id={`${fieldId}-listing-mobile`}
                          value={String(listing.mobile_density)}
                          onChange={(v) => setListing({ mobile_density: Number(v) as ListingValue['mobile_density'] })}
                          options={LISTING_MOBILE_DENSITIES.map((n) => ({ value: String(n), label: t('listing.columns', { count: n }) }))}
                        />
                      </div>
                    </div>
                    <CreativeSwitchRow
                      id={`${fieldId}-listing-switch`}
                      label={t('listing.densitySwitch')}
                      checked={listing.density_switch}
                      onChange={(density_switch) => setListing({ density_switch })}
                    />
                    <p className="text-[11px] text-zinc-500">{t('listing.densitySwitchHint')}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Motion: scroll animations and image zoom, store-wide */}
          <section className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500">
              {t('motion.title')}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-motion-reveal`} className="text-[11.5px] text-zinc-700">{t('motion.reveal')}</Label>
                <SearchableSelect
                  id={`${fieldId}-motion-reveal`}
                  value={motionValue(draft, 'reveal')}
                  onChange={(v) => setMotion('reveal', v)}
                  options={[
                    { value: '', label: t('motion.revealDefault') },
                    ...MOTION_REVEAL_VALUES.map((value, i) => ({ value, label: t(MOTION_REVEAL_LABEL_KEYS[i]) })),
                  ]}
                  placeholder={t('motion.revealDefault')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-motion-zoom`} className="text-[11.5px] text-zinc-700">{t('motion.zoom')}</Label>
                <SearchableSelect
                  id={`${fieldId}-motion-zoom`}
                  value={motionValue(draft, 'zoom')}
                  onChange={(v) => setMotion('zoom', v)}
                  options={[
                    { value: '', label: t('motion.zoomDefault') },
                    ...MOTION_ZOOM_VALUES.map((value, i) => ({ value, label: t(MOTION_ZOOM_LABEL_KEYS[i]) })),
                  ]}
                  placeholder={t('motion.zoomDefault')}
                />
              </div>
              <p className="text-[11px] text-zinc-500">{t('motion.reducedMotionNote')}</p>

              {/* Motion style: one store switch, every section of every page (light motion on product, cart, checkout) */}
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/50 p-2.5">
                <CreativeSwitchRow
                  id={`${fieldId}-creative`}
                  label={t('creative.enabled')}
                  checked={creative.enabled}
                  onChange={(enabled) => setCreative({ enabled })}
                  strong
                />
                <p className="text-[11px] text-zinc-500">{t('creative.enabledHint')}</p>
                {creative.enabled && (
                  <div className="space-y-2 border-t border-zinc-200 pt-2">
                    <CreativeSwitchRow
                      id={`${fieldId}-creative-smooth`}
                      label={t('creative.smooth')}
                      checked={creative.smooth}
                      onChange={(smooth) => setCreative({ smooth })}
                    />
                    <CreativeSwitchRow
                      id={`${fieldId}-creative-magnetic`}
                      label={t('creative.magnetic')}
                      checked={creative.magnetic}
                      onChange={(magnetic) => setCreative({ magnetic })}
                    />
                    <CreativeSwitchRow
                      id={`${fieldId}-creative-curtain`}
                      label={t('creative.curtain')}
                      checked={creative.curtain}
                      onChange={(curtain) => setCreative({ curtain })}
                    />
                    <CreativeSwitchRow
                      id={`${fieldId}-creative-progress`}
                      label={t('creative.progress')}
                      checked={creative.progress}
                      onChange={(progress) => setCreative({ progress })}
                    />
                    <CreativeSwitchRow
                      id={`${fieldId}-creative-cursor`}
                      label={t('creative.cursor')}
                      checked={creative.cursor}
                      onChange={(cursor) => setCreative({ cursor })}
                    />
                    <p className="text-[11px] text-zinc-500">{t('creative.optionsHint')}</p>
                    {creativeMuted && (
                      <p role="status" className="text-[11px] text-amber-700">{t('creative.calmNote')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Store-wide custom CSS (collapsible, advanced) */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setCssOpen((o) => !o)}
              aria-expanded={cssOpen}
              aria-controls="theme-custom-css"
              className="flex w-full items-center justify-between gap-2 text-[10.5px] uppercase tracking-[0.12em] font-bold text-zinc-500 hover:text-zinc-800"
            >
              <span>{t('customCss')}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', cssOpen && 'rotate-180')} />
            </button>
            {cssOpen && (
              <div id="theme-custom-css" className="space-y-1">
                <p className="text-[11px] text-zinc-500">{t('customCssHint')}</p>
                {/* Code is always left-to-right, also in an RTL dashboard. */}
                <textarea
                  dir="ltr"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  rows={8}
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  placeholder={'.store-root h1 {\n  letter-spacing: 0.02em;\n}'}
                  aria-label={t('customCss')}
                  aria-invalid={cssTooLong}
                  aria-describedby="theme-custom-css-count"
                  className={cn(
                    'block w-full resize-y rounded-md border bg-white px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-left text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:ring-2',
                    cssTooLong
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20',
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <p className={cn('text-[11px]', cssTooLong ? 'text-red-600' : 'text-zinc-500')} role={cssTooLong ? 'alert' : undefined}>
                    {cssTooLong
                      ? t('customCssTooLong', { max: CUSTOM_CSS_MAX_LENGTH, over: customCss.length - CUSTOM_CSS_MAX_LENGTH })
                      : t('customCssEmptyHint')}
                  </p>
                  <span
                    id="theme-custom-css-count"
                    dir="ltr"
                    className={cn('shrink-0 font-mono text-[11px] tabular-nums', cssTooLong ? 'text-red-600 font-semibold' : 'text-zinc-400')}
                  >
                    {customCss.length} / {CUSTOM_CSS_MAX_LENGTH}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-zinc-500">
            <RotateCcw className="w-3.5 h-3.5 me-1.5" />
            {t('resetToTheme')}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || cssTooLong}>
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />
                  {tc('saving')}
                </>
              ) : (
                tc('save')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('builder');
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-zinc-600">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-zinc-200 bg-white p-0.5 shrink-0"
        />
        <Input
          className="h-7 flex-1 text-[11px] font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-zinc-400 hover:text-zinc-900 shrink-0" title={t('clear')}>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** One labelled on/off row of the motion style group. */
function CreativeSwitchRow({
  id,
  label,
  checked,
  onChange,
  strong,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={`${id}-label`} className={cn('text-[11.5px] text-zinc-700', strong && 'font-semibold text-zinc-900')}>
        {label}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-indigo-100',
          checked ? 'bg-indigo-600' : 'bg-zinc-200',
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0.5 rtl:-translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/**
 * Small sketch of the product card with the current settings: photo shape,
 * corners, badge, quick add, swatches, sizes and the low-stock line. A
 * picture for the owner only; the storefront draws the real card.
 */
function CardPreview({
  value,
  label,
  title,
  sale,
  low,
}: {
  value: ProductCardValue;
  label: string;
  title: string;
  sale: string;
  low: string;
}) {
  const editorial = value.style === 'editorial';
  const auto = cardStyleDefaults(value.style);
  const aspect = value.aspect || auto.aspect;
  const sharp = (value.corners || auto.corners) === 'square';
  return (
    <div role="img" aria-label={label} className="w-[104px] shrink-0 select-none rounded-md border border-zinc-200 bg-white p-2">
      <div
        className={cn(
          'relative w-full overflow-hidden bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 transition-all',
          aspect === 'portrait' ? 'aspect-[4/5]' : aspect === 'landscape' ? 'aspect-[4/3]' : 'aspect-square',
          sharp ? 'rounded-none' : 'rounded-lg',
        )}
      >
        {value.badge !== 'none' && (
          <span
            className={cn(
              'absolute start-1 top-1 leading-none',
              editorial
                ? 'bg-white px-1 py-0.5 text-[6.5px] font-medium uppercase tracking-[0.14em] text-zinc-900'
                : 'rounded-full bg-red-600 px-1.5 py-0.5 text-[7px] font-bold text-white',
            )}
          >
            {value.badge === 'sale' ? sale : <span dir="ltr">-20%</span>}
          </span>
        )}
        {value.quick_add && (
          <span
            className={cn(
              'absolute bottom-1 end-1 flex size-4 items-center justify-center bg-white text-zinc-900 shadow-sm',
              sharp ? 'rounded-none' : 'rounded-full',
            )}
          >
            <Plus className="size-2.5" />
          </span>
        )}
        {value.hover_image && (
          <span className="absolute bottom-1.5 start-1 flex gap-0.5">
            <span className="size-1 rounded-full bg-zinc-900" />
            <span className="size-1 rounded-full bg-zinc-900/30" />
          </span>
        )}
      </div>
      <div className={cn('mt-1.5 truncate text-zinc-900', editorial ? 'text-[7.5px] uppercase tracking-[0.12em]' : 'text-[8.5px] font-semibold')}>
        {title}
      </div>
      <div className={cn('flex gap-1', editorial ? 'text-[7.5px] text-zinc-500' : 'text-[8.5px] font-bold text-zinc-900')}>
        <span>79</span>
        <span className="font-normal text-zinc-400 line-through">99</span>
      </div>
      {value.swatches && (
        <div className="mt-1 flex gap-1">
          {['#1f2937', '#a8a29e', '#7c2d12'].map((c) => (
            <span key={c} className="size-2 rounded-full border border-black/10" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}
      {value.sizes_line && (
        <div className="mt-1 flex gap-1 text-[7px] tracking-wide text-zinc-600">
          <span>S</span>
          <span>M</span>
          <span>L</span>
          <span className="text-zinc-300 line-through">XL</span>
        </div>
      )}
      {value.availability === 'sold_out_and_low' && (
        <div className={cn('mt-1 text-[7px]', editorial ? 'uppercase tracking-[0.1em] text-zinc-500' : 'font-medium text-amber-700')}>{low}</div>
      )}
    </div>
  );
}
