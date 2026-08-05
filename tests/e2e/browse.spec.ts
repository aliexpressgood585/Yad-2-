import { expect, test } from "@playwright/test";

/**
 * מסלול העיון — מה שרוב המבקרים עושים ולא עוברים דרך API.
 *
 * הבדיקות כאן מכוונות למה ש-`npm run e2e` לא יכול לראות: פריסה
 * שנשברת, אלמנט שנחתך, וטקסט שלא מוצג בכיוון הנכון.
 */

test("דף הבית נטען עם קטגוריות ומודעות", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // עץ הקטגוריות מרונדר בשרת — אם הוא ריק, המטמון מצביע על מזהים ישנים
  await expect(page.getByRole("link", { name: "רכב", exact: true }).first()).toBeVisible();
});

test("חיפוש מוביל לתוצאות", async ({ page }) => {
  /*
   * מונח החיפוש נלקח ממודעה אמיתית ולא נכתב בקוד.
   *
   * הגרסה הראשונה חיפשה "קורולה" וקיבלה אפס תוצאות — לא בגלל באג
   * אלא מפני שבמסד המקומי המודעות היחידות עם המילה הזו היו שאריות
   * חסומות של בדיקת הקבלה. בדיקה שתלויה בתוכן מסוים נכשלת בכל סביבה
   * שנזרעה אחרת, וכישלון כזה נראה בדיוק כמו באג אמיתי.
   */
  await page.goto("/vehicles");
  const title = await page.locator("article h3, article h2").first().innerText();
  const term = title.trim().split(/\s+/)[0]!;

  await page.goto("/");

  /*
   * `searchbox` ולא `textbox`: השדה הוא `type="search"`, ולתפקיד הזה
   * יש שם משלו ב-ARIA. `getByRole("textbox")` מחזיר אפס תוצאות ונראה
   * כאילו השדה נעלם.
   */
  const box = page.getByRole("searchbox").first();
  await box.fill(term);
  await box.press("Enter");

  await page.waitForURL(/search|q=/);
  await expect(page.locator("article").first()).toBeVisible();
});

test("דף קטגוריה מציג מודעות וסקאלת מחיר", async ({ page }) => {
  await page.goto("/vehicles");

  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(3);

  /*
   * הסקאלה היא אלמנט החתימה של הלוח, ובדף רכב עם מאות מודעות היא
   * חייבת להופיע לפחות פעם אחת. אם היא נעלמה — או שהמדגם קטן מדי
   * בכל חתך, או שהרכיב נשבר. שתי האפשרויות שוות בדיקה.
   */
  await expect(page.locator(".price-scale").first()).toBeVisible();
});

test("קטגוריה לא קיימת מחזירה 404 אמיתי", async ({ page }) => {
  /*
   * זו הבדיקה שמגנה על ההחלטה למקם את Suspense בתוך הדף ולא
   * ב-`loading.tsx` (ראה DECISIONS.md). המימוש הנוח יותר מחזיר
   * soft-404 עם סטטוס 200, ומנועי חיפוש מוסיפים את הדף לאינדקס.
   */
  const res = await page.goto("/category-that-does-not-exist");
  expect(res?.status()).toBe(404);
});

test("דף מודעה נפתח מהרשימה", async ({ page }) => {
  await page.goto("/vehicles");

  await page.locator("article a[href^='/item/']").first().click();
  await page.waitForURL(/\/item\//);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // המחיר הוא הדבר שהמבקר בא בשבילו; אם הוא חסר, הדף לא שווה כלום
  await expect(page.locator(".num").first()).toBeVisible();
});

test("הפריסה אינה גולשת אופקית", async ({ page }, testInfo) => {
  /*
   * גלישה אופקית היא הבאג הקלאסי של RTL: אלמנט אחד עם `margin-left`
   * שלילי, וכל הדף זז. בנייד זה הופך את האתר לבלתי שמיש, ובדסקטופ
   * כמעט לא מבחינים בו — ולכן דווקא כאן צריך בדיקה אוטומטית.
   */
  for (const path of ["/", "/vehicles", "/search?q=דירה"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });

    expect(overflow, `${path} ב-${testInfo.project.name}`).toBeLessThanOrEqual(1);
  }
});
