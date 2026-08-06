/**
 * ניטור צד לקוח.
 *
 * שגיאת hydration או כישלון fetch בדפדפן אינם מגיעים ללוג השרת
 * בכלל, ולכן בלי הקובץ הזה חצי מהשגיאות פשוט אינן קיימות מבחינתנו.
 *
 * **הייבוא דינמי בכוונה.** ייבוא סטטי של Sentry מכניס את ה-SDK לחבילה
 * הראשית גם כשאין `NEXT_PUBLIC_SENTRY_DSN` — כלומר כל מבקר משלם על
 * ניטור שאינו פועל. במדידה זה עלה כשלוש נקודות ביצועים בכל דף.
 */
type SentryModule = typeof import("@sentry/nextjs");

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sentry: SentryModule | null = null;

const ready: Promise<void> = dsn
  ? import("@sentry/nextjs").then((mod) => {
      sentry = mod;
      mod.init({
        dsn,
        tracesSampleRate: 0.1,
        // הקלטת מושבים כבויה: היא מצלמת מסכים שיש בהם פרטי קשר.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        sendDefaultPii: false,
      });
    })
  : Promise.resolve();

/**
 * Next דורש את הייצוא הזה באופן סטטי. כשאין DSN הוא לא עושה כלום,
 * וכשיש — הוא ממתין לטעינת ה-SDK ואז מדווח.
 */
export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
) {
  if (!dsn) return;
  void ready.then(() => sentry?.captureRouterTransitionStart(...args));
}
