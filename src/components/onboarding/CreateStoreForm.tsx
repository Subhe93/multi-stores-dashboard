'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CheckCircle2, Loader2, Store as StoreIcon, Wallet, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { asciiHandle, asciiHandleTyping } from '@/lib/slug';
import { setCachedStoreType } from '@/lib/useStoreType';
import { invalidateMyStore, type MyStoreSummary } from '@/lib/useStorefrontUrl';
import { isReservedStoreSlug, slugCheckState, type SlugAvailability, type SlugCheckState } from '@/lib/storeStatus';

export type StoreType = 'MARKETPLACE' | 'INDEPENDENT';

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'sv', label: 'Svenska' },
];

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

// Hostname suffix shown next to the slug input (".localhost:3003" in dev).
const PLATFORM_DOMAIN_SUFFIX = (() => {
  try {
    return `.${new URL(WEB_ORIGIN).host}`;
  } catch {
    return '.localhost:3003';
  }
})();

/**
 * Live availability of a store slug through the creator endpoint
 * `GET /stores/slug-available?slug=` (wave 3): available / taken / reserved
 * / invalid, with the same WP normalisation as `POST /stores`. Reserved names
 * are also known locally so they never cost a request. Debounced 400 ms;
 * keyed by slug so a stale response never describes the current input. The
 * final answer is still `POST /stores` (409 STORE_SLUG_TAKEN / 400
 * STORE_SLUG_RESERVED).
 */
function useSlugAvailability(slug: string, token: string): SlugCheckState {
  const [answer, setAnswer] = useState<{ slug: string; state: SlugCheckState } | null>(null);
  const active = slug.length >= 2 && !!token && !isReservedStoreSlug(slug);
  useEffect(() => {
    if (!active) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      api<SlugAvailability>(`/stores/slug-available?slug=${encodeURIComponent(slug)}`, { token, signal: ac.signal })
        .then((res) => setAnswer({ slug, state: slugCheckState(res) }))
        .catch(() => {
          if (ac.signal.aborted) return;
          // Network / throttle: no claim either way; the submit decides.
          setAnswer({ slug, state: 'idle' });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [slug, active, token]);
  if (slug.length < 2) return 'idle';
  if (isReservedStoreSlug(slug)) return 'reserved';
  if (!token) return 'idle';
  return answer?.slug === slug ? answer.state : 'checking';
}

export interface CreateStoreFormProps {
  token: string;
  onCreated: (store: MyStoreSummary) => void;
  /** Pre-selected store type (sign-up card or survey). */
  defaultStoreType?: StoreType;
  /** Pre-selected content language. */
  defaultLocale?: string;
  /** Hides the page heading when embedded in the onboarding stepper. */
  embedded?: boolean;
}

/** `POST /stores`: name, slug, language and the one-time store type choice. */
export function CreateStoreForm({ token, onCreated, defaultStoreType, defaultLocale, embedded }: CreateStoreFormProps) {
  const t = useTranslations('creator');
  const tcom = useTranslations('common');
  const describe = useApiError();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [primaryLocale, setPrimaryLocale] = useState(defaultLocale || 'en');
  const [storeType, setStoreType] = useState<StoreType>(defaultStoreType || 'INDEPENDENT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const availability = useSlugAvailability(asciiHandle(slug), token);

  const handleNameChange = (val: string) => {
    setName(val);
    // Store slug = DNS label: ASCII only, derived from the name until edited.
    if (!slugTouched) setSlug(asciiHandle(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;
    setError('');
    const finalSlug = asciiHandle(slug);
    if (!name.trim() || !finalSlug) {
      setError(t('myStore.nameSlugRequired'));
      return;
    }
    if (isReservedStoreSlug(finalSlug)) {
      setError(t('myStore.slugReserved'));
      return;
    }
    setSlug(finalSlug);
    setSubmitting(true);
    try {
      const created = await api<MyStoreSummary>('/stores', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          slug: finalSlug,
          description: description.trim() || undefined,
          primary_locale: primaryLocale,
          secondary_locales: [],
          store_type: storeType,
        }),
      });
      // Session caches: the sidebar layout and the shared store request.
      setCachedStoreType(created.store_type === 'INDEPENDENT' ? 'INDEPENDENT' : 'MARKETPLACE');
      invalidateMyStore();
      onCreated(created);
    } catch (err) {
      setError(describe(err) || t('myStore.failedCreateStore'));
    } finally {
      setSubmitting(false);
    }
  };

  const slugHint = {
    idle: null,
    checking: <span className="text-muted-foreground">{t('myStore.slugChecking')}</span>,
    available: (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="size-3" /> {t('myStore.slugAvailable')}
      </span>
    ),
    invalid: (
      <span className="inline-flex items-center gap-1 text-red-600">
        <CircleAlert className="size-3" /> {t('myStore.slugInvalid')}
      </span>
    ),
    taken: (
      <span className="inline-flex items-center gap-1 text-red-600">
        <CircleAlert className="size-3" /> {t('myStore.slugTaken')}
      </span>
    ),
    reserved: (
      <span className="inline-flex items-center gap-1 text-red-600">
        <CircleAlert className="size-3" /> {t('myStore.slugReserved')}
      </span>
    ),
  }[availability];

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">
          {t('myStore.storeName')} <span className="text-red-500">*</span>
        </Label>
        <Input
          className="h-9 text-sm"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={t('myStore.storeNamePlaceholder')}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          {t('myStore.slug')} <span className="text-red-500">*</span>
        </Label>
        <div className="flex items-center">
          <Input
            className="h-9 rounded-e-none border-e-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            dir="ltr"
            value={slug}
            onChange={(e) => {
              setSlug(asciiHandleTyping(e.target.value));
              setSlugTouched(true);
            }}
            onBlur={() => setSlug(asciiHandle(slug))}
            placeholder="my-store"
            aria-invalid={availability === 'taken' || availability === 'reserved' || availability === 'invalid'}
            required
          />
          <span className="flex h-9 items-center whitespace-nowrap rounded-e-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-muted-foreground" dir="ltr">
            {PLATFORM_DOMAIN_SUFFIX}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          {slugHint ?? t('myStore.slugHint')}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{tcom('description')}</Label>
        <Textarea
          className="resize-none text-sm"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('myStore.descriptionPlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t('myStore.primaryLanguage')}</Label>
        <SearchableSelect value={primaryLocale} onChange={setPrimaryLocale} options={LOCALES} placeholder={t('myStore.selectLanguage')} />
      </div>

      {/* Store type: chosen once at creation, immutable afterwards. */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('myStore.storeTypeLabel')}</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('myStore.storeTypeLabel')}>
          {[
            {
              value: 'INDEPENDENT' as StoreType,
              icon: <Wallet className="size-4" />,
              title: t('myStore.storeTypeIndependent'),
              desc: t('myStore.storeTypeIndependentDesc'),
            },
            {
              value: 'MARKETPLACE' as StoreType,
              icon: <StoreIcon className="size-4" />,
              title: t('myStore.storeTypeMarketplace'),
              desc: t('myStore.storeTypeMarketplaceDesc'),
            },
          ].map((opt) => {
            const selected = storeType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStoreType(opt.value)}
                className={`rounded-lg border p-3 text-start transition ${
                  selected ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={selected ? 'text-zinc-900' : 'text-zinc-500'}>{opt.icon}</span>
                  <span className="text-sm font-medium">{opt.title}</span>
                  {selected && <Check className="ms-auto size-3.5 text-zinc-900" />}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">{t('myStore.storeTypeHint')}</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="pt-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> {t('myStore.creating')}
            </>
          ) : (
            t('myStore.createStore')
          )}
        </Button>
      </div>
    </form>
  );

  if (embedded) return form;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('myStore.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('myStore.setUpToSell')}</p>
      </div>
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('myStore.createYourStore')}</CardTitle>
        </CardHeader>
        <CardContent>{form}</CardContent>
      </Card>
    </div>
  );
}
