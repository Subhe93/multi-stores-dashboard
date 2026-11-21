'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { countryLabel } from '@/lib/taxCountries';
import {
  PATH_LANGUAGES,
  buildLocalePath,
  countriesWithoutPath,
  hasPlainCode,
  languageName,
  legacyRedirects,
  localePathStatus,
  type LocalePathError,
} from '@/lib/localePaths';
import type { MarketLocalePath, MarketLocalePathInactiveReason } from '@/lib/markets.api';

/** Select value standing for "All countries" (a language-only row, country null). */
const ALL_COUNTRIES = '__all__';

/** DOM id of the card, so the form can scroll to it on a validation error. */
export const LOCALE_PATHS_CARD_ID = 'market-locale-paths';

const INACTIVE_KEY: Record<MarketLocalePathInactiveReason, string> = {
  locale_unsupported: 'inactiveLocaleUnsupported',
  locale_not_enabled: 'inactiveLocaleNotEnabled',
  country_not_in_market: 'inactiveCountry',
};

// Inline row messages; the other codes cannot come from the editor's own
// choices and fall back to the errors.<code> text.
const ROW_ERROR_KEY: Partial<Record<LocalePathError['code'], string>> = {
  MARKET_LOCALE_PATH_DUPLICATE: 'errorDuplicate',
  MARKET_LOCALE_PATH_DEFAULT_LOCALE: 'errorDefaultLocale',
  MARKET_LOCALE_PATH_COUNTRY: 'errorCountry',
  MARKET_LOCALE_PATH_HREFLANG: 'errorHreflang',
};

interface LocalePathsEditorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  rows: MarketLocalePath[];
  onChange: (rows: MarketLocalePath[]) => void;
  /** Current form values: the activity badges and the choices follow them live. */
  defaultLocale: string;
  locales: string[];
  countries: string[];
  /** Hostname for the URL preview (primary domain or platform host); empty for a new market. */
  host: string;
  /** Errors to show per row (client validation, or the API error with its index). */
  errors: LocalePathError[];
}

/**
 * M156 "Language-country URLs" card of the market form: optional per-market
 * URL paths such as /de-de/ and /de-at/ instead of the bare /de/ folder.
 * Each row is built from a language, a country (or all countries) and the
 * "plain code" choice, so only the shapes the API accepts can be produced.
 */
export function LocalePathsEditor({
  enabled,
  onEnabledChange,
  rows,
  onChange,
  defaultLocale,
  locales,
  countries,
  host,
  errors,
}: LocalePathsEditorProps) {
  const t = useTranslations('creator.markets.form.localePaths');
  const tErrors = useTranslations('errors');
  const uiLocale = useLocale();

  const market = { locales: locales.filter((l) => l !== defaultLocale), countries };
  const langLabel = (code: string) => `${languageName(code, uiLocale)} (${code})`;

  // Another row already answers for the plain code of `locale`.
  const plainOwner = (locale: string, except: number) => rows.find((r, i) => i !== except && hasPlainCode(r) && r.locale === locale);

  const replace = (index: number, row: MarketLocalePath) => onChange(rows.map((r, i) => (i === index ? row : r)));

  const update = (index: number, locale: string, country: string | null, plain: boolean) =>
    replace(index, buildLocalePath(locale, country, plain && !plainOwner(locale, index)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  // A new row takes the first free (language, country) pair, preferring the
  // market's enabled languages, so it never starts as a duplicate.
  const addRow = () => {
    const languages = [...market.locales, ...PATH_LANGUAGES.filter((l) => !market.locales.includes(l))].filter(
      (l) => l !== defaultLocale,
    );
    const taken = new Set(rows.map((r) => `${r.locale}|${r.country ?? ''}`));
    const slots: (string | null)[] = [...countries, null];
    for (const locale of languages) {
      for (const country of slots) {
        if (taken.has(`${locale}|${country ?? ''}`)) continue;
        const plain = !!country && !rows.some((r) => hasPlainCode(r) && r.locale === locale);
        onChange([...rows, buildLocalePath(locale, country, plain)]);
        return;
      }
    }
  };

  const toggle = (on: boolean) => {
    onEnabledChange(on);
    if (on && rows.length === 0) addRow();
  };

  const statuses = rows.map((r) => localePathStatus(r, market));
  const activeRows = rows.filter((_, i) => statuses[i].active);
  const redirects = legacyRedirects(activeRows);
  const uncovered = countriesWithoutPath(activeRows, countries);
  const languageOnly = activeRows.filter((r) => r.country === null).map((r) => `/${r.path}/`);
  const errorOf = (index: number) => errors.find((e) => e.index === index) ?? null;

  return (
    <Card id={LOCALE_PATHS_CARD_ID} className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('hint')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
          <div className="space-y-0.5">
            <span className="block text-xs font-medium">{t('enable')}</span>
            <p className="text-[10px] text-muted-foreground">{t('enableHint')}</p>
          </div>
        </label>

        {enabled && (
          <>
            {rows.length === 0 && <p className="text-xs text-muted-foreground">{t('empty')}</p>}

            <ol className="space-y-3">
              {rows.map((row, index) => {
                const status = statuses[index];
                const error = errorOf(index);
                const errorId = `${LOCALE_PATHS_CARD_ID}-err-${index}`;
                const plainTakenBy = row.country ? plainOwner(row.locale, index) : undefined;
                const languageOptions = [
                  ...PATH_LANGUAGES.filter((l) => l !== defaultLocale),
                  // A stored language outside the list stays selectable as it is.
                  ...(PATH_LANGUAGES.includes(row.locale) && row.locale !== defaultLocale ? [] : [row.locale]),
                ].map((l) => ({ value: l, label: langLabel(l) }));
                const countryOptions = [
                  { value: ALL_COUNTRIES, label: t('allCountries') },
                  ...[...countries, ...(row.country && !countries.includes(row.country) ? [row.country] : [])].map((c) => ({
                    value: c,
                    label: countryLabel(c, uiLocale),
                  })),
                ];
                const languageId = `${LOCALE_PATHS_CARD_ID}-lang-${index}`;
                const countryId = `${LOCALE_PATHS_CARD_ID}-country-${index}`;
                return (
                  <li
                    key={index}
                    role="group"
                    aria-label={t('row', { number: index + 1 })}
                    // aria-invalid is not valid on a group; the error is linked instead.
                    aria-describedby={error ? errorId : undefined}
                    className={`space-y-3 rounded-md border p-3 ${error ? 'border-red-300 bg-red-50/40' : 'border-zinc-200'}`}
                  >
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor={languageId} className="text-xs">
                          {t('language')}
                        </Label>
                        <SearchableSelect
                          id={languageId}
                          value={row.locale}
                          onChange={(v) => update(index, v, row.country, hasPlainCode(row))}
                          options={languageOptions}
                        />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor={countryId} className="text-xs">
                          {t('country')}
                        </Label>
                        <SearchableSelect
                          id={countryId}
                          value={row.country ?? ALL_COUNTRIES}
                          onChange={(v) =>
                            update(index, row.locale, v === ALL_COUNTRIES ? null : v, row.country ? hasPlainCode(row) : true)
                          }
                          options={countryOptions}
                        />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <span className="block text-xs font-medium">{t('url')}</span>
                        <p className="flex h-8 items-center truncate rounded-md border border-dashed bg-zinc-50 px-2 font-mono text-xs text-zinc-700">
                          <bdi dir="ltr">{`${host}/${row.path}/`}</bdi>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium">{t('hreflang')}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.hreflang.map((code) => (
                          <Badge key={code} variant="outline" className="font-mono text-[10px]">
                            <bdi dir="ltr">{code}</bdi>
                          </Badge>
                        ))}
                      </div>
                      {row.country && (
                        <label
                          className={`flex items-start gap-2 text-xs ${plainTakenBy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={hasPlainCode(row)}
                            disabled={!!plainTakenBy}
                            onChange={(e) => update(index, row.locale, row.country, e.target.checked)}
                          />
                          <span className="space-y-0.5">
                            <span className="block">
                              {t('plainCode', { language: languageName(row.locale, uiLocale), code: row.locale })}
                            </span>
                            {plainTakenBy && (
                              <span className="block text-[10px] text-muted-foreground">
                                {t('plainCodeTaken', { code: row.locale, path: plainTakenBy.path })}
                              </span>
                            )}
                          </span>
                        </label>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{t('status')}:</span>
                        {status.active ? (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800">
                            {t('active')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-auto whitespace-normal border-amber-300 bg-amber-50 text-start text-[10px] text-amber-800">
                            {t(INACTIVE_KEY[status.inactive_reason ?? 'locale_not_enabled'])}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t('moveUp')}
                          title={t('moveUp')}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t('moveDown')}
                          title={t('moveDown')}
                          disabled={index === rows.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-600 hover:text-red-700"
                          aria-label={t('remove')}
                          title={t('remove')}
                          onClick={() => onChange(rows.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {error && (
                      <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[11px] text-red-600">
                        <AlertTriangle className="mt-px size-3.5 shrink-0" />
                        <span>{ROW_ERROR_KEY[error.code] ? t(ROW_ERROR_KEY[error.code]!) : tErrors(error.code)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3.5" /> {t('addRow')}
            </Button>

            {(redirects.length > 0 || (activeRows.length > 0 && uncovered.length > 0)) && (
              <ul className="space-y-1 border-t pt-3 text-[11px] text-muted-foreground">
                {redirects.map((r) => (
                  <li key={r.from}>{t('redirectSummary', { from: r.from, to: r.to })}</li>
                ))}
                {activeRows.length > 0 && uncovered.length > 0 && (
                  <li>
                    {languageOnly.length > 0
                      ? t('rootSummaryWithPaths', {
                          countries: uncovered.join(', '),
                          language: languageName(defaultLocale, uiLocale),
                          paths: languageOnly.join(', '),
                        })
                      : t('rootSummary', { countries: uncovered.join(', '), language: languageName(defaultLocale, uiLocale) })}
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
