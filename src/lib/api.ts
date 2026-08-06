import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Session } from "next-auth";
import { ZodError, type ZodSchema, type z } from "zod";

import { auth } from "@/lib/auth";
import { rateLimit, type RateLimitKey } from "@/lib/rate-limit";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** תשובת JSON תקינה. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** תשובת שגיאה אחידה בעברית. */
export function fail(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** ממפה חריגות ידועות לתשובת HTTP. שאר החריגות נרשמות ומוחזרות כ-500. */
export function handleError(err: unknown) {
  if (err instanceof ApiError) return fail(err.status, err.message, err.code);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(422, first?.message ?? "הנתונים שנשלחו אינם תקינים", "VALIDATION");
  }
  console.error("[api] unhandled error", err);
  return fail(500, "אירעה שגיאה בשרת. נסו שוב בעוד רגע.");
}

/** כתובת ה-IP של הפונה, לפי כותרות ה-proxy. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

/** גיבוב IP — נשמר בלוגים במקום הכתובת עצמה (פרטיות). */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${process.env.AUTH_SECRET ?? "kedai"}`)
    .digest("hex")
    .slice(0, 32);
}

/** מחזיר את הסשן או זורק 401. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError(401, "יש להתחבר כדי לבצע פעולה זו", "UNAUTHENTICATED");
  }
  return session;
}

/** מחזיר סשן של מנהל או זורק 403. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") {
    throw new ApiError(403, "הפעולה מותרת למנהלי המערכת בלבד", "FORBIDDEN");
  }
  return session;
}

/**
 * אוכף מגבלת קצב. המזהה הוא מזהה המשתמש כשקיים, אחרת ה-IP —
 * כדי שמשתמש מחובר לא ייחסם בגלל שכן מאחורי אותו NAT.
 */
export async function enforceRateLimit(
  key: RateLimitKey,
  identifier?: string,
): Promise<void> {
  const id = identifier ?? (await getClientIp());
  const res = await rateLimit(key, id);
  if (!res.success) {
    throw new ApiError(
      429,
      `בוצעו יותר מדי בקשות. נסו שוב בעוד ${res.retryAfter} שניות.`,
      "RATE_LIMITED",
    );
  }
}

/** קורא ומאמת גוף בקשה מול סכמת Zod. */
export async function parseBody<S extends ZodSchema>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "גוף הבקשה אינו JSON תקין");
  }
  return schema.parse(raw);
}

/** קורא ומאמת פרמטרי query מול סכמת Zod. */
export function parseQuery<S extends ZodSchema>(url: string, schema: S): z.infer<S> {
  const params = new URL(url).searchParams;
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    obj[key] = all.length > 1 ? all : all[0]!;
  }
  return schema.parse(obj);
}
