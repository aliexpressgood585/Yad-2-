/**
 * שפות הממשק.
 *
 * ## למה עוגייה ולא קידומת בכתובת
 *
 * `/en/...` היה מפצל כל נתיב באתר לשלוש גרסאות, שובר את מפתחות ה-ISR
 * הקיימים, ומתנגש עם הנתיבים העבריים (`/שווי`, `/מחירון/[יצרן]/[דגם]`)
 * שהם חלק מהמוצר. עוגייה עם נפילה אחורה ל-`Accept-Language` נותנת את
 * אותה חוויה בלי הפיצול.
 *
 * **המחיר, במפורש:** אין כתובת ייחודית לכל שפה, ולכן מנועי חיפוש
 * מאנדקסים את הגרסה העברית בלבד. זו החלטה מודעת ולא פספוס — ראה
 * `GROWTH.md` סעיף H. אם אי פעם יידרש אינדוקס רב-לשוני, המעבר לקידומת
 * הוא שינוי ב-`middleware.ts` וב-`resolveLocale`, ולא שינוי בכל קריאה
 * ל-`t()` באתר.
 *
 * ## שפה נכנסת לרשימה רק כשהיא שלמה
 *
 * `Messages` נגזר מהקטלוג העברי, וקטלוג של שפה אחרת מוקלד מולו. מפתח
 * חסר בערבית או באנגלית אינו נראה בזמן ריצה — הוא **אינו מתקמפל**.
 * זו הסיבה שאין כאן דגל "שלם/חלקי": אי אפשר לרשום שפה חלקית.
 */

export const LOCALES = ["he", "en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "he";

/**
 * השפות שמוצעות למשתמש בפועל.
 *
 * נפרד מ-`LOCALES` בכוונה. הקטלוגים של אנגלית וערבית שלמים ומאומתים על
 * ידי המהדר, אבל חלק מהממשק עדיין אינו עובר דרך `t()`, ובחירת אנגלית
 * הייתה נותנת מסך שחציו אנגלית וחציו עברית — בדיוק מה שהכלל השלישי
 * אוסר.
 *
 * `npm run check:i18n` סופר את המחרוזות שנותרו והוא זה שמחזיק את השער:
 * הוא נכשל אם נפתחו כאן שפות בזמן שנשארו מחרוזות, ונכשל גם בכיוון
 * ההפוך — אם החילוץ הושלם והשער נשאר סגור. השער אינו הבטחה, הוא נבדק.
 */
export const AVAILABLE_LOCALES: readonly Locale[] = ["he"];

/** כיוון הכתיבה. עברית וערבית מימין לשמאל, אנגלית משמאל לימין. */
export const LOCALE_DIR: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
  ar: "rtl",
};

/** שם השפה בשפה עצמה — כך בורר שפה נקרא למי שאינו קורא את השפה הנוכחית. */
export const LOCALE_LABEL: Record<Locale, string> = {
  he: "עברית",
  en: "English",
  ar: "العربية",
};

/** תג ה-BCP 47 המלא, לשימוש ב-`Intl` וב-`lang`. */
export const LOCALE_TAG: Record<Locale, string> = {
  he: "he-IL",
  en: "en-IL",
  ar: "ar-IL",
};

export const LOCALE_COOKIE = "luach_locale";

/** שנה. השפה היא העדפה קבועה ולא נתון סשן. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * בחירת שפה מתוך עוגייה, ואם אין — מתוך `Accept-Language`.
 *
 * הכותרת מגיעה בצורה `he-IL,he;q=0.9,en;q=0.8`. נלקח החלק הראשי של כל
 * תג (`he-IL` → `he`) לפי סדר העדפה, והראשון שאנחנו תומכים בו מנצח.
 * דפדפן שמבקש שפה שאיננו תומכים בה מקבל עברית ולא שגיאה.
 */
export function resolveLocale(cookieValue?: string, acceptLanguage?: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;

  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    const base = tag?.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
