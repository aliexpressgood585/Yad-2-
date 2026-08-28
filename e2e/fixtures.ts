import { expect, type Page } from "@playwright/test";

/**
 * עזרים משותפים למסלולי הבדיקה.
 *
 * הבדיקות רצות מול שרת אמיתי עם בסיס נתונים אמיתי, ולכן כל בדיקה
 * מייצרת את המשתמש שלה עם חותמת זמן. בדיקה שנשענת על משתמש קבוע
 * נשברת בהרצה השנייה, וזה הכשל שגורם לאנשים להפסיק להריץ בדיקות.
 */

export function stamp(): string {
  return `${Date.now()}`.slice(-9);
}

export type TestUser = { name: string; email: string; password: string; phone: string };

export function newUser(prefix: string): TestUser {
  const s = stamp();
  return {
    name: `${prefix} ${s}`,
    email: `pw-${prefix}-${s}@example.com`,
    password: "Password123!",
    phone: `05${s}`,
  };
}

/**
 * הרשמה, התחברות ואימות טלפון — דרך ה-API ולא דרך הטפסים.
 *
 * כוונה: המסלול שנבדק בכל קובץ הוא המסלול שהקובץ עוסק בו. מילוי טופס
 * הרשמה בכל בדיקה מוסיף חמש דקות לריצה ובודק את אותו דבר שוב ושוב,
 * ומייצר כשל בטופס ההרשמה שנראה ככשל בפרסום מודעה.
 *
 * קוד ה-OTP מוחזר מה-API בסביבת פיתוח בלבד, וזו הסיבה שהבדיקות
 * דורשות שרת פיתוח.
 */
export async function signUp(page: Page, user: TestUser): Promise<void> {
  const register = await page.request.post("/api/auth/register", { data: user });
  expect(register.ok(), await register.text()).toBeTruthy();

  await signIn(page, user);

  const otp = await page.request.post("/api/auth/otp", {
    data: { phone: user.phone, purpose: "verify" },
  });
  const { devCode } = (await otp.json()) as { devCode?: string };
  expect(devCode, "קוד האימות מוחזר רק בסביבת פיתוח — ודאו שהשרת רץ ב-next dev").toBeTruthy();

  const verify = await page.request.put("/api/auth/otp", {
    data: { phone: user.phone, code: devCode },
  });
  expect(verify.ok(), await verify.text()).toBeTruthy();

  // הסשן חייב להתרענן כדי ש-phoneVerified ייכנס לטוקן
  await signIn(page, user);
}

export async function signIn(page: Page, user: Pick<TestUser, "email" | "password">) {
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };

  const res = await page.request.post("/api/auth/callback/password", {
    form: { email: user.email, password: user.password, csrfToken, json: "true" },
  });
  expect([200, 302]).toContain(res.status());
}

/**
 * מעלה תמונה דרך הטופס.
 *
 * הקובץ נוצר בזיכרון ולא נקרא מהדיסק: קובץ בינארי בריפו הוא דבר
 * שמישהו יחליף בטעות, ותמונה של 1x1 פיקסל מספיקה לחלוטין — מה
 * שנבדק כאן הוא שההעלאה עוברת ושהמודעה מקבלת תמונה, לא איכות הדחיסה.
 */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * מוודא שהשרת הוא שרת פיתוח.
 *
 * נבדק דרך כותרת שקיימת רק ב-`next dev`, ולא בשליחת OTP: שליחת OTP
 * כאן הייתה שורפת מכסה מהמגביל (חמש בחמש-עשרה דקות לכל IP) עוד לפני
 * שהבדיקה התחילה, והבדיקה הייתה נופלת על המגביל במקום על הקוד.
 */
export async function assertDevServer(page: Page) {
  const res = await page.request.get("/");
  expect(res.ok(), "השרת אינו מגיב").toBeTruthy();
  const html = await res.text();
  expect(
    html.includes("__next_devtools") || html.includes("/_next/static/chunks/main-app.js"),
    "הבדיקות דורשות `next dev` — בפרודקשן קוד ה-OTP אינו מוחזר ואי אפשר להירשם",
  ).toBeTruthy();
}
