import { defineConfig, devices } from "@playwright/test";

/**
 * הגדרות Playwright.
 *
 * ## למה הדפדפן נלקח ממשתנה סביבה
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` מאפשר להצביע על Chromium שכבר מותקן
 * בסביבה, במקום להוריד אחד. סביבות CI רבות — וגם סביבת הפיתוח של
 * הפרויקט הזה — מגיעות עם דפדפן מותקן בגרסה שאינה בדיוק זו שהחבילה
 * מצפה לה, ובלי המשתנה כל ריצה מתחילה בהורדה של 150MB או נופלת על
 * "Executable doesn't exist". כשהמשתנה אינו מוגדר, Playwright מתנהג
 * כרגיל ומשתמש בדפדפן שהוא הוריד בעצמו.
 *
 * ## למה `dir=rtl` נבדק במפורש
 *
 * כל האתר RTL, וזה בדיוק סוג הדבר שנשבר בשקט: רכיב חדש עם `ml-`
 * במקום `ms-` נראה תקין בצילום מסך אחד ומזיז חצי מסך בדפדפן אמיתי.
 */
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  // המסלולים תלויים במצב המסד (מודעה שפורסמה, שיחה שנפתחה), ולכן
  // בזה אחר זה. הרצה מקבילה כאן הייתה מייצרת כשלים שאי אפשר לשחזר.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(chromium ? { launchOptions: { executablePath: chromium } } : {}),
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
