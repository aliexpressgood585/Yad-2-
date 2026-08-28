import { blurDataUrl } from "@/lib/blur";
import { accentFromBlurhash, type ListingAccent } from "@/lib/listing-accent";
import { formatAttributeEntry, type AttributeEntry } from "@/lib/format";
import type { PriceMeter } from "@/lib/price-meter";
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
  /** אייקון הקטגוריה — משמש כאילוסטרציה כשאין תמונה */
  categoryIcon: string;
  /** מיקום המחיר ביחס למודעות דומות. null = אין מספיק בסיס להשוואה. */
  priceMeter: PriceMeter | null;
  /**
   * הצבע הדומיננטי של התמונה, בשתי הפנים. צובע את מסגרת השורה ואת
   * ההילה שמתחתיה — ורק אותן. `null` כשהתמונה אפורה או חסרה.
   *
   * מחושב בשרת ולא בלקוח: הוא נגזר מה-blurhash שכבר קיים ב-DTO, וחישוב
   * בלקוח היה מוסיף עבודה לכל שורה בגלילה אינסופית בלי להרוויח דבר.
   */
  accent: ListingAccent | null;
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

/**
 * שלושת שדות המפרט שיוצגו בכרטיס.
 *
 * שדה שערכו כבר מופיע בכותרת מסונן החוצה. הכותרת "BYD דולפין 2007"
 * הופכת את "BYD · דולפין · 2007" לשורה שאומרת בדיוק אותו דבר פעמיים —
 * וזה בזבוז של שלוש המשבצות היחידות שיש לכרטיס. במקומן נכנסים יד,
 * קילומטראז' ותיבת הילוכים, שהם מה שבאמת מבדיל בין שתי מודעות.
 *
 * אם הסינון מותיר פחות משני שדות, מוותרים עליו וחוזרים לרשימה המלאה:
 * שורת מפרט קצרה מדי גרועה יותר משורה שחוזרת על הכותרת.
 */
function pickHighlights(listing: ListingCard): AttributeEntry[] {
  const all = [...listing.attributes]
    .sort((a, b) => a.attribute.order - b.attribute.order)
    .map(formatAttributeEntry)
    .filter((e): e is AttributeEntry => e !== null);

  const title = listing.title;

  // בכרטיס מוצגים ערכים בלבד, בלי תוויות — שורה אחת שנסרקת במבט.
  // לכן שדה שערכו חסר משמעות בלי התווית ("₪120,000") יורד מהכרטיס
  // כולו במקום להופיע כמספר עירום; מקומו בטבלת המפרט בדף המודעה.
  const usable = all.filter((e) => e.selfEvident);
  const fresh = usable.filter((e) => !title.includes(e.value));

  return (fresh.length >= 2 ? fresh : usable).slice(0, 3);
}

export function toListingCardDto(
  listing: ListingCard,
  priceMeter: PriceMeter | null = null,
): ListingCardDto {
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
    categoryIcon: listing.category?.icon ?? "Package",
    priceMeter,
    accent: accentFromBlurhash(image?.blurhash),
    blurDataURL: image?.blurhash ? blurDataUrl(image.blurhash) : null,
    imageCount: listing.images.length,
    highlights: pickHighlights(listing),
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

export function toListingCardDtos(
  listings: ListingCard[],
  meters?: Map<string, PriceMeter>,
): ListingCardDto[] {
  return listings.map((l) => toListingCardDto(l, meters?.get(l.id) ?? null));
}
