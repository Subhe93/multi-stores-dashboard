'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LayoutTemplate, Loader2, Palette } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchThemes, type ThemePresetSummary } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeCard } from '@/components/themes/ThemeCard';
import { ApplyThemeDialog } from '@/components/themes/ApplyThemeDialog';

interface StoreLite {
  language_config?: { primary_locale?: string } | null;
  theme_customizations?: { preset_id?: string } | null;
}

export default function ThemesPage() {
  const { token } = useAuth();
  const t = useTranslations('creator.themes');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [themes, setThemes] = useState<ThemePresetSummary[]>([]);
  const [primaryLocale, setPrimaryLocale] = useState('en');
  const [currentPresetId, setCurrentPresetId] = useState<string | undefined>(undefined);
  const [active, setActive] = useState<ThemePresetSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // The loading/error flags are reset by the caller (initial state or the
  // Retry button) so the effect never sets state synchronously.
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetchThemes(token),
      api<StoreLite>('/stores/my/store', { token }).catch(() => null),
    ])
      .then(([list, store]) => {
        setThemes(Array.isArray(list) ? list : []);
        if (store?.language_config?.primary_locale) setPrimaryLocale(store.language_config.primary_locale);
        setCurrentPresetId(store?.theme_customizations?.preset_id);
      })
      .catch((err) => {
        console.error('Failed to load themes:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [token, reloadKey]);

  // Re-read the store after an apply so the "Current" badge moves to the new
  // preset without a full reload of the gallery.
  async function refreshStore() {
    if (!token) return;
    try {
      const store = await api<StoreLite>('/stores/my/store', { token });
      setCurrentPresetId(store?.theme_customizations?.preset_id);
    } catch {
      /* keep the previous marker; the next page load will catch up */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Point creators who want new page content at the template kits instead */}
      <div className="flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
        <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-indigo-600" />
        <p className="text-xs text-indigo-900 leading-relaxed">
          {t('hint')}{' '}
          <Link href="/creator/templates" className="font-medium underline underline-offset-2">
            {t('hintLink')}
          </Link>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 text-zinc-400 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm text-destructive">{t('loadFailed')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              setLoadError(false);
              setReloadKey((k) => k + 1);
            }}
          >
            {t('retry')}
          </Button>
        </div>
      ) : themes.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <Palette className="size-6" />
            </div>
            <p className="text-sm font-medium">{t('noneAvailable')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((preset) => (
            <ThemeCard
              key={preset.id}
              preset={preset}
              primaryLocale={primaryLocale}
              isCurrent={!!currentPresetId && preset.id === currentPresetId}
              onApply={setActive}
            />
          ))}
        </div>
      )}

      <ApplyThemeDialog
        preset={active}
        primaryLocale={primaryLocale}
        onClose={() => setActive(null)}
        onApplied={refreshStore}
      />
    </div>
  );
}
