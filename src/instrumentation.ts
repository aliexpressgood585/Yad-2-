/**
 * ניטור שגיאות — Sentry.
 *
 * בלי זה שגיאת שרת בפרודקשן נעלמת בלוגים של Vercel, ומגלים אותה
 * ממשתמש שמתלונן. `instrumentation.ts` הוא נקודת הכניסה ש-Next קורא
 * לפני כל דבר אחר, כלומר גם שגיאות בזמן העלייה נתפסות.
 *
 * בלי `NEXT_PUBLIC_SENTRY_DSN` שום דבר לא נטען — הפרויקט חייב לעבוד
 * בלי חשבון ניטור, וזה גם מה שמונע רעש מסביבת פיתוח.
 */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    /*
     * דגימה חלקית ולא מלאה. לוח מודעות מגיש הרבה בקשות זהות, ומעקב
     * על כל אחת מהן ממלא את המכסה ביום ומסתיר את מה שחשוב.
     */
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    /*
     * ברירת המחדל של Sentry שולחת כותרות ועוגיות. בלוח יש מספרי
     * טלפון וכתובות מייל, וניטור אינו סיבה להוציא אותם מהמערכת.
     */
    sendDefaultPii: false,
  });
}

export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
