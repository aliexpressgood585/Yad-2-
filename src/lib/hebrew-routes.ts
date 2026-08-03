/**
 * נתיבים ציבוריים בעברית.
 *
 * למה זה קיים ולא תיקיות בעברית תחת `src/app`: Next מתאים את הנתיב
 * הנכנס בצורתו המקודדת (`/%D7%A9%D7%95%D7%95%D7%99`) מול שמות התיקיות
 * כפי שהם, ולכן תיקייה בשם `שווי` פשוט אינה נתפסת והבקשה נופלת
 * ל-`[category]` ומשם ל-404. אומת בפועל על 15.5.
 *
 * הפתרון: הדפים יושבים בנתיבים לטיניים, וכתיבה מחדש (rewrite) ממפה
 * אליהם את הכתובות בעברית. הכתובת בעברית היא הכתובת הציבורית — היא זו
 * שמופיעה בקישורים, ב-canonical ובמפת האתר.
 *
 * הקובץ נטען גם מ-`next.config.ts` ולכן אסור שיהיו בו ייבואים.
 */

export const HEBREW_ROUTES = [
  { hebrew: "/שווי", app: "/valuation" },
  { hebrew: "/מחירון", app: "/price-guide" },
  { hebrew: "/מחירון/:make", app: "/price-guide/:make" },
  { hebrew: "/מחירון/:make/:model", app: "/price-guide/:make/:model" },
  { hebrew: "/מחירים", app: "/city-prices" },
  { hebrew: "/מחירים/:city", app: "/city-prices/:city" },
] as const;

/** רשימת ה-rewrites ל-`next.config.ts`. */
export function hebrewRewrites() {
  return HEBREW_ROUTES.map((r) => ({
    source: encodeURI(r.hebrew),
    destination: r.app,
  }));
}

/**
 * בוני הנתיבים. מקבלים ערך שכבר עבר `slugify` — הקובץ הזה חייב להישאר
 * נטול ייבואים כדי שיהיה אפשר לטעון אותו מקובץ ההגדרות.
 */
export const pricePaths = {
  valuation: "/שווי",
  guideIndex: "/מחירון",
  guide: (makeSlug: string, modelSlug?: string) =>
    modelSlug ? `/מחירון/${makeSlug}/${modelSlug}` : `/מחירון/${makeSlug}`,
  cityIndex: "/מחירים",
  city: (citySlug: string) => `/מחירים/${citySlug}`,
} as const;
