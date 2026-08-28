import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { priceMetersFor, type PriceMeter } from "@/lib/price-meter";

/**
 * ביצועי המלאי של סוחר.
 *
 * הדשבורד עונה על שלוש שאלות שסוחר שואל בפועל, ולא על "כמה צפיות היו
 * לי החודש":
 *
 *   1. **מה עובד** — אילו מודעות מייצרות פניות, ובאיזה יחס.
 *   2. **מה תקוע** — מה יושב במלאי הכי הרבה זמן בלי פנייה אחת.
 *   3. **איפה המחיר שלי** — מול השוק, לפי אותה סקאלה שהקונה רואה.
 *
 * השלישית היא הסיבה שהדשבורד הזה שונה מכל דוח מלאי אחר: לסוחר יש כבר
 * מערכת שיודעת מה יש לו במלאי. מה שאין לו הוא איפה המחיר שלו יושב
 * ביחס למה שהקונה משווה אליו — וזה בדיוק מה שמדד המחירים של הלוח יודע.
 */

export type InventoryRow = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  status: string;
  publishedAt: Date | null;
  views: number;
  reveals: number;
  contacts: number;
  /** ימים באוויר */
  ageDays: number;
  /** מיקום המחיר בשוק. null = פחות מ-8 מודעות דומות. */
  meter: PriceMeter | null;
};

export type InventorySummary = {
  active: number;
  drafts: number;
  sold: number;
  views: number;
  reveals: number;
  contacts: number;
  /** מודעות פעילות שלא קיבלו אף פנייה ב-30 הימים האחרונים */
  silent: number;
  /** גיל חציוני של המלאי הפעיל, בימים */
  medianAgeDays: number;
};

type Scope = { businessId: string; userId?: string; deletedAt: null };

/** תנאי ה-SQL שמקביל ל-`inventoryScope` של Prisma. */
function scopeSql(scope: Scope): Prisma.Sql {
  return scope.userId
    ? Prisma.sql`l."businessId" = ${scope.businessId} AND l."userId" = ${scope.userId} AND l."deletedAt" IS NULL`
    : Prisma.sql`l."businessId" = ${scope.businessId} AND l."deletedAt" IS NULL`;
}

export async function inventorySummary(
  scope: Scope,
  days = 30,
): Promise<InventorySummary> {
  const since = new Date(Date.now() - days * 86_400_000);

  const [counts] = await prisma.$queryRaw<
    {
      active: bigint;
      drafts: bigint;
      sold: bigint;
      views: bigint;
      reveals: bigint;
      silent: bigint;
      median_age: number | null;
    }[]
  >`
    SELECT
      count(*) FILTER (WHERE l.status = 'ACTIVE')                          AS active,
      count(*) FILTER (WHERE l.status = 'DRAFT')                           AS drafts,
      count(*) FILTER (WHERE l.status = 'SOLD')                            AS sold,
      COALESCE(sum(s.views), 0)                                            AS views,
      COALESCE(sum(s.reveals), 0)                                          AS reveals,
      count(*) FILTER (
        WHERE l.status = 'ACTIVE' AND COALESCE(s.reveals, 0) = 0
      )                                                                    AS silent,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (now() - l."publishedAt")) / 86400
      ) FILTER (WHERE l.status = 'ACTIVE' AND l."publishedAt" IS NOT NULL) AS median_age
    FROM "Listing" l
    LEFT JOIN LATERAL (
      SELECT sum(d.views) AS views, sum(d.reveals) AS reveals
        FROM "ListingDailyStat" d
       WHERE d."listingId" = l.id AND d.day >= ${since}
    ) s ON true
    WHERE ${scopeSql(scope)}
  `;

  /*
   * פניות נספרות מיומן האירועים ולא מ-`ListingDailyStat`, כי הטבלה
   * היומית סופרת צפיות וחשיפות בלבד. שתי הספירות מוגדרות על אותו חלון
   * זמן בדיוק, אחרת "יחס ההמרה" בדשבורד היה מחלק שני מספרים משתי
   * תקופות שונות.
   */
  const [contacts] = await prisma.$queryRaw<{ contacts: bigint }[]>`
    SELECT count(*) AS contacts
      FROM "AnalyticsEvent" e
      JOIN "Listing" l ON l.id = e."listingId"
     WHERE e.type = 'CONTACT' AND e."createdAt" >= ${since}
       AND ${scopeSql(scope)}
  `;

  return {
    active: Number(counts?.active ?? 0),
    drafts: Number(counts?.drafts ?? 0),
    sold: Number(counts?.sold ?? 0),
    views: Number(counts?.views ?? 0),
    reveals: Number(counts?.reveals ?? 0),
    contacts: Number(contacts?.contacts ?? 0),
    silent: Number(counts?.silent ?? 0),
    medianAgeDays: Math.round(Number(counts?.median_age ?? 0)),
  };
}

/**
 * שורות המלאי עם הביצועים שלהן.
 *
 * `sort` קובע איזו שאלה המסך שואל: `performance` מציג את מה שעובד,
 * ו-`stale` את מה שתקוע — הכי ותיק, עם הכי מעט פניות.
 */
export async function inventoryRows(
  scope: Scope,
  options: { days?: number; sort?: "performance" | "stale" | "recent"; take?: number } = {},
): Promise<InventoryRow[]> {
  const { days = 30, sort = "performance", take = 50 } = options;
  const since = new Date(Date.now() - days * 86_400_000);

  const order =
    sort === "stale"
      ? Prisma.sql`ORDER BY reveals + contacts ASC, l."publishedAt" ASC NULLS LAST`
      : sort === "recent"
        ? Prisma.sql`ORDER BY l."publishedAt" DESC NULLS LAST`
        : Prisma.sql`ORDER BY contacts DESC, reveals DESC, views DESC`;

  const rows = await prisma.$queryRaw<
    {
      id: string;
      slug: string;
      title: string;
      price: number | null;
      status: string;
      publishedAt: Date | null;
      views: bigint;
      reveals: bigint;
      contacts: bigint;
      age_days: number | null;
    }[]
  >`
    SELECT l.id, l.slug, l.title, l.price, l.status::text AS status, l."publishedAt",
           COALESCE(s.views, 0)                              AS views,
           COALESCE(s.reveals, 0)                            AS reveals,
           COALESCE(c.contacts, 0)                           AS contacts,
           EXTRACT(EPOCH FROM (now() - l."publishedAt")) / 86400 AS age_days
      FROM "Listing" l
      LEFT JOIN LATERAL (
        SELECT sum(d.views) AS views, sum(d.reveals) AS reveals
          FROM "ListingDailyStat" d
         WHERE d."listingId" = l.id AND d.day >= ${since}
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS contacts
          FROM "AnalyticsEvent" e
         WHERE e."listingId" = l.id AND e.type = 'CONTACT' AND e."createdAt" >= ${since}
      ) c ON true
     WHERE ${scopeSql(scope)} AND l.status IN ('ACTIVE', 'DRAFT')
     ${order}
     LIMIT ${take}
  `;

  // מד המחיר בשאילתה אחת לכל העמוד, כמו בכל מקום אחר באתר
  const meters = await priceMetersFor(rows.map((r) => r.id));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    price: r.price,
    status: r.status,
    publishedAt: r.publishedAt,
    views: Number(r.views),
    reveals: Number(r.reveals),
    contacts: Number(r.contacts),
    ageDays: Math.max(0, Math.round(Number(r.age_days ?? 0))),
    meter: meters.get(r.id) ?? null,
  }));
}
