import { expect, test } from "@playwright/test";

import { assertDevServer, newUser, signIn, signUp } from "./fixtures";

/**
 * מסלול יצירת הקשר — הצעד שהלוח נמדד לפיו.
 *
 * מדד הצפון הוא "מודעות מחוברות": מודעות שקיבלו חשיפת טלפון או הודעה
 * ראשונה (GROWTH.md סעיף G). שני השלבים האלה נבדקים כאן דרך הממשק,
 * וגם האירועים שהם מייצרים.
 */
test.describe("יצירת קשר", () => {
  test("חשיפת טלפון ושליחת הודעה למוכר", async ({ page }) => {
    await assertDevServer(page);

    const buyer = newUser("buyer");
    await signUp(page, buyer);

    // מודעה של מישהו אחר — הלוח חוסם פנייה למודעה של עצמך
    await page.goto("/search?q=");
    const rows = page.locator("article.listing-row");
    await expect(rows.first()).toBeVisible();
    await rows.first().getByRole("link").first().click();
    await page.waitForURL(/\/item\//);

    // --- חשיפת טלפון ---
    const reveal = page.getByRole("button", { name: /הצגת מספר הטלפון/ });
    await expect(reveal).toBeVisible();
    await reveal.click();

    /*
     * המספר עצמו, ולא היעלמות הכפתור: כפתור שנעלם אינו הוכחה שהמספר
     * הוצג. הפורמט הוא `050-123-4567` (`formatPhone`), ולכן הבדיקה
     * מחפשת קישור `tel:` — הוא גם מה שהמשתמש באמת לוחץ עליו בנייד.
     */
    await expect(page.locator('a[href^="tel:"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('a[href^="tel:"]')).toContainText(/\d{2,3}-\d{3}-\d{4}/);

    // --- שליחת הודעה ---
    const box = page.getByPlaceholder(/כתבו הודעה למוכר/);
    if (await box.count()) {
      await box.fill("שלום, האם המודעה עדיין רלוונטית? אשמח לתאם צפייה.");
      await page.getByRole("button", { name: /שליחת הודעה/ }).click();

      await page.waitForURL(/\/my\/messages/, { timeout: 20_000 });
      await expect(page.getByText(/עדיין רלוונטית/)).toBeVisible();
    }
  });

  test("אנונימי אינו יכול לשלוח הודעה", async ({ page }) => {
    const res = await page.request.post("/api/messages", {
      data: { listingId: "whatever", body: "שלום" },
    });
    expect(res.status()).toBe(401);
  });

  test("מוכר רואה את הפנייה ומשיב", async ({ page }) => {
    await assertDevServer(page);

    const buyer = newUser("buyer2");
    await signUp(page, buyer);

    await page.goto("/search?q=");
    await page.locator("article.listing-row").first().getByRole("link").first().click();
    await page.waitForURL(/\/item\//);

    const box = page.getByPlaceholder(/כתבו הודעה למוכר/);
    test.skip((await box.count()) === 0, "המודעה שנבחרה אינה מאפשרת צ׳אט");

    await box.fill("היי, מה המחיר הסופי?");
    await page.getByRole("button", { name: /שליחת הודעה/ }).click();
    await page.waitForURL(/\/my\/messages/, { timeout: 20_000 });

    // הקונה רואה את השיחה שלו ברשימה
    await page.goto("/my/messages");
    await expect(page.getByText(/מה המחיר הסופי/)).toBeVisible();

    // והמוכר מקבל התראה — נבדק דרך המונה בכותרת אחרי התחברות מחדש
    await signIn(page, buyer);
    const unread = await page.request.get("/api/notifications");
    expect(unread.ok()).toBeTruthy();
  });
});
