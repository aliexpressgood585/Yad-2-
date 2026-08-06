import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { CONSENT_COOKIE, measurementAllowed } from "@/lib/consent";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session-cookie";

const { auth } = NextAuth(authConfig);

/** נתיבים שדורשים משתמש מחובר. */
const PROTECTED = [/^\/my(\/|$)/, /^\/publish(\/|$)/, /^\/compare\/save/];

/** נתיבים שמותרים למנהלים בלבד. */
const ADMIN_ONLY = [/^\/admin(\/|$)/];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (ADMIN_ONLY.some((r) => r.test(pathname))) {
    if (!user) return redirectToLogin(req.nextUrl.origin, pathname + search);
    if (user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return withSession(req, NextResponse.next());
  }

  if (PROTECTED.some((r) => r.test(pathname)) && !user) {
    return redirectToLogin(req.nextUrl.origin, pathname + search);
  }

  // משתמש מחובר לא צריך לראות מסכי התחברות
  if (/^\/auth\/(login|register)$/.test(pathname) && user) {
    return NextResponse.redirect(new URL("/my", req.nextUrl.origin));
  }

  return withSession(req, NextResponse.next());
});

/**
 * מזהה סשן אנונימי למדידה.
 *
 * מזהה **אקראי**, ולא גיבוב של כתובת IP או של דפדפן. גיבוב IP נראה
 * פרטי אבל הוא מזהה יציב של אדם שאפשר להצליב מולו, ובבית עם כמה
 * דיירים הוא גם מאחד אותם לאדם אחד ומעוות את הספירה. מזהה אקראי
 * בעוגייה עונה על "אותו דפדפן" — וזו בדיוק השאלה שהמשפך שואל.
 *
 * `SameSite=Lax` ו-`httpOnly`: העוגייה נקראת רק בשרת ואין לה שימוש
 * בלקוח.
 */
function withSession(req: Parameters<Parameters<typeof auth>[0]>[0], res: NextResponse) {
  /*
   * בלי הסכמה אין מדידה, וזה נאכף כאן ולא בלקוח: העוגייה היא
   * `httpOnly`, כלומר `document.cookie` אינו יכול למחוק אותה. משתמש
   * שסירב וממשיך להיות נמדד הוא בדיוק מה שהבאנר אמור למנוע.
   *
   * גם היעדר החלטה הוא היעדר הסכמה. העוגייה נכתבת רק אחרי "מאשר/ת".
   */
  if (!measurementAllowed(req.cookies.get(CONSENT_COOKIE)?.value)) {
    if (req.cookies.get(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (req.cookies.get(SESSION_COOKIE)) return res;

  res.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

function redirectToLogin(origin: string, target: string) {
  const url = new URL("/auth/login", origin);
  url.searchParams.set("callbackUrl", target);
  return NextResponse.redirect(url);
}

export const config = {
  // כל הנתיבים פרט לקבצים סטטיים, תמונות ו-API של האימות עצמו
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|uploads|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
};
