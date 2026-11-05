'use client';

import { useCallback, useEffect, useId, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, CircleCheck, CornerDownRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import {
  createRedirect,
  getProductPathsBatch,
  getRedirectLocalePrefixes,
  testRedirect,
  type ProductPathKind,
} from '@/lib/redirects.api';
import { fetchMyStore } from '@/lib/useStorefrontUrl';

/*
 * "Redirect the old address?" prompt shown in delete dialogs of public store
 * items (pages, products, collections). The owner opts in, picks a target and,
 * after a successful delete, 301s are created for every public address of each
 * deleted item through `POST /redirects/my`. A failed redirect never undoes or
 * blocks the delete: the outcome is reported in a fixed notice with a link to
 * Online store -> Redirects.
 */

const PATH_MAX = 1024;
const PRODUCT_PATHS_CHUNK = 100;
const SUCCESS_NOTICE_MS = 8000;
export const REDIRECTS_HREF = '/creator/redirects';

/** One suggested target (a storefront path) offered as a radio option. */
export interface RedirectTargetSuggestion {
  path: string;
  label: string;
}

/** What the owner chose, frozen when the delete is confirmed. */
export interface DeleteRedirectPlan {
  enabled: boolean;
  /** Validated target path (null when disabled or invalid). */
  target: string | null;
}

interface ChoiceRef {
  plan: DeleteRedirectPlan;
  /** True when enabled with an invalid target (the delete must wait). */
  invalid: boolean;
  /** Makes the mounted field show its validation error. */
  reveal?: () => void;
}

/** One deleted item whose redirect(s) could not all be created. */
export interface DeleteRedirectFailure {
  from: string;
  message: string;
}

/**
 * Public addresses of one deleted item:
 * - a string is its unprefixed path, expanded with every `/<locale>` prefix
 *   the storefront serves;
 * - `{ paths }` is the complete list (from `redirects/my/product-paths`), used as is.
 */
export type DeleteRedirectSource = string | null | undefined | { paths: readonly string[] };

interface NoticeState {
  /** Shown address of each item that is fully redirected. */
  ok: string[];
  failures: DeleteRedirectFailure[];
  target: string;
}

// Success of a delete made on an editor page that navigates away right after:
// the next mounted hook (the list page) shows it.
let flashed: NoticeState | null = null;

type TargetProblem = 'required' | 'scheme' | 'slash' | 'tooLong' | 'same';

/** Matching key of a storefront path (no query, lower case, no trailing slash). */
export function redirectPathKey(path: string): string {
  let p = path.trim().split(/[?#]/)[0] ?? '';
  try {
    p = decodeURIComponent(p);
  } catch {
    // Keep the raw value; the API normalises it again.
  }
  p = p.normalize('NFC').toLowerCase().replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * A full http(s) link becomes its path and query (redirects match on the
 * store's own host, like "Test a URL"); anything else is returned trimmed.
 * `fromUrl` tells the caller the host was dropped.
 */
export function toStorePath(raw: string): { value: string; fromUrl: boolean; badUrl: boolean } {
  const v = raw.trim();
  if (!/^https?:\/\//i.test(v)) return { value: v, fromUrl: false, badUrl: false };
  try {
    const u = new URL(v);
    return { value: `${u.pathname || '/'}${u.search}`, fromUrl: true, badUrl: false };
  } catch {
    return { value: v, fromUrl: false, badUrl: true };
  }
}

const RESERVED_ROOTS = new Set(['products', 'collections', 'cart', 'checkout', 'account', 'auth', 'legal', 'search']);

/**
 * True when the path has the shape of a product, collection or root page
 * (mirrors the API's live-content shapes), so "nothing published there" is
 * worth a warning. Home, listings and app routes never warn.
 */
function hasContentShape(path: string): boolean {
  const key = redirectPathKey(path);
  if (key === '/' || !key.startsWith('/')) return false;
  let segs = key.slice(1).split('/');
  if (segs.some((s) => !s)) return false;
  if (segs.length > 1 && /^[a-z]{2}(-[a-z0-9]+)?$/.test(segs[0]!)) segs = segs.slice(1);
  if (segs[0] === 'products') return segs.length === 2;
  if (segs[0] === 'collections') return segs.length >= 2;
  return segs.length === 1 && !RESERVED_ROOTS.has(segs[0]!);
}

/**
 * Asks the API (debounced) whether anything answers at `path`: published
 * content or an active redirect. True only when the path looks like a content
 * address and nothing answers, so the owner can double-check the target.
 */
export function useUnknownTarget(path: string | null, skip = false): boolean {
  const { token } = useAuth();
  const [unknownFor, setUnknownFor] = useState<string | null>(null);
  const check = !!token && !!path && !skip && hasContentShape(path);
  useEffect(() => {
    if (!check || !token || !path) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      testRedirect(token, path)
        .then((r) => {
          if (!cancelled) setUnknownFor(!r.live && !r.match ? path : null);
        })
        .catch(() => {
          // No warning when the check itself fails.
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [check, token, path]);
  return check && unknownFor === path;
}

/**
 * Turns the typed target into a store path. A full http(s) URL keeps only its
 * path and query (redirects stay on the store's own host); anything else must
 * already be an absolute path.
 */
function parseTarget(raw: string, froms: readonly string[]): { path: string | null; problem: TargetProblem | null; fromUrl: boolean } {
  const v = raw.trim();
  if (!v) return { path: null, problem: 'required', fromUrl: false };
  const { value: path, fromUrl, badUrl } = toStorePath(v);
  if (badUrl || (!fromUrl && /^[a-z][a-z0-9+.-]*:/i.test(v))) return { path: null, problem: 'scheme', fromUrl: false };
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\s]/.test(path)) {
    return { path: null, problem: 'slash', fromUrl };
  }
  if (path.length > PATH_MAX) return { path: null, problem: 'tooLong', fromUrl };
  // A single-item delete may not point the old address at itself.
  if (froms.length === 1 && redirectPathKey(froms[0]!) === redirectPathKey(path)) {
    return { path: null, problem: 'same', fromUrl };
  }
  return { path, problem: null, fromUrl };
}

/** `/<prefix>` of `path` among the store's prefixes, or null. */
function prefixOf(path: string, prefixes: readonly string[]): string | null {
  const lower = path.toLowerCase();
  for (const l of prefixes) {
    if (lower === `/${l}` || lower.startsWith(`/${l}/`)) return l;
  }
  return null;
}

/**
 * State and actions of the prompt for one page. Render `DeleteRedirectField`
 * (with `choiceRef`) inside the delete dialog, call `prepare()` when the delete
 * is confirmed (null = stay in the dialog, the field shows why), resolve
 * product addresses with `productSources()` BEFORE deleting, then
 * `apply(plan, sources)` with the items that were actually deleted. `notice`
 * is a fixed toast with the outcome.
 */
export function useDeleteRedirect() {
  const { token } = useAuth();
  const describeError = useApiError();
  const t = useTranslations('creator.redirects.onDelete');
  const choiceRef = useRef<ChoiceRef>({ plan: { enabled: false, target: null }, invalid: false });
  const [state, setState] = useState<NoticeState | null>(null);
  // Every `/<locale>` prefix the storefront serves (content locales and
  // market locales): one redirect row covers one exact path.
  const localePrefixes = useRef<string[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const keep = (list: readonly (string | null | undefined)[], primary?: string | null) => {
      if (cancelled) return;
      const out = new Set<string>();
      for (const l of list) {
        const v = l?.trim().toLowerCase();
        if (v && v !== primary?.toLowerCase()) out.add(v);
      }
      localePrefixes.current = [...out];
    };
    getRedirectLocalePrefixes(token)
      .then((res) => keep(res.prefixes ?? []))
      .catch(() =>
        // Older API: fall back to the content locales of the store.
        fetchMyStore(token)
          .then((store) => keep(store.language_config?.secondary_locales ?? [], store.language_config?.primary_locale))
          .catch(() => {
            // Without any config only the unprefixed address is redirected.
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Pick up a success flashed by an editor page before it navigated here.
  useEffect(() => {
    if (!flashed) return;
    setState(flashed);
    flashed = null;
  }, []);

  // A notice with only successes goes away by itself.
  useEffect(() => {
    if (!state || state.failures.length) return;
    const timer = setTimeout(() => setState(null), SUCCESS_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  /** Snapshot of the current choice, or null when the target is still invalid. */
  const prepare = useCallback((): DeleteRedirectPlan | null => {
    const c = choiceRef.current;
    if (c.plan.enabled && c.invalid) {
      c.reveal?.();
      return null;
    }
    return { ...c.plan };
  }, []);

  /**
   * Every public address of the given products, read from the API before
   * they are deleted (per-locale slugs included). Items the API cannot
   * resolve fall back to their primary path. Same order as `items`.
   */
  const productSources = useCallback(
    async (
      plan: DeleteRedirectPlan | null,
      items: readonly { kind: ProductPathKind; id: string; fallback: string | null }[],
    ): Promise<DeleteRedirectSource[]> => {
      const fallback = items.map((i) => i.fallback);
      if (!plan?.enabled || !plan.target || !token || !items.length) return fallback;
      const found = new Map<string, string[]>();
      for (let i = 0; i < items.length; i += PRODUCT_PATHS_CHUNK) {
        const chunk = items.slice(i, i + PRODUCT_PATHS_CHUNK).map(({ kind, id }) => ({ kind, id }));
        try {
          for (const r of await getProductPathsBatch(token, chunk)) {
            if (Array.isArray(r.paths) && r.paths.length) found.set(`${r.kind}:${r.id}`, r.paths);
          }
        } catch {
          // This chunk keeps the primary-slug fallback.
        }
      }
      return items.map((i) => {
        const paths = found.get(`${i.kind}:${i.id}`);
        return paths ? { paths } : i.fallback;
      });
    },
    [token],
  );

  /**
   * Creates a 301 for every public address of each deleted item (prefixed
   * addresses go to the same target under that prefix); never throws.
   * Counts are per item. `flash` keeps a success for the next page (editors
   * that navigate away right after).
   */
  const apply = useCallback(
    async (
      plan: DeleteRedirectPlan | null,
      sources: readonly DeleteRedirectSource[],
      opts: { flash?: boolean } = {},
    ): Promise<DeleteRedirectFailure[]> => {
      setState(null);
      if (!plan?.enabled || !plan.target || !token) return [];
      const target = plan.target;
      const targetKey = redirectPathKey(target);
      const prefixes = localePrefixes.current;
      const targetPrefix = prefixOf(target, prefixes);
      const targetFor = (from: string): string => {
        const l = prefixOf(from, prefixes);
        // A target that already carries a prefix is used as typed.
        if (!l || targetPrefix) return target;
        return target === '/' ? `/${l}` : `/${l}${target}`;
      };
      const seen = new Set<string>();
      const items: { shown: string; froms: string[] }[] = [];
      for (const src of sources) {
        if (!src) continue;
        const all = typeof src === 'string' ? [src, ...prefixes.map((l) => `/${l}${src}`)] : [...src.paths];
        const froms: string[] = [];
        for (const p of all) {
          const key = redirectPathKey(p);
          // Skip duplicates and an address that is the target itself.
          if (!p || seen.has(key) || key === targetKey) continue;
          seen.add(key);
          froms.push(p);
        }
        if (!froms.length) continue;
        const shown = typeof src === 'string' ? src : (froms.find((p) => !prefixOf(p, prefixes)) ?? froms[0]!);
        items.push({ shown, froms });
      }

      const ok: string[] = [];
      const failures: DeleteRedirectFailure[] = [];
      // Sequential: the API flattens chains per write, so parallel writes
      // to the same store would only contend.
      for (const item of items) {
        let failure: DeleteRedirectFailure | null = null;
        for (const from of item.froms) {
          try {
            await createRedirect(token, { from_path: from, to_path: targetFor(from), status_code: 301 });
          } catch (err) {
            if (failure) continue;
            const e = err as { code?: string; payload?: { kind?: string } } | null;
            const message =
              e?.code === 'REDIRECT_SHADOWS_LIVE' ? t('shadowsLive', { kind: e.payload?.kind ?? 'other' }) : describeError(err);
            failure = { from, message };
          }
        }
        if (failure) failures.push(failure);
        else ok.push(item.shown);
      }
      const next: NoticeState | null = ok.length || failures.length ? { ok, failures, target } : null;
      if (opts.flash && next && !failures.length) flashed = next;
      setState(next);
      return failures;
    },
    // describeError and t only read stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  const clear = useCallback(() => setState(null), []);

  const notice = state ? <DeleteRedirectNotice state={state} onDismiss={clear} /> : null;

  return { choiceRef, prepare, productSources, apply, failures: state?.failures ?? [], clear, notice };
}

// ─── Field ───────────────────────────────────────────────────────────────────

interface DeleteRedirectFieldProps {
  /** `useDeleteRedirect().choiceRef`. */
  choiceRef: MutableRefObject<ChoiceRef>;
  /** Public storefront paths of the items about to be deleted (no-URL items left out). */
  paths: readonly string[];
  /** Checked by default (published items); drafts start unchecked. */
  defaultEnabled: boolean;
  /** Suggested targets; the first one is preselected. */
  suggestions: readonly RedirectTargetSuggestion[];
  /** Published items the page already knows (offered in a searchable list). */
  knownTargets?: readonly RedirectTargetSuggestion[];
  /** Number of selected items without a public address (bulk only). */
  skipped?: number;
  disabled?: boolean;
}

/**
 * The opt-in section of a delete dialog. Mount it with a `key` per opened
 * dialog so it starts from the item's defaults. Renders nothing when no item
 * has a public address.
 */
export function DeleteRedirectField(props: DeleteRedirectFieldProps) {
  if (!props.paths.length) return null;
  return <DeleteRedirectFieldInner {...props} />;
}

const CUSTOM = '__custom__';

function DeleteRedirectFieldInner({
  choiceRef,
  paths,
  defaultEnabled,
  suggestions,
  knownTargets = [],
  skipped = 0,
  disabled,
}: DeleteRedirectFieldProps) {
  const t = useTranslations('creator.redirects.onDelete');
  const tr = useTranslations('creator.redirects');
  const id = useId();
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [selected, setSelected] = useState<string>(suggestions[0]?.path ?? CUSTOM);
  const [custom, setCustom] = useState('');
  const [showError, setShowError] = useState(false);

  const isCustom = selected === CUSTOM;
  const parsed = isCustom ? parseTarget(custom, paths) : { path: selected, problem: null, fromUrl: false };
  const deletedKeys = new Set(paths.map(redirectPathKey));
  const known = knownTargets.filter((k) => !deletedKeys.has(redirectPathKey(k.path)));
  const knownKeys = new Set([...known, ...suggestions].map((k) => redirectPathKey(k.path)));
  const unknown = useUnknownTarget(isCustom && enabled ? parsed.path : null, !!parsed.path && knownKeys.has(redirectPathKey(parsed.path)));

  // Keep the page's ref in step with the field; reset it when the dialog closes.
  useEffect(() => {
    choiceRef.current = {
      plan: { enabled, target: enabled ? parsed.path : null },
      invalid: enabled && !parsed.path,
      reveal: () => setShowError(true),
    };
  }, [choiceRef, enabled, parsed.path]);
  useEffect(
    () => () => {
      choiceRef.current = { plan: { enabled: false, target: null }, invalid: false };
    },
    [choiceRef],
  );

  const visible = paths.slice(0, 3);
  const errorText = parsed.problem && (showError || (isCustom && custom.trim() !== '')) ? t(`errors.${parsed.problem}`) : null;
  const pickedKnown = parsed.path ? known.find((k) => redirectPathKey(k.path) === redirectPathKey(parsed.path!)) : undefined;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="min-w-0 space-y-0.5">
          <span className="block font-medium">{t('label', { count: paths.length })}</span>
          <span className="block text-xs text-muted-foreground">{t('hint')}</span>
        </span>
      </label>
      {defaultEnabled && (
        <p className="ms-6.5 rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-800">{t('defaultOnNote')}</p>
      )}

      <div className={`min-w-0 space-y-3 ps-6.5 ${enabled ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!enabled}>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t('oldAddress', { count: paths.length })}</p>
          <ul className="space-y-0.5 font-mono text-xs">
            {visible.map((p) => (
              <li key={p} className="min-w-0 text-start">
                <span className="break-all" dir="ltr">
                  {p}
                </span>
              </li>
            ))}
          </ul>
          {paths.length > visible.length && (
            <p className="text-xs text-muted-foreground">{t('more', { count: paths.length - visible.length })}</p>
          )}
          {skipped > 0 && <p className="text-xs text-muted-foreground">{t('skipped', { count: skipped })}</p>}
        </div>

        <fieldset className="min-w-0 space-y-1.5" disabled={!enabled || disabled}>
          <legend className="mb-1 text-xs text-muted-foreground">{t('target')}</legend>
          {suggestions.map((s) => (
            <label key={s.path} className="flex min-w-0 cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5">
              <input
                type="radio"
                name={`${id}-target`}
                className="size-3.5 shrink-0 accent-zinc-900"
                checked={selected === s.path}
                onChange={() => setSelected(s.path)}
              />
              <span className="min-w-0">{s.label}</span>
              <span className="min-w-0 break-all font-mono text-xs text-muted-foreground" dir="ltr">
                {s.path}
              </span>
            </label>
          ))}
          <label className="flex min-w-0 cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5">
            <input
              type="radio"
              name={`${id}-target`}
              className="size-3.5 shrink-0 accent-zinc-900"
              checked={isCustom}
              onChange={() => setSelected(CUSTOM)}
            />
            <span className="min-w-0">{t('customOption')}</span>
          </label>
          {isCustom && (
            <div className="min-w-0 space-y-1.5 ps-5.5">
              {known.length > 0 && (
                <SearchableSelect
                  options={known.map((k) => ({ value: k.path, label: k.label, description: k.path }))}
                  value={pickedKnown?.path ?? ''}
                  onChange={(v) => {
                    setCustom(v);
                    setShowError(false);
                  }}
                  placeholder={t('pickPlaceholder')}
                  searchPlaceholder={t('pickSearch')}
                />
              )}
              <Input
                id={`${id}-custom`}
                dir="ltr"
                autoFocus={known.length === 0}
                className={`h-8 font-mono text-sm ${errorText ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onBlur={() => setShowError(true)}
                placeholder="/products/new-name"
                aria-label={t('customOption')}
                aria-invalid={!!errorText}
              />
              {errorText ? (
                <p className="text-[11px] text-red-600">{errorText}</p>
              ) : (
                <>
                  {parsed.fromUrl && parsed.path ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t('urlKeepsPath')}{' '}
                      <span className="break-all font-mono" dir="ltr">
                        {parsed.path}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">{known.length ? t('customHintPick') : t('customHint')}</p>
                  )}
                  {unknown && (
                    <p className="flex items-start gap-1 text-[11px] text-amber-700">
                      <AlertTriangle className="mt-px size-3 shrink-0" />
                      {tr('unknownTarget')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}

// ─── Notes and outcome ───────────────────────────────────────────────────────

/** Legal-kind pages of independent stores live under /legal/...: nothing to redirect. */
export function DeleteRedirectLegalNote() {
  const t = useTranslations('creator.redirects.onDelete');
  return (
    <p className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
      <CornerDownRight className="mt-0.5 size-3.5 shrink-0" />
      {t('legalNote')}
    </p>
  );
}

const pathTag = (chunks: ReactNode) => (
  <span className="break-all font-mono" dir="ltr">
    {chunks}
  </span>
);

/** Fixed notice (toast) with the outcome of the redirects of a delete. */
function DeleteRedirectNotice({ state, onDismiss }: { state: NoticeState; onDismiss: () => void }) {
  const t = useTranslations('creator.redirects.onDelete');
  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] space-y-2 sm:inset-x-auto sm:end-4 sm:w-[28rem]">
      {state.ok.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 shadow-lg"
        >
          <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
          <p className="min-w-0 flex-1">
            {t.rich('success', { count: state.ok.length, from: state.ok[0]!, to: state.target, path: pathTag })}
          </p>
          {!state.failures.length && (
            <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
      {state.failures.length > 0 && (
        <div className="shadow-lg">
          <DeleteRedirectFailures failures={state.failures} onDismiss={onDismiss} />
        </div>
      )}
    </div>
  );
}

/** Error after the delete went through but a redirect could not be created. */
export function DeleteRedirectFailures({
  failures,
  onDismiss,
}: {
  failures: readonly DeleteRedirectFailure[];
  onDismiss?: () => void;
}) {
  const t = useTranslations('creator.redirects.onDelete');
  if (!failures.length) return null;
  const first = failures[0]!;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          {failures.length === 1 ? (
            <>
              {t('failedOne')}{' '}
              <span className="break-all font-mono" dir="ltr">
                {first.from}
              </span>
            </>
          ) : (
            t('failedMany', { count: failures.length })
          )}
          {' — '}
          {first.message}
        </p>
        <Link href={REDIRECTS_HREF} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
          {t('openRedirects')}
          <ArrowRight className="size-3 rtl:rotate-180" />
        </Link>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
