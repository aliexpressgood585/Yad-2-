/**
 * בדיקה: אף שאילתת SQL גולמית על `Listing` אינה נשארת בלי סינון הדגמה.
 *
 * ההרחבה של Prisma ב-`lib/db` מסננת כל `findMany` ו-`count`, אבל היא
 * **אינה חלה על `$queryRaw`** — שם Prisma מעביר את השאילתה כמו שהיא.
 * החור הזה היה אמיתי: במסד בלי מודעות אמיתיות `listing.count()` החזיר
 * 0 בזמן שאותה ספירה ב-SQL גולמי החזירה 3,076, וכך דף הבית הכריז על
 * אלפי מודעות שאיש לא רואה — וקריאות השוק חושבו מנתוני הדגמה.
 *
 * הבדיקה גסה בכוונה: היא סורקת טקסט ולא AST. שאילתה שנוגעת ב-`Listing`
 * וחסר בה `notDemo` או `isDemo` נחשבת כשל, גם אם במקרה היא בטוחה —
 * עדיף אזהרה מיותרת מדי על חור שחוזר בשקט.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/lib";

/** קבצים שנבדקו ידנית ואינם זקוקים לסינון, עם הסיבה. */
const EXEMPT: Record<string, string> = {
  "metrics.ts": "מדדי ניהול בלבד — נצפים במסך אדמין ולא מוגשים למשתמש",
};

let failed = 0;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

console.log("\nבידוד נתוני הדגמה בשאילתות גולמיות\n");

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
  const source = readFileSync(join(DIR, file), "utf8");
  if (!/\$queryRaw|Prisma\.sql/.test(source)) continue;
  if (!/"Listing"/.test(source)) continue;

  if (EXEMPT[file]) {
    console.log(`${green("✓")} ${file.padEnd(20)} פטור — ${EXEMPT[file]}`);
    continue;
  }

  const guarded = /notDemo\(|isDemo/.test(source);
  if (!guarded) {
    console.log(`${red("✗")} ${file.padEnd(20)} נוגע ב-Listing בלי סינון הדגמה`);
    failed++;
    continue;
  }

  console.log(`${green("✓")} ${file.padEnd(20)} מסונן`);
}

console.log();
if (failed) {
  console.log(`${failed} קבצים ללא סינון. הוסיפו notDemo() או רשמו פטור עם סיבה.\n`);
  process.exit(1);
}
console.log("כל השאילתות הגולמיות מסננות נתוני הדגמה.\n");
