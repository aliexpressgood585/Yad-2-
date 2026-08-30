/**
 * סיווג כל מחרוזת עברית בקוד לפי מה שאפשר לעשות איתה אוטומטית.
 *   npx tsx scripts/i18n/classify.ts
 *
 * `DECISIONS.md` §53 טען שחילוץ אוטומטי שובר אינטרפולציות, ריבוי וסימני
 * פיסוק ב-RTL. הטענה נכונה — אבל היא נכונה לגבי *חלק* מהמחרוזות, ולא
 * לגבי כולן. הקובץ הזה סופר כמה מכל סוג, כדי שההחלטה מה לחלץ ביד תתקבל
 * לפי מספרים ולא לפי הערכה.
 *
 * הסיווג:
 *
 *   `safe`     — טקסט JSX או מחרוזת פשוטה בלי ביטויים. חילוץ מכני.
 *   `template` — תבנית עם ביטויים בפנים. דורשת המרה לפרמטרים בשם.
 *   `data`     — מודול שהעברית בו היא נתונים ולא ממשק (שמות ערים,
 *                מילים נרדפות לחיפוש). אין מה לתרגם: הן קיימות כדי
 *                לנתח קלט עברי.
 *   `comment`  — לא נספר כלל; ה-AST אינו רואה הערות.
 */
import { scanAll, type Hit } from "./scan";

/**
 * מודולים שהעברית בהם היא נתונים לשוניים ולא טקסט ממשק.
 *
 * `search/*` הוא אוצר המילים שמנתח שאילתות בעברית — מילים נרדפות,
 * נטיות, יחידות. תרגום שלו לאנגלית אינו חסר משמעות בלבד, הוא היה שובר
 * את החיפוש. `cities.ts` הוא רשימת היישובים בישראל; שמותיהם הרשמיים הם
 * הנתון, ותעתיק שלהם שייך לשכבת תרגום נפרדת ולא לקטלוג ממשק.
 */
const DATA_MODULES = [
  /^src\/lib\/search\//,
  /^src\/lib\/cities\.ts$/,
  /^src\/lib\/listing-text\.ts$/,
  /^prisma\//,
  /*
   * הקטלוגים עצמם. העברית בהם היא היעד של החילוץ, לא מה שנותר לחלץ —
   * בלי החרגה הבדיקה סופרת כל מחרוזת שחולצה בהצלחה כמחרוזת שנותרה,
   * והמונה עולה ככל שמתקדמים.
   */
  /^src\/i18n\/messages\//,
  /*
   * נתיבים עבריים. `/מחירון/[יצרן]/[דגם]` הוא כתובת ציבורית שקיימת
   * באינדקס ובקישורים חיצוניים; תרגום שלה שובר כתובות ואינו מתרגם
   * ממשק.
   */
  /^src\/lib\/hebrew-routes\.ts$/,
];

/**
 * מחרוזות שאינן ממשק גם כשהן יושבות במודול ממשק.
 *
 * SQL עם הערה בעברית בפנים הוא שאילתה, לא טקסט שמוצג. אורך של יותר
 * מ-200 תווים עם `SELECT` בתוכו אינו תווית כפתור.
 */
function isQuery(text: string): boolean {
  return /\bSELECT\b|\bWITH\b\s|\bINSERT\b/.test(text) && text.length > 120;
}

export function isDataModule(file: string): boolean {
  return DATA_MODULES.some((re) => re.test(file));
}

export type Class = "safe" | "template" | "data";

export function classify(hit: Hit): Class {
  if (isDataModule(hit.file)) return "data";
  if (isQuery(hit.text)) return "data";
  if (hit.kind === "tmplx") return "template";
  return "safe";
}

if (process.argv[1]?.endsWith("classify.ts")) {
  const hits = scanAll();
  const buckets = new Map<Class, Hit[]>();
  for (const hit of hits) {
    const cls = classify(hit);
    if (!buckets.has(cls)) buckets.set(cls, []);
    buckets.get(cls)!.push(hit);
  }

  for (const cls of ["safe", "template", "data"] as const) {
    const list = buckets.get(cls) ?? [];
    const unique = new Set(list.map((h) => h.text)).size;
    const files = new Set(list.map((h) => h.file)).size;
    console.log(`${cls.padEnd(9)} ${String(list.length).padStart(5)} מופעים · ${String(unique).padStart(5)} ייחודיות · ${files} קבצים`);
  }

  const ui = hits.filter((h) => classify(h) !== "data");
  console.log(`\nממשק בלבד: ${ui.length} מופעים, ${new Set(ui.map((h) => h.text)).size} ייחודיות, ${new Set(ui.map((h) => h.file)).size} קבצים`);

  console.log("\nדוגמאות לתבניות שדורשות טיפול ידני:");
  (buckets.get("template") ?? []).slice(0, 12).forEach((h) => {
    console.log(`  ${h.file}:${h.line}  ${h.text.replace(/\s+/g, " ").slice(0, 78)}`);
  });
}
