'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Check, Loader2, Rocket, Store as StoreIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CreateStoreForm } from '@/components/onboarding/CreateStoreForm';
import { useAuth } from '@/lib/auth';
import { useMyStore } from '@/lib/useMyStore';
import { resolveOnboardingSurvey, saveOnboardingSurvey } from '@/lib/onboardingSurvey';
import { countryFromLocale, suggestedStoreType, SURVEY_SELLS, SURVEY_STAGES, type OnboardingSurvey, type SurveySells, type SurveyStage } from '@/lib/storeStatus';
import { taxCountryOptions } from '@/lib/taxCountries';
import { cn } from '@/lib/utils';

type Step = 'survey' | 'store';

function OptionCard({ selected, title, onClick }: { selected: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-start text-sm transition',
        selected ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-400',
      )}
    >
      <span className="flex-1 font-medium">{title}</span>
      {selected && <Check className="size-3.5 text-zinc-900" />}
    </button>
  );
}

/**
 * First-run onboarding (PLAN §2.4): a skippable survey, then the store
 * creation form. The creator layout sends every creator route here while
 * `GET /stores/my/store` answers 404 and hides the sidebar meanwhile.
 */
export default function CreatorOnboardingPage() {
  const { token, user, refreshProfile } = useAuth();
  const router = useRouter();
  const t = useTranslations('creator.onboarding');
  const locale = useLocale();
  const { store, loading } = useMyStore();
  const [step, setStep] = useState<Step>('survey');
  const [saving, setSaving] = useState(false);
  // Stored answers (server profile, else the browser copy) + the browser
  // locale's country (SE when unknown). This page only mounts client-side
  // (behind the auth gate), so reading the browser here is safe; the server
  // branch keeps the initializer pure.
  const [survey, setSurvey] = useState<OnboardingSurvey>(() =>
    typeof window === 'undefined'
      ? {}
      : { country: countryFromLocale(navigator.language), ...resolveOnboardingSurvey(user?.creator?.onboarding_profile) },
  );

  // A store already exists: nothing to onboard.
  useEffect(() => {
    if (!loading && store) router.replace('/creator');
  }, [loading, store, router]);

  const countryOptions = useMemo(() => {
    const opts = taxCountryOptions(locale);
    // Sweden first: the platform's home market.
    const se = opts.find((o) => o.value === 'SE');
    return se ? [se, ...opts.filter((o) => o.value !== 'SE')] : opts;
  }, [locale]);

  const accountKind = user?.creator?.onboarding_profile?.account_kind ?? null;
  const defaultStoreType = suggestedStoreType(accountKind, survey);

  // Saves through `PUT /creators/me/onboarding-profile` (localStorage is the
  // fallback inside saveOnboardingSurvey); a failed save never blocks the
  // flow, the answers still shape this session.
  const continueToStore = async (save: boolean) => {
    if (save) {
      setSaving(true);
      const stored = await saveOnboardingSurvey(token ?? '', survey);
      if (stored) await refreshProfile().catch(() => undefined);
      setSaving(false);
    }
    setStep('store');
  };

  if (loading || store) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <ol className="flex items-center gap-3 text-xs text-muted-foreground" aria-label={t('stepsLabel')}>
        {(['survey', 'store'] as Step[]).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                step === s ? 'bg-zinc-900 text-white' : i === 0 && step === 'store' ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700',
              )}
            >
              {i === 0 && step === 'store' ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={step === s ? 'font-medium text-foreground' : undefined}>{t(`steps.${s}`)}</span>
            {i === 0 && <span className="ms-1 h-px w-8 bg-zinc-200" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 'survey' ? (
        <>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t('welcome', { name: user?.creator?.display_name || '' })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('welcomeHint')}</p>
          </div>
          <Card className="shadow-none">
            <CardContent className="space-y-6 p-5">
              <div className="space-y-2">
                <Label className="text-xs">{t('stage.label')}</Label>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('stage.label')}>
                  {SURVEY_STAGES.map((v) => (
                    <OptionCard key={v} selected={survey.stage === v} title={t(`stage.${v}`)} onClick={() => setSurvey((s) => ({ ...s, stage: v as SurveyStage }))} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('sells.label')}</Label>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('sells.label')}>
                  {SURVEY_SELLS.map((v) => (
                    <OptionCard key={v} selected={survey.sells === v} title={t(`sells.${v}`)} onClick={() => setSurvey((s) => ({ ...s, sells: v as SurveySells }))} />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{t('sells.hint')}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('country')}</Label>
                <SearchableSelect
                  value={survey.country ?? 'SE'}
                  onChange={(v) => setSurvey((s) => ({ ...s, country: v }))}
                  options={countryOptions}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void continueToStore(false)}>
                  {t('skip')}
                </Button>
                <Button type="button" size="sm" disabled={saving} onClick={() => void continueToStore(true)}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {t('continue')}
                  <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
              <StoreIcon className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{t('createTitle')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('createHint')}</p>
            </div>
          </div>
          <Card className="shadow-none">
            <CardContent className="p-5">
              <CreateStoreForm
                token={token ?? ''}
                embedded
                defaultStoreType={defaultStoreType}
                defaultLocale={locale}
                onCreated={() => router.replace('/creator')}
              />
            </CardContent>
          </Card>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Rocket className="size-3.5" aria-hidden="true" />
            {t('afterCreate')}
          </p>
          <Button type="button" variant="link" size="sm" className="px-0 text-xs" onClick={() => setStep('survey')}>
            {t('backToSurvey')}
          </Button>
        </>
      )}
    </div>
  );
}
