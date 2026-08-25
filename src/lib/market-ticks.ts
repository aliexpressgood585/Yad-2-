import { unstable_cache } from "next/cache";

import { notDemo, prisma } from "@/lib/db";

/**
 * קריאות שוק לדף הבית — במקום סלוגן.
 *
 * "כל מה שצריך, במקום אחד נקי" יכול להופיע בכל אתר בעולם, וזה בדיוק
 * מה שהיה כתוב כאן. במקומו יושבות עכשיו שלוש-ארבע קריאות שנשלפות
 * מהמודעות הפעילות ברגע זה: חציון לדגם רכב מבוקש, חציון שכירות לדירת
 * 3 חדרים בעיר גדולה, כמה ימים לוקח למכור.
 *
 * זה גם הוכחת הערך של המוצר וגם הדבר היחיד בדף שמתחרה לא יכול להעתיק
 * בלי הנתונים עצמם.
 *
 * מתרענן כל שעה. הקריאות משתנות לאט, והדף הזה נטען הרבה.
 */

export type MarketTick = {
  /** הכותרת של הקריאה — מה נמדד */
  subject: string;
  /** המספר עצמו, כבר מעוצב */
  value: string;
  /** הקשר קצר: גודל המדגם או קריאה משלימה */
  note: string;
};

const MIN_SAMPLE = 8;
const ils = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

type ModelRow = { make: string; model: string; year: number; median: number; n: bigint };
type CityRow = { city: string; median: number; n: bigint };
type SpeedRow = { root: string; days: number; n: bigint };

async function load(): Promise<MarketTick[]> {
  const ticks: MarketTick[] = [];

  /*
   * רכב: הצירוף יצרן+דגם+שנה עם הכי הרבה מודעות פעילות. לא "הדגם
   * הפופולרי" באופן כללי — קריאה בלי שנה היא קריאה על שוק ולא על פריט,
   * ובדיוק זה מה שמייחד את הלוח.
   */
  /*
   * הדגם נשלף מ-`AttributeValue.label` ולא מ-`cohortKey`.
   *
   * הערך ב-`cohortKey` הוא המפתח, והוא משורשר ליצרן במכוון —
   * "טויוטה-קורולה" — כדי שדגם "3" של מאזדה לא יתנגש ב-"3" של
   * ב.מ.וו באותה קבוצת השוואה. אבל הצגה שלו כמו שהוא נותנת
   * "קיה קיה-ספורטג'", והיצרן מופיע פעמיים בשורה הראשונה שמשתמש
   * רואה בדף הבית. התווית היא מה שנועד להיקרא.
   */
  const [car] = await prisma.$queryRaw<ModelRow[]>`
    SELECT split_part(l."cohortKey", '|', 1) AS make,
           COALESCE(max(m.label), split_part(l."cohortKey", '|', 2)) AS model,
           l."comparableBand"::int AS year,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price)::int AS median,
           count(*) AS n
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
      LEFT JOIN "Category" p ON p.id = c."parentId"
      LEFT JOIN LATERAL (
        SELECT v.label
          FROM "ListingAttribute" la
          JOIN "Attribute" a ON a.id = la."attributeId" AND a.key = 'model'
          JOIN "AttributeValue" v ON v.id = la."valueId"
         WHERE la."listingId" = l.id
         LIMIT 1
      ) m ON true
     WHERE p.slug = 'vehicles'
       AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
       ${notDemo("l")}
       AND l.price > 0 AND l."cohortKey" IS NOT NULL AND l."comparableBand" IS NOT NULL
     GROUP BY split_part(l."cohortKey", '|', 1),
              split_part(l."cohortKey", '|', 2),
              l."comparableBand"
    HAVING count(*) >= ${MIN_SAMPLE}
     ORDER BY count(*) DESC
     LIMIT 1
  `;

  if (car) {
    ticks.push({
      subject: `${car.make} ${car.model} ${car.year}`,
      value: ils.format(car.median),
      note: `חציון ${Number(car.n)} מודעות פעילות`,
    });
  }

  /* נדל"ן להשכרה: העיר עם הכי הרבה דירות 3 חדרים פעילות. */
  const [rent] = await prisma.$queryRaw<CityRow[]>`
    SELECT l.city,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price)::int AS median,
           count(*) AS n
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
     WHERE c.slug = 'apartments-rent'
       AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
       ${notDemo("l")}
       AND l.price > 0 AND l."comparableBand" BETWEEN 3 AND 3.5
     GROUP BY 1
    HAVING count(*) >= ${MIN_SAMPLE}
     ORDER BY count(*) DESC
     LIMIT 1
  `;
  if (rent) {
    ticks.push({
      subject: `דירות 3 חדרים להשכרה ב${rent.city}`,
      value: `${ils.format(rent.median)} לחודש`,
      note: `חציון ${Number(rent.n)} מודעות פעילות`,
    });
  }

  /* מכירה: אותה שאלה בצד השני של השוק. */
  const [sale] = await prisma.$queryRaw<CityRow[]>`
    SELECT l.city,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price)::int AS median,
           count(*) AS n
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
     WHERE c.slug = 'apartments-sale'
       AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
       ${notDemo("l")}
       AND l.price > 0 AND l."comparableBand" BETWEEN 4 AND 4.5
     GROUP BY 1
    HAVING count(*) >= ${MIN_SAMPLE}
     ORDER BY count(*) DESC
     LIMIT 1
  `;
  if (sale) {
    ticks.push({
      subject: `דירות 4 חדרים למכירה ב${sale.city}`,
      value: ils.format(sale.median),
      note: `חציון ${Number(sale.n)} מודעות פעילות`,
    });
  }

  /*
   * זמן עד מכירה — הקריאה שהלוח היחיד שיכול לתת, כי היא נשענת על
   * מודעות שנסגרו כאן ולא על מחירון חיצוני.
   */
  const [speed] = await prisma.$queryRaw<SpeedRow[]>`
    SELECT COALESCE(p.slug, c.slug) AS root,
           percentile_cont(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (l."soldAt" - l."publishedAt")) / 86400
           )::int AS days,
           count(*) AS n
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
      LEFT JOIN "Category" p ON p.id = c."parentId"
     WHERE l."soldAt" IS NOT NULL AND l."publishedAt" IS NOT NULL
       AND l."soldAt" > l."publishedAt"
       ${notDemo("l")}
     GROUP BY 1
    HAVING count(*) >= ${MIN_SAMPLE}
     ORDER BY count(*) DESC
     LIMIT 1
  `;
  const ROOT_LABEL: Record<string, string> = {
    vehicles: "רכב",
    realestate: 'נדל"ן',
    "second-hand": "יד שנייה",
    pets: "בעלי חיים",
  };
  if (speed) {
    ticks.push({
      subject: `זמן עד מכירה — ${ROOT_LABEL[speed.root] ?? speed.root}`,
      value: `${speed.days} ימים`,
      note: `חציון ${Number(speed.n)} מודעות שנסגרו`,
    });
  }

  return ticks;
}

export const marketTicks = unstable_cache(load, ["market-ticks"], {
  revalidate: 3600,
  tags: ["market-ticks"],
});
