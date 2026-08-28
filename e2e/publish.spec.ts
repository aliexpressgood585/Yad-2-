import { expect, test, type Page } from "@playwright/test";

import { TINY_PNG, assertDevServer, newUser, signUp } from "./fixtures";

/**
 * ממלא שדה ומוודא שהערך אכן נשמר.
 *
 * `fill` לבדו מצליח גם כשהוא כותב לתוך שדה שעוד לא עבר הידרציה,
 * ו-React מוחק את הערך מיד אחריו. האימות הופך את הכשל הזה לשגיאה
 * במקום שבו הוא קרה.
 */
async function fillAndVerify(locator: ReturnType<Page["locator"]>, value: string) {
  await locator.fill(value);
  await expect(locator).toHaveValue(value, { timeout: 5_000 });
}

/**
 * ממלא את כל שדות החובה הדינמיים של הקטגוריה.
 *
 * שלושה דברים כאן נדרשו כדי שהבדיקה תהיה נכונה, ושלושתם התגלו בהרצה
 * מלאה ולא בהרצה של קובץ בודד:
 *
 *   **המתנה לשדות עצמם ולא ל-`[data-required]` כלשהו.** גם שדה "עיר"
 *   הוא שדה חובה, ולכן הסלקטור הכללי היה מתקיים מיד — לפני שהשדות
 *   הדינמיים בכלל נטענו מהשרת. הלולאה הייתה מוצאת אפס, יוצאת, והכשל
 *   היה מופיע שני שלבים אחר כך כ"אין שדה קובץ".
 *
 *   **חזרה עד שאין שדה ריק.** יש שדות תלויים: "דגם" מופיע רק אחרי
 *   שנבחר יצרן, ומעבר יחיד מפספס אותו.
 *
 *   **מילוי לפי סוג ולא לפי רשימת שמות.** הוספת שדה חובה לקטגוריה
 *   היא שינוי נתונים, ואינה צריכה לשבור בדיקה.
 */
async function fillRequiredAttributes(page: Page) {
  const emptySelect = page.locator("[data-required] button[role=combobox][data-placeholder]");
  const emptyNumber = page.locator("[data-required] input[type=number]");

  // השדות הדינמיים מגיעים בבקשה נפרדת אחרי בחירת הקטגוריה
  await expect
    .poll(async () => emptySelect.count(), { timeout: 20_000 })
    .toBeGreaterThan(0);

  for (let pass = 0; pass < 6; pass++) {
    const selects = await emptySelect.count();
    if (selects > 0) {
      await chooseFromSelect(page, emptySelect.first());
      continue;
    }

    let filled = false;
    for (let i = 0; i < (await emptyNumber.count()); i++) {
      const input = emptyNumber.nth(i);
      if ((await input.inputValue()) !== "") continue;
      const id = (await input.getAttribute("id")) ?? "";
      await fillAndVerify(input, id.includes("year") ? "2019" : "80000");
      filled = true;
    }
    if (!filled) break;
  }

  // אחרי הכול לא נותר אף שדה חובה ריק
  await expect(emptySelect).toHaveCount(0);
}

/**
 * פותח Radix Select ובוחר בו פריט.
 *
 * שני דברים כאן נדרשו כדי שהבדיקה תהיה יציבה בנייד, ושניהם התגלו
 * בהרצה מלאה ולא בהרצה של קובץ בודד:
 *
 *   **פתיחה עם ניסיון חוזר.** לחיצה על המפעיל לפני שהוא סיים להירשם
 *   ל-`pointerdown` פשוט לא פותחת דבר, והבדיקה נתקעת בהמתנה לרשימה
 *   שלא תיפתח. הלולאה עולה בעלות של מילישניות ומסירה מחלקה שלמה של
 *   כשלים מקריים.
 *
 *   **`force` ו-`scrollIntoViewIfNeeded` על הפריט.** רשימת Radix
 *   גוללת את עצמה כשהסמן קרוב לקצה, ובחלון של טלפון הפריט לעולם אינו
 *   "יציב" לפי ההגדרה של Playwright.
 */
async function chooseFromSelect(
  page: Page,
  trigger: ReturnType<Page["locator"]>,
) {
  const listbox = page.getByRole("listbox");

  await trigger.scrollIntoViewIfNeeded();

  for (let attempt = 0; attempt < 3; attempt++) {
    await trigger.click();
    try {
      await expect(listbox).toBeVisible({ timeout: 3_000 });
      break;
    } catch {
      if (attempt === 2) throw new Error("רשימת הבחירה לא נפתחה אחרי שלושה ניסיונות");
    }
  }

  /*
   * הבחירה נעשית במקלדת ולא בלחיצה, וזה ההבדל בין בדיקה שעוברת
   * לבדיקה שנופלת בנייד.
   *
   * Radix מסמן את הפריט הראשון כפעיל ברגע שהרשימה נפתחת, ו-Enter
   * בוחר אותו. לחיצה, לעומת זאת, דורשת שהפריט יהיה בתוך אזור הנראה —
   * ובחלון של טלפון, כשהמפעיל יושב נמוך, הפאנל נפתח כלפי מעלה ופריט
   * שנמצא בקצה שלו נשאר מחוץ למסך. זה גם המסלול שמשתמש מקלדת עובר
   * בפועל, ולכן הבדיקה בודקת אותו ולא מעקפת אותו.
   *
   * (מגבלת הגובה של הפאנל תוקנה בנפרד ב-`select.tsx`; זו הייתה תקלה
   * אמיתית בממשק שהבדיקה מצאה.)
   */
  await page.keyboard.press("Enter");
  await expect(listbox).toBeHidden();
}

test.describe("פרסום מודעה", () => {
  test("אשף מלא עד למודעה חיה", async ({ page }) => {
    await assertDevServer(page);
    const user = newUser("seller");
    await signUp(page, user);

    await page.goto("/publish");
    await expect(page.getByRole("heading", { name: "פרסום מודעה חדשה" })).toBeVisible();

    // --- 1. קטגוריה ---
    await page.getByRole("tab", { name: "רכב" }).click();
    await page.getByRole("button", { name: /רכב פרטי/ }).first().click();

    // --- 2. פרטי המודעה ---
    const title = `בדיקת פרסום ${Date.now().toString().slice(-6)} טויוטה קורולה`;

    /*
     * ההמתנה ל-`toBeEditable` לפני המילוי הראשון היא מה שמפריד בין
     * בדיקה יציבה לבדיקה שעוברת פעם מתוך שתיים. השדות מרונדרים בשרת
     * ונעשים מבוקרים רק אחרי ההידרציה; `fill` שקורה לפניה כותב לתוך
     * ה-DOM, ו-React דורס אותו ברינדור הראשון. התוצאה היא כותרת ריקה
     * שנופלת באימות בשלב הבא — כלומר שגיאה שמצביעה על שלב 3 והסיבה
     * שלה בשלב 2.
     */
    await expect(page.locator("#title")).toBeEditable({ timeout: 20_000 });

    await fillAndVerify(page.locator("#title"), title);
    await fillAndVerify(
      page.locator("#description"),
      "מודעת בדיקה אוטומטית של מסלול הפרסום. הרכב במצב מצוין, טופל במוסך מורשה, ויש תיעוד מלא של הטיפולים.",
    );
    /*
     * `#price` ולא `getByLabel("מחיר")`: התווית "מחיר" מתאימה גם לתיבת
     * "המחיר גמיש", ו-Playwright נופל על התאמה כפולה.
     */
    await fillAndVerify(page.locator("#price"), "64000");

    // עיר — Select של Radix, לא <select> נייטיבי
    /*
     * העיר הראשונה ברשימה ולא עיר מסוימת.
     *
     * Radix מציב את רשימת הבחירה כך שהפריט המסומן יתיישר מול המפעיל,
     * ובחלון של טלפון פריט שנמצא עשרים שורות למטה נשאר מחוץ לאזור
     * הנראה גם אחרי גלילה — הלחיצה נכשלת ב-"outside of the viewport".
     * לבדיקה הזו לא משנה איזו עיר נבחרה, רק שנבחרה אחת.
     */
    await chooseFromSelect(page, page.locator("#city"));
    await expect(page.locator("#city")).not.toHaveAttribute("data-placeholder", /.*/);

    await fillRequiredAttributes(page);

    await page.getByRole("button", { name: "הבא" }).click();

    // --- 3. תמונות ---
    // אימות שאנחנו באמת בשלב הזה, ולא נשארנו בשלב הקודם על שגיאת אימות
    const upload = page.locator('input[type="file"]');
    await expect(upload).toBeAttached({ timeout: 15_000 });
    await page.setInputFiles('input[type="file"]', {
      name: "car.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.getByRole("button", { name: /הסרת תמונה/ }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "הבא" }).click();

    // --- 4. תצוגה מקדימה ופרסום ---
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: "פרסום המודעה" }).click();

    await page.waitForURL(/\/item\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title.slice(0, 15));

    /*
     * המחיר נבדק לפי הספרות ולא לפי "₪": סימן המטבע מופיע בעשרות
     * מקומות בדף (מודעות דומות, התפלגות, מד המחיר) ו-Playwright נופל
     * על התאמה מרובה. "64,000" הוא גם מה שמאמת שהפורמט עשה את עבודתו.
     */
    await expect(page.getByText("64,000").first()).toBeVisible();
  });

  test("פרסום בלי אימות טלפון נחסם", async ({ page }) => {
    await assertDevServer(page);
    const user = newUser("unverified");

    const register = await page.request.post("/api/auth/register", { data: user });
    expect(register.ok()).toBeTruthy();

    const csrf = await page.request.get("/api/auth/csrf");
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    await page.request.post("/api/auth/callback/password", {
      form: { email: user.email, password: user.password, csrfToken, json: "true" },
    });

    /*
     * דרך ה-API ולא דרך המסך: המסך חוסם את הכפתור, וזה בדיוק מה
     * שהבדיקה הזו **לא** אמורה לסמוך עליו. אימות טלפון הוא קו ההגנה
     * מול ספאם, והוא חייב להיאכף בשרת.
     */
    const res = await page.request.post("/api/listings", {
      data: { mode: "publish", data: { categoryId: "x", title: "x", description: "x" } },
    });
    expect(res.status()).toBe(403);
    expect(await res.text()).toContain("לאמת מספר טלפון");
  });
});
