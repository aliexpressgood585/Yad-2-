import { prisma } from "@/lib/db";

/**
 * זמן למכירה — כמה זמן ייקח למכור, ומה המחיר עושה למספר הזה.
 *
 * ## למה זה קיים
 *
 * מוכר ששואל "מה המחיר הנכון?" לא באמת שואל על מחיר. הוא שואל
 * **כמה זה יעלה לו לחכות.** מדד המחיר עונה "אתה 12% מתחת לחציון",
 * וזו תשובה נכונה שלא מכריעה כלום — 12% מתחת לחציון זה טוב או רע
 * תלוי אם הוא ממהר או לא.
 *
 * הרכיב הזה עונה על השאלה האמיתית: **במחיר X תמכור בערך תוך N ימים,
 * ובמחיר Y תוך M ימים.** זו ההכרעה, ואף לוח בישראל לא נותן אותה.
 *
 * ## איך
 *
 * המודעות שנמכרו באותה קטגוריה מחולקות לארבעה רבעוני מחיר, ולכל
 * רבעון מחושב חציון הימים מפרסום עד מכירה. התוצאה היא עקומה של
 * מחיר מול מהירות, ולא מספר אחד.
 *
 * חציון ולא ממוצע: מודעה אחת ששכבה שנה מזיזה ממוצע בעשרות ימים.
 *
 * ## מה הרכיב הזה מסרב לעשות
 *
 * **לא מציג מספר בלי מדגם.** אותה משמעת כמו במדד המחיר: מתחת ל-
 * `MIN_SOLD` מודעות שנמכרו, אין תשובה — לא הערכה זהירה ולא טווח רחב.
 * מוכר שיקבל "בערך 20 יום" ויחכה 90 לא יחזור.
 */

/** מתחת לזה אין תשובה. אותו סף כמו במדד המחיר, ומאותו טעם. */
export const MIN_SOLD = 8;

/** אין טעם ללמוד ממכירות מלפני שנתיים; השוק זז. */
const LOOKBACK_DAYS = 540;

export type SpeedBand = {
  /** 1–4, מהזול ליקר */
  quartile: number;
  minPrice: number;
  maxPrice: number;
  /** חציון הימים מפרסום עד מכירה ברבעון הזה */
  medianDays: number;
  sold: number;
};

export type TimeToSale = {
  categoryId: string;
  /** כמה מודעות שנמכרו נכנסו לחישוב */
  sample: number;
  /** חציון הימים בכל הקטגוריה, בלי קשר למחיר */
  overallMedianDays: number;
  bands: SpeedBand[];
};

/**
 * עקומת המחיר-מהירות לקטגוריה.
 *
 * שאילתה אחת. `NTILE(4)` מחלק לרבעונים ו-`PERCENTILE_CONT` מחזיר את
 * החציון בכל אחד — שניהם בצד המסד, כי משיכת כל המכירות ל-JS בשביל
 * לחשב חציון היא בדיוק הדבר שמתחיל להכאיב כשהלוח גדל.
 */
export async function speedCurveFor(categoryId: string): Promise<TimeToSale | null> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const rows = await prisma.$queryRaw<
    {
      quartile: number;
      min_price: number;
      max_price: number;
      median_days: number;
      sold: bigint;
    }[]
  >`
    WITH sold AS (
      SELECT
        price,
        EXTRACT(EPOCH FROM ("soldAt" - "publishedAt")) / 86400 AS days
      FROM "Listing"
      WHERE "categoryId" = ${categoryId}
        AND status = 'SOLD'
        AND "soldAt" IS NOT NULL
        AND "publishedAt" IS NOT NULL
        AND "soldAt" > "publishedAt"
        AND "soldAt" >= ${since}
        AND "deletedAt" IS NULL
        AND price IS NOT NULL
    ),
    banded AS (
      SELECT price, days, NTILE(4) OVER (ORDER BY price) AS quartile
      FROM sold
    )
    SELECT
      quartile::int                                           AS quartile,
      MIN(price)::int                                          AS min_price,
      MAX(price)::int                                          AS max_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::float AS median_days,
      COUNT(*)                                                 AS sold
    FROM banded
    GROUP BY quartile
    ORDER BY quartile
  `;

  const sample = rows.reduce((sum, r) => sum + Number(r.sold), 0);
  if (sample < MIN_SOLD) return null;

  const bands: SpeedBand[] = rows.map((r) => ({
    quartile: r.quartile,
    minPrice: r.min_price,
    maxPrice: r.max_price,
    medianDays: Math.max(1, Math.round(r.median_days)),
    sold: Number(r.sold),
  }));

  return {
    categoryId,
    sample,
    overallMedianDays: medianOf(bands.map((b) => b.medianDays)),
    bands,
  };
}

/**
 * הרבעון שאליו נופל מחיר נתון.
 *
 * מחיר מתחת לרבעון הזול או מעל ליקר נופל אל הקצה ולא מוחזר `null` —
 * מוכר שמבקש פי שניים מהמחיר הגבוה ביותר שנמכר עדיין מקבל תשובה,
 * והתשובה היא זמן המכירה של הרבעון היקר. היא שמרנית מדי, וזה הכיוון
 * הנכון לטעות בו.
 */
export function bandForPrice(curve: TimeToSale, price: number): SpeedBand | null {
  if (!curve.bands.length) return null;

  const hit = curve.bands.find((b) => price >= b.minPrice && price <= b.maxPrice);
  if (hit) return hit;

  const first = curve.bands[0]!;
  const last = curve.bands[curve.bands.length - 1]!;
  return price < first.minPrice ? first : last;
}

/**
 * מה עולה להעלות את המחיר — בימים.
 *
 * זה המספר שמכריע בפועל. "המחיר שלך גבוה" הוא משפט שאפשר להתווכח
 * איתו; "המחיר שלך מוסיף 22 ימי המתנה" הוא עובדה שאפשר להחליט לפיה.
 *
 * `null` כשאין הפרש משמעותי — הפרש של יום-יומיים בין רבעונים הוא
 * רעש, ולהציג אותו כעצה זה ללמד את המוכר להתעלם מהמסך.
 */
export function daysCostOfPrice(curve: TimeToSale, price: number): number | null {
  const band = bandForPrice(curve, price);
  if (!band) return null;

  const fastest = Math.min(...curve.bands.map((b) => b.medianDays));
  const cost = band.medianDays - fastest;
  return cost >= 3 ? cost : null;
}

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}
