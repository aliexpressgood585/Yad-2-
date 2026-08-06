import { BRAND } from "@/lib/brand";

/**
 * הגדרות האתר.
 *
 * שם המותג, הסלוגן והתיאור אינם יושבים כאן אלא ב-`@/lib/brand` —
 * מקור אמת אחד לכל מחרוזת מותג בקוד. `SITE` נשאר נקודת הכניסה
 * הקיימת ומחזיק את מה שאינו מותג: כתובת, שפה, צבע דפדפן וקבועי מוצר.
 */
export const SITE = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  description: BRAND.description,
  url: BRAND.domain,
  locale: "he_IL",
  themeColor: "#16181B",
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
