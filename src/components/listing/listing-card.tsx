"use client";

import { BidiText } from "@/components/bidi-text";
import { ViewTransitionLink } from "@/components/view-transition-link";

import { FavoriteButton } from "@/components/listing/favorite-button";
import { ListingImage } from "@/components/listing/listing-image";
import { PriceGauge } from "@/components/listing/price-gauge";
import { listingImageTransition } from "@/lib/view-transitions";
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
 * שורת התוצאה.
 *
 * תוצאות מוצגות כשורות קריאה ברוחב מלא ולא כגריד כרטיסים. הסיבה אינה
 * טעם: בגריד העין קופצת בשני צירים ומשווה מודעה לשכנתה בטור, ואילו
 * ההשוואה שקונה באמת עושה היא בין פריטים רצופים — כלומר טבלה. שורה
 * מלאה גם מאפשרת את הדבר שגריד אינו מאפשר: **טור מחירים אחד שמתיישר
 * לאורך כל התוצאות**, במונו-רווח, עם הסקאלה מתחת לכל מחיר.
 *
 * ההיררכיה קבועה ולא משתנה בין קטגוריות: כותרת, שלושה שדות מפרט,
 * מיקום וזמן — ובטור הקריאה מחיר וסקאלה. מה שהוסר במכוון: דירוג
 * המוכר, ספירת צפיות ומספר התמונות. שלושתם רעש ברשימה, ומקומם בדף
 * המודעה אחרי שכבר נכנסו.
 *
 * **השורה מגיבה למכל שלה ולא לחלון.** אותו רכיב עובד ברשימה, בסיידבר,
 * ברצועת "נצפו לאחרונה" ובחלונית של המפה בלי prop שמסביר לו איפה הוא
 * נמצא — נקודות השבירה יושבות ב-`@container` (ראה `globals.css`).
 *
 * `density` נשאר prop כי הוא כוונה של המשתמש ולא מידה של המכל: הוא
 * קובע אם השורה מציגה את התמונה כלוחית מלאה או כחתימה צרה.
 */
export function ListingCard({ listing, density = "full", priority = false, className }: Props) {
  const compact = density === "compact";

  /*
   * שני המשתנים נכתבים יחד ותמיד. `globals.css` בוחר ביניהם לפי הפנים
   * הפעילה, כי אותה בהירות אינה יכולה לעבור בדיקת ניגודיות גם מול
   * גרפיט וגם מול עצם.
   */
  const accentStyle = listing.accent
    ? ({
        "--accent-instrument": listing.accent.instrument,
        "--accent-day": listing.accent.day,
      } as React.CSSProperties)
    : undefined;

  return (
    <article
      data-density={density}
      style={accentStyle}
      className={cn(
        "listing-row group flex transition-colors duration-ui ease-ui",
        "focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <div className={cn("listing-row-media relative", compact && "!w-24")}>
        <ListingImage
          src={listing.imageUrl}
          blurDataURL={listing.blurDataURL}
          categoryIcon={listing.categoryIcon}
          sizes={compact ? "96px" : "176px"}
          priority={priority}
          viewTransitionName={listingImageTransition(listing.id)}
        />

        {/*
         * תג "מקודם" — קטן, בצבע טקסט משני, על רקע שלדה.
         * מודעה מקודמת מנצחת במיקום ברשימה, לא בצעקנות.
         * ה-scrim מתחתיו מבטיח קריאוּת גם על פינת תמונה בהירה.
         */}
        {listing.isPromoted ? (
          <>
            <div className="img-scrim pointer-events-none absolute inset-x-0 bottom-0 h-10" />
            <span className="absolute bottom-1 start-1 bg-card/90 px-1.5 py-0.5 text-xs text-muted-foreground">
              מקודם
            </span>
          </>
        ) : null}
      </div>

      <div className="listing-row-body">
        {/*
         * min-w-0 חיוני: בלעדיו פריט flex לא יורד מתחת לרוחב התוכן שלו,
         * ושורת מפרט ארוכה דוחפת את גוף השורה אל מחוץ לגבולותיה.
         */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-base font-semibold leading-snug">
            {/* הקישור פרוס על כל השורה כדי להגדיל את שטח הלחיצה */}
            <ViewTransitionLink
              href={`/item/${listing.slug}`}
              className="outline-none after:absolute after:inset-0"
            >
              <BidiText>{listing.title}</BidiText>
            </ViewTransitionLink>
          </h3>

          {/*
           * שדה שלא נכנס יורד כולו, ולא נחתך.
           *
           * `.num` מבודד את המספר ל-LTR, וחיתוך בקצה השורה ב-RTL אוכל
           * דווקא את הספרות המובילות — "417,851 ק\"מ" הופך ל-"7,851
           * ק\"מ", מספר שגוי שנראה תקין לחלוטין. כמה שדות מוצגים נקבע
           * ברוחב המכל (`globals.css`), והפריטים עצמם לעולם לא מתכווצים.
           */}
          {listing.highlights.length ? (
            <ul className="listing-row-specs flex items-center gap-x-1.5 overflow-hidden text-xs text-muted-foreground">
              {listing.highlights.map((h, i) => (
                <li
                  key={h.key}
                  className={cn(
                    "flex items-center gap-1.5",
                    // ערך עם ספרות לעולם אינו מתכווץ; טקסט מתקצר במקומו
                    /\d/.test(h.value) ? "shrink-0" : "min-w-0 truncate",
                  )}
                >
                  {i > 0 ? <span aria-hidden>·</span> : null}
                  <span className="num">{h.value}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="truncate text-xs text-muted-foreground/75">
            {listing.city}
            {listing.neighborhood ? `, ${listing.neighborhood}` : ""}
            {" · "}
            <time dateTime={listing.date}>{timeAgo(listing.date)}</time>
          </p>
        </div>

        {/*
         * טור הקריאה. הסקאלה יושבת מתחת למחיר ולא לצידו — היא קוראת את
         * המספר שמעליה, ומיקום המחוג בשורה הבאה נמדד מול אותו קו בדיוק.
         */}
        <div className="listing-row-readout flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="num text-lg font-medium leading-none text-foreground">
              {formatPrice(listing.price, { currency: listing.currency })}
            </p>
            <PriceGauge meter={listing.priceMeter} className="mt-1.5" />
          </div>

          {/* מיקום קבוע בכל השורות — העין לומדת איפה הלב נמצא */}
          <div className="relative z-10 shrink-0">
            <FavoriteButton listingId={listing.id} />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * שלד טעינה במידות המדויקות של השורה האמיתית.
 * כל סטייה כאן מתורגמת ישירות ל-CLS כשהתוכן מגיע.
 */
export function ListingCardSkeleton({ density = "full" }: { density?: Density }) {
  const compact = density === "compact";
  return (
    <div data-density={density} className="listing-row flex" aria-hidden>
      <div
        className={cn(
          "listing-row-media aspect-[4/3] animate-pulse bg-muted",
          compact && "!w-24",
        )}
      />
      <div className="listing-row-body">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-2/3 animate-pulse bg-muted" />
          <div className="h-3 w-1/2 animate-pulse bg-muted" />
          <div className="h-3 w-2/5 animate-pulse bg-muted" />
        </div>
        <div className="listing-row-readout">
          <div className="h-5 w-24 animate-pulse bg-muted" />
          <div className="mt-2 h-3 w-full animate-pulse bg-muted" />
        </div>
      </div>
    </div>
  );
}
