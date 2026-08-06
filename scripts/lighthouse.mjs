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
  /*
   * דף מודעה — הדף שאליו מגיעים מגוגל ומשיתוף, כלומר הדף שנמדד בפועל.
   * הנתיב נלקח מ-`E2E_ITEM_SLUG` אם הוגדר; אחרת נדלג עליו במקום להיכשל
   * על מודעה שלא קיימת במסד הזה.
   */
  ...(process.env.LH_ITEM_SLUG
    ? [{ path: `/item/${process.env.LH_ITEM_SLUG}`, name: "דף מודעה" }]
    : []),
];

/**
 * היעד המוצהר לביצועים. הסקריפט מדפיס את המרחק ממנו בכל הרצה, גם
 * כשהוא עובר — כדי שהפער יישאר גלוי ולא ייעלם מאחורי "ירוק".
 */
const PERF_TARGET = 95;

/**
 * ספים לכל קטגוריה.
 *
 * נגישות, best-practices ו-SEO נמדדים מבדיקות דטרמיניסטיות (ניגודיות,
 * תוויות, תגיות) ולכן הם גבוהים ויציבים.
 */
const THRESHOLDS = {
  accessibility: 95,
  "best-practices": 90,
  seo: 90,
};

/**
 * רצפות ביצועים לכל דף, ולמה הן אינן 95.
 *
 * ------------------------------------------------------------------
 * מה נמדד ומה תוקן
 *
 * Lighthouse מדמה 4G איטי: 1.6Mbps ו-RTT של 150ms. בקצב הזה כל
 * קילובייט שהדף מוריד הוא זמן, ו-LCP אינו יכול להקדים את סוף
 * ההעברה. שלושה דברים תוקנו אחרי מדידה, לא לפי הרגשה:
 *
 * 1. MapLibre (767KB) נטען בכל דף מודעה מיד — עבור רכיב מתחת לקיפול.
 *    עכשיו הוא נטען בהתקרבות למסך. דף מודעה עלה מ-60 ל-86, וזמן
 *    החסימה ירד מ-780ms ל-100ms.
 * 2. שלושה קישורים למסכים מאחורי התחברות נמשכו מראש בכל טעינת דף.
 * 3. ה-placeholder המטושטש בכרטיס שקל 3KB, והתמונונת שהוא הסתיר
 *    שוקלת 2-3KB. 75KB למסמך כדי להסתיר טעינה של 20 מילישניות.
 *
 * מה שנבדק ולא היה תקלה: גודל התמונות. הדפדפן מבקש w=384 במשקל
 * 2-3KB לכל כרטיס — ה-w=1600 שנראה במקור הדף הוא מועמד ב-srcset
 * שלעולם אינו נבחר.
 *
 * ------------------------------------------------------------------
 * למה לא 95
 *
 * מה שנשאר הוא משקל ההעברה: 480-580KB לדף, שמתוכם כ-340KB הם
 * ה-runtime של React ושל Next עצמם. ב-1.6Mbps ההעברה לבדה נמשכת
 * 2.4-2.9 שניות, ו-LCP מתחת ל-2.5 שניות — מה שנדרש לציון 95 — אינו
 * אפשרי אריתמטית בלי לחתוך את ה-runtime, שאינו בשליטתנו.
 *
 * לכך מתווסף שהמדידה רצה במכולה משותפת מול שרת מקומי, בלי CDN ובלי
 * brotli, ורעש של 6-8 נקודות בין הרצות הוא נורמלי. בפריסה אמיתית
 * (Vercel, brotli, CDN קרוב) המספרים גבוהים יותר — אבל לא נמדדו כאן
 * ולכן אינם מה שהרצפות משקפות.
 *
 * הרצפות למטה הן המדוד פחות מרווח רעש. הן לא הורדו כדי לעבור; הן
 * נכתבו יחד עם הסיבה.
 */
const PERF_FLOOR = {
  "/": 78,
  "/vehicles": 68,
  default: 74,
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

      /*
       * ביצועים נמדדים מול הרצפה המתועדת, והמרחק מ-95 מודפס תמיד.
       * סף שעובר בשקט הוא סף שמפסיקים לראות.
       */
      const perf = Math.round((result.lhr.categories.performance?.score ?? 0) * 100);
      const floor = PERF_FLOOR[page.path] ?? PERF_FLOOR.default;
      const perfOk = perf >= floor;
      if (!perfOk) failed++;
      console.log(
        `  ${perfOk ? "✓" : "✗"} ${"performance".padEnd(15)} ${perf}  (רצפה ${floor}, יעד ${PERF_TARGET} — חסרות ${Math.max(0, PERF_TARGET - perf)})`,
      );

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
