import { expect, test } from "@playwright/test";

/**
 * מסלול החיפוש — הדרך שבה רוב המשתמשים מגיעים למודעה.
 *
 * הבדיקה עוברת את כל השלבים שהאתר נמדד עליהם ב-`/admin/analytics`:
 * חיפוש, תוצאה, וכניסה למודעה.
 */
test.describe("חיפוש", () => {
  test("מדף הבית לתוצאות ולמודעה", async ({ page }) => {
    await page.goto("/");

    // שדה החיפוש בהירו — ההדר מוותר על שלו כשיש אחד בעמוד (DECISIONS §27)
    const search = page.getByRole("searchbox").first();
    await expect(search).toBeVisible();
    await search.fill("דירה");
    await search.press("Enter");

    await page.waitForURL(/\/search\?/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // שורות תוצאה, לא כרטיסים בגריד (DECISIONS §38)
    const rows = page.locator("article.listing-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    /*
     * הסקאלה מוצגת רק כשיש קריאה. אין כאן טענה שהיא חייבת להופיע —
     * מדגם קטן הוא מצב תקין — אבל כשהיא מופיעה חייב להיות בה מחוג.
     */
    const gauges = page.locator(".gauge");
    if ((await gauges.count()) > 0) {
      await expect(gauges.first().locator(".gauge-needle")).toBeVisible();
    }

    const title = await rows.first().getByRole("heading").innerText();
    await rows.first().getByRole("link").first().click();

    await page.waitForURL(/\/item\//);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title.trim().slice(0, 12));
  });

  test("סינון לפי עיר מצמצם את התוצאות ומחזיר רק אותה", async ({ page }) => {
    await page.goto("/search?q=");
    await expect(page.locator("article.listing-row").first()).toBeVisible();
    const before = await page.locator("article.listing-row").count();
    expect(before).toBeGreaterThan(0);

    await page.goto(`/search?q=&city=${encodeURIComponent("חיפה")}`);
    await expect(page.locator("article.listing-row").first()).toBeVisible();

    /*
     * שורת המיקום היא ה-`<time>` והטקסט שלפניו. נבדק לפי המכל שמכיל
     * את `<time>` ולא לפי `p:last-of-type` — ל-CSS יש `:last-of-type`
     * לכל הורה בנפרד, ולכן הוא תפס גם פסקאות מטור הקריאה והבדיקה
     * נפלה על טקסט של מחיר.
     */
    const rows = page.locator("article.listing-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(before);

    for (let i = 0; i < count; i++) {
      const location = await rows.nth(i).locator("p", { has: page.locator("time") }).innerText();
      expect(location, `שורה ${i + 1}`).toContain("חיפה");
    }
  });

  test("חיפוש בלי תוצאות מציג מצב ריק ולא דף שבור", async ({ page }) => {
    await page.goto("/search?q=zzqqxxwwvv");
    await expect(page.getByText(/לא נמצאו תוצאות/)).toBeVisible();
    await expect(page.locator("article.listing-row")).toHaveCount(0);
  });

  test("האתר RTL בכל מסך", async ({ page }) => {
    for (const path of ["/", "/search?q=", "/publish"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("html")).toHaveAttribute("lang", "he");
    }
  });
});
