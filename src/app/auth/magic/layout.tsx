import type { Metadata } from 'next';

// The magic-link page carries a single-use login token in its URL: keep it out
// of search engines and never leak the URL to other origins via Referer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function MagicLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
