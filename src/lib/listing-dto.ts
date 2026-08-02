import { blurDataUrl } from "@/lib/blur";
import { formatAttributeEntry, type AttributeEntry } from "@/lib/format";
import type { ListingCard } from "@/lib/listings";

/**
 * ייצוג מודעה לכרטיס — מבנה שטוח וניתן לסריאליזציה.
 * מאפשר לרנדר את אותו רכיב גם בשרת (עמוד ראשון) וגם בלקוח
 * (עמודים נוספים בגלילה אינסופית).
 */
export type ListingCardDto = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  currency: string;
  city: string;
  neighborhood: string | null;
  categoryId: string;
  isPromoted: boolean;
  date: string;
  viewCount: number;
  imageUrl: string | null;
  blurDataURL: string | null;
  imageCount: number;
  /**
   * שלושת השדות הדינמיים הבולטים, כל אחד עם התווית שלו.
   * מבנה ולא מחרוזת, כדי שהכרטיס יוכל לאכוף שערך מספרי עירום
   * לא מוצג בלי תווית (ראה DESIGN.md).
   */
  highlights: AttributeEntry[];
  distanceKm?: number;
  seller: {
    id: string;
    name: string;
    businessName: string | null;
    businessSlug: string | null;
    verified: boolean;
    ratingAvg: number;
    ratingCount: number;
  };
};

export function toListingCardDto(listing: ListingCard): ListingCardDto {
  const image = listing.images[0];
  const now = Date.now();

  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    city: listing.city,
    neighborhood: listing.neighborhood,
    categoryId: listing.categoryId,
    isPromoted: Boolean(
      listing.isPromoted && listing.promotedUntil && listing.promotedUntil.getTime() > now,
    ),
    date: (listing.bumpedAt ?? listing.publishedAt ?? listing.createdAt).toISOString(),
    viewCount: listing.viewCount,
    imageUrl: image ? (image.thumbUrl ?? image.url) : null,
    blurDataURL: image?.blurhash ? blurDataUrl(image.blurhash) : null,
    imageCount: listing.images.length,
    highlights: [...listing.attributes]
      .sort((a, b) => a.attribute.order - b.attribute.order)
      .map(formatAttributeEntry)
      .filter((e): e is AttributeEntry => e !== null)
      .slice(0, 3),
    distanceKm: listing.distanceKm,
    seller: {
      id: listing.user.id,
      name: listing.user.name,
      businessName: listing.user.businessName,
      businessSlug: listing.user.businessSlug,
      verified: Boolean(listing.user.verifiedAt),
      ratingAvg: listing.user.ratingAvg,
      ratingCount: listing.user.ratingCount,
    },
  };
}

export function toListingCardDtos(listings: ListingCard[]): ListingCardDto[] {
  return listings.map(toListingCardDto);
}
