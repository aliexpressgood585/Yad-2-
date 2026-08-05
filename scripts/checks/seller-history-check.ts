/**
 * בדיקות שקיפות התנהגות המוכר.
 *   npm run check:seller-history
 *
 * שני דפוסים, ושתי דרכים להיכשל: להאשים מוכר תמים, או לפספס דפוס
 * אמיתי. הבדיקות כאן מכוונות לשניהם.
 */
import {
  REPOST_MIN,
  priceInsight,
  priceInsightLabel,
  repostLabel,
  type PricePoint,
} from "../../src/lib/seller-history";

let failed = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

const NOW = new Date("2026-06-15T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

/* --- ריפרוט -------------------------------------------------------------- */

console.log("ריפרוט\n");

check(repostLabel(null, NOW) === null, "בלי נתונים — אין תווית");

/*
 * חידוש בודד הוא התנהגות רגילה לחלוטין: מודעה פגה והמוכר חידש אותה.
 * להציג את זה כדפוס זה להאשים את רוב המשתמשים בלוח.
 */
check(
  repostLabel({ times: 2, firstSeen: daysAgo(40) }, NOW) === null,
  `${REPOST_MIN - 1} פרסומים אינם דפוס`,
  "מודעה שחודשה פעם אחת",
);

const label = repostLabel({ times: 6, firstSeen: daysAgo(63) }, NOW);
check(label !== null, "שישה פרסומים כן", label ?? "");
check(
  label!.includes("63") || label!.includes("באוויר"),
  "התווית אומרת כמה זמן הפריט באוויר",
  label ?? "",
);

/*
 * זה הפרט שהופך את זה לשימושי. מספר הפרסומים לבדו לא אומר לקונה דבר;
 * מה שמעניין אותו הוא שהפריט לא נמכר כבר חודשיים — וזה בדיוק מה
 * שהריפרוט נועד להסתיר.
 */
check(
  /\d+ ימים/.test(label!),
  "מוצג מספר ימים ולא רק מספר פרסומים",
  label ?? "",
);

check(
  repostLabel({ times: 4, firstSeen: NOW }, NOW)!.includes("1 ימים"),
  "פרסום ראשון היום לא מייצר אפס ימים",
  "מינימום יום אחד",
);

/* --- מחיר: הועלה ואז הורד ------------------------------------------------ */

console.log("\nהועלה ואז הורד\n");

const raisedThenCut: PricePoint[] = [
  { price: 100_000, at: daysAgo(60) },
  { price: 125_000, at: daysAgo(30) },
  { price: 108_000, at: daysAgo(2) },
];

const insight = priceInsight(raisedThenCut);
check(insight?.kind === "raised-then-cut", "הדפוס מזוהה", insight?.kind ?? "null");
check(
  priceInsightLabel(insight)!.includes("אינו נמוך"),
  "הניסוח אומר שהמחיר לא באמת ירד",
  priceInsightLabel(insight) ?? "",
);

/* --- מחיר: ירידה אמיתית -------------------------------------------------- */

console.log("\nירידה אמיתית\n");

const realDrop: PricePoint[] = [
  { price: 100_000, at: daysAgo(60) },
  { price: 88_000, at: daysAgo(3) },
];
const drop = priceInsight(realDrop);
check(drop?.kind === "net-drop", "ירידה מנקודת הפתיחה מזוהה כירידה");
check(drop?.kind === "net-drop" && drop.pct === 12, "האחוז נכון", `${(drop as { pct: number }).pct}%`);

/*
 * גם כשהמחיר עלה בדרך, אם הוא בסוף מתחת לפתיחה — זו ירידה אמיתית.
 * הדפוס המטעה הוא רק כשהמחיר הנוכחי *אינו* מתחת לנקודת הפתיחה.
 */
const upThenReallyDown: PricePoint[] = [
  { price: 100_000, at: daysAgo(60) },
  { price: 130_000, at: daysAgo(30) },
  { price: 82_000, at: daysAgo(1) },
];
check(
  priceInsight(upThenReallyDown)?.kind === "net-drop",
  "עלייה ואז ירידה מתחת לפתיחה = ירידה אמיתית",
);

/* --- לא להאשים לחינם ----------------------------------------------------- */

console.log("\nלא להאשים לחינם\n");

check(priceInsight([]) === null, "בלי היסטוריה — אין ממצא");
check(priceInsight([{ price: 100, at: NOW }]) === null, "נקודה אחת — אין ממצא");

/*
 * עיגול של אחוז אינו מהלך. בלי רצפת רעש כל מודעה שתוקנה ב-500 שקל
 * הייתה מקבלת תווית, והתווית הייתה מאבדת משמעות.
 */
const noise: PricePoint[] = [
  { price: 100_000, at: daysAgo(10) },
  { price: 100_500, at: daysAgo(5) },
  { price: 100_000, at: daysAgo(1) },
];
check(priceInsight(noise) === null, "שינוי של חצי אחוז נבלע כרעש");

const flat: PricePoint[] = [
  { price: 100_000, at: daysAgo(10) },
  { price: 100_000, at: daysAgo(1) },
];
check(priceInsight(flat) === null, "מחיר שלא זז אינו ממצא");
check(priceInsightLabel(null) === null, "null מחזיר null ולא מחרוזת ריקה");

/*
 * המילים אסורות. הרכיבים האלה מציגים עובדה ולא מסקנה — יש סיבות
 * לגיטימיות לפרסם מחדש ולהעלות מחיר.
 */
const ACCUSATORY = ["מטעה", "רמאי", "מנסה", "שקר"];
const texts = [
  repostLabel({ times: 6, firstSeen: daysAgo(63) }, NOW)!,
  priceInsightLabel(insight)!,
  priceInsightLabel(drop)!,
];
check(
  !texts.some((t) => ACCUSATORY.some((w) => t.includes(w))),
  "אין ניסוח שמאשים את המוכר",
  `${texts.length} טקסטים נבדקו`,
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות שקיפות המוכר עברו");
