/**
 * הפלטה כערכים מוחלטים.
 *
 * בדרך כלל צבע מגיע מטוקן CSS (`hsl(var(--sign))`), וזה הכלל. הקובץ הזה
 * קיים בשביל ארבעה הקשרים שלא מריצים CSS ולכן לא יכולים לקרוא טוקן:
 *
 *   next/og      — Satori מרנדר ל-PNG ולא מכיר var()
 *   manifest.ts  — מניפסט PWA הוא JSON
 *   email.ts     — לקוחות דוא"ל לא תומכים במשתני CSS
 *   MapLibre     — מאפייני paint מקבלים מחרוזת צבע, לא CSS
 *
 * הערכים חייבים להישאר תואמים ל-globals.css. שינוי כאן בלי שינוי שם
 * (או להפך) הוא באג — ראה DESIGN.md.
 */

export const PALETTE = {
  ink: "#14171A",
  paper: "#F7F5F0",
  sign: "#005F3C",
  route: "#0B4A8F",
  stone: "#DDD8CE",
  signal: "#C2410C",
  white: "#FFFFFF",
  /** טקסט משני — --muted-foreground בבהיר */
  muted: "#5A5F66",
} as const;

export const PALETTE_DARK = {
  ink: "#EFECE5",
  paper: "#16181A",
  sign: "#2FA875",
  route: "#6BA6E8",
  stone: "#393D42",
  signal: "#E8733C",
} as const;
