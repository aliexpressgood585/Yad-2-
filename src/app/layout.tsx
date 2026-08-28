import type { Metadata, Viewport } from "next";
import { Assistant, Heebo, IBM_Plex_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { CompareBar } from "@/components/compare/compare-bar";
import { PwaRegister } from "@/components/pwa-register";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { PALETTE } from "@/lib/palette";
import { SITE } from "@/lib/site";

import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

/*
 * שלושה גופנים, שלושה תפקידים — ראה DESIGN.md.
 *
 * Heebo הוא גרוטסק עברי עם משקלים אמיתיים עד 900, וזה הדבר הקרוב ביותר
 * ל"מעובה-צר" שקיים בעברית בגופן חופשי: אין גרוטסק עברי חופשי עם ציר
 * רוחב (`font-stretch`), ולכן ה"צר" מושג במשקל 900 יחד עם מרווח אותיות
 * שלילי ב-globals.css. שני משקלים נטענים בלבד.
 */
const display = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["700", "900"],
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

/*
 * ספרות במונו-רווח.
 *
 * במכשיר מדידה טור מספרים חייב להתיישר לאורך השורות — העין משווה מיקום
 * ספרה ולא ערך מספרי. Plex Mono הוא מונו אמיתי עם `tnum`, בשונה מגופן
 * פרופורציונלי עם ספרות טבלאיות שרק מיישר רוחב.
 *
 * לגופן אין עברית, וזו החלטה ולא פשרה: `.num` עוטף גם ערכים עבריים
 * ("יד שנייה"), והם נופלים אחורה ל-Assistant דרך שרשרת ה-fallback.
 */
const data = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-data",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
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
  /*
   * צבע אחד ולא שניים לפי `prefers-color-scheme`: פנים המכשיר היא
   * ברירת המחדל של האתר ואינה נגזרת מהעדפת מערכת ההפעלה (ראה
   * DECISIONS.md §37), ולכן שורת הכתובת בנייד תמיד גרפיטית.
   */
  themeColor: PALETTE.graphite,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`dark ${display.variable} ${assistant.variable} ${data.variable}`}
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
      </body>
    </html>
  );
}
