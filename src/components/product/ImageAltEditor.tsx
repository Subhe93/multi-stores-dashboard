'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleTabs } from '@/components/common/LocaleTabs';
import { resolveMediaUrl } from '@/lib/media';
import { IMAGE_ALT_MAX, altFilledLocales, altValueFor, withImageAlt, type ImageWithAlt } from '@/lib/imageAlt';

interface AltImage extends ImageWithAlt {
  id: string;
  url: string;
}

interface ImageAltEditorProps<I extends AltImage> {
  /** Product-level images, in gallery order. */
  images: I[];
  onChange: (images: I[]) => void;
  /** Language being edited (the form's shared language tab). */
  activeLocale: string;
  onLocaleChange: (locale: string) => void;
  /** All content languages of the store. */
  locales: string[];
  primaryLocale: string;
  /** Display name of the language being edited. */
  languageLabel: string;
  /** Product title in the language being edited (placeholder fallback). */
  titleFallback?: string;
  isRtl: boolean;
}

/**
 * M170 A: alt text of every product image, per language. The store's primary
 * language edits the default alt; every other language its own text, with
 * the default alt (else the product title) as the placeholder, since an
 * empty field falls back to it on the storefront.
 */
export function ImageAltEditor<I extends AltImage>({
  images,
  onChange,
  activeLocale,
  onLocaleChange,
  locales,
  primaryLocale,
  languageLabel,
  titleFallback,
  isRtl,
}: ImageAltEditorProps<I>) {
  const t = useTranslations('image');
  if (images.length === 0) return null;
  const isPrimary = activeLocale === primaryLocale;

  return (
    <div id="product-image-alt" className="mt-3 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="space-y-0.5">
        <Label className="text-xs">{t('altTitle')}</Label>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {isPrimary ? t('altHelpPrimary') : t('altHelpLocale', { language: languageLabel })}
        </p>
      </div>
      <LocaleTabs
        value={activeLocale}
        onChange={onLocaleChange}
        locales={locales}
        primaryLocale={primaryLocale}
        filled={altFilledLocales(images, locales, primaryLocale)}
        variant="pill"
        hint={false}
      />
      <ul className="space-y-1.5">
        {images.map((img, index) => {
          const value = altValueFor(img, activeLocale, primaryLocale);
          const label = t('altInputLabel', { number: index + 1 });
          const placeholder = isPrimary
            ? t('altPlaceholder')
            : (img.alt_text || '').trim() || (titleFallback || '').trim() || t('altPlaceholder');
          return (
            <li key={img.id} className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveMediaUrl(img.url)}
                alt=""
                aria-hidden
                className="h-10 w-10 shrink-0 rounded-md border border-border object-cover bg-background"
              />
              <Input
                dir={isRtl ? 'rtl' : 'ltr'}
                className="h-8 text-sm min-w-0 flex-1"
                maxLength={IMAGE_ALT_MAX}
                aria-label={label}
                title={label}
                value={value}
                placeholder={placeholder}
                onChange={(e) =>
                  onChange(
                    images.map((other) =>
                      other.id === img.id ? withImageAlt(other, activeLocale, primaryLocale, e.target.value) : other,
                    ),
                  )
                }
              />
              <span className="w-12 shrink-0 text-end text-[10px] tabular-nums text-muted-foreground" aria-hidden>
                {value ? t('altCounter', { count: value.length, max: IMAGE_ALT_MAX }) : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
