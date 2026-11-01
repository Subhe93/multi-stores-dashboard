'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CircleAlert, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApiError } from '@/lib/useApiError';
import { errorCode, lockedMinutes, sanitizeTotp } from '@/lib/twoFactor';
import { Input } from '@/components/ui/input';

const inputClass =
  'h-12 rounded-xl border-zinc-200 bg-white ps-10 text-[17px] tracking-[0.3em] shadow-xs transition-[border-color,box-shadow] placeholder:tracking-normal placeholder:text-zinc-400 hover:border-zinc-300 focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/10';

interface TwoFactorPromptProps {
  /** challenge_token from /auth/login or /auth/magic-login. */
  challenge: string;
  /** Leave the second step (back to the password form / login page). */
  onBack: () => void;
  /** The challenge expired: the caller restarts sign-in with a message. */
  onChallengeInvalid: () => void;
}

/**
 * Second sign-in step for accounts with two-factor authentication. On success
 * the auth context stores the tokens and redirects by role.
 */
export function TwoFactorPrompt({ challenge, onBack, onChallengeInvalid }: TwoFactorPromptProps) {
  const t = useTranslations('auth.twoFactor');
  const { verifyTwoFactorLogin } = useAuth();
  const apiError = useApiError();
  const [mode, setMode] = useState<'app' | 'recovery'>('app');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submittedRef = useRef('');

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const submit = async (value: string) => {
    if (loading || !value) return;
    submittedRef.current = value;
    setError('');
    setLoading(true);
    try {
      await verifyTwoFactorLogin(challenge, value);
    } catch (err) {
      if (errorCode(err) === 'TWO_FACTOR_CHALLENGE_INVALID') {
        onChallengeInvalid();
        return;
      }
      const minutes = lockedMinutes(err);
      if (minutes !== null) setError(t('locked', { minutes }));
      else if (err instanceof TypeError) setError(t('networkError'));
      else setError(apiError(err));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const onChange = (raw: string) => {
    if (mode === 'app') {
      const next = sanitizeTotp(raw);
      setCode(next);
      // Six digits is a complete code: submit without an extra click, once.
      if (next.length === 6 && submittedRef.current !== next) void submit(next);
    } else {
      setCode(raw.toUpperCase().slice(0, 20));
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'app' ? 'recovery' : 'app'));
    setCode('');
    setError('');
    submittedRef.current = '';
  };

  const ready = mode === 'app' ? code.length === 6 : code.replace(/[\s-]/g, '').length >= 8;

  return (
    <div>
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-700"
      >
        <ShieldCheck className="size-5" />
      </span>
      <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">
        {mode === 'app' ? t('subtitle') : t('recoverySubtitle')}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code.trim());
        }}
        className="mt-8 space-y-5"
      >
        {error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 outline-none focus-visible:ring-4 focus-visible:ring-red-500/15"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="two-factor-code" className="text-sm font-medium text-zinc-800">
            {mode === 'app' ? t('codeLabel') : t('recoveryLabel')}
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              id="two-factor-code"
              name={mode === 'app' ? 'otp' : 'recovery-code'}
              dir="ltr"
              value={code}
              onChange={(e) => onChange(e.target.value)}
              inputMode={mode === 'app' ? 'numeric' : 'text'}
              autoComplete={mode === 'app' ? 'one-time-code' : 'off'}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={mode === 'app' ? 6 : 20}
              placeholder={mode === 'app' ? '123456' : 'XXXXX-XXXXX'}
              aria-invalid={error ? true : undefined}
              required
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !ready}
          aria-busy={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-8px_rgba(9,9,11,0.6)] transition-[background-color,transform] outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-zinc-900/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t('verifying')}
            </>
          ) : (
            t('verify')
          )}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md text-zinc-500 outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            {t('back')}
          </button>
          <button
            type="button"
            onClick={switchMode}
            className="rounded-md font-medium text-zinc-700 underline-offset-4 outline-none hover:text-zinc-950 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900/20"
          >
            {mode === 'app' ? t('useRecovery') : t('useApp')}
          </button>
        </div>
      </form>
    </div>
  );
}
