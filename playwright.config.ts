import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * הגדרות Playwright.
 *
 * ה-E2E הקיים (`npm run e2e`) בודק את ה-API: הרשמה, פרסום, חיפוש,
 * הרשאות. הוא מהיר ומכסה הרבה, אבל הוא **לא רואה את המסך** — הוא לא
 * יכול לתפוס כפתור שנחתך, ניגודיות שנשברה, או תפריט שלא נפתח בנייד.
 *
 * זה מה שהקובץ הזה מוסיף. שני הכלים משלימים ואף אחד מהם אינו מחליף
 * את השני.
 */

/**
 * הדפדפן מותקן מראש בסביבה, ואסור להוריד אותו שוב.
 * הנתיב מתגלה ולא מקובע: מספר הגרסה בתיקייה משתנה עם כל עדכון.
 */
function chromiumPath(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!fs.existsSync(root)) return undefined;
  return fs
    .readdirSync(root)
    .filter((d) => d.startsWith("chromium-"))
    .map((d) => `${root}/${d}/chrome-linux/chrome`)
    .find((p) => fs.existsSync(p));
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  /*
   * ריצה טורית ולא מקבילית.
   *
   * הבדיקות רצות מול מסד אמיתי, וחלקן כותבות אליו. שתי בדיקות
   * שרצות במקביל על אותו משתמש דמו נכשלות זו בגלל זו, וכישלון
   * כזה נראה בדיוק כמו באג אמיתי — וזה מה שגורם לצוות להפסיק
   * להאמין לחבילת הבדיקות.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: chromiumPath() },
      },
    },
    {
      /*
       * נייד אינו "נחמד שיהיה" בלוח מודעות ישראלי — זה המכשיר העיקרי.
       * פריסה שנשברת ב-390px היא פריסה שבורה, גם אם היא מושלמת בדסקטופ.
       */
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { executablePath: chromiumPath() },
      },
    },
  ],
});
