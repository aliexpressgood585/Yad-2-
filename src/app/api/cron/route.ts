import { handleError, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { STALE_DAYS } from "@/lib/availability";
import { enqueue, runQueue } from "@/lib/notify-queue";
import { parseFilters, toSearchQuery } from "@/lib/filters";
import { getAttributesForCategory, getCategoryBySlug, getCategoryIdsWithDescendants } from "@/lib/categories";
import { searchListings } from "@/lib/listings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * משימות מתוזמנות. מיועד להרצה מ-Vercel Cron (ראה vercel.json)
 * או מכל מתזמן חיצוני, עם כותרת Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const header = req.headers.get("authorization");
      if (header !== `Bearer ${secret}`) {
        throw new ApiError(401, "Unauthorized");
      }
    }

    const job = new URL(req.url).searchParams.get("job") ?? "all";
    const results: Record<string, unknown> = {};

    if (job === "all" || job === "expire") {
      results.expire = await expireListings();
    }
    if (job === "all" || job === "expiring-soon") {
      results.expiringSoon = await notifyExpiringSoon();
    }
    if (job === "all" || job === "boosts") {
      results.boosts = await endFinishedBoosts();
    }
    if (job === "all" || job === "saved-searches") {
      results.savedSearches = await runSavedSearchAlerts();
    }
    if (job === "all" || job === "stale") {
      results.stale = await nudgeStaleListings();
    }
    /*
     * התור רץ אחרון ובכוונה: כל המשימות שמעליו רק מכניסות עבודות,
     * וכך התראות שנוצרו בהרצה הזו יוצאות בה ולא ממתינות ליום הבא.
     */
    if (job === "all" || job === "notify") {
      results.notify = await runQueue();
    }

    return ok({ ran: job, results });
  } catch (err) {
    return handleError(err);
  }
}

/** מסמן מודעות שפג תוקפן. */
async function expireListings() {
  const result = await prisma.listing.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() }, deletedAt: null },
    data: { status: "EXPIRED" },
  });
  return { expired: result.count };
}

/** מתריע למוכרים על מודעות שעומדות לפוג בעוד 5 ימים. */
async function notifyExpiringSoon() {
  const from = new Date(Date.now() + 4 * 86_400_000);
  const to = new Date(Date.now() + 5 * 86_400_000);

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      expiresAt: { gte: from, lt: to },
    },
    select: { id: true, title: true, userId: true, expiresAt: true },
    take: 500,
  });

  for (const listing of listings) {
    const daysLeft = Math.ceil(
      ((listing.expiresAt?.getTime() ?? Date.now()) - Date.now()) / 86_400_000,
    );
    await enqueue({
      userId: listing.userId,
      kind: "LISTING_EXPIRING",
      // יום התפוגה במפתח: מודעה מחודשת מקבלת התראה חדשה, ריצה חוזרת לא
      dedupeKey: `expiring:${listing.id}:${listing.expiresAt?.toISOString().slice(0, 10)}`,
      payload: {
        title: "המודעה שלך עומדת לפוג",
        body: `"${listing.title}" תפוג בעוד ${daysLeft} ימים. אפשר לחדש אותה בלחיצה.`,
        url: "/my/listings",
        itemLabel: listing.title,
        email: true,
      },
    });
  }

  return { notified: listings.length };
}

/**
 * מבקש מהמוכר לאשר מודעות שלא אושרו מעל הסף.
 *
 * שונה מ"מודעה שעומדת לפוג": שם יש תאריך שמתקרב, וכאן המודעה תקפה עוד
 * שבועות — הבעיה היא שאיש לא יודע אם היא עדיין אמיתית. מודעה ישנה שלא
 * אושרה היא מה שגורם לקונים להפסיק להאמין ללוח כולו, ולא רק לה.
 */
async function nudgeStaleListings() {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      publishedAt: { lt: cutoff },
      OR: [{ availabilityAt: null }, { availabilityAt: { lt: cutoff } }],
    },
    select: { id: true, title: true, userId: true },
    take: 500,
  });

  let queued = 0;
  for (const listing of listings) {
    /*
     * חלון של שבוע במפתח. מודעה שנשארת ישנה לא מייצרת תזכורת יומית —
     * זו הדרך המהירה ביותר לגרום למוכר לכבות התראות לגמרי.
     */
    const week = Math.floor(Date.now() / (7 * 86_400_000));
    const created = await enqueue({
      userId: listing.userId,
      kind: "SYSTEM",
      dedupeKey: `stale:${listing.id}:${week}`,
      payload: {
        title: "המודעה שלך עדיין רלוונטית?",
        body: `"${listing.title}" פורסמה לפני יותר מחודש ולא אושרה מאז. אישור בלחיצה אחת מראה לקונים שהיא מעודכנת.`,
        url: "/my",
        itemLabel: listing.title,
      },
    });
    if (created) queued += 1;
  }

  return { candidates: listings.length, queued };
}

/** מסיר סימון קידום ממודעות שהקידום שלהן הסתיים. */
async function endFinishedBoosts() {
  const result = await prisma.listing.updateMany({
    where: { isPromoted: true, promotedUntil: { lt: new Date() } },
    data: { isPromoted: false, promotedUntil: null },
  });
  return { ended: result.count };
}

/**
 * מריץ את כל החיפושים השמורים ומודיע על מודעות חדשות שהתווספו
 * מאז ההתראה האחרונה. תדירות OFF מדולגת.
 */
async function runSavedSearchAlerts() {
  const now = new Date();
  const searches = await prisma.savedSearch.findMany({
    where: { frequency: { not: "OFF" } },
    take: 2000,
  });

  let notified = 0;
  let matched = 0;

  for (const search of searches) {
    const since = search.lastNotified ?? search.createdAt;

    // כיבוד תדירות ההתראה שהמשתמש בחר
    const minGapMs =
      search.frequency === "DAILY"
        ? 20 * 3600_000
        : search.frequency === "WEEKLY"
          ? 6.5 * 86_400_000
          : 0;
    if (minGapMs && now.getTime() - since.getTime() < minGapMs) continue;

    try {
      const filters = (search.filters ?? {}) as Record<string, string>;
      const state = parseFilters(filters);

      const categorySlug = filters.categorySlug ?? filters.category;
      let categoryIds: string[] | undefined;
      let attributes: Awaited<ReturnType<typeof getAttributesForCategory>> = [];

      if (categorySlug) {
        const category = await getCategoryBySlug(categorySlug);
        if (category) {
          categoryIds = await getCategoryIdsWithDescendants(category.id);
          attributes = await getAttributesForCategory(category.id);
        }
      }

      const query = toSearchQuery(state, attributes, {
        categoryIds,
        perPage: 1,
        page: 1,
      });

      // סופרים רק מודעות שפורסמו מאז ההתראה האחרונה
      const newCount = await countNewSince(query, since);
      if (newCount === 0) continue;

      matched += newCount;
      await enqueue({
        userId: search.userId,
        kind: "SAVED_SEARCH_MATCH",
        // חלון ההתראה במפתח, כדי ששתי הרצות באותו חלון לא יתריעו פעמיים
        dedupeKey: `saved-search:${search.id}:${since.toISOString()}`,
        payload: {
          title: `${newCount} מודעות חדשות ב"${search.name}"`,
          body: `נמצאו ${newCount} מודעות חדשות שמתאימות לחיפוש ששמרת.`,
          url: `/my/searches`,
          itemLabel: search.name,
          email: search.frequency !== "INSTANT",
        },
      });
      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotified: now },
      });
      notified += 1;
    } catch (err) {
      console.error(`[cron] saved search ${search.id} failed`, err);
    }
  }

  return { searches: searches.length, notified, matched };
}

/**
 * סופר כמה מודעות תואמות לחיפוש פורסמו מאז תאריך נתון.
 * החיפוש ממוין לפי תאריך, ולכן די בעמוד אחד כדי לדעת אם יש חדשות
 * ובכמה — התראה על "48+ מודעות חדשות" ממילא מיותרת.
 */
async function countNewSince(
  query: ReturnType<typeof toSearchQuery>,
  since: Date,
): Promise<number> {
  const page = await searchListings({ ...query, perPage: 48, page: 1, sort: "date" });
  if (!page.ids.length) return 0;
  return prisma.listing.count({
    where: { id: { in: page.ids }, publishedAt: { gt: since } },
  });
}
