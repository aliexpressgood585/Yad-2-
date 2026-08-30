/**
 * הוספת מפתחות לקטלוג.
 *   echo '{"key":"ערך"}' | npx tsx scripts/i18n/add-keys.ts he "כותרת המקטע"
 *
 * המפתחות נכתבים לפני הסוגר של האובייקט, בלי לגעת במה שכבר קיים.
 * מפתח שכבר בקטלוג מדולג — הרצה חוזרת אינה מכפילה שורות ואינה דורסת
 * תרגום שנכתב ביד.
 *
 * הקובץ קיים כדי שהוספת מפתחות תהיה פעולה אחת ולא עריכה ידנית בשלושה
 * קבצים; עריכה ידנית באלפי מפתחות היא בדיוק המקום שבו נוצרות שורות
 * כפולות ומרכאות שבורות.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , locale = "he", section = ""] = process.argv;
const path = `src/i18n/messages/${locale}.ts`;

const input = readFileSync(0, "utf8");
const additions = JSON.parse(input) as Record<string, string>;

const catalog = readFileSync(path, "utf8");
const anchor = catalog.lastIndexOf(locale === "he" ? "} as const;" : "};");
if (anchor < 0) {
  console.error(`לא נמצא סוף האובייקט ב-${path}`);
  process.exit(1);
}

const existing = new Set([...catalog.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
const fresh = Object.entries(additions).filter(([key]) => !existing.has(key));

if (!fresh.length) {
  console.log(`אין מפתחות חדשים ל-${path}`);
  process.exit(0);
}

const header = section ? `\n  /* --- ${section} --- */\n` : "\n";
const block =
  header + fresh.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") + "\n";

writeFileSync(path, catalog.slice(0, anchor) + block + catalog.slice(anchor));
console.log(`נוספו ${fresh.length} מפתחות ל-${path}`);
