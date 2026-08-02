export const SITE = {
  name: "לוח",
  tagline: "הלוח שמכבד את הזמן שלך",
  description:
    "לוח מודעות ישראלי נקי ומהיר — רכב, נדל\"ן, יד שנייה, דרושים ועוד. בלי עומס פרסומות, עם חיפוש חכם והתראות מיידיות.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "he_IL",
  themeColor: "#0f6d55",
} as const;

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
