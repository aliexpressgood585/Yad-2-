import { ListingGrid } from "@/components/listing/listing-grid";
import { toListingCardDtos } from "@/lib/listing-dto";
import { searchListingCards } from "@/lib/listings";

type Props = {
  listingId: string;
  categoryId: string;
  city: string;
  price: number | null;
  title: string;
};

/**
 * מודעות דומות: קודם באותה קטגוריה, טווח מחירים קרוב ואותה עיר;
 * אם אין מספיק — מרחיבים לכל הארץ ואז לכל טווח המחירים.
 */
export async function SimilarListings({ listingId, categoryId, city, price, title }: Props) {
  const priceWindow = price
    ? { priceMin: Math.round(price * 0.6), priceMax: Math.round(price * 1.6) }
    : {};

  const base = {
    categoryIds: [categoryId],
    excludeIds: [listingId],
    withImages: true,
    perPage: 8,
    sort: "date" as const,
  };

  let result = await searchListingCards({ ...base, ...priceWindow, cities: [city] });

  if (result.items.length < 4) {
    result = await searchListingCards({ ...base, ...priceWindow });
  }
  if (result.items.length < 4) {
    // נפילה אחרונה: חיפוש טקסטואלי לפי הכותרת בכל הקטגוריות
    result = await searchListingCards({
      excludeIds: [listingId],
      withImages: true,
      perPage: 8,
      q: title,
      sort: "relevance",
    });
  }

  if (!result.items.length) return null;

  return (
    <section aria-labelledby="similar-heading" className="mt-12">
      <h2 id="similar-heading" className="mb-4 font-heading text-xl font-bold">
        מודעות דומות
      </h2>
      <ListingGrid listings={toListingCardDtos(result.items)} priorityCount={0} />
    </section>
  );
}
