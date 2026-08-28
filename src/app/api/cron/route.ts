import { handleError, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { notifyListingExpiring, notifySavedSearchMatch } from "@/lib/notification-triggers";
import { drainQueue } from "@/lib/notification-queue";
import { runActiveFeeds } from "@/lib/feed-runner";
import { sendMonthlyPriceReports } from "@/lib/monthly-report";
import { parseFilters, toSearchQuery } from "@/lib/filters";
import { getAttributesForCategory, getCategoryBySlug, getCategoryIdsWithDescendants } from "@/lib/categories";
import { searchListings } from "@/lib/listings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * משימות מתוזמנות. מיועד להרצה מ-Vercel Cron (ראה vercel.json)
 * או מכל מתזמן חיצוני, עם כותרת Authorization: Bearer $CRON_SECRET.
 *
 * **סדר המשימות אינו מקרי.** קודם רצים כל היצרנים של אירועים (פקיעה,
 * חיפושים שמורים, הדוח החודשי) ורק אחריהם `drain` שמרוקן את התור.
 * כך אירוע שנוצר היום נשלח היום ולא מחר, והמשתמש מקבל התראה מרוכזת
 * אחת שמכילה את כל מה שקרה לו — במקום שתיים בהפרש של יממה.
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
    if (job === "all" || job === "feeds") {
      results.feeds = await runActiveFeeds();
    }
    if (job === "all" || job === "monthly-report") {
      results.monthlyReport = await sendMonthlyPriceReports(new Date());
    }
    if (job === "all" || job === "drain") {
      results.drain = await drainQueue();
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
    const expiresAt = listing.expiresAt ?? new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
    await notifyListingExpiring({
      userId: listing.userId,
      listingId: listing.id,
      listingTitle: listing.title,
      daysLeft,
      expiresAt,
    });
  }

  return { queued: listings.length };
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
 * מריץ את כל החיפושים השמורים ומכניס לתור התראה על מודעות חדשות
 * שהתווספו מאז ההתראה האחרונה. תדירות OFF מדולגת.
 */
async function runSavedSearchAlerts() {
  const now = new Date();
  /*
   * חותמת ההרצה — היום הקלנדרי. היא נכנסת ל-`dedupeKey`, ולכן הרצה
   * שנייה של ה-cron באותו יום (ניסיון חוזר, הפעלה ידנית, שני מופעים
   * שהתעוררו יחד) אינה מייצרת התראה שנייה לאותו חיפוש.
   */
  const runStamp = now.toISOString().slice(0, 10);

  const searches = await prisma.savedSearch.findMany({
    where: { frequency: { not: "OFF" } },
    take: 2000,
  });

  let queued = 0;
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
      await notifySavedSearchMatch({
        userId: search.userId,
        searchId: search.id,
        searchName: search.name,
        count: newCount,
        runStamp,
      });
      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotified: now },
      });
      queued += 1;
    } catch (err) {
      console.error(`[cron] saved search ${search.id} failed`, err);
    }
  }

  return { searches: searches.length, queued, matched };
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
