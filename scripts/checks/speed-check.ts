/**
 * בדיקות זמן למכירה.
 *   npm run check:speed
 *
 * שני חלקים: ההיגיון הטהור (איזה רבעון, כמה ימים זה עולה) נבדק על
 * עקומות סינתטיות, והשאילתה עצמה נבדקת מול המסד — כי מה שיכול להישבר
 * בה הוא ה-SQL, ואותו אי אפשר לבדוק בלי Postgres.
 */
import { PrismaClient } from "@prisma/client";

import {
  bandForPrice,
  daysCostOfPrice,
  speedCurveFor,
  MIN_SOLD,
  type TimeToSale,
} from "../../src/lib/time-to-sale";

const prisma = new PrismaClient();

let failed = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/** עקומה סינתטית: ככל שהמחיר עולה, המכירה איטית יותר. */
const CURVE: TimeToSale = {
  categoryId: "synthetic",
  sample: 40,
  overallMedianDays: 20,
  bands: [
    { quartile: 1, minPrice: 10_000, maxPrice: 49_999, medianDays: 6, sold: 12 },
    { quartile: 2, minPrice: 50_000, maxPrice: 89_999, medianDays: 14, sold: 10 },
    { quartile: 3, minPrice: 90_000, maxPrice: 129_999, medianDays: 26, sold: 10 },
    { quartile: 4, minPrice: 130_000, maxPrice: 200_000, medianDays: 46, sold: 8 },
  ],
};

async function main() {
  console.log("שיוך מחיר לרבעון\n");

  check(bandForPrice(CURVE, 30_000)?.quartile === 1, "מחיר נמוך → רבעון 1");
  check(bandForPrice(CURVE, 100_000)?.quartile === 3, "מחיר באמצע → רבעון 3");
  check(bandForPrice(CURVE, 150_000)?.quartile === 4, "מחיר גבוה → רבעון 4");

  /*
   * מחיר מחוץ לטווח נופל אל הקצה ואינו מחזיר null.
   * מוכר שמבקש פי שניים מהמחיר הגבוה ביותר שנמכר עדיין מקבל תשובה,
   * והיא שמרנית — וזה הכיוון הנכון לטעות בו.
   */
  check(bandForPrice(CURVE, 500)?.quartile === 1, "מתחת לכל טווח → הרבעון הזול");
  check(bandForPrice(CURVE, 9_000_000)?.quartile === 4, "מעל כל טווח → הרבעון היקר");

  console.log("\nמה עולה המחיר בימים\n");

  check(daysCostOfPrice(CURVE, 30_000) === null, "הרבעון המהיר לא עולה כלום", "אין מה להציע");
  check(daysCostOfPrice(CURVE, 100_000) === 20, "רבעון 3 עולה 20 ימי המתנה", "26 פחות 6");
  check(daysCostOfPrice(CURVE, 150_000) === 40, "רבעון 4 עולה 40 ימי המתנה");

  /*
   * הפרש קטן אינו מוצג. הפרש של יום-יומיים בין רבעונים הוא רעש,
   * ולהציג אותו כעצה זה ללמד את המוכר להתעלם מהמסך.
   */
  const flat: TimeToSale = {
    ...CURVE,
    bands: CURVE.bands.map((b) => ({ ...b, medianDays: 10 + b.quartile })),
  };
  check(daysCostOfPrice(flat, 100_000) === null, "הפרש של יומיים נבלע כרעש", "פחות מ-3 ימים");
  check(daysCostOfPrice(flat, 150_000) === 3, "הפרש של שלושה ימים כבר מוצג");

  console.log("\nהשאילתה מול המסד\n");

  const withSales = await prisma.$queryRaw<{ id: string; n: bigint }[]>`
    SELECT "categoryId" AS id, COUNT(*) AS n
    FROM "Listing"
    WHERE status = 'SOLD' AND "soldAt" IS NOT NULL
    GROUP BY "categoryId"
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `;

  const top = withSales[0];
  if (!top || Number(top.n) < MIN_SOLD) {
    console.log("… אין קטגוריה עם מספיק מכירות במסד הזה — מדלג על בדיקת השאילתה");
  } else {
    const curve = await speedCurveFor(top.id);
    check(curve !== null, "עקומה מוחזרת לקטגוריה עם מכירות", `${top.n} מכירות`);

    if (curve) {
      check(curve.bands.length === 4, "ארבעה רבעונים", `${curve.bands.length}`);
      check(
        curve.bands.every((b) => b.medianDays >= 1),
        "אין רבעון עם אפס ימים",
        "הפרש שלילי או אפס הוא נתון שבור",
      );
      check(
        curve.bands.every((b, i, all) => i === 0 || b.minPrice >= all[i - 1]!.minPrice),
        "הרבעונים ממוינים לפי מחיר עולה",
      );
      check(
        curve.sample === curve.bands.reduce((s, b) => s + b.sold, 0),
        "המדגם שווה לסכום הרבעונים",
        `${curve.sample}`,
      );
    }
  }

  /*
   * הכלל שחוזר בכל הפרויקט: מתחת למדגם — אין תשובה.
   * קטגוריה בלי מכירות כלל חייבת להחזיר null ולא עקומה של אפסים.
   */
  const empty = await speedCurveFor("category-that-does-not-exist");
  check(empty === null, "קטגוריה בלי מכירות מחזירה null", "לא ממציאים מספר");
}

main()
  .catch((err) => {
    console.error(err);
    failed++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failed) {
      console.error(`\n${failed} בדיקות נכשלו`);
      process.exit(1);
    }
    console.log("\nכל בדיקות זמן המכירה עברו");
  });
