/**
 * מדידת Lighthouse מול שרת חי.
 *   npm run lighthouse [baseUrl]
 *
 * הסקריפט **נכשל** כשציון יורד מתחת לסף, ולא רק מדפיס מספר. דוח
 * שאיש לא נכשל בגללו הופך תוך חודש לקובץ שאף אחד לא פותח.
 *
 * הספים מכוונים לסביבה הזו ולא לאידיאל: המדידה רצה מול שרת מקומי
 * במכולה משותפת, וציוני ביצועים שם רועשים בהרבה מאשר במכשיר אמיתי.
 * ה-thresholds של נגישות ושל best-practices, לעומת זאת, יציבים —
 * ולכן הם גבוהים.
 */
import fs from "node:fs";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

/** הדפים שנמדדים, ולמה דווקא הם. */
const PAGES = [
  { path: "/", name: "דף הבית" },
  { path: "/vehicles", name: "דף קטגוריה" },
];

/**
 * ספים לכל קטגוריה.
 *
 * נגישות ו-SEO גבוהים כי הם נמדדים מבדיקות דטרמיניסטיות — ניגודיות,
 * תוויות, תגיות. ביצועים נמוך יותר כי המדידה כאן רצה על שרת מקומי
 * במכולה משותפת, ורעש של 15 נקודות בין הרצות הוא נורמלי.
 */
const THRESHOLDS = {
  performance: 55,
  accessibility: 90,
  "best-practices": 90,
  seo: 90,
};

function chromePath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!fs.existsSync(root)) return undefined;
  return fs
    .readdirSync(root)
    .filter((d) => d.startsWith("chromium-"))
    .map((d) => `${root}/${d}/chrome-linux/chrome`)
    .find((p) => fs.existsSync(p));
}

async function main() {
  const chrome = await chromeLauncher.launch({
    chromePath: chromePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  let failed = 0;

  try {
    for (const page of PAGES) {
      const url = `${BASE}${page.path}`;
      const result = await lighthouse(url, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        // נייד הוא המכשיר העיקרי בלוח מודעות ישראלי, ולכן זו ברירת המחדל
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2 },
      });

      if (!result?.lhr) {
        console.error(`✗ ${page.name} — המדידה לא החזירה דוח`);
        failed++;
        continue;
      }

      console.log(`\n${page.name}  ${page.path}`);
      for (const [key, min] of Object.entries(THRESHOLDS)) {
        const score = Math.round((result.lhr.categories[key]?.score ?? 0) * 100);
        const ok = score >= min;
        if (!ok) failed++;
        console.log(`  ${ok ? "✓" : "✗"} ${key.padEnd(15)} ${score}  (סף ${min})`);
      }
    }
  } finally {
    await chrome.kill();
  }

  if (failed) {
    console.error(`\n${failed} מדדים מתחת לסף`);
    process.exit(1);
  }
  console.log("\nכל המדדים מעל הסף");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
