'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Languages, Check, X, Loader2, RefreshCw, Globe } from 'lucide-react';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
interface TranslationEntity {
  id: string;
  type: string;
  title: string;
  translated_locales: string[];
}

interface Overview {
  store_id: string | null;
  primary_locale: string;
  secondary_locales: string[];
  products: TranslationEntity[];
  custom_products: TranslationEntity[];
  pages: TranslationEntity[];
}

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', sv: 'Svenska',
};

type Translator = ReturnType<typeof useTranslations>;

function entityLabels(t: Translator): Record<string, string> {
  return {
    products: t('translations.entityProducts'),
    custom_products: t('translations.entityCustomProducts'),
    pages: t('translations.entityPages'),
  };
}

// ──────────────────────────────────────────────────────────
// Stat card
// ──────────────────────────────────────────────────────────
function StatCard({
  label,
  done,
  total,
  onTranslateAll,
  translating,
}: {
  label: string;
  done: number;
  total: number;
  onTranslateAll: () => void;
  translating: boolean;
}) {
  const t = useTranslations('creator');
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);
  const allDone = done === total;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-700">{label}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: allDone ? '#10b981' : '#2563eb',
              }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {done}/{total}
          </span>
        </div>
      </div>
      {!allDone && total > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={onTranslateAll}
          disabled={translating}
        >
          {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : t('translations.translateAll')}
        </Button>
      )}
      {allDone && total > 0 && (
        <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 shrink-0">
          <Check className="w-3 h-3" /> {t('translations.done')}
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Entity table
// ──────────────────────────────────────────────────────────
function EntityTable({
  entities,
  locale,
  primaryLocale,
  storeId,
  onTranslated,
}: {
  entities: TranslationEntity[];
  locale: string;
  primaryLocale: string;
  storeId: string | null;
  onTranslated: (entityId: string) => void;
}) {
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const { token } = useAuth();
  const t = useTranslations('creator');

  const handleTranslate = async (entity: TranslationEntity) => {
    if (!token) return;
    setTranslating((p) => ({ ...p, [entity.id]: true }));
    try {
      await api('/translations/auto-translate', {
        method: 'POST',
        token,
        body: JSON.stringify({
          entity_type: entity.type,
          entity_id: entity.id,
          source_locale: primaryLocale,
          target_locale: locale,
        }),
      });
      onTranslated(entity.id);
    } catch (err) {
      console.error('Failed to translate entity:', err);
    } finally {
      setTranslating((p) => ({ ...p, [entity.id]: false }));
    }
  };

  if (entities.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        {t('translations.noItemsInSection')}
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {entities.map((entity) => {
        const isDone = entity.translated_locales.includes(locale);
        const isTranslating = !!translating[entity.id];

        return (
          <div key={entity.id} className="flex items-center gap-3 py-2.5 px-1">
            {/* Status dot */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isDone ? 'bg-emerald-500' : 'bg-zinc-200'
              }`}
            />

            {/* Title */}
            <span className="flex-1 text-sm text-zinc-700 truncate min-w-0">
              {entity.title}
            </span>

            {/* Status badge */}
            {isDone ? (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50 shrink-0"
              >
                <Check className="w-2.5 h-2.5 mr-1" />
                {t('translations.translated')}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] text-zinc-400 border-zinc-200 shrink-0"
              >
                <X className="w-2.5 h-2.5 mr-1" />
                {t('translations.missing')}
              </Badge>
            )}

            {/* Translate button */}
            <button
              onClick={() => handleTranslate(entity)}
              disabled={isTranslating || isDone}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              {isTranslating ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {t('translations.translating')}</>
              ) : isDone ? (
                <><RefreshCw className="w-3 h-3" /> {t('translations.retranslate')}</>
              ) : (
                <><Languages className="w-3 h-3" /> {t('translations.translate')}</>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────
export default function TranslationsPage() {
  const { token } = useAuth();
  const t = useTranslations('creator');
  const ENTITY_LABELS = entityLabels(t);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLocale, setActiveLocale] = useState<string>('');
  const [bulkTranslating, setBulkTranslating] = useState<Record<string, boolean>>({});

  const fetchOverview = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<Overview>('/translations/overview', { token });
      setOverview(data);
      if (!activeLocale && data.secondary_locales.length > 0) {
        const firstSecondary = data.secondary_locales.find(l => l !== data.primary_locale);
        setActiveLocale(firstSecondary || data.secondary_locales[0] || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleEntityTranslated = useCallback((entityId: string) => {
    if (!activeLocale) return;
    setOverview((prev) => {
      if (!prev) return prev;
      const addLocale = (arr: TranslationEntity[]) =>
        arr.map((e) =>
          e.id === entityId && !e.translated_locales.includes(activeLocale)
            ? { ...e, translated_locales: [...e.translated_locales, activeLocale] }
            : e,
        );
      return {
        ...prev,
        products: addLocale(prev.products),
        custom_products: addLocale(prev.custom_products),
        pages: addLocale(prev.pages),
      };
    });
  }, [activeLocale]);

  const handleBulkTranslate = async (entityTypes: string[]) => {
    if (!token || !overview?.store_id || !activeLocale) return;
    const key = entityTypes.join('-') + '-' + activeLocale;
    setBulkTranslating((p) => ({ ...p, [key]: true }));
    try {
      await api('/translations/bulk-translate', {
        method: 'POST',
        token,
        body: JSON.stringify({
          store_id: overview.store_id,
          target_locale: activeLocale,
          source_locale: overview.primary_locale,
          entity_types: entityTypes,
        }),
      });
      // Refresh overview after bulk translate
      await fetchOverview();
    } catch (err) {
      console.error('Bulk translate failed:', err);
    } finally {
      setBulkTranslating((p) => ({ ...p, [key]: false }));
    }
  };

  // ────────────────────────────────────────
  // Loading
  // ────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl">
        <div className="h-7 bg-zinc-200 rounded w-48" />
        <div className="h-12 bg-zinc-100 rounded" />
        <div className="h-64 bg-zinc-100 rounded" />
      </div>
    );
  }

  // ────────────────────────────────────────
  // No store / no secondary locales
  // ────────────────────────────────────────
  if (!overview?.store_id) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <Globe className="w-10 h-10 text-zinc-300" />
        <p className="text-sm font-medium">{t('translations.noStoreFound')}</p>
        <p className="text-xs text-muted-foreground">{t('translations.noStoreDesc')}</p>
      </div>
    );
  }

  const secondaryLocales = overview.secondary_locales.filter(l => l !== overview.primary_locale);

  if (secondaryLocales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center max-w-sm mx-auto">
        <Languages className="w-10 h-10 text-zinc-300" />
        <p className="text-sm font-medium">{t('translations.noSecondaryTitle')}</p>
        <p className="text-xs text-muted-foreground">
          {t('translations.noSecondaryPrefix')}{' '}
          <a href="/creator/store" className="text-primary underline">
            {t('translations.noSecondaryLink')}
          </a>{' '}
          {t('translations.noSecondarySuffix')}
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────
  // Per-locale stats
  // ────────────────────────────────────────
  const sections = [
    { key: 'products', entities: overview.products },
    { key: 'custom_products', entities: overview.custom_products },
    { key: 'pages', entities: overview.pages },
  ].filter((s) => s.entities.length > 0);

  const getStats = (entities: TranslationEntity[]) => ({
    done: entities.filter((e) => e.translated_locales.includes(activeLocale)).length,
    total: entities.length,
  });

  const totalDone = sections.reduce((sum, s) => sum + getStats(s.entities).done, 0);
  const totalItems = sections.reduce((sum, s) => sum + s.entities.length, 0);
  const allDone = totalDone === totalItems;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('translations.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('translations.subtitle')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOverview} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('translations.refresh')}
        </Button>
      </div>

      {/* Language tabs */}
      <div className="flex items-center gap-1 border-b">
        {secondaryLocales.map((locale) => {
          const stats = sections.reduce(
            (acc, s) => ({
              done: acc.done + getStats(s.entities).done,
              total: acc.total + s.entities.length,
            }),
            { done: 0, total: 0 },
          );
          // Recalculate for this specific locale
          const localeDone = sections.reduce(
            (sum, s) => sum + s.entities.filter((e) => e.translated_locales.includes(locale)).length,
            0,
          );
          const isActive = locale === activeLocale;
          const pct = totalItems === 0 ? 100 : Math.round((localeDone / totalItems) * 100);

          return (
            <button
              key={locale}
              onClick={() => setActiveLocale(locale)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {LOCALE_LABELS[locale] || locale.toUpperCase()}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  localeDone === totalItems
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {pct}%
              </span>
            </button>
          );
        })}
      </div>

      {activeLocale && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {LOCALE_LABELS[activeLocale] || activeLocale}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('translations.itemsTranslated', { done: totalDone, total: totalItems })}
              </span>
            </div>
            {!allDone && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleBulkTranslate(['all'])}
                disabled={!!bulkTranslating[`all-${activeLocale}`]}
              >
                {bulkTranslating[`all-${activeLocale}`] ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('translations.translatingEverything')}</>
                ) : (
                  <><Languages className="w-3.5 h-3.5" /> {t('translations.translateEverything')}</>
                )}
              </Button>
            )}
          </div>

          {/* Per-section stats */}
          <div className="grid grid-cols-2 gap-3">
            {sections.map((section) => {
              const { done, total } = getStats(section.entities);
              const key = `${section.key}-${activeLocale}`;
              return (
                <StatCard
                  key={section.key}
                  label={ENTITY_LABELS[section.key] || section.key}
                  done={done}
                  total={total}
                  translating={!!bulkTranslating[key]}
                  onTranslateAll={() => handleBulkTranslate([section.key])}
                />
              );
            })}
          </div>

          {/* Entity tables per section */}
          {sections.map((section) => (
            <Card key={section.key} className="shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {ENTITY_LABELS[section.key] || section.key}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {t('translations.countTranslated', { done: getStats(section.entities).done, total: section.entities.length })}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <EntityTable
                  entities={section.entities}
                  locale={activeLocale}
                  primaryLocale={overview.primary_locale}
                  storeId={overview.store_id}
                  onTranslated={handleEntityTranslated}
                />
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
