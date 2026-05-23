import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, LOCALE_COOKIE } from './config';

// The dashboard has no locale URL segment; the active UI language is read from
// the `dashboard-locale` cookie (set by the language switcher), falling back to
// the default locale.
export default getRequestConfig(async () => {
  let locale: string = defaultLocale;
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    if (cookieLocale && locales.includes(cookieLocale as never)) {
      locale = cookieLocale;
    }
  } catch {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
