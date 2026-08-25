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
 * מה נמדד, ומה נמצא שאינו נכון
 *
 * Lighthouse מדמה 4G איטי: 1.6Mbps ו-RTT של 150ms. הציון נשען על
 * סימולציה (Lantern) ולא על מדידה בדפדפן, וזה ההבדל שמסביר את הכול.
 *
 * **רק LCP עולה נקודות.** במדידה: FCP 99, Speed Index 100, CLS 100,
 * TBT 79–93 — ו-LCP 36–46. כל שאר האודיטים עוברים, ו-Lighthouse
 * אינו מציע אף הזדמנות ספציפית.
 *
 * מה שתוקן אחרי מדידה:
 *
 * 1. MapLibre (767KB JS) נטען בכל דף מודעה מיד, עבור רכיב מתחת
 *    לקיפול. עכשיו בהתקרבות למסך. דף מודעה עלה מ-60 ל-86.
 * 2. גיליון הסגנון של MapLibre (64KB, חוסם רינדור) יובא מהפריסה
 *    הראשית — כלומר בכל דף באתר, כולל דף הבית שאין בו מפה.
 * 3. הודעת העוגיות הייתה אלמנט ה-LCP בכל דף: במסך נייד היא כיסתה
 *    שטח גדול יותר מהכותרת הראשית והופיעה רק אחרי ההידרציה.
 *    **LCP אמיתי ירד מ-2,544ms ל-1,312ms** — והציון של Lighthouse
 *    לא זז. זה בדיוק הפער בין הסימולציה למשתמש.
 * 4. משיכה מוקדמת של מסלול מאחורי התחברות נכשלה בכל טעינה וכתבה
 *    שגיאה לקונסולה. best-practices עלה מ-96 ל-100.
 *
 * ------------------------------------------------------------------
 * למה לא 95 — המספרים, לא ההרגשה
 *
 * משקל על החוט: 453KB בדף הבית, 577KB בדף קטגוריה. הפירוט בדף
 * הבית — 253KB סקריפט, 131KB גופנים, 26KB CSS, 22KB מסמך.
 *
 * ב-1.6Mbps ההעברה לבדה נמשכת כ-2.3 שניות. ציון 95 דורש LCP מתחת
 * ל-2.5 שניות, ו-LCP אינו יכול להקדים את הבתים שהוא זקוק להם.
 *
 * **הגופנים נבדקו ואינם החסם.** חיתוך משלוש משפחות לאחת — 85KB
 * פחות — הזיז את הציון בנקודה עד שתיים, בתוך רעש המדידה. הבדיקה
 * הזאת נעשתה בפועל והוחזרה, ולכן שלוש המשפחות נשארו: הנימוק
 * העיצובי שלהן שרד מדידה.
 *
 * מה שנשאר הוא ה-runtime עצמו. `First Load JS` הוא 177KB בדף הבית
 * ו-210KB בדף קטגוריה, ושני צ'אנקים של 172KB הם React ו-Next.
 * לרדת מזה משמעו לעזוב את המסגרת.
 *
 * **בדפדפן אמיתי המספרים אחרים לגמרי.** במדידה עם האטה מוחלת
 * (לא מדומה) על אמולציית Moto G: LCP 928ms בדף הבית, 1,900ms בדף
 * קטגוריה. שניהם הרבה מתחת ל-2.5 שניות.
 *
 * לכך מתווסף שהמדידה רצה במכולה משותפת מול שרת מקומי, בלי CDN
 * ובלי brotli, ורעש של 5-8 נקודות בין הרצות הוא נורמלי.
 *
 * הרצפות למטה הן המדוד פחות מרווח רעש. הן לא הורדו כדי לעבור; הן
 * נכתבו יחד עם הסיבה, והיעד נשאר 95 כדי שהפער יישאר גלוי.
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
