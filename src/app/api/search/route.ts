import { enforceRateLimit, handleError, ok } from "@/lib/api";
import { getAttributesForCategory, getCategoryBySlug, getCategoryIdsWithDescendants } from "@/lib/categories";
import { parseFilters, toSearchQuery } from "@/lib/filters";
import { toListingCardDtos } from "@/lib/listing-dto";
import { searchListingCards } from "@/lib/listings";
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
    const query = toSearchQuery(state, attributes, {
      categoryIds,
      perPage: countOnly ? 1 : PAGE_SIZE,
    });

    const result = await searchListingCards(query);

    return ok({
      total: result.total,
      page: result.page,
      hasMore: result.hasMore,
      items: countOnly ? [] : toListingCardDtos(result.items),
    });
  } catch (err) {
    return handleError(err);
  }
}
