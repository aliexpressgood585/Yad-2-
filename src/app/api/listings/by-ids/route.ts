import { handleError, ok } from "@/lib/api";
import { toListingCardDtos } from "@/lib/listing-dto";
import { fetchListingCards } from "@/lib/listings";
import { priceMetersFor } from "@/lib/price-meter";

export const dynamic = "force-dynamic";

/** טוען מודעות לפי רשימת מזהים — משמש ל"נצפו לאחרונה" ולהשוואה. */
export async function GET(req: Request) {
  try {
    const ids = (new URL(req.url).searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (!ids.length) return ok({ items: [] });

    const listings = await fetchListingCards(ids);
    // מודעות שנמחקו או נחסמו לא יוחזרו
    const visible = listings.filter((l) => l.status === "ACTIVE");
    const meters = await priceMetersFor(visible.map((l) => l.id));
    return ok({ items: toListingCardDtos(visible, meters) });
  } catch (err) {
    return handleError(err);
  }
}
