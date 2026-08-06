/**
 * ניטור צד לקוח.
 *
 * שגיאת hydration או כישלון fetch בדפדפן אינם מגיעים ללוג השרת
 * בכלל, ולכן בלי הקובץ הזה חצי מהשגיאות פשוט אינן קיימות מבחינתנו.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // הקלטת מושבים כבויה: היא מצלמת מסכים שיש בהם פרטי קשר.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
