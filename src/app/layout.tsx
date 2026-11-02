import type { Metadata } from "next";
import { Inter, Geist, Cairo, Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { cn } from "@/lib/utils";
import { isRtl } from "@/i18n/config";
import { AuthProvider } from "@/lib/auth";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const inter = Inter({ subsets: ["latin"] });
// Arabic UI font — applied only when the dashboard language is Arabic.
const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-arabic' });
// ShopsDoor brand font — used only for the brand lockup and the login headline.
// Exposed as --font-manrope; globals.css maps it onto the `font-brand` token
// (a theme token cannot reference a variable with its own name).
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-manrope' });

// Browser-tab title inherits the admin-configured platform name.
export async function generateMetadata(): Promise<Metadata> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  let platformName = 'ShopsDoor';
  try {
    const res = await fetch(`${apiBase}/storefront/platform-meta`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { platform_name?: string }; platform_name?: string };
      platformName = json.data?.platform_name || json.platform_name || platformName;
    }
  } catch {
    // Offline API must never block the dashboard shell — keep the fallback.
  }
  return {
    title: `${platformName} Dashboard`,
    description: "Management dashboard for providers, creators, and admins",
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '32x32 48x48' },
        { url: '/brand/app-icon.svg', type: 'image/svg+xml' },
      ],
      apple: '/brand/app-icon.svg',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const rtl = isRtl(locale);
  const dir = rtl ? "rtl" : "ltr";
  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(
        "h-full",
        "antialiased",
        // In Arabic, use Cairo as the base font; otherwise Inter.
        rtl ? cairo.className : inter.className,
        "font-sans",
        geist.variable,
        cairo.variable,
        manrope.variable,
      )}
      // Point the Tailwind `font-sans` token at the Arabic font when Arabic, so
      // components using `font-sans` pick up Cairo too.
      style={rtl ? ({ "--font-sans": "var(--font-arabic)" } as React.CSSProperties) : undefined}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
