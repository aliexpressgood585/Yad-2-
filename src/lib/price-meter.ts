import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { COHORT_TIERS, MIN_SAMPLE } from "@/lib/price-cohort";

/**
 * מד המחיר — איפה המחיר של מודעה יושב ביחס למודעות **הדומות לה באמת**.
 *
 * למה זה קיים: בלוח מודעות המחיר לבדו חסר משמעות. "₪27,000" הוא זול או
 * יקר רק ביחס לרכבים דומים, וזה בדיוק המידע שקונה מחפש ואין לו.
 *
 * הגדרת "דומה" יושבת ב-`@/lib/price-cohort` ולא כאן — שם גם ההסבר למה
 * ההשוואה מול תת-הקטגוריה כולה הייתה שגויה מיסודה.
 *
 * שני כללי ברזל:
 * 1. מתחת ל-`MIN_SAMPLE` בכל שלבי ההרפיה — לא מוחזר כלום והרכיב לא
 *    מוצג. עדיף בלי נתון מאשר נתון שמומצא מתוך שלוש מודעות.
 * 2. **גודל המדגם מוצג תמיד לצד המספר.** מד שלא אומר על כמה מודעות הוא
 *    מבוסס הוא מד שאי אפשר לבדוק, וזה גם מה שמסתיר באגים בקוהורט.
 */

export { MIN_SAMPLE };

/** כמה מכל קצה מקוצץ לפני חישוב החציון. */
const TRIM = 0.05;

export type PriceMeter = {
  /** 0–1: איפה המחיר יושב בהתפלגות המודעות הדומות */
  percentile: number;
  median: number;
  /** כמה מודעות השתתפו בהשוואה */
  sample: number;
  /** אחוז סטייה מהחציון. שלילי = זול יותר. */
  deltaPct: number;
  /** באיזה שלב הרפיה נמצא המדגם. 1 = הקוהורט ההדוק ביותר. */
  tier: number;
};

/** היסטוגרמה מורחבת לדף המודעה. */
export type PriceDistribution = PriceMeter & {
  min: number;
  max: number;
  p25: number;
  p75: number;
  /** עשרה תאים בגובה יחסי, לציור ההיסטוגרמה */
  buckets: { from: number; to: number; count: number }[];
};

type MeterRow = {
  id: string;
  price: number | null;
  sample: bigint | number | null;
  median: number | null;
  percentile: number | null;
  tier: number | null;
};

/**
 * ביטוי SQL שמחזיר את הסטייה המותרת בשלב מסוים, לפי קטגוריית השורש.
 *
 * נבנה מ-`COHORT_TIERS` ולא נכתב ידנית ב-SQL, כדי ששינוי בהגדרת
 * הקוהורט ישנה גם את השאילתה. שני מקורות אמת לאותו מספר היו מבטיחים
 * שהם ייפרדו.
 */
function tierValue(tier: number, field: "band" | "band2Pct"): Prisma.Sql {
  const arms = Object.entries(COHORT_TIERS)
    .map(([slug, tiers]) => {
      const value = tiers[tier - 1]?.[field] ?? null;
      return value === null ? null : Prisma.sql`WHEN ${slug} THEN ${value}::float`;
    })
    .filter((x): x is Prisma.Sql => x !== null);

  if (!arms.length) return Prisma.sql`NULL::float`;
  return Prisma.sql`CASE t.root_slug ${Prisma.join(arms, " ")} ELSE NULL END`;
}

/** האם השלב משתמש במפתח המורחב. */
function tierUsesBroad(tier: number): Prisma.Sql {
  const slugs = Object.entries(COHORT_TIERS)
    .filter(([, tiers]) => tiers[tier - 1]?.broad)
    .map(([slug]) => slug);
  if (!slugs.length) return Prisma.sql`FALSE`;
  return Prisma.sql`t.root_slug IN (${Prisma.join(slugs.map((s) => Prisma.sql`${s}`), ", ")})`;
}

/** תנאי ההתאמה של שלב אחד. */
function tierMatch(tier: number): Prisma.Sql {
  const keyMatch = Prisma.sql`
    CASE WHEN ${tierUsesBroad(tier)}
      THEN t.key_broad IS NOT NULL AND peer."cohortKeyBroad" = t.key_broad
      ELSE peer."cohortKey" = t.key
    END`;

  /*
   * הסטייה נבדקת רק כשהיא מוגדרת גם לשלב וגם למודעה. מודעה בלי ק"מ
   * לא נופלת מהשלב הראשון בגלל זה — היא פשוט מושווית בלעדיו, וזה
   * המצב הנכון: אין סיבה להעניש מודעה על שדה שאינו חובה.
   */
  const band = Prisma.sql`(
    ${tierValue(tier, "band")} IS NULL OR t.band IS NULL
    OR (peer."comparableBand" IS NOT NULL
        AND abs(peer."comparableBand" - t.band) <= ${tierValue(tier, "band")})
  )`;

  const band2 = Prisma.sql`(
    ${tierValue(tier, "band2Pct")} IS NULL OR t.band2 IS NULL
    OR (peer."comparableBand2" IS NOT NULL
        AND abs(peer."comparableBand2" - t.band2) <= t.band2 * ${tierValue(tier, "band2Pct")})
  )`;

  return Prisma.sql`(${keyMatch} AND ${band} AND ${band2})`;
}

/**
 * ה-CTE המשותף: המודעות שנבדקות, והזוגות שלהן עם כל מודעה מתאימה,
 * מתויגים בשלב ההרפיה ההדוק ביותר שהזוג עומד בו.
 *
 * `peer.id <> t.id` — מודעה אינה מודעה דומה לעצמה. הכללתה הייתה מזיזה
 * את האחוזון ומנפחת את גודל המדגם שמוצג למשתמש.
 */
function cohortPairs(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    target AS (
      SELECT l.id,
             l."categoryId",
             l.price::float           AS price,
             l."cohortKey"            AS key,
             l."cohortKeyBroad"       AS key_broad,
             l."comparableBand"       AS band,
             l."comparableBand2"      AS band2,
             COALESCE(root.slug, c.slug) AS root_slug
        FROM "Listing" l
        JOIN "Category" c ON c.id = l."categoryId"
        LEFT JOIN "Category" root ON root.id = c."parentId"
       WHERE ${where}
         AND l.price IS NOT NULL AND l.price > 0
         AND l."cohortKey" IS NOT NULL
    ),
    pairs AS (
      SELECT t.id AS target_id,
             t.price AS target_price,
             peer.price::float AS peer_price,
             CASE
               WHEN ${tierMatch(1)} THEN 1
               WHEN ${tierMatch(2)} THEN 2
               WHEN ${tierMatch(3)} THEN 3
               ELSE NULL
             END AS tier
        FROM target t
        JOIN "Listing" peer
          ON peer."categoryId" = t."categoryId"
         AND peer.id <> t.id
         AND peer.status = 'ACTIVE'
         AND peer."deletedAt" IS NULL
         AND peer.price IS NOT NULL AND peer.price > 0
         AND (peer."cohortKey" = t.key OR peer."cohortKeyBroad" = t.key_broad)
    ),
    tier_counts AS (
      SELECT target_id,
             count(*) FILTER (WHERE tier <= 1) AS c1,
             count(*) FILTER (WHERE tier <= 2) AS c2,
             count(*) FILTER (WHERE tier <= 3) AS c3
        FROM pairs WHERE tier IS NOT NULL GROUP BY target_id
    ),
    -- עוצרים בשלב הראשון שיש בו מספיק דגימות. אין שלב כזה = אין מד.
    chosen AS (
      SELECT target_id,
             CASE WHEN c1 >= ${MIN_SAMPLE} THEN 1
                  WHEN c2 >= ${MIN_SAMPLE} THEN 2
                  WHEN c3 >= ${MIN_SAMPLE} THEN 3
             END AS tier
        FROM tier_counts
    ),
    cohort AS (
      SELECT p.target_id, p.target_price, p.peer_price, ch.tier,
             /*
              * קיצוץ 5% מכל קצה לפני החציון — מודעת פיתיון ב-₪1 ומודעת
              * "מחיר לתיאום" ב-₪9,999,999 מזיזות ממוצע, ואת החציון הן
              * מזיזות פחות אבל עדיין. העיגול כלפי מטה פירושו שבמדגם קטן לא
              * מקצצים כלום: ב-8 מודעות 5% הוא פחות ממודעה אחת.
              */
             row_number() OVER (PARTITION BY p.target_id ORDER BY p.peer_price) AS rn,
             count(*)     OVER (PARTITION BY p.target_id) AS n
        FROM pairs p
        JOIN chosen ch ON ch.target_id = p.target_id
       WHERE ch.tier IS NOT NULL AND p.tier IS NOT NULL AND p.tier <= ch.tier
    )`;
}

const TRIMMED = Prisma.sql`rn > floor(n * ${TRIM}) AND rn <= n - floor(n * ${TRIM})`;

/**
 * מד מחיר לקבוצת מודעות, בשאילתה אחת.
 *
 * נקרא פעם אחת לכל עמוד תוצאות ולא פעם לכל כרטיס — 24 שאילתות נפרדות
 * היו הופכות את מד המחיר לפיצ'ר שמאט את הדף שהוא אמור לשפר.
 */
export async function priceMetersFor(listingIds: string[]): Promise<Map<string, PriceMeter>> {
  const result = new Map<string, PriceMeter>();
  if (!listingIds.length) return result;

  const rows = await prisma.$queryRaw<MeterRow[]>`
    WITH ${cohortPairs(Prisma.sql`l.id IN (${Prisma.join(listingIds)})`)}
    SELECT target_id AS id,
           max(target_price)::int AS price,
           max(tier)::int         AS tier,
           count(*)               AS sample,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY peer_price)
             FILTER (WHERE ${TRIMMED}) AS median,
           (count(*) FILTER (WHERE peer_price < target_price))::float / count(*) AS percentile
      FROM cohort
     GROUP BY target_id
  `;

  for (const row of rows) {
    const sample = Number(row.sample ?? 0);
    const median = row.median === null ? null : Number(row.median);
    const price = row.price;
    if (!median || price === null || sample < MIN_SAMPLE) continue;

    result.set(row.id, {
      percentile: Math.min(1, Math.max(0, Number(row.percentile ?? 0))),
      median: Math.round(median),
      sample,
      deltaPct: Math.round(((price - median) / median) * 100),
      tier: Number(row.tier ?? 1),
    });
  }

  return result;
}

/** התפלגות מלאה למודעה אחת — להיסטוגרמה בדף המודעה, מאותו קוהורט. */
export async function priceDistributionFor(listingId: string): Promise<PriceDistribution | null> {
  const base = (await priceMetersFor([listingId])).get(listingId);
  if (!base) return null;

  const [stats] = await prisma.$queryRaw<{ min: number; max: number; p25: number; p75: number }[]>`
    WITH ${cohortPairs(Prisma.sql`l.id = ${listingId}`)}
    SELECT min(peer_price) FILTER (WHERE ${TRIMMED})::int AS min,
           max(peer_price) FILTER (WHERE ${TRIMMED})::int AS max,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY peer_price)
             FILTER (WHERE ${TRIMMED}) AS p25,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY peer_price)
             FILTER (WHERE ${TRIMMED}) AS p75
      FROM cohort
  `;

  if (!stats || stats.min === null || stats.max === null) return null;

  const min = Number(stats.min);
  const max = Number(stats.max);
  const span = Math.max(1, max - min);
  const BUCKETS = 10;

  const counts = await prisma.$queryRaw<{ bucket: number; count: bigint }[]>`
    WITH ${cohortPairs(Prisma.sql`l.id = ${listingId}`)}
    -- Prisma שולח מספרי JS כ-bigint; בלי ההמרה ל-double אין חתימה
    -- מתאימה ל-width_bucket והשאילתה נופלת ב-42883
    SELECT width_bucket(peer_price, ${min}::float, ${max + 1}::float, ${BUCKETS}::int) AS bucket,
           count(*) AS count
      FROM cohort
     WHERE ${TRIMMED}
     GROUP BY 1 ORDER BY 1
  `;

  const byBucket = new Map(counts.map((c) => [Number(c.bucket), Number(c.count)]));

  return {
    ...base,
    min,
    max,
    p25: Math.round(Number(stats.p25)),
    p75: Math.round(Number(stats.p75)),
    buckets: Array.from({ length: BUCKETS }, (_, i) => ({
      from: Math.round(min + (span * i) / BUCKETS),
      to: Math.round(min + (span * (i + 1)) / BUCKETS),
      count: byBucket.get(i + 1) ?? 0,
    })),
  };
}
