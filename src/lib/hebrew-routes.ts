/**
 * הכתובות בעברית — היסטוריה בלבד.
 *
 * הן היו הכתובות הציבוריות, וזו הייתה טעות: הלוח הגיש `/vehicles`
 * ו-`/realestate` באנגלית לצד `/שווי` ו-`/מחירון` בעברית, כלומר שתי
 * מוסכמות באותו אתר. משתמש שמשתף קישור מקבל
 * `/%D7%A9%D7%95%D7%95%D7%99` בוואטסאפ, וגוגל רואה שני דפוסי כתובות
 * לאותו מוצר.
 *
 * מעכשיו הכתובת הקנונית לטינית, והכתובות בעברית מפנות אליה ב-301.
 * הפניה ולא rewrite: קישורים שכבר שותפו ימשיכו לעבוד, אבל הם יעבירו
 * את הדירוג לכתובת אחת במקום לפצל אותו.
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

/** הפניות 301 מהכתובות הישנות בעברית, ל-`next.config.ts`. */
export function hebrewRedirects() {
  return HEBREW_ROUTES.map((r) => ({
    source: encodeURI(r.hebrew),
    destination: r.app,
    permanent: true,
  }));
}

/**
 * בוני הנתיבים הקנוניים. מקבלים ערך שכבר עבר `slugify` — הקובץ הזה
 * חייב להישאר נטול ייבואים כדי שיהיה אפשר לטעון אותו מקובץ ההגדרות.
 */
export const pricePaths = {
  valuation: "/valuation",
  guideIndex: "/price-guide",
  guide: (makeSlug: string, modelSlug?: string) =>
    modelSlug ? `/price-guide/${makeSlug}/${modelSlug}` : `/price-guide/${makeSlug}`,
  cityIndex: "/city-prices",
  city: (citySlug: string) => `/city-prices/${citySlug}`,
} as const;
