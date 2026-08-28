/**
 * הפלטה כערכים מוחלטים.
 *
 * בדרך כלל צבע מגיע מטוקן CSS (`hsl(var(--amber))`), וזה הכלל. הקובץ הזה
 * קיים בשביל ארבעה הקשרים שלא מריצים CSS ולכן לא יכולים לקרוא טוקן:
 *
 *   next/og      — Satori מרנדר ל-PNG ולא מכיר var()
 *   manifest.ts  — מניפסט PWA הוא JSON
 *   email.ts     — לקוחות דוא"ל לא תומכים במשתני CSS
 *   MapLibre     — מאפייני paint מקבלים מחרוזת צבע, לא CSS
 *
 * הערכים חייבים להישאר תואמים ל-globals.css. שינוי כאן בלי שינוי שם
 * (או להפך) הוא באג — ראה DESIGN.md, ובדיקת `npm run check:design`.
 *
 * `PALETTE` היא פנים המכשיר — הקרקע הגרפיטית, ברירת המחדל של האתר.
 * `PALETTE_DAY` היא פנים היום, שנבנתה מחדש ואינה היפוך שלה.
 */

export const PALETTE = {
  /** קרקע — גרפיט */
  graphite: "#16181B",
  /** משטח — שלדה */
  chassis: "#1E2126",
  /** טקסט — עצם */
  bone: "#E6E2D6",
  /** צבע הקריאה היחיד — ענבר זרחני */
  amber: "#FFB000",
  /** פסק דין בלבד — ציאן */
  cyan: "#58C6D8",
  /** קווי מסגרת ומפרידים */
  rule: "#2C3037",
  /** טקסט משני */
  muted: "#9A9689",
} as const;

export const PALETTE_DAY = {
  graphite: "#E6E2D6",
  chassis: "#F0EDE3",
  bone: "#16181B",
  amber: "#7A4A00",
  cyan: "#0E5F6E",
  rule: "#C9C3B2",
  muted: "#54514A",
} as const;
