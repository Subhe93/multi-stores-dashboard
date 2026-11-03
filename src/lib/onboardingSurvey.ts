// First-run survey (step 1 of /creator/onboarding). Since wave 3 the
// answers are persisted server-side (`PUT /creators/me/onboarding-profile`,
// merged into `Creator.onboarding_profile` and exposed by `GET /auth/me`);
// localStorage is only the offline fallback. They personalise the
// store-type pre-selection and the checklist order.

import { api } from './api';
import { parseSurvey, type OnboardingSurvey } from './storeStatus';

const KEY = 'ms-onboarding-survey';

export function readOnboardingSurvey(): OnboardingSurvey {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseSurvey(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function writeOnboardingSurvey(survey: OnboardingSurvey): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(parseSurvey(survey)));
  } catch {
    // Storage unavailable: the answers only shape this session.
  }
}

/**
 * Persists the survey: the API first, the browser copy always (so the
 * answers survive a failed request and an offline session). Resolves to
 * false when the server did not take it.
 */
export async function saveOnboardingSurvey(token: string, survey: OnboardingSurvey): Promise<boolean> {
  const clean = parseSurvey(survey);
  writeOnboardingSurvey(clean);
  if (!token) return false;
  try {
    await api('/creators/me/onboarding-profile', {
      method: 'PUT',
      token,
      body: JSON.stringify(clean),
    });
    return true;
  } catch {
    return false;
  }
}

/** True when a server profile carries at least one survey answer. */
export function hasSurveyAnswers(profile: unknown): boolean {
  const s = parseSurvey(profile);
  return !!(s.stage || s.sells || s.country);
}

/**
 * The survey to use: the server profile when it holds any answer, else the
 * browser copy (offline fallback / older accounts).
 */
export function resolveOnboardingSurvey(profile: unknown): OnboardingSurvey {
  return hasSurveyAnswers(profile) ? parseSurvey(profile) : readOnboardingSurvey();
}

/** Key of the "setup guide dismissed" flag on the dashboard home. */
export const SETUP_DISMISS_KEY = 'ms-overview-setup-dismissed';
/** Key of the "opened the storefront preview" flag (checklist step). */
export const PREVIEWED_KEY = 'ms-store-previewed';
