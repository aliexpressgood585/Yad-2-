import { prisma } from "@/lib/db";

/**
 * החישובים שמאחורי מסך המדידה.
 *
 * מדד הצפון והנימוק לבחירתו מתועדים ב-GROWTH.md. בקצרה: **מודעות
 * מחוברות בשבוע** — כמה מודעות *שונות* קיבלו לפחות פנייה אמיתית אחת
 * (חשיפת טלפון או הודעה ראשונה) באותו שבוע.
 *
 * כל השאילתות כאן קוראות רק את `AnalyticsEvent`, שהוא append-only.
 */

/** תחילת השבוע (יום ראשון) בחצות UTC. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

export type WeeklyPoint = {
  /** תחילת השבוע, ISO */
  weekStart: string;
  /** מודעות שונות שקיבלו פנייה — מדד הצפון */
  connectedListings: number;
};

/**
 * מדד הצפון לאורך השבועות האחרונים.
 *
 * `count(DISTINCT "listingId")` ולא `count(*)` — וזה ההבדל היחיד
 * שחשוב כאן. ספירת אירועים הייתה מאפשרת לקונה אחד נלהב שחושף את אותו
 * מספר עשר פעמים להזיז את המדד; ספירת מודעות שונות אינה ניתנת לניפוח
 * כך, והיא גם מה שהמדד באמת מנסה לומר — כמה מודעות הפכו לקשר.
 */
export async function northStarByWeek(weeks = 12): Promise<WeeklyPoint[]> {
  const from = startOfWeek(new Date());
  from.setUTCDate(from.getUTCDate() - 7 * (weeks - 1));

  const rows = await prisma.$queryRaw<{ week: Date; connected: bigint }[]>`
    SELECT date_trunc('week', "createdAt" + interval '1 day') - interval '1 day' AS week,
           count(DISTINCT "listingId") AS connected
      FROM "AnalyticsEvent"
     WHERE "createdAt" >= ${from}
       AND type IN ('PHONE_REVEAL', 'CONTACT')
       AND "listingId" IS NOT NULL
     GROUP BY 1
     ORDER BY 1
  `;

  const byWeek = new Map(
    rows.map((r) => [new Date(r.week).toISOString().slice(0, 10), Number(r.connected)]),
  );

  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(from);
    start.setUTCDate(start.getUTCDate() + 7 * i);
    const key = start.toISOString().slice(0, 10);
    return { weekStart: start.toISOString(), connectedListings: byWeek.get(key) ?? 0 };
  });
}

export type FunnelStage = {
  key: "search" | "view" | "reveal" | "contact";
  label: string;
  sessions: number;
};

export type Funnel = {
  stages: FunnelStage[];
  /**
   * סשנים שהגיעו למודעה בלי לעבור דרך מסך תוצאות — כניסה ישירה
   * מגוגל, מקישור ששותף או מדף הבית.
   */
  viewsWithoutSearch: number;
  /**
   * סשנים שפנו למוכר בלי לחשוף טלפון קודם. המשפך הוא שרשרת קפדנית,
   * ולכן הם אינם מופיעים בשלב האחרון שלו — ומספר שנופל בין הכיסאות
   * הוא בדיוק מה שהופך מכשיר למטעה.
   */
  contactedWithoutReveal: number;
};

/**
 * המשפך: חיפוש ← צפייה במודעה ← חשיפת טלפון ← פנייה.
 *
 * נמדד ברמת **סשן** ולא ברמת אירוע, כי השאלה היא "מכמה ביקורים יצא
 * קשר" ולא "כמה קליקים היו". סשן נספר בשלב מסוים רק אם הוא עבר את כל
 * השלבים שלפניו — משפך שאינו שרשרת קפדנית מציג שיעורי המרה גבוהים
 * מ-100% ואי אפשר להסיק ממנו דבר.
 *
 * שני מספרים שנופלים מחוץ לשרשרת מוחזרים בנפרד ומוצגים על המסך, כדי
 * שהמשפך לא יסתיר אותם בשקט.
 */
export async function funnel(from: Date, to: Date): Promise<Funnel> {
  const [row] = await prisma.$queryRaw<
    {
      searched: bigint;
      viewed: bigint;
      revealed: bigint;
      contacted: bigint;
      views_without_search: bigint;
      contacted_without_reveal: bigint;
    }[]
  >`
    WITH s AS (
      SELECT "sessionId",
             bool_or(type = 'SEARCH')       AS searched,
             bool_or(type = 'LISTING_VIEW') AS viewed,
             bool_or(type = 'PHONE_REVEAL') AS revealed,
             bool_or(type = 'CONTACT')      AS contacted
        FROM "AnalyticsEvent"
       WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
       GROUP BY "sessionId"
    )
    SELECT count(*) FILTER (WHERE searched)                                        AS searched,
           count(*) FILTER (WHERE searched AND viewed)                             AS viewed,
           count(*) FILTER (WHERE searched AND viewed AND revealed)                AS revealed,
           count(*) FILTER (WHERE searched AND viewed AND revealed AND contacted)  AS contacted,
           count(*) FILTER (WHERE viewed AND NOT searched)                         AS views_without_search,
           count(*) FILTER (WHERE contacted AND NOT revealed)                      AS contacted_without_reveal
      FROM s
  `;

  return {
    stages: [
      { key: "search", label: "חיפוש", sessions: Number(row?.searched ?? 0) },
      { key: "view", label: "צפייה במודעה", sessions: Number(row?.viewed ?? 0) },
      { key: "reveal", label: "חשיפת טלפון", sessions: Number(row?.revealed ?? 0) },
      { key: "contact", label: "פנייה", sessions: Number(row?.contacted ?? 0) },
    ],
    viewsWithoutSearch: Number(row?.views_without_search ?? 0),
    contactedWithoutReveal: Number(row?.contacted_without_reveal ?? 0),
  };
}

export type DeadQuery = { query: string; searches: number };

/**
 * חיפושים שהחזירו אפס תוצאות, לפי שכיחות.
 *
 * זה המספר היחיד במסך שאפשר לפעול לפיו מיד: כל שורה כאן היא ביקוש
 * שהגיע ללוח ולא מצא היצע, ולכן היא או קטגוריה חסרה, או מילה נרדפת
 * שלא נכנסה למילון, או שגיאת כתיב שהחיפוש לא סופג.
 */
export async function deadQueries(from: Date, to: Date, limit = 15): Promise<DeadQuery[]> {
  const rows = await prisma.$queryRaw<{ query: string; searches: bigint }[]>`
    SELECT query, count(*) AS searches
      FROM "AnalyticsEvent"
     WHERE type = 'SEARCH'
       AND "createdAt" >= ${from} AND "createdAt" < ${to}
       AND "resultCount" = 0
       AND query IS NOT NULL AND query <> ''
     GROUP BY query
     ORDER BY count(*) DESC, query
     LIMIT ${limit}
  `;
  return rows.map((r) => ({ query: r.query, searches: Number(r.searches) }));
}

export type CategoryPerformance = {
  categoryId: string;
  name: string;
  views: number;
  connections: number;
};

/**
 * שיעור ההמרה מצפייה לקשר, לפי קטגוריה.
 *
 * מוצג רק לקטגוריות עם 30 צפיות ומעלה בתקופה. אותו היגיון בדיוק
 * שמאחורי סף המדגם של מדד המחירים: שיעור המרה שמחושב משבע צפיות אינו
 * מדידה אלא רעש, והצגתו כמדידה היא בדיוק מה שגורם להחלטות גרועות.
 */
export async function categoryPerformance(
  from: Date,
  to: Date,
  minViews = 30,
): Promise<CategoryPerformance[]> {
  const rows = await prisma.$queryRaw<
    { categoryId: string; name: string; views: bigint; connections: bigint }[]
  >`
    SELECT e."categoryId"                                                    AS "categoryId",
           c.name                                                            AS name,
           count(*) FILTER (WHERE e.type = 'LISTING_VIEW')                   AS views,
           count(DISTINCT e."listingId")
             FILTER (WHERE e.type IN ('PHONE_REVEAL', 'CONTACT'))            AS connections
      FROM "AnalyticsEvent" e
      JOIN "Category" c ON c.id = e."categoryId"
     WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
       AND e."categoryId" IS NOT NULL
     GROUP BY e."categoryId", c.name
    HAVING count(*) FILTER (WHERE e.type = 'LISTING_VIEW') >= ${minViews}
     ORDER BY count(*) FILTER (WHERE e.type = 'LISTING_VIEW') DESC
     LIMIT 20
  `;

  return rows.map((r) => ({
    categoryId: r.categoryId,
    name: r.name,
    views: Number(r.views),
    connections: Number(r.connections),
  }));
}

/** כמה אירועים נרשמו בכלל — כדי שיהיה ברור מתי המדידה עצמה שותקת. */
export async function eventVolume(from: Date, to: Date): Promise<number> {
  return prisma.analyticsEvent.count({
    where: { createdAt: { gte: from, lt: to } },
  });
}
