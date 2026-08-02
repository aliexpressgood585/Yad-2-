/**
 * כתובת הבסיס של האתר.
 *
 * הסדר חשוב: משתנה מפורש גובר תמיד, אבל אם שכחו להגדיר אותו ב-Vercel
 * עדיין מקבלים כתובת נכונה במקום `localhost` — שהיה שולח `og:url`
 * ל-localhost בכל שיתוף בוואטסאפ ובפייסבוק.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` הוא הדומיין היציב של הפרויקט ולא של
 * הפריסה הבודדת, ולכן קישורים ששותפו לא נשברים בפריסה הבאה.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const SITE = {
  name: "לוח",
  tagline: "הלוח שמכבד את הזמן שלך",
  description:
    "לוח מודעות ישראלי נקי ומהיר — רכב, נדל\"ן, יד שנייה, דרושים ועוד. בלי עומס פרסומות, עם חיפוש חכם והתראות מיידיות.",
  url: resolveSiteUrl(),
  locale: "he_IL",
  themeColor: "#005F3C",
} as const;

/**
 * הופך נתיב יחסי לכתובת מוחלטת.
 * `next/og` מרנדר מחוץ להקשר של הדף, ולכן `<img src="/uploads/…">` שם
 * פשוט לא נטען — הוא חייב דומיין.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** מספר ימי תוקף למודעה לפני שהיא פגה. */
export const LISTING_TTL_DAYS = 45;

/** מספר תמונות מרבי למודעה. */
export const MAX_IMAGES = 12;

/** מספר מודעות להשוואה בו-זמנית. */
export const MAX_COMPARE = 4;

/** גודל עמוד ברירת מחדל בתוצאות חיפוש. */
export const PAGE_SIZE = 24;

/** חבילות קידום. */
export const BOOST_PACKAGES = [
  {
    kind: "BUMP" as const,
    name: "רענון מודעה",
    description: "המודעה קופצת לראש הרשימה בקטגוריה",
    days: 1,
    priceIls: 19,
  },
  {
    kind: "HIGHLIGHT" as const,
    name: "הדגשה",
    description: "מסגרת ותג בולטים ברשימת התוצאות",
    days: 7,
    priceIls: 39,
  },
  {
    kind: "TOP_CATEGORY" as const,
    name: "ראש הקטגוריה",
    description: "מיקום קבוע בראש הקטגוריה למשך שבוע",
    days: 7,
    priceIls: 89,
  },
  {
    kind: "HOMEPAGE" as const,
    name: "חשיפה בדף הבית",
    description: "הופעה ברצועת המודעות המקודמות בדף הבית",
    days: 7,
    priceIls: 149,
  },
];
