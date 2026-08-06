/**
 * הסכמה לעוגיות — שמות ובדיקה, בלי תלויות.
 *
 * הקובץ נטול ייבואים בכוונה: `src/middleware.ts` רץ ב-Edge Runtime
 * וקורא ממנו, בדיוק כמו `session-cookie.ts`.
 */

/** ההחלטה של המשתמש. "all" = מסכים למדידה, "essential" = סירב. */
export const CONSENT_COOKIE = "kedai_consent";

/** העוגייה היחידה שדורשת הסכמה. */
export const MEASUREMENT_COOKIE = "kedai_sid";

/**
 * האם מותר למדוד.
 *
 * **ברירת המחדל היא לא.** משתמש שעוד לא החליט אינו משתמש שהסכים, וזה
 * ההבדל בין באנר אמיתי לבין באנר שמבקש רשות אחרי שכבר לקח אותה.
 */
export function measurementAllowed(consent: string | undefined): boolean {
  return consent === "all";
}
