'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CountryMultiSelect } from '@/components/common/CountryMultiSelect';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { useCurrency } from '@/lib/useCurrency';
import {
  EMPTY_POLICIES_FORM,
  HANDLING_MAX_DAYS,
  RETURN_CATEGORIES,
  RETURN_DAYS_MAX,
  RETURN_FEES,
  RETURN_METHODS,
  RETURN_POLICIES_MAX,
  emptyReturnPolicy,
  firstInvalidPolicy,
  isPoliciesFormEmpty,
  policiesFormErrors,
  policyErrorsAt,
  samePoliciesForm,
  serverPolicyErrors,
  takenCountries,
  toPoliciesBody,
  toPoliciesForm,
  type MerchantPoliciesForm,
  type PolicyErrorKey,
  type PolicyErrors,
  type ReturnCategory,
  type ReturnFees,
  type ReturnMethod,
  type ReturnPolicyForm,
} from '@/lib/merchantPolicies';

// Merchant policies of the store (M170 C): handling time and return policies.
// They are published as structured data on product pages exactly as entered;
// an empty card publishes nothing. Self-contained: own load, save and dirty
// state, independent of the shipping profile dialogs on the same page.

const CATEGORY_LABEL: Record<ReturnCategory, string> = {
  finite: 'categoryFinite',
  unlimited: 'categoryUnlimited',
  none: 'categoryNone',
};
const METHOD_LABEL: Record<ReturnMethod, string> = {
  mail: 'methodMail',
  store: 'methodStore',
  kiosk: 'methodKiosk',
};
const FEES_LABEL: Record<ReturnFees, string> = {
  free: 'feesFree',
  customer: 'feesCustomer',
  fixed: 'feesFixed',
};
// SearchableSelect needs a non-empty value for "not stated".
const FEES_UNSET = 'unset';

interface StoreResponse {
  merchant_policies?: unknown;
}

/** The dialog's draft: the policy being edited and its position (-1 = new). */
interface Draft {
  index: number;
  policy: ReturnPolicyForm;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[11px] text-destructive">
      {message}
    </p>
  );
}

export function MerchantPoliciesCard() {
  const t = useTranslations('shipping.policies');
  const tc = useTranslations('common');
  const describeError = useApiError();
  const { token } = useAuth();
  const { currency } = useCurrency();
  const ids = useId();

  const [saved, setSaved] = useState<MerchantPoliciesForm>(EMPTY_POLICIES_FORM);
  const [form, setForm] = useState<MerchantPoliciesForm>(EMPTY_POLICIES_FORM);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [errors, setErrors] = useState<PolicyErrors>({});
  const [banner, setBanner] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErrors, setDraftErrors] = useState<Partial<Record<string, PolicyErrorKey>>>({});
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<StoreResponse>('/stores/my/store', { token })
      .then((store) => {
        if (cancelled) return;
        const loaded = toPoliciesForm(store?.merchant_policies);
        setSaved(loaded);
        setForm(loaded);
      })
      .catch((err) => {
        if (!cancelled) setLoadFailed(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // describeError is a fresh closure on every render; the load runs once per token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const dirty = !samePoliciesForm(form, saved);
  const configured = !isPoliciesFormEmpty(saved);
  const errorText = (key?: PolicyErrorKey) => (key ? t(`errors.${key}`) : undefined);

  const update = (next: MerchantPoliciesForm) => {
    setForm(next);
    setJustSaved(false);
    setBanner('');
  };

  const setHandling = (key: 'handling_min' | 'handling_max', value: string) => {
    update({ ...form, [key]: value });
    setErrors((prev) => {
      const { 'handling.min_days': _min, 'handling.max_days': _max, ...rest } = prev;
      void _min;
      void _max;
      return rest;
    });
  };

  const openPolicy = (index: number, policyErrors?: Partial<Record<string, PolicyErrorKey>>) => {
    setDraft({ index, policy: index < 0 ? emptyReturnPolicy() : { ...form.returns[index] } });
    setDraftErrors(policyErrors ?? {});
  };

  const patchDraft = (patch: Partial<ReturnPolicyForm>) => {
    if (!draft) return;
    setDraft({ ...draft, policy: { ...draft.policy, ...patch } });
    setDraftErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      // The type decides which of the other fields apply.
      if ('category' in patch) {
        delete next.days;
        delete next.methods;
        delete next.fee_amount;
      }
      if ('fees' in patch) delete next.fee_amount;
      return next;
    });
  };

  // Puts the draft into the list when it has no problem of its own.
  const applyDraft = () => {
    if (!draft) return;
    const at = draft.index < 0 ? form.returns.length : draft.index;
    const returns = [...form.returns];
    returns[at] = draft.policy;
    const next = { ...form, returns };
    const own = policyErrorsAt(policiesFormErrors(next), at);
    if (Object.keys(own).length) {
      setDraftErrors(own);
      return;
    }
    update(next);
    // Indexes may have new meaning: the list is checked again on save.
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([path]) => !path.startsWith('returns'))));
    setDraft(null);
  };

  const removePolicy = (index: number) => {
    update({ ...form, returns: form.returns.filter((_, i) => i !== index) });
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([path]) => !path.startsWith('returns'))));
  };

  // Shows the problems inline and opens the first return policy that has one.
  const showErrors = (found: PolicyErrors, current: MerchantPoliciesForm) => {
    setErrors(found);
    const first = firstInvalidPolicy(found);
    if (first !== null && current.returns[first]) {
      setDraft({ index: first, policy: { ...current.returns[first] } });
      setDraftErrors(policyErrorsAt(found, first));
    }
  };

  const save = async (next: MerchantPoliciesForm) => {
    if (!token) return;
    const found = policiesFormErrors(next);
    if (Object.keys(found).length) {
      showErrors(found, next);
      return;
    }
    setSaving(true);
    setBanner('');
    setErrors({});
    try {
      const res = await api<StoreResponse>('/stores/my/merchant-policies', {
        method: 'PUT',
        token,
        body: JSON.stringify(toPoliciesBody(next)),
      });
      const stored = toPoliciesForm(res?.merchant_policies);
      setSaved(stored);
      setForm(stored);
      setJustSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MERCHANT_POLICIES_INVALID') {
        const mapped = serverPolicyErrors(err.payload?.fields, next);
        showErrors(mapped, next);
      }
      // Always the translated message, never the server text.
      setBanner(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setConfirmClear(false);
    const empty: MerchantPoliciesForm = { ...EMPTY_POLICIES_FORM, returns: [] };
    setForm(empty);
    await save(empty);
  };

  const summary = (p: ReturnPolicyForm) => {
    const countries = p.countries.join(', ');
    if (p.category === 'finite') return t('summaryFinite', { days: p.days || '–', countries });
    return t(p.category === 'unlimited' ? 'summaryUnlimited' : 'summaryNone', { countries });
  };

  const draftTaken = draft ? takenCountries(form.returns, draft.index) : [];
  const policy = draft?.policy;
  const minId = `${ids}-min`;
  const maxId = `${ids}-max`;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
              {!loading && !loadFailed && !configured && (
                <Badge variant="outline" className="text-[10px]">
                  {t('notConfigured')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">{t('description')}</p>
          </div>
          {configured && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-xs text-muted-foreground"
              disabled={saving}
              onClick={() => setConfirmClear(true)}
            >
              <RotateCcw className="w-3 h-3 me-1.5" /> {t('removeAll')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{tc('loading')}</p>
        ) : loadFailed ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {loadFailed}
          </div>
        ) : (
          <>
            {/* Handling time */}
            <section className="space-y-2">
              <div>
                <p className="text-xs font-medium">{t('handlingTitle')}</p>
                <p className="text-[11px] text-muted-foreground max-w-2xl">{t('handlingHint')}</p>
              </div>
              <div className="flex flex-wrap items-start gap-3">
                <div className="space-y-1">
                  <Label htmlFor={minId} className="text-xs">
                    {t('handlingMin')}
                  </Label>
                  <Input
                    id={minId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={HANDLING_MAX_DAYS}
                    step={1}
                    className="h-8 w-28 text-sm"
                    value={form.handling_min}
                    aria-invalid={!!errors['handling.min_days']}
                    onChange={(e) => setHandling('handling_min', e.target.value)}
                  />
                  <FieldError message={errorText(errors['handling.min_days'])} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={maxId} className="text-xs">
                    {t('handlingMax')}
                  </Label>
                  <Input
                    id={maxId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={HANDLING_MAX_DAYS}
                    step={1}
                    className="h-8 w-28 text-sm"
                    value={form.handling_max}
                    aria-invalid={!!errors['handling.max_days']}
                    onChange={(e) => setHandling('handling_max', e.target.value)}
                  />
                  <FieldError message={errorText(errors['handling.max_days'])} />
                </div>
              </div>
            </section>

            {/* Return policies */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium">{t('returnsTitle')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={form.returns.length >= RETURN_POLICIES_MAX}
                  onClick={() => openPolicy(-1)}
                >
                  <Plus className="w-3 h-3 me-1.5" /> {t('addReturn')}
                </Button>
              </div>
              <FieldError message={errorText(errors.returns)} />
              {form.returns.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  {t('returnsEmpty')}
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {form.returns.map((p, i) => {
                    const rowInvalid = Object.keys(policyErrorsAt(errors, i)).length > 0;
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-medium">{t(CATEGORY_LABEL[p.category])}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{summary(p)}</p>
                          {rowInvalid && (
                            <p className="flex items-center gap-1 text-[11px] text-destructive">
                              <AlertCircle className="size-3 shrink-0" />
                              {errorText(Object.values(policyErrorsAt(errors, i))[0])}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            title={t('editReturn')}
                            aria-label={t('editReturn')}
                            onClick={() => openPolicy(i, policyErrorsAt(errors, i))}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title={t('removeReturn')}
                            aria-label={t('removeReturn')}
                            onClick={() => removePolicy(i)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {banner && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {banner}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {justSaved && !dirty && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="size-3.5" /> {t('saved')}
                </span>
              )}
              <Button size="sm" disabled={saving || !dirty} onClick={() => save(form)}>
                {saving ? tc('saving') : t('save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* Return policy editor */}
      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft && draft.index >= 0 ? t('editReturn') : t('addReturn')}</DialogTitle>
          </DialogHeader>
          {policy && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('countries')}</Label>
                <CountryMultiSelect
                  value={policy.countries}
                  onChange={(countries) => patchDraft({ countries })}
                  disabledCodes={draftTaken}
                  disabledHint={t('countriesTaken')}
                />
                {draftTaken.length > 0 && <p className="text-[10px] text-muted-foreground">{t('countriesTaken')}</p>}
                <FieldError message={errorText(draftErrors.countries)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${ids}-category`} className="text-xs">
                    {t('category')}
                  </Label>
                  <SearchableSelect
                    id={`${ids}-category`}
                    value={policy.category}
                    onChange={(value) => patchDraft({ category: value as ReturnCategory })}
                    options={RETURN_CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_LABEL[c]) }))}
                  />
                </div>
                {policy.category === 'finite' && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`${ids}-days`} className="text-xs">
                      {t('days')}
                    </Label>
                    <Input
                      id={`${ids}-days`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={RETURN_DAYS_MAX}
                      step={1}
                      className="h-9 text-sm"
                      value={policy.days}
                      aria-invalid={!!draftErrors.days}
                      onChange={(e) => patchDraft({ days: e.target.value })}
                    />
                    <FieldError message={errorText(draftErrors.days)} />
                  </div>
                )}
              </div>

              {policy.category !== 'none' && (
                <>
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-medium">{t('methods')}</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {RETURN_METHODS.map((m) => (
                        <label key={m} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="rounded accent-primary"
                            checked={policy.methods.includes(m)}
                            onChange={(e) =>
                              patchDraft({
                                methods: RETURN_METHODS.filter((x) =>
                                  x === m ? e.target.checked : policy.methods.includes(x),
                                ),
                              })
                            }
                          />
                          {t(METHOD_LABEL[m])}
                        </label>
                      ))}
                    </div>
                    <FieldError message={errorText(draftErrors.methods)} />
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${ids}-fees`} className="text-xs">
                        {t('fees')}
                      </Label>
                      <SearchableSelect
                        id={`${ids}-fees`}
                        value={policy.fees || FEES_UNSET}
                        onChange={(value) => patchDraft({ fees: value === FEES_UNSET ? '' : (value as ReturnFees) })}
                        options={[
                          { value: FEES_UNSET, label: t('feesUnset') },
                          ...RETURN_FEES.map((f) => ({ value: f, label: t(FEES_LABEL[f]) })),
                        ]}
                      />
                    </div>
                    {policy.fees === 'fixed' && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`${ids}-fee`} className="text-xs">
                          {t('feeAmount')}
                        </Label>
                        <div className="relative">
                          <Input
                            id={`${ids}-fee`}
                            inputMode="decimal"
                            className="h-9 pe-14 text-sm"
                            value={policy.fee_amount}
                            aria-invalid={!!draftErrors.fee_amount}
                            onChange={(e) => patchDraft({ fee_amount: e.target.value })}
                          />
                          <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-xs text-muted-foreground">
                            {currency}
                          </span>
                        </div>
                        <FieldError message={errorText(draftErrors.fee_amount)} />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              {tc('cancel')}
            </Button>
            <Button size="sm" onClick={applyDraft}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm "remove all" */}
      <Dialog open={confirmClear} onOpenChange={(open) => !open && setConfirmClear(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('removeAll')}</DialogTitle>
          </DialogHeader>
          <p className="py-1 text-sm text-muted-foreground">{t('removeAllConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={clearAll}>
              {t('removeAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
