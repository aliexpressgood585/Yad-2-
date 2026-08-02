import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

/**
 * מד המחיר — איפה המחיר של מודעה יושב ביחס למודעות הדומות לה.
 *
 * למה זה קיים: בלוח מודעות המחיר לבדו חסר משמעות. "₪27,000" הוא זול או
 * יקר רק ביחס לרכבים דומים, וזה בדיוק המידע שקונה מחפש ואין לו.
 *
 * מה נחשב "דומה": אותה תת-קטגוריה, ואם לקטגוריה יש ערך השוואה
 * (`comparableBand` — שנת ייצור ברכב, מספר חדרים בנדל"ן) גם טווח קרוב
 * שלו. אזור נלקח בחשבון כשיש מספיק מודעות בו.
 *
 * כלל ברזל: מתחת ל-MIN_SAMPLE מודעות להשוואה לא מוחזר כלום, והרכיב
 * לא מוצג. עדיף בלי נתון מאשר נתון שמומצא מתוך שלוש מודעות.
 */

/** מתחת לזה אין מספיק בסיס להשוואה. */
export const MIN_SAMPLE = 8;

/** רוחב טווח ההשוואה סביב ערך המודעה, לפי קטגוריית השורש. */
const BAND_WIDTH: Record<string, number> = {
  vehicles: 3, // ±3 שנות ייצור
  realestate: 1, // ±חדר
};

export type PriceMeter = {
  /** 0–1: איפה המחיר יושב בהתפלגות המודעות הדומות */
  percentile: number;
  median: number;
  /** כמה מודעות השתתפו בהשוואה */
  sample: number;
  /** אחוז סטייה מהחציון. שלילי = זול יותר. */
  deltaPct: number;
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

type Row = {
  id: string;
  percentile: number | null;
  median: number | null;
  sample: bigint | number | null;
  price: number | null;
};

/** רוחב הטווח של קטגוריית שורש, או null אם אין השוואה לפי ערך. */
export function bandWidthFor(rootSlug: string | null | undefined): number | null {
  return rootSlug ? (BAND_WIDTH[rootSlug] ?? null) : null;
}

/** השדה הדינמי שממנו נגזר ערך ההשוואה, לפי קטגוריית השורש. */
const BAND_KEY: Record<string, string> = {
  vehicles: "year",
  realestate: "rooms",
};

/**
 * ערך ההשוואה של מודעה — מנורמל מהשדות הדינמיים לעמודה אחת.
 *
 * מחושב פעם אחת בכתיבה ולא בכל שאילתה: בלעדיו כל בדיקת מד מחיר הייתה
 * דורשת join אל ListingAttribute עבור כל מודעה שמושווית.
 */
export function comparableBandFor(
  rootSlug: string | null | undefined,
  attributes: Record<string, unknown>,
): number | null {
  const key = rootSlug ? BAND_KEY[rootSlug] : undefined;
  if (!key) return null;
  const raw = attributes[key];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * מד מחיר לקבוצת מודעות, בשאילתה אחת.
 *
 * נקרא פעם אחת לכל עמוד תוצאות ולא פעם לכל כרטיס — 24 שאילתות נפרדות
 * היו הופכות את מד המחיר לפיצ'ר שמאט את הדף שהוא אמור לשפר.
 */
export async function priceMetersFor(listingIds: string[]): Promise<Map<string, PriceMeter>> {
  const result = new Map<string, PriceMeter>();
  if (!listingIds.length) return result;

  const rows = await prisma.$queryRaw<Row[]>`
    WITH target AS (
      SELECT l.id, l."categoryId", l.price, l."comparableBand",
             COALESCE(root.slug, c.slug) AS root_slug
        FROM "Listing" l
        JOIN "Category" c ON c.id = l."categoryId"
        LEFT JOIN "Category" root ON root.id = c."parentId"
       WHERE l.id IN (${Prisma.join(listingIds)})
         AND l.price IS NOT NULL AND l.price > 0
    ),
    comparable AS (
      SELECT t.id AS target_id, t.price AS target_price, peer.price AS peer_price
        FROM target t
        JOIN "Listing" peer
          ON peer."categoryId" = t."categoryId"
         AND peer.status = 'ACTIVE'
         AND peer."deletedAt" IS NULL
         AND peer.price IS NOT NULL
         AND peer.price > 0
         -- טווח ההשוואה חל רק כששני הצדדים מוגדרים; אחרת משווים
         -- לכל הקטגוריה במקום לא להשוות בכלל
         AND (
              t."comparableBand" IS NULL
           OR peer."comparableBand" IS NULL
           OR abs(peer."comparableBand" - t."comparableBand") <=
              CASE t.root_slug WHEN 'vehicles' THEN 3 WHEN 'realestate' THEN 1 ELSE 1e9 END
         )
    )
    SELECT c.target_id AS id,
           max(c.target_price)::int AS price,
           count(*) AS sample,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY c.peer_price) AS median,
           -- שיעור המודעות הזולות מזו הנוכחית. target_price קבוע בתוך
           -- הקבוצה, ולכן מותר להשוות אליו ישירות בתוך FILTER.
           (count(*) FILTER (WHERE c.peer_price < c.target_price))::float
             / count(*) AS percentile
      FROM comparable c
     GROUP BY c.target_id
    HAVING count(*) >= ${MIN_SAMPLE}
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
    });
  }

  return result;
}

/** התפלגות מלאה למודעה אחת — להיסטוגרמה בדף המודעה. */
export async function priceDistributionFor(
  listingId: string,
): Promise<PriceDistribution | null> {
  const base = (await priceMetersFor([listingId])).get(listingId);
  if (!base) return null;

  const [stats] = await prisma.$queryRaw<
    { min: number; max: number; p25: number; p75: number }[]
  >`
    WITH target AS (
      SELECT l."categoryId", l."comparableBand",
             COALESCE(root.slug, c.slug) AS root_slug
        FROM "Listing" l
        JOIN "Category" c ON c.id = l."categoryId"
        LEFT JOIN "Category" root ON root.id = c."parentId"
       WHERE l.id = ${listingId}
    )
    SELECT min(peer.price)::int AS min,
           max(peer.price)::int AS max,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY peer.price) AS p25,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY peer.price) AS p75
      FROM target t
      JOIN "Listing" peer
        ON peer."categoryId" = t."categoryId"
       AND peer.status = 'ACTIVE'
       AND peer."deletedAt" IS NULL
       AND peer.price IS NOT NULL AND peer.price > 0
       AND (
            t."comparableBand" IS NULL
         OR peer."comparableBand" IS NULL
         OR abs(peer."comparableBand" - t."comparableBand") <=
            CASE t.root_slug WHEN 'vehicles' THEN 3 WHEN 'realestate' THEN 1 ELSE 1e9 END
       )
  `;

  if (!stats) return null;

  const min = Number(stats.min);
  const max = Number(stats.max);
  const span = Math.max(1, max - min);
  const BUCKETS = 10;

  const counts = await prisma.$queryRaw<{ bucket: number; count: bigint }[]>`
    WITH target AS (
      SELECT l."categoryId", l."comparableBand",
             COALESCE(root.slug, c.slug) AS root_slug
        FROM "Listing" l
        JOIN "Category" c ON c.id = l."categoryId"
        LEFT JOIN "Category" root ON root.id = c."parentId"
       WHERE l.id = ${listingId}
    )
    -- Prisma שולח מספרי JS כ-bigint; בלי ההמרה ל-double אין חתימה
    -- מתאימה ל-width_bucket והשאילתה נופלת ב-42883
    SELECT width_bucket(
             peer.price::float,
             ${min}::float,
             ${max + 1}::float,
             ${BUCKETS}::int
           ) AS bucket,
           count(*) AS count
      FROM target t
      JOIN "Listing" peer
        ON peer."categoryId" = t."categoryId"
       AND peer.status = 'ACTIVE'
       AND peer."deletedAt" IS NULL
       AND peer.price IS NOT NULL AND peer.price > 0
       AND (
            t."comparableBand" IS NULL
         OR peer."comparableBand" IS NULL
         OR abs(peer."comparableBand" - t."comparableBand") <=
            CASE t.root_slug WHEN 'vehicles' THEN 3 WHEN 'realestate' THEN 1 ELSE 1e9 END
       )
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
