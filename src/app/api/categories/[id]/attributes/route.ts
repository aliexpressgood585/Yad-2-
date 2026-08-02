import { handleError, ok } from "@/lib/api";
import { getAttributesForCategory, getCategoryById } from "@/lib/categories";

/** השדות הדינמיים החלים על קטגוריה, כולל אלו שיורשים מקטגוריות-אב. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const category = await getCategoryById(id);
    if (!category) return ok({ attributes: [] });

    const attributes = await getAttributesForCategory(id);
    return ok(
      { attributes },
      { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    return handleError(err);
  }
}
