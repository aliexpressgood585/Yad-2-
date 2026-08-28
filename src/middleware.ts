import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/** נתיבים שדורשים משתמש מחובר. */
const PROTECTED = [/^\/my(\/|$)/, /^\/publish(\/|$)/, /^\/compare\/save/];

/** נתיבים שמותרים למנהלים בלבד. */
const ADMIN_ONLY = [/^\/admin(\/|$)/];

/**
 * מזהה הסשן האנונימי למדידה.
 *
 * נכתב כאן ולא ברכיב שרת או ב-route handler, כי ה-middleware הוא המקום
 * היחיד בזרימה של Next שבו מותר לכתוב cookie על כל בקשה. רכיב שרת אינו
 * יכול לכתוב cookie בזמן רינדור, ו-route handler היה מייצר מזהה חדש לכל
 * קריאת API שמגיעה לפני שהדף עצמו נטען — כלומר סשן חדש לכל אירוע,
 * ומשפך שכל שלב בו הוא סשן נפרד.
 *
 * ה-cookie הוא first-party ו-httpOnly, מכיל מזהה אקראי בלבד, ואינו
 * מקושר לזהות ואינו נשלח לאף גורם חיצוני. ראה GROWTH.md.
 */
const SESSION_COOKIE = "luach_sid";
const SESSION_TTL_SECONDS = 30 * 60;

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (ADMIN_ONLY.some((r) => r.test(pathname))) {
    if (!user) return redirectToLogin(req.nextUrl.origin, pathname + search);
    if (user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return withSessionCookie(req);
  }

  if (PROTECTED.some((r) => r.test(pathname)) && !user) {
    return redirectToLogin(req.nextUrl.origin, pathname + search);
  }

  // משתמש מחובר לא צריך לראות מסכי התחברות
  if (/^\/auth\/(login|register)$/.test(pathname) && user) {
    return NextResponse.redirect(new URL("/my", req.nextUrl.origin));
  }

  return withSessionCookie(req);
});

/**
 * מייצר או מחדש את מזהה הסשן.
 *
 * שתי כתיבות ולא אחת, ושתיהן נחוצות:
 *
 *   **על הבקשה** — כדי שרכיב השרת שירונדר מיד אחרי ה-middleware יוכל
 *   לקרוא את המזהה. `cookies()` ברכיב שרת קורא את *כותרות הבקשה*, ולא
 *   את ה-cookie שנכתב על התשובה. בלי הכתיבה הזו הביקור הראשון של כל
 *   משתמש היה מאבד את אירוע החיפוש שלו — כלומר דווקא את השלב הראשון
 *   במשפך, אצל כל מי שנכנס ללוח בפעם הראשונה.
 *
 *   **על התשובה** — כדי שהדפדפן ישמור אותו לבקשה הבאה.
 *
 * התוקף מתחדש בכל בקשה, ולכן החלון הוא 30 דקות של **חוסר פעילות** ולא
 * 30 דקות מהביקור הראשון: בלי החידוש ביקור ארוך היה מתפצל לשני סשנים
 * באמצע, ושיעור ההמרה במשפך היה יורד מסיבה טכנית בלבד.
 */
function withSessionCookie(req: NextRequest): NextResponse {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existing || crypto.randomUUID();

  const headers = new Headers(req.headers);
  if (!existing) {
    const prior = headers.get("cookie");
    headers.set(
      "cookie",
      prior ? `${prior}; ${SESSION_COOKIE}=${sessionId}` : `${SESSION_COOKIE}=${sessionId}`,
    );
  }

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
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
