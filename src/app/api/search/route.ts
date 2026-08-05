import { enforceRateLimit, handleError, ok } from "@/lib/api";
import { getAttributesForCategory, getCategoryBySlug, getCategoryIdsWithDescendants } from "@/lib/categories";
import { parseFilters, toSearchQuery } from "@/lib/filters";
import { toListingCardDtos } from "@/lib/listing-dto";
import { searchListingCards } from "@/lib/listings";
import { recordEvent } from "@/lib/metrics";
import { sessionId } from "@/lib/metrics-session";
import { PAGE_SIZE } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * חיפוש מודעות — משרת את הגלילה האינסופית ואת ספירת התוצאות החיה.
 * מקבל בדיוק את אותם פרמטרי URL כמו דפי הקטגוריה והחיפוש.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit("search");

    const url = new URL(req.url);
    const raw: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      raw[k] = v;
    });

    const state = parseFilters(raw);
    const categorySlug = raw.category;

    let categoryIds: string[] | undefined;
    let attributes = [] as Awaited<ReturnType<typeof getAttributesForCategory>>;

    if (categorySlug) {
      const category = await getCategoryBySlug(categorySlug);
      if (category) {
        categoryIds = await getCategoryIdsWithDescendants(category.id);
        attributes = await getAttributesForCategory(category.id);
      }
    }

    const countOnly = raw.countOnly === "1";

    /*
     * רק חיפוש אמיתי נספר.
     *
     * `countOnly=1` הוא הספירה החיה שרצה על כל הקשה בתיבת החיפוש
     * ועל כל פתיחת פילטר; לספור אותה היה מנפח את שלב ה-SEARCH פי
     * עשרות ומרסק את שיעור המעבר לצפייה — כלומר משפך שנראה נורא
     * בגלל שיפור בממשק.
     */
    if (!countOnly) {
      recordEvent({
        step: "SEARCH",
        sessionId: (await sessionId()) ?? "",
        categoryId: categoryIds?.[0] ?? null,
      });
    }
    const query = toSearchQuery(state, attributes, {
      categoryIds,
      perPage: countOnly ? 1 : PAGE_SIZE,
    });

    const result = await searchListingCards(query);

    return ok({
      total: result.total,
      page: result.page,
      hasMore: result.hasMore,
      items: countOnly ? [] : toListingCardDtos(result.items, result.meters),
    });
  } catch (err) {
    return handleError(err);
  }
}
