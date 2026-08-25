import type { Metadata, Viewport } from "next";
import { Assistant, Noto_Sans_Hebrew, Rubik } from "next/font/google";

import { CookieConsent } from "@/components/cookie-consent";
import { NeedleSettle } from "@/components/listing/needle-settle";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { CompareBar } from "@/components/compare/compare-bar";
import { PwaRegister } from "@/components/pwa-register";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { PALETTE, PALETTE_DARK } from "@/lib/palette";
import { SITE } from "@/lib/site";

import "./globals.css";

/*
 * גיליון הסגנון של MapLibre **אינו** מיובא כאן במכוון.
 *
 * הוא שוקל 64KB, והוא חוסם רינדור. בייבוא מהפריסה הראשית הוא נטען
 * בכל דף באתר — כולל דף הבית, שאין בו מפה — ודחה את הצביעה הראשונה
 * של כל דף כדי לעצב רכיב שלא קיים בו. הוא יובא עכשיו בתוך רכיבי
 * המפה עצמם, ולכן Next מצרף אותו רק למסלולים שבהם יש מפה.
 */

/*
 * שלושה גופנים, שלושה תפקידים — ראה DESIGN.md.
 *
 * הכותרות בגרוטסק עברי מעובה־צר, ולא בסריף.
 *
 * סריף נותן אופי, אבל האופי שהוא נותן הוא של עיתון או של ספר — לא של
 * מכשיר מדידה. הכיוון קורא לצורה שנקראת כמו הדפסה על לוחית: צרה,
 * כבדה, בלי תגים.
 *
 * `Noto Sans Hebrew` הוא הגופן העברי היחיד ב-Google Fonts עם ציר
 * רוחב (`wdth`) אמיתי. החלופות — הבבו, רוביק, אלף — נותנות משקל אבל
 * לא צרות, ו"צר" מזויף על ידי `transform: scaleX()` שובר את הצורה של
 * האות ונראה בדיוק כמו מה שהוא.
 *
 * `axes` נטען בלי `weight`, כלומר כל טווח המשקלים מגיע כגופן משתנה
 * אחד — זול יותר משלושה קבצים סטטיים.
 */
const display = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

/* ספרות ברוחב קבוע, כדי שעמודת מחירים בגריד תתיישר לאורך השורות. */
const data = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-data",
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PALETTE.bone },
    { media: "(prefers-color-scheme: dark)", color: PALETTE_DARK.bone },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${display.variable} ${assistant.variable} ${data.variable}`}
    >
      <body className="min-h-dvh font-sans">
        <SiteJsonLd />
        <Providers>
          <a href="#main" className="skip-link">
            דילוג לתוכן הראשי
          </a>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main id="main" className="flex-1 pb-16 md:pb-0">
              {children}
            </main>
            <SiteFooter />
          </div>
          <CompareBar />
          <MobileTabBar />
          <PwaRegister />
        </Providers>
        <NeedleSettle />
        <CookieConsent />
      </body>
    </html>
  );
}
