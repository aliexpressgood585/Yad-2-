/**
 * בדיקות מדד המחירים.
 *   npm run check:valuation
 *
 * מקבע את שלושת הכללים שמדד המחירים עומד עליהם:
 *   1. מתחת לגודל המדגם המזערי לא מוחזר מספר — בשום מסלול.
 *   2. סולם ההרפיה בוחר את השלב המחמיר ביותר שיש בו מספיק מודעות,
 *      ומדווח בדיוק מה הוסר.
 *   3. האחוזונים מחושבים כמו ב-Postgres, כדי שאותה קבוצת מודעות תיתן
 *      אותו חציון בדף המודעה ובדף השווי.
 */
import { MIN_SAMPLE } from "../../src/lib/price-meter";
import {
  percentile,
  pickStep,
  realEstateSteps,
  summarizePrices,
  toTrendPoints,
  vehicleSteps,
  type RealEstateComparable,
  type VehicleComparable,
} from "../../src/lib/valuation";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/* --- 1. אחוזונים ---------------------------------------------------------- */

console.log("אחוזונים\n");

// אותם ערכים שמחזירה percentile_cont של Postgres עבור 1..10
check(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5) === 5.5, "חציון של 10 ערכים = 5.5");
check(percentile([1, 2, 3, 4, 5], 0.25) === 2, "אחוזון 25 של 5 ערכים = 2");
check(percentile([10], 0.5) === 10, "ערך יחיד");
check(percentile([], 0.5) === 0, "רשימה ריקה לא זורקת");

/* --- 2. גודל מדגם מזערי --------------------------------------------------- */

console.log("\nגודל מדגם מזערי\n");

const seven = Array.from({ length: MIN_SAMPLE - 1 }, (_, i) => 100 + i);
const eight = Array.from({ length: MIN_SAMPLE }, (_, i) => 100 + i);

check(summarizePrices(seven) === null, `${MIN_SAMPLE - 1} מודעות → אין נתון`);
check(summarizePrices(eight) !== null, `${MIN_SAMPLE} מודעות → יש נתון`);
check(
  summarizePrices([0, -5, ...eight.slice(0, 3)]) === null,
  "מחירים לא חוקיים אינם נספרים במדגם",
);

const summary = summarizePrices([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])!;
check(summary.sample === 10, "גודל מדגם", `sample=${summary.sample}`);
check(summary.median === 550, "חציון", `median=${summary.median}`);
check(summary.min === 100 && summary.max === 1000, "טווח");
check(
  summary.buckets.reduce((s, b) => s + b.count, 0) === 10,
  "סכום תאי ההיסטוגרמה שווה לגודל המדגם",
);
check(
  summary.buckets[summary.buckets.length - 1]!.count >= 1,
  "המחיר הגבוה ביותר נופל בתא האחרון ולא מחוץ להיסטוגרמה",
);

/* --- 3. סולם ההרפיה — רכב ------------------------------------------------- */

console.log("\nסולם ההרפיה — רכב\n");

function car(over: Partial<VehicleComparable>): VehicleComparable {
  return {
    id: Math.random().toString(36).slice(2),
    slug: "s",
    title: "t",
    price: 100_000,
    city: "חיפה",
    publishedAt: null,
    model: "קורולה",
    year: 2018,
    hand: 2,
    km: 80_000,
    ...over,
  };
}

// עשר מודעות מדויקות → השלב הראשון תופס, שום קריטריון לא מוסר
const exact = Array.from({ length: 10 }, (_, i) => car({ price: 90_000 + i * 1000 }));
const strict = pickStep(exact, vehicleSteps({
  manufacturer: "טויוטה",
  model: "קורולה",
  year: 2018,
  hand: 2,
  km: 80_000,
}));
check(strict.summary !== null, "התאמה מדויקת מחזירה נתון");
check(strict.dropped.length === 0, "לא הוסר שום קריטריון", `criteria=${strict.criteria.length}`);
check(strict.criteria.some((c) => c.label === "קילומטראז'"), "הקילומטראז' מופיע בקריטריונים");

// אותן מודעות אבל עם ק"מ רחוק → הק"מ מוסר, והמשתמש מקבל על כך דיווח
const farKm = Array.from({ length: 10 }, (_, i) => car({ price: 90_000 + i * 1000, km: 300_000 }));
const relaxed = pickStep(farKm, vehicleSteps({
  manufacturer: "טויוטה",
  model: "קורולה",
  year: 2018,
  hand: 2,
  km: 80_000,
}));
check(relaxed.summary !== null, "הרפיה מגיעה לגודל מדגם");
check(relaxed.dropped.includes("קילומטראז'"), "ההסרה מדווחת", `dropped=${relaxed.dropped.join(", ")}`);
check(
  !relaxed.criteria.some((c) => c.label === "קילומטראז'"),
  "קריטריון שהוסר אינו מוצג ככזה שנכלל בהשוואה",
);

// שבע מודעות בלבד בכל הסולם → אין מספר בכלל
const tooFew = Array.from({ length: MIN_SAMPLE - 1 }, () => car({}));
const none = pickStep(tooFew, vehicleSteps({ manufacturer: "טויוטה", model: "קורולה", year: 2018 }));
check(none.summary === null, "כל הסולם מתחת למינימום → אין נתון");
check(none.sample === MIN_SAMPLE - 1, "גודל המדגם שנמצא מדווח", `sample=${none.sample}`);

// שנת ייצור רחוקה: 2018 מול צי מ-2010 → גם אחרי ±3 אין התאמה,
// והשלב שנבחר מוותר על השנה ומדווח על כך
const oldFleet = Array.from({ length: 12 }, (_, i) => car({ year: 2010, price: 40_000 + i * 500 }));
const yearDropped = pickStep(oldFleet, vehicleSteps({
  manufacturer: "טויוטה",
  model: "קורולה",
  year: 2018,
}));
check(yearDropped.summary !== null, "ויתור על השנה מגיע לגודל מדגם");
check(yearDropped.dropped.includes("שנת ייצור"), "ויתור על השנה מדווח");

// אין דגם → אין קריטריון דגם ואין דיווח על הסרה
const noModel = pickStep(exact, vehicleSteps({ manufacturer: "טויוטה", year: 2018 }));
check(
  !noModel.dropped.includes("דגם"),
  "מה שהמשתמש לא מסר אינו מדווח כ\"הוסר\"",
  `dropped=[${noModel.dropped.join(", ")}]`,
);

/* --- 4. סולם ההרפיה — נדל"ן ----------------------------------------------- */

console.log("\nסולם ההרפיה — נדל\"ן\n");

function flat(over: Partial<RealEstateComparable>): RealEstateComparable {
  return {
    id: Math.random().toString(36).slice(2),
    slug: "s",
    title: "t",
    price: 2_000_000,
    city: "חיפה",
    neighborhood: "הדר",
    publishedAt: null,
    rooms: 3,
    size: 80,
    ...over,
  };
}

const sameHood = Array.from({ length: 9 }, (_, i) => flat({ price: 1_900_000 + i * 10_000 }));
const hoodStep = pickStep(sameHood, realEstateSteps({
  deal: "sale",
  city: "חיפה",
  neighborhood: "הדר",
  rooms: 3,
  size: 80,
}));
check(hoodStep.summary !== null, "התאמה בשכונה מחזירה נתון");
check(hoodStep.criteria.some((c) => c.label === "שכונה"), "השכונה נכללת בהשוואה");
check(hoodStep.criteria[0]!.label === "עיר", "העיר תמיד ראשונה בקריטריונים");

// אותה עיר, שכונות אחרות → השכונה מוסרת, החדרים נשמרים
const otherHoods = Array.from({ length: 9 }, (_, i) =>
  flat({ neighborhood: "כרמל", price: 2_400_000 + i * 10_000 }),
);
const cityStep = pickStep(otherHoods, realEstateSteps({
  deal: "sale",
  city: "חיפה",
  neighborhood: "הדר",
  rooms: 3,
  size: 80,
}));
check(cityStep.summary !== null, "הרפיה לרמת עיר מחזירה נתון");
check(cityStep.dropped.includes("שכונה"), "הסרת השכונה מדווחת");
check(
  cityStep.criteria.some((c) => c.label === "חדרים"),
  "החדרים נשמרים כשהשכונה מוסרת — הם מגדירים את המוצר",
);

/* --- 5. מגמה חודשית ------------------------------------------------------- */

console.log("\nמגמה חודשית\n");

const points = toTrendPoints([
  { month: new Date("2026-01-01"), median: 100, sample: 3 },
  { month: new Date("2026-02-01"), median: 110, sample: 20 },
  { month: new Date("2026-03-01"), median: null, sample: 0 },
  { month: new Date("2026-04-01"), median: 120.4, sample: MIN_SAMPLE },
]);
check(points.length === 2, "חודשים דלילים אינם נקודות בגרף", `points=${points.length}`);
check(points[0]!.month === "2026-02", "מפתח החודש");
check(points[1]!.median === 120, "החציון מעוגל");
check(points[0]!.label.includes("פברואר"), "תווית החודש בעברית", points[0]!.label);

/* -------------------------------------------------------------------------- */

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות מדד המחירים עברו");
