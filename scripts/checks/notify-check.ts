/**
 * בדיקות שעות השקט.
 *   npm run check:notify
 *
 * החישוב כאן קובע מתי הלוח שולח התראות, והוא נשען על אלגוריתם שקיעה
 * שנכשל בשקט: ענף הזריחה וענף השקיעה נבדלים בתו אחד (`360 - acos` מול
 * `acos`), ותוצאה שגויה נראית כמו `Date` תקין לחלוטין. הבדיקה
 * הראשונה כאן תפסה בדיוק את זה — "שקיעה" ב-06:40 בבוקר.
 *
 * הבדיקות טהורות ואינן דורשות בסיס נתונים.
 */
import {
  isQuiet,
  jerusalemParts,
  nextAllowedTime,
  sunsetUtc,
  SHABBAT_ENTRY_MINUTES_BEFORE_SUNSET,
  SHABBAT_EXIT_MINUTES_AFTER_SUNSET,
} from "../../src/lib/quiet-hours";
import { composeReport, lineFromTrend } from "../../src/lib/monthly-report";
import type { TrendPoint } from "../../src/lib/valuation";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

const il = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: "Asia/Jerusalem", hour12: false });

/** השעה בישראל כמספר עשרוני, לבדיקות טווח. */
function ilHour(d: Date): number {
  const { hour, minute } = jerusalemParts(d);
  return hour + minute / 60;
}

/* --- שקיעה ---------------------------------------------------------------- */

console.log("שקיעה בירושלים\n");

/*
 * ערכי ייחוס מלוחות אסטרונומיים לירושלים. הסטייה המותרת היא שתי דקות:
 * האלגוריתם מתעלם ממשוואת הזמן ברמת דיוק של שניות ומגובה פני הים,
 * ושני אלה שווים יחד לפחות מדקה.
 */
const SUNSETS: [string, number][] = [
  ["2026-01-09", 16.88], // ~16:53
  ["2026-04-10", 19.07], // ~19:04
  ["2026-07-10", 19.79], // ~19:47
  ["2026-10-09", 18.24], // ~18:14
];

for (const [iso, expected] of SUNSETS) {
  const actual = ilHour(sunsetUtc(new Date(`${iso}T12:00:00Z`)));
  check(
    Math.abs(actual - expected) < 0.05,
    `${iso} — שקיעה סבירה`,
    `${il(sunsetUtc(new Date(`${iso}T12:00:00Z`)))}`,
  );
}

/*
 * הבדיקה שמגלה את הענף ההפוך: שקיעה בישראל היא תמיד אחרי הצהריים
 * בשעון מקומי. "שקיעה" ב-06:40 עוברת כל בדיקת סוג ונופלת כאן.
 */
for (let day = 1; day <= 365; day += 7) {
  const d = new Date(Date.UTC(2026, 0, day, 12));
  const hour = ilHour(sunsetUtc(d));
  if (hour < 16 || hour > 20.5) {
    check(false, `שקיעה מחוץ לטווח האפשרי ביום ${day}`, il(sunsetUtc(d)));
  }
}
check(true, "שקיעה נופלת בין 16:00 ל-20:30 בכל השנה");

/* --- לילה ----------------------------------------------------------------- */

console.log("\nחלון הלילה\n");

// יום שני, כדי שהשבת לא תתערב
const monday = "2026-07-13";
const nightCases: [string, boolean][] = [
  [`${monday}T09:00:00Z`, false], // 12:00
  [`${monday}T16:00:00Z`, false], // 19:00
  [`${monday}T19:30:00Z`, true], // 22:30
  [`${monday}T23:00:00Z`, true], // 02:00 למחרת
  [`${monday}T03:00:00Z`, true], // 06:00
  [`${monday}T04:30:00Z`, false], // 07:30
];

for (const [iso, quiet] of nightCases) {
  const d = new Date(iso);
  check(isQuiet(d) === quiet, `${il(d)} — ${quiet ? "שקט" : "מותר"}`);
}

const atNight = new Date(`${monday}T23:00:00Z`);
const afterNight = nextAllowedTime(atNight);
check(
  jerusalemParts(afterNight).hour === 7 && jerusalemParts(afterNight).minute === 0,
  "היציאה מהלילה היא 07:00 בדיוק",
  il(afterNight),
);

/* --- שבת ------------------------------------------------------------------ */

console.log("\nחלון השבת\n");

for (const friday of ["2026-01-09", "2026-07-10"]) {
  const sunsetFri = sunsetUtc(new Date(`${friday}T12:00:00Z`));
  const entry = new Date(sunsetFri.getTime() - SHABBAT_ENTRY_MINUTES_BEFORE_SUNSET * 60_000);

  const before = new Date(entry.getTime() - 30 * 60_000);
  const after = new Date(entry.getTime() + 30 * 60_000);

  // חצי שעה לפני הכניסה עדיין מותר, אלא אם זה כבר הלילה (לא המקרה כאן)
  check(!isQuiet(before), `${friday} — חצי שעה לפני כניסת שבת עדיין מותר`, il(before));
  check(isQuiet(after), `${friday} — אחרי כניסת השבת שקט`, il(after));

  const saturday = new Date(new Date(`${friday}T12:00:00Z`).getTime() + 86_400_000);
  const exit = new Date(
    sunsetUtc(saturday).getTime() + SHABBAT_EXIT_MINUTES_AFTER_SUNSET * 60_000,
  );

  check(
    isQuiet(new Date(exit.getTime() - 60 * 60_000)),
    `${friday} — שעה לפני צאת השבת עדיין שקט`,
  );

  // השבת מסתיימת ביציאה; אחריה מותר, אלא אם בקיץ כבר נכנס הלילה
  const justAfter = new Date(exit.getTime() + 5 * 60_000);
  const nightAlready = ilHour(justAfter) >= 22;
  check(
    isQuiet(justAfter) === nightAlready,
    `${friday} — מיד אחרי צאת השבת ${nightAlready ? "הלילה כבר התחיל" : "מותר"}`,
    il(justAfter),
  );

  // מתוך השבת, הרגע המותר הבא אינו לפני צאתה
  const midShabbat = new Date(`${friday}T12:00:00Z`).getTime() + 86_400_000 + 3 * 3600_000;
  const allowed = nextAllowedTime(new Date(midShabbat));
  check(
    allowed.getTime() >= exit.getTime(),
    `${friday} — מתוך השבת, הרגע המותר אינו לפני צאתה`,
    il(allowed),
  );
}

/* --- המשכיות -------------------------------------------------------------- */

console.log("\nהמשכיות\n");

/*
 * `nextAllowedTime` חייבת להחזיר רגע מותר בכל קלט. הלולאה שבתוכה
 * מוגבלת לשמונה סיבובים, ואם חלון לילה וחלון שבת ישתלבו בצורה שלא
 * נצפתה — התוצאה תהיה רגע שעדיין שקט. הבדיקה עוברת על שנה שלמה בקפיצות
 * של שלוש שעות.
 */
let stillQuiet = 0;
let moved = 0;
for (let h = 0; h < 365 * 8; h++) {
  const at = new Date(Date.UTC(2026, 0, 1) + h * 3 * 3600_000);
  const allowed = nextAllowedTime(at);
  if (isQuiet(allowed)) stillQuiet++;
  if (allowed.getTime() !== at.getTime()) moved++;
  if (allowed.getTime() < at.getTime()) {
    check(false, "הרגע המותר לעולם אינו לפני נקודת המוצא", il(at));
    break;
  }
}
check(stillQuiet === 0, "כל תוצאה של nextAllowedTime היא רגע מותר", `${stillQuiet} חריגות`);
check(moved > 0 && moved < 365 * 8, "חלק מהרגעים נדחים וחלק לא", `${moved} נדחו`);

/* --- הדוח החודשי ---------------------------------------------------------- */

console.log("\nהדוח החודשי\n");

const point = (month: string, median: number): TrendPoint => ({
  month,
  label: month,
  median,
  sample: 20,
});

check(
  lineFromTrend("טויוטה קורולה", [point("2026-01", 100), point("2026-02", 110)]) === null,
  "שתי נקודות אינן מגמה, ואין שורה בדוח",
);

const line = lineFromTrend("טויוטה קורולה", [
  point("2026-01", 100_000),
  point("2026-02", 105_000),
  point("2026-03", 110_000),
]);
check(line?.changePct === 10, "שינוי באחוזים מחושב מהנקודה הראשונה לאחרונה", `${line?.changePct}%`);
check(line?.median === 110_000, "החציון המדווח הוא של החודש האחרון");

check(composeReport([]) === null, "בלי שורות — אין דוח, ולא מייל ריק");
const report = composeReport([line!]);
check(
  Boolean(report && report.body.includes("עלה") && report.body.includes("10%")),
  "הדוח מנסח כיוון ועוצמה",
  report?.body,
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות שעות השקט והדוח החודשי עברו");
