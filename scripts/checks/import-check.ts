/**
 * בדיקות הייבוא המרוכז.
 *   npm run check:import
 *
 * מקבע את מה שמפריד בין ייבוא שסוחר יכול להשתמש בו לבין ייבוא שהוא
 * ינטוש: שורה שגויה לא מפילה את הקובץ, מחיר מאקסל נקרא כמו שהוא,
 * ושדות מצוטטים עם פסיקים בתוכם לא נשברים.
 */
import {
  parseCsvLine,
  parsePrice,
  parseImport,
  findDuplicates,
  SAMPLE_CSV,
} from "../../src/lib/dealer-import";

let failed = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/* --- פירוק שורה ----------------------------------------------------------- */

console.log("פירוק CSV\n");

check(
  JSON.stringify(parseCsvLine("a,b,c")) === JSON.stringify(["a", "b", "c"]),
  "שורה פשוטה",
);
check(
  JSON.stringify(parseCsvLine('"שלום, עולם",2')) === JSON.stringify(["שלום, עולם", "2"]),
  "פסיק בתוך שדה מצוטט אינו מפריד",
  "זה מה ששובר כמעט כל מפרק תמים",
);
check(
  JSON.stringify(parseCsvLine('"הוא אמר ""שלום""",1')) ===
    JSON.stringify(['הוא אמר "שלום"', "1"]),
  "מרכאה כפולה בתוך שדה מצוטט",
);
check(
  JSON.stringify(parseCsvLine("a,,c")) === JSON.stringify(["a", "", "c"]),
  "שדה ריק נשמר במקומו",
);

/* --- מחיר ----------------------------------------------------------------- */

console.log("\nמחיר מאקסל\n");

check(parsePrice("104500") === 104500, "מספר רגיל");
check(parsePrice("104,500") === 104500, "מפריד אלפים", "אקסל מוסיף אותו לבד");
check(parsePrice("₪104,500") === 104500, "סימן מטבע");
check(parsePrice("104500 ") === 104500, "רווחים בקצוות");
check(parsePrice("") === null, "ריק → null");
check(parsePrice("בערך 100 אלף") === null, "טקסט חופשי → null");
check(parsePrice("-5000") === null, "מחיר שלילי נדחה");

/* --- שורה שגויה לא מפילה את הקובץ ---------------------------------------- */

console.log("\nעמידות\n");

const mixed = [
  "כותרת,תיאור,מחיר,עיר",
  '"טויוטה קורולה הייבריד","רכב במצב מצוין יד ראשונה מחברה עם תיעוד מלא",104500,חיפה',
  "קצר,קצר,לא מספר,",
  '"מאזדה 3 סקייאקטיב 2020","שמור היטב ללא תאונות וכל הטיפולים בזמן ובתיעוד",89000,נתניה',
].join("\n");

const res = parseImport(mixed);
check(res.rows.length === 2, "שתי שורות תקינות נשמרו", `${res.rows.length} שורות`);
check(res.errors.length >= 3, "השורה השגויה החזירה שגיאות מפורטות", `${res.errors.length} שגיאות`);
check(
  res.errors.every((e) => e.line === 3),
  "כל השגיאות מצביעות על שורה 3",
  "מספר השורה כפי שהסוחר רואה אותו בקובץ",
);
check(
  res.errors.some((e) => e.column === "מחיר") && res.errors.some((e) => e.column === "עיר"),
  "השגיאות מציינות את העמודה",
);

/* --- עמודות חובה ---------------------------------------------------------- */

console.log("\nעמודות\n");

const missing = parseImport("כותרת,תיאור\nא,ב");
check(
  missing.errors.some((e) => e.message.includes("מחיר")),
  "עמודת חובה חסרה מדווחת",
  missing.errors[0]?.message ?? "",
);
check(missing.rows.length === 0, "בלי עמודות חובה לא מיובא כלום");

const sample = parseImport(SAMPLE_CSV);
check(sample.errors.length === 0, "קובץ הדוגמה עובר בלי שגיאות", `${sample.rows.length} שורות`);
check(
  sample.rows[0]?.attributes["יצרן"] === "טויוטה",
  "עמודה לא מוכרת נקראת כמאפיין דינמי",
  JSON.stringify(sample.rows[0]?.attributes ?? {}),
);
check(
  sample.rows[0]?.categorySlug === "private-cars",
  "עמודת קטגוריה אינה נחשבת מאפיין",
);

check(parseImport("").errors.length === 1, "קובץ ריק מחזיר שגיאה אחת ולא נופל");

/* --- כפילויות ------------------------------------------------------------- */

console.log("\nכפילויות\n");

const dupCsv = [
  "כותרת,תיאור,מחיר,עיר",
  '"טויוטה קורולה הייבריד","רכב במצב מצוין יד ראשונה מחברה עם תיעוד מלא",104500,חיפה',
  '"טויוטה קורולה הייבריד","רכב במצב מצוין יד ראשונה מחברה עם תיעוד מלא",104500,חיפה',
].join("\n");

const dups = findDuplicates(parseImport(dupCsv).rows);
check(dups.length === 1, "שורה כפולה מזוהה", `${dups.length} כפילויות`);
check(dups[0]?.line === 3, "הכפילות מצביעה על השורה השנייה ולא הראשונה", `שורה ${dups[0]?.line}`);
check(
  findDuplicates(parseImport(SAMPLE_CSV).rows).length === 0,
  "קובץ בלי כפילויות מחזיר רשימה ריקה",
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות הייבוא עברו");
