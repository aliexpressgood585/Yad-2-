/**
 * התחלה קרה — איך הלוח נראה עם 30 מודעות.
 *
 * המוצר עוצב מול אלפי מודעות. ביום הראשון יהיו שלושים, וכל מסך
 * שמניח צפיפות נראה שבור — לא בגלל באג אלא בגלל הנחה. הבדיקה כאן
 * מוודאת שהספים עצמם נכונים, ושהם מסודרים בסדר הגיוני.
 */
import {
  MIN_LISTINGS_FOR_COUNTER,
  MIN_LISTINGS_FOR_PROMOTED,
  MIN_LISTINGS_FOR_SECTIONS,
  MIN_LISTINGS_FOR_TICKS,
  inventoryShape,
} from "../../src/lib/inventory";

let failed = 0;
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
}

console.log("\nהתחלה קרה\n");

const day1 = inventoryShape(30);
check(!day1.counter, "עם 30 מודעות אין מונה מלאי", "מספר קטן מזיק יותר משום מספר");
check(!day1.promoted, "עם 30 מודעות אין רצועת מקודמות");
check(day1.ticks, "עם 30 מודעות עדיין יש קריאות שוק");

/*
 * ב-30 מודעות הרצועות המשניות כן נפתחות — הסף שלהן הוא 20. מה שמגן
 * עליהן מכותרת ריקה הוא תנאי התוכן בדף עצמו, והסף כאן מגן על המקרה
 * שמתחתיו אין טעם לנסות בכלל.
 */
const tiny = inventoryShape(15);
check(!tiny.sections, "מתחת ל-20 מודעות אין רצועות משניות", "כותרת בלי תוכן נראית כמו תקלה");
check(day1.sections, "מ-20 ומעלה הרצועות נפתחות");

const empty = inventoryShape(0);
check(!empty.counter && !empty.sections && !empty.promoted && !empty.ticks, "לוח ריק לגמרי סגור הכול");

const grown = inventoryShape(500);
check(
  grown.counter && grown.sections && grown.promoted && grown.ticks,
  "לוח מלא פותח הכול בלי שינוי קוד",
);

check(
  MIN_LISTINGS_FOR_TICKS <= MIN_LISTINGS_FOR_PROMOTED &&
    MIN_LISTINGS_FOR_SECTIONS <= MIN_LISTINGS_FOR_PROMOTED &&
    MIN_LISTINGS_FOR_PROMOTED <= MIN_LISTINGS_FOR_COUNTER,
  "הספים מסודרים — מה שדורש יותר מלאי נפתח מאוחר יותר",
  `${MIN_LISTINGS_FOR_SECTIONS} · ${MIN_LISTINGS_FOR_TICKS} · ${MIN_LISTINGS_FOR_PROMOTED} · ${MIN_LISTINGS_FOR_COUNTER}`,
);

/* המונה חייב לשקף את המסד ולא מספר קבוע. */
check(inventoryShape(137).total === 137, "המונה מחזיר את המספר האמיתי");

console.log();
if (failed) process.exit(1);
