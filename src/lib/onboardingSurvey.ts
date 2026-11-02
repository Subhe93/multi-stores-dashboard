// Browser storage for the first-run survey (step 1 of /creator/onboarding).
// The API has no endpoint that accepts these answers from the dashboard
// (`onboarding_profile` is written at sign-up only), so they stay client-side
// and personalise the store-type pre-selection and the checklist order.

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

/** Key of the "setup guide dismissed" flag on the dashboard home. */
export const SETUP_DISMISS_KEY = 'ms-overview-setup-dismissed';
/** Key of the "opened the storefront preview" flag (checklist step). */
export const PREVIEWED_KEY = 'ms-store-previewed';
