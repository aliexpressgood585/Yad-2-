/**
 * מדידת Lighthouse על המסלולים שחשובים.
 *   npm run lighthouse            — מול http://localhost:3000
 *   npm run lighthouse -- <base>  — מול כתובת אחרת
 *
 * ## מה נמדד, ולמה דווקא זה
 *
 * שלושה עמודים: דף הבית, מסך תוצאות, ודף מודעה. הם מכסים את שלושת
 * סוגי הדפים באתר — עמוד סטטי, עמוד עם שאילתות כבדות, ועמוד עם גלריה
 * ומפה — וכל השאר הוא וריאציה עליהם.
 *
 * ## חייב לרוץ מול בנייה של פרודקשן
 *
 * `next dev` מגיש קוד לא ממוזער, בלי פיצול מנות ועם מדידת HMR בתוך
 * הדף. ציון שנמדד עליו אינו קטן יותר — הוא **לא קשור** למה שמשתמש
 * מקבל, והוא גורם לתיקונים של בעיות שאינן קיימות. הסקריפט מסרב לרוץ
 * אם הוא מזהה שרת פיתוח.
 *
 * ## הספים
 *
 * נגישות וקידום נדרשים ב-100 ו-95: שניהם נמדדים כמעט לגמרי סטטית,
 * וכל ירידה בהם היא רגרסיה אמיתית שאפשר לתקן. ביצועים נדרשים ב-75
 * במובייל — הסביבה שבה זה רץ אינה מכונה שקטה, והמדד רועש בין ריצות.
 * סף גבוה מדי היה הופך את הבדיקה לרעש שמתעלמים ממנו.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.argv[2] ?? process.env.LH_BASE_URL ?? "http://localhost:3000";
const OUT = "lighthouse-report";

const THRESHOLDS = {
  performance: 75,
  accessibility: 100,
  "best-practices": 90,
  seo: 95,
};

/**
 * מדדים שמדולגים במכוון, עם הסיבה.
 *
 * מסך התוצאות נושא `noindex` בכוונה (ראה `robots.ts` ו-`search/page.tsx`):
 * דפי תוצאות אינם מיועדים לאינדוקס, והקישורים מתוכם כן נסרקים. הציון
 * של Lighthouse בקטגוריית SEO נקבע כמעט כולו לפי `is-crawlable`, ולכן
 * הוא נמוך שם **בגלל החלטה נכונה**. סף שהיה מכריח אותו לעבור היה גורם
 * למישהו להסיר את ה-noindex כדי "לתקן את הבדיקה", וזה בדיוק ההפך.
 */
const SKIP = [
  {
    path: "/search?q=",
    category: "seo",
    reason: "מסך תוצאות נושא noindex בכוונה",
  },
];

const CATEGORY_LABELS = {
  performance: "ביצועים",
  accessibility: "נגישות",
  "best-practices": "שיטות מומלצות",
  seo: "קידום אורגני",
};

/** נתיב הדפדפן — אותו משתנה שבו משתמשות בדיקות Playwright. */
const chromePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? process.env.CHROME_PATH ?? undefined;

async function pickListingPath() {
  const res = await fetch(`${BASE}/api/search?perPage=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const slug = data.items?.[0]?.slug;
  return slug ? `/item/${encodeURIComponent(slug)}` : null;
}

async function assertProductionBuild() {
  const res = await fetch(BASE);
  const html = await res.text();
  if (html.includes("__next_devtools") || html.includes("react-refresh")) {
    console.error(
      "Lighthouse חייב לרוץ מול בנייה של פרודקשן (npm run build && npm start).\n" +
        "מדידה מול next dev אינה קשורה למה שמשתמש מקבל.",
    );
    process.exit(1);
  }
}

async function run(path) {
  const chrome = await launch({
    chromePath,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const result = await lighthouse(
      `${BASE}${path}`,
      { port: chrome.port, output: "html", logLevel: "error" },
      // ברירת המחדל של Lighthouse היא מובייל עם רשת מוגבלת, וזו הסביבה
      // שרוב המשתמשים בלוח מודעות ישראלי נמצאים בה בפועל.
      undefined,
    );

    mkdirSync(OUT, { recursive: true });
    const name = path === "/" ? "home" : path.split("/").filter(Boolean)[0];
    writeFileSync(`${OUT}/${name}.html`, result.report);

    return Object.fromEntries(
      Object.entries(result.lhr.categories).map(([id, c]) => [id, Math.round(c.score * 100)]),
    );
  } finally {
    await chrome.kill();
  }
}

async function main() {
  await assertProductionBuild();

  const listing = await pickListingPath();
  const paths = ["/", "/search?q=", ...(listing ? [listing] : [])];

  console.log(`Lighthouse מול ${BASE}\n`);

  let failed = 0;
  for (const path of paths) {
    const scores = await run(path);
    console.log(path);
    for (const [id, threshold] of Object.entries(THRESHOLDS)) {
      const score = scores[id];
      const skip = SKIP.find((s) => s.path === path && s.category === id);
      if (skip) {
        console.log(`  · ${CATEGORY_LABELS[id]}: ${score}  (מדולג — ${skip.reason})`);
        continue;
      }
      const ok = score >= threshold;
      if (!ok) failed++;
      console.log(
        `  ${ok ? "✓" : "✗"} ${CATEGORY_LABELS[id]}: ${score}` +
          (ok ? "" : `  (נדרש ${threshold})`),
      );
    }
    console.log("");
  }

  console.log(`הדוחות המלאים ב-${OUT}/`);

  if (failed) {
    console.error(`${failed} מדדים מתחת לסף`);
    process.exit(1);
  }
  console.log("כל המדדים עברו את הסף");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
