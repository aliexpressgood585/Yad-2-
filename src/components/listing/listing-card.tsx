"use client";

import Link from "next/link";

import { FavoriteButton } from "@/components/listing/favorite-button";
import { ListingImage } from "@/components/listing/listing-image";
import { PriceMeter } from "@/components/listing/price-meter";
import type { ListingCardDto } from "@/lib/listing-dto";
import { formatPrice } from "@/lib/format";
import type { Density } from "@/stores/density";
import { cn, timeAgo } from "@/lib/utils";

type Props = {
  listing: ListingCardDto;
  density?: Density;
  priority?: boolean;
  className?: string;
};

/**
 * כרטיס מודעה.
 *
 * ההיררכיה קבועה ולא משתנה בין קטגוריות: מחיר, כותרת, שלושה שדות מפרט,
 * מיקום וזמן. מה שהוסר במכוון — דירוג המוכר, ספירת צפיות ומספר התמונות.
 * שלושתם רעש ברשימה: הם לא עוזרים לבחור בין מודעות, והם מה שהופך לוח
 * מודעות לצפוף. מקומם בדף המודעה, אחרי שכבר נכנסו.
 */
export function ListingCard({ listing, density = "grid", priority = false, className }: Props) {
  const isList = density === "list";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card",
        "transition-shadow duration-ui ease-ui focus-within:ring-2 focus-within:ring-ring hover:shadow-lifted",
        isList && "flex",
        className,
      )}
    >
      <div className={cn("relative shrink-0", isList ? "w-32 sm:w-44" : "w-full")}>
        <ListingImage
          src={listing.imageUrl}
          blurDataURL={listing.blurDataURL}
          categoryIcon={listing.categoryIcon}
          sizes={isList ? "176px" : "(max-width: 640px) 50vw, 300px"}
          priority={priority}
        />

        {/*
         * תג "מקודם" — קטן, בצבע טקסט משני, על רקע כרטיס חצי-שקוף.
         * מודעה מקודמת מנצחת במיקום ברשימה, לא בצעקנות.
         * ה-scrim מתחתיו מבטיח קריאוּת גם על פינת תמונה בהירה.
         */}
        {listing.isPromoted ? (
          <>
            <div className="img-scrim pointer-events-none absolute inset-x-0 bottom-0 h-12" />
            <span className="absolute bottom-2 start-2 rounded-full bg-card/85 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
              מקודם
            </span>
          </>
        ) : null}

        {/* מיקום קבוע בכל הכרטיסים — העין לומדת איפה הלב נמצא */}
        <div className="absolute end-2 top-2">
          <FavoriteButton listingId={listing.id} />
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col gap-1 p-3", isList && "justify-center")}>
        <p className="num text-lg font-medium leading-none text-foreground">
          {formatPrice(listing.price, { currency: listing.currency })}
        </p>

        <PriceMeter meter={listing.priceMeter} />

        <h3 className="truncate text-base font-semibold leading-snug">
          {/* הקישור פרוס על כל הכרטיס כדי להגדיל את שטח הלחיצה */}
          <Link
            href={`/item/${listing.slug}`}
            className="outline-none after:absolute after:inset-0"
          >
            {listing.title}
          </Link>
        </h3>

        {listing.highlights.length ? (
          <ul className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {listing.highlights.map((h, i) => (
              <li key={h.key} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>·</span> : null}
                {/* כלל גלובלי: ערך שלא מסביר את עצמו לא מוצג בלי תווית */}
                {h.selfEvident ? null : <span>{h.label}</span>}
                <span className="num">{h.value}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-auto truncate pt-0.5 text-xs text-muted-foreground/70">
          {listing.city}
          {listing.neighborhood ? `, ${listing.neighborhood}` : ""}
          {" · "}
          <time dateTime={listing.date}>{timeAgo(listing.date)}</time>
        </p>
      </div>
    </article>
  );
}

/**
 * שלד טעינה במידות המדויקות של הכרטיס האמיתי.
 * כל סטייה כאן מתורגמת ישירות ל-CLS כשהתוכן מגיע.
 */
export function ListingCardSkeleton({ density = "grid" }: { density?: Density }) {
  const isList = density === "list";
  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-border bg-card", isList && "flex")}
      aria-hidden
    >
      <div
        className={cn(
          "aspect-[4/3] shrink-0 animate-pulse bg-muted",
          isList ? "w-32 sm:w-44" : "w-full",
        )}
      />
      <div className={cn("flex flex-1 flex-col gap-1 p-3", isList && "justify-center")}>
        <div className="h-5 w-24 animate-pulse rounded-sm bg-muted" />
        <div className="mt-1 h-4 w-full animate-pulse rounded-sm bg-muted" />
        <div className="mt-1 h-3 w-2/3 animate-pulse rounded-sm bg-muted" />
        <div className="mt-auto h-3 w-1/2 animate-pulse rounded-sm bg-muted" />
      </div>
    </div>
  );
}
