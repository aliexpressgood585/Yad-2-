import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

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
    return NextResponse.next();
  }

  if (PROTECTED.some((r) => r.test(pathname)) && !user) {
    return redirectToLogin(req.nextUrl.origin, pathname + search);
  }

  // משתמש מחובר לא צריך לראות מסכי התחברות
  if (/^\/auth\/(login|register)$/.test(pathname) && user) {
    return NextResponse.redirect(new URL("/my", req.nextUrl.origin));
  }

  return NextResponse.next();
});

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
