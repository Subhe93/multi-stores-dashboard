'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Languages, Loader2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  getDiscountTypeOptions,
  LOCALE_LABELS,
  RTL_LOCALES,
  type BundleOffer,
} from './types';

interface Props {
  /** Stable id used by dnd-kit. The parent controls it. */
  id: string;
  index: number;
  offer: BundleOffer;
  locales: string[];
  primaryLocale: string;
  onChange: (next: BundleOffer) => void;
  onRemove: () => void;
}

function ensureLocale(offer: BundleOffer, locale: string): BundleOffer {
  if (offer.translations.some((t) => t.locale === locale)) return offer;
  return {
    ...offer,
    translations: [
      ...offer.translations,
      { locale, title: '', label: '', sticker_text: '' },
    ],
  };
}

export function BundleOfferEditor({
  id,
  index,
  offer,
  locales,
  primaryLocale,
  onChange,
  onRemove,
}: Props) {
  const t = useTranslations();
  const discountTypeOptions = getDiscountTypeOptions(t);
  const { token } = useAuth();
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const [translatingLocale, setTranslatingLocale] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const ensured = ensureLocale(offer, activeLocale);
  const tIdx = ensured.translations.findIndex((t) => t.locale === activeLocale);
  const translation = ensured.translations[tIdx] ?? {
    locale: activeLocale,
    title: '',
    label: '',
    sticker_text: '',
  };

  const setTranslationField = (
    field: 'title' | 'label' | 'sticker_text',
    value: string,
  ) => {
    const ensured = ensureLocale(offer, activeLocale);
    const i = ensured.translations.findIndex((t) => t.locale === activeLocale);
    onChange({
      ...ensured,
      translations: ensured.translations.map((t, idx) =>
        idx === i ? { ...t, [field]: value } : t,
      ),
    });
  };

  const handleTranslateTo = async (target: string) => {
    if (!token || translatingLocale) return;
    const source = offer.translations.find((t) => t.locale === primaryLocale);
    if (!source?.title?.trim()) return;
    setTranslatingLocale(target);
    try {
      const fields: Array<'title' | 'label' | 'sticker_text'> = [
        'title',
        'label',
        'sticker_text',
      ];
      const tasks = fields.map(async (f) => {
        const text = (source[f] as string | undefined | null)?.trim();
        if (!text) return { field: f, translated: '' };
        const res = await api<{ translated: string }>(
          '/translations/translate-text',
          {
            method: 'POST',
            token,
            body: JSON.stringify({
              text,
              source_locale: primaryLocale,
              target_locale: target,
            }),
          },
        );
        return { field: f, translated: res?.translated ?? '' };
      });
      const out = await Promise.all(tasks);

      const ensured = ensureLocale(offer, target);
      const i = ensured.translations.findIndex((t) => t.locale === target);
      const merged = { ...ensured.translations[i] };
      for (const { field, translated } of out) {
        if (translated) (merged as Record<string, string>)[field] = translated;
      }
      onChange({
        ...ensured,
        translations: ensured.translations.map((t, idx) =>
          idx === i ? merged : t,
        ),
      });
    } catch {
      // Silent — UI keeps prior value.
    } finally {
      setTranslatingLocale('');
    }
  };

  const dir = RTL_LOCALES.has(activeLocale) ? 'rtl' : 'ltr';

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-1 text-muted-foreground transition hover:bg-zinc-100 active:cursor-grabbing"
            aria-label={t('bundle.dragToReorder')}
          >
            <GripVertical className="size-4" />
          </button>
          <span className="text-sm font-semibold">
            {t('bundle.bundleOfferNum', { num: String(index + 1).padStart(2, '0') })}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground transition hover:bg-red-50 hover:text-red-500"
          aria-label={t('bundle.removeOffer')}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {locales.length > 1 && (
        <div className="mb-3 flex items-center gap-0 border-b">
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setActiveLocale(locale)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition ${
                locale === activeLocale
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {LOCALE_LABELS[locale] || locale.toUpperCase()}
              {locale === primaryLocale && (
                <span className="ml-1 text-[9px] text-zinc-400">(primary)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeLocale !== primaryLocale && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-dashed bg-zinc-50 p-2.5">
          <span className="text-xs text-muted-foreground">
            {t('bundle.autoTranslateFrom')}{' '}
            <strong>{LOCALE_LABELS[primaryLocale] || primaryLocale}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleTranslateTo(activeLocale)}
            disabled={!!translatingLocale}
            className="ml-3 flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            {translatingLocale === activeLocale ? (
              <>
                <Loader2 className="size-3 animate-spin" /> {t('bundle.translating')}
              </>
            ) : (
              <>
                <Languages className="size-3" /> {t('bundle.autoTranslate')}
              </>
            )}
          </button>
        </div>
      )}

      <div className="space-y-3" dir={dir}>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            {t('bundle.offerTitle')}
            {activeLocale === primaryLocale && (
              <span className="text-red-500"> *</span>
            )}
          </Label>
          <Input
            className="h-9 text-sm"
            placeholder={t('bundle.offerTitlePlaceholder')}
            value={translation.title}
            onChange={(e) => setTranslationField('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" dir="ltr">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('bundle.quantity')}</Label>
            <Input
              type="number"
              min={1}
              className="h-9 text-sm"
              value={offer.quantity}
              onChange={(e) =>
                onChange({ ...offer, quantity: Math.max(1, +e.target.value || 1) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('bundle.discountType')}</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={offer.discount_type}
              onChange={(e) =>
                onChange({
                  ...offer,
                  discount_type: e.target.value as BundleOffer['discount_type'],
                })
              }
            >
              {discountTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('bundle.discountValue')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-9 text-sm"
              value={offer.discount_value}
              onChange={(e) =>
                onChange({
                  ...offer,
                  discount_value: Math.max(0, +e.target.value || 0),
                })
              }
            />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          {discountTypeOptions.find((o) => o.value === offer.discount_type)?.help}
        </p>

        <div dir={dir} className="space-y-1.5">
          <Label className="text-xs font-medium">{t('bundle.offerLabel')}</Label>
          <Input
            className="h-9 text-sm"
            placeholder={t('bundle.offerLabelPlaceholder')}
            value={translation.label ?? ''}
            onChange={(e) => setTranslationField('label', e.target.value)}
          />
        </div>

        <div dir={dir} className="space-y-1.5">
          <Label className="text-xs font-medium">{t('bundle.stickerText')}</Label>
          <Input
            className="h-9 text-sm"
            placeholder={t('bundle.stickerTextPlaceholder')}
            value={translation.sticker_text ?? ''}
            onChange={(e) => setTranslationField('sticker_text', e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            {t('bundle.editColorsHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
