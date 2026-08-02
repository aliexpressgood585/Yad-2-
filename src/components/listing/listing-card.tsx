"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Camera, Eye, MapPin, Star } from "lucide-react";

import { FavoriteButton } from "@/components/listing/favorite-button";
import { CompareToggle } from "@/components/listing/compare-toggle";
import { Badge } from "@/components/ui/badge";
import type { ListingCardDto } from "@/lib/listing-dto";
import { cn, formatPrice, timeAgo } from "@/lib/utils";

type Props = {
  listing: ListingCardDto;
  /** תצוגת שורה אופקית — משמשת ברשימות צרות */
  layout?: "grid" | "row";
  priority?: boolean;
  showCompare?: boolean;
  className?: string;
};

export function ListingCard({
  listing,
  layout = "grid",
  priority = false,
  showCompare = true,
  className,
}: Props) {
  const seller = listing.seller;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card transition-shadow",
        "focus-within:ring-2 focus-within:ring-ring hover:shadow-lifted",
        listing.isPromoted && "ring-1 ring-accent/40",
        layout === "row" && "flex",
        className,
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-muted",
          layout === "grid" ? "aspect-[4/3] w-full" : "aspect-[4/3] w-36 sm:w-52",
        )}
      >
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt=""
            fill
            sizes={layout === "grid" ? "(max-width: 640px) 50vw, 300px" : "208px"}
            className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            placeholder={listing.blurDataURL ? "blur" : "empty"}
            blurDataURL={listing.blurDataURL ?? undefined}
            priority={priority}
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Camera className="size-8" aria-hidden />
            <span className="sr-only">אין תמונה למודעה זו</span>
          </div>
        )}

        {listing.imageCount > 1 ? (
          <span className="absolute bottom-2 start-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            <Camera className="size-3" aria-hidden />
            <span className="num">{listing.imageCount}</span>
          </span>
        ) : null}

        {listing.isPromoted ? (
          <Badge variant="accent" className="absolute start-2 top-2 shadow-soft">
            מקודם
          </Badge>
        ) : null}

        <div className="absolute end-2 top-2 flex flex-col gap-1.5">
          <FavoriteButton listingId={listing.id} />
          {showCompare ? (
            <CompareToggle
              listing={{
                id: listing.id,
                slug: listing.slug,
                title: listing.title,
                price: listing.price,
                image: listing.imageUrl,
                categoryId: listing.categoryId,
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="font-heading text-lg font-bold leading-none">
          <span className="num">
            {formatPrice(listing.price, { currency: listing.currency })}
          </span>
        </p>

        <h3 className="line-clamp-2-fixed min-h-[2.5rem] text-sm font-medium leading-tight">
          {/* הקישור פרוס על כל הכרטיס כדי להגדיל את שטח הלחיצה */}
          <Link
            href={`/item/${listing.slug}`}
            className="outline-none after:absolute after:inset-0"
          >
            {listing.title}
          </Link>
        </h3>

        {listing.highlights.length ? (
          <ul className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {listing.highlights.map((h, i) => (
              <li key={`${h}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>·</span> : null}
                <span className="num">{h}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {listing.city}
            {listing.neighborhood ? `, ${listing.neighborhood}` : ""}
          </span>
          {listing.distanceKm !== undefined ? (
            <span className="num shrink-0">
              ·{" "}
              {listing.distanceKm < 1
                ? `${Math.round(listing.distanceKm * 1000)} מ'`
                : `${listing.distanceKm.toFixed(1)} ק"מ`}
            </span>
          ) : null}
          <span aria-hidden>·</span>
          <time dateTime={listing.date} className="shrink-0">
            {timeAgo(listing.date)}
          </time>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {seller.businessName ? (
            <span className="flex items-center gap-1 truncate font-medium text-foreground">
              <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
              {seller.businessName}
            </span>
          ) : seller.verified ? (
            <span className="flex items-center gap-1">
              <BadgeCheck className="size-3.5 text-primary" aria-hidden />
              מוכר מאומת
            </span>
          ) : null}
          {seller.ratingCount > 0 ? (
            <span className="flex items-center gap-0.5">
              <Star className="size-3 fill-warning text-warning" aria-hidden />
              <span className="num">{seller.ratingAvg.toFixed(1)}</span>
            </span>
          ) : null}
          {listing.viewCount > 50 ? (
            <span className="ms-auto flex items-center gap-0.5">
              <Eye className="size-3" aria-hidden />
              <span className="num">{listing.viewCount.toLocaleString("he-IL")}</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** שלד טעינה בגודל זהה לכרטיס — מונע קפיצות פריסה. */
export function ListingCardSkeleton({ layout = "grid" }: { layout?: "grid" | "row" }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        layout === "row" && "flex",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "animate-pulse bg-muted",
          layout === "grid" ? "aspect-[4/3] w-full" : "aspect-[4/3] w-36 sm:w-52",
        )}
      />
      <div className="flex-1 space-y-2 p-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
