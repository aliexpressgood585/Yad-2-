/**
 * המספרים ב-README מול הקוד שמייצר אותם.
 *   npm run check:docs
 *
 * ## למה זו בדיקה ולא תיקון חד-פעמי
 *
 * טבלת "מה יש כאן" הצהירה 103 שדות ו-444 ערכים בזמן שעץ הקטגוריות כבר
 * הגדיר 114 ו-964, ותיאור הזריעה הצהיר 300 מודעות במקום 829. אף אחד לא
 * שיקר: מישהו הוסיף קטגוריות ולא חזר ל-README, וזה קורה שוב בכל פעם.
 * מספר בתיעוד שאיש אינו מאמת הוא מספר שנעשה שגוי בשקט, וקורא שמגלה
 * שאחד מהם לא נכון מפסיק להאמין לכל השאר.
 *
 * הבדיקה טהורה: היא נגזרת מ-`CATEGORY_TREE` ומ-`prisma/seed/volume.ts`
 * ואינה נוגעת בבסיס הנתונים. הקבועים יושבים ב-`volume.ts` דווקא משום
 * ש-`seed.ts` מריץ את `main()` בטעינה.
 *
 * ## כישלון כאן פירושו לתקן את ה-README
 *
 * מקור האמת הוא הקוד. אם המספר בקוד השתנה במכוון — עדכן את ה-README.
 * אין להרפות את הבדיקה.
 */
import { readFileSync } from "node:fs";

import { CATEGORY_TREE, type CatDef } from "../../prisma/seed/categories";
import { TOTAL_LISTINGS, TOTAL_USERS } from "../../prisma/seed/volume";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/** ספירת הקטגוריות, השדות והערכים כפי שהזריעה תיצור אותם. */
function countTree(nodes: CatDef[]) {
  let categories = 0;
  let attributes = 0;
  let values = 0;

  const walk = (node: CatDef) => {
    categories++;
    for (const attr of node.attributes ?? []) {
      attributes++;
      values += attr.options?.length ?? 0;
    }
    for (const child of node.children ?? []) walk(child);
  };

  nodes.forEach(walk);
  return { categories, attributes, values };
}

const readme = readFileSync("README.md", "utf8");

/**
 * חילוץ המספרים מהמשפט שבו הם מופיעים. אם הניסוח שונה עד כדי כך
 * שהתבנית אינה נמצאת — זה כישלון ולא דילוג, אחרת עריכה של המשפט הייתה
 * מכבה את הבדיקה בלי שאיש ישים לב.
 */
function numbersFrom(pattern: RegExp, label: string): number[] | null {
  const match = readme.match(pattern);
  if (!match) {
    failed++;
    console.log(`✗ ${label}: המשפט לא נמצא ב-README — עדכן את התבנית בבדיקה יחד עם הניסוח`);
    return null;
  }
  return match.slice(1).map(Number);
}

console.log("מספרים ב-README מול הקוד\n");

const tree = countTree(CATEGORY_TREE);

const catalog = numbersFrom(
  /\((\d+) קטגוריות, (\d+) שדות, (\d+) ערכים\)/,
  "טבלת מה יש כאן",
);
if (catalog) {
  const [categories, attributes, values] = catalog as [number, number, number];
  check(categories === tree.categories, "מספר הקטגוריות", `README ${categories}, קוד ${tree.categories}`);
  check(attributes === tree.attributes, "מספר השדות", `README ${attributes}, קוד ${tree.attributes}`);
  check(values === tree.values, "מספר הערכים", `README ${values}, קוד ${tree.values}`);
}

const seedLine = numbersFrom(
  /זריעה: קטגוריות, שדות דינמיים, (\d+) מודעות, (\d+) משתמשים/,
  "תיאור הזריעה במפת הקבצים",
);
if (seedLine) {
  const [listings, users] = seedLine as [number, number];
  check(listings === TOTAL_LISTINGS, "מספר המודעות בזריעה", `README ${listings}, קוד ${TOTAL_LISTINGS}`);
  check(users === TOTAL_USERS, "מספר המשתמשים בזריעה", `README ${users}, קוד ${TOTAL_USERS}`);
}

if (failed) {
  console.error(`\n${failed} מספרים ב-README אינם תואמים את הקוד`);
  process.exit(1);
}
console.log("\nכל המספרים ב-README תואמים את הקוד");
