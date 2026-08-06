"use client";

import { BidiText } from "@/components/bidi-text";
import { ViewTransitionLink } from "@/components/view-transition-link";

import { FavoriteButton } from "@/components/listing/favorite-button";
import { ListingImage } from "@/components/listing/listing-image";
import { PriceMeter } from "@/components/listing/price-meter";
import { listingImageTransition } from "@/lib/view-transitions";
import type { ListingCardDto } from "@/lib/listing-dto";
import { formatPrice } from "@/lib/format";
import { priceLabel, priceSuffix } from "@/lib/price-kind";
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
 *
 * **הכרטיס מגיב למכל שלו ולא לחלון.** אותו רכיב עובד בגריד, בסיידבר,
 * ברצועת "נצפו לאחרונה" ובחלונית של המפה בלי prop שמסביר לו איפה הוא
 * נמצא — נקודות השבירה יושבות ב-`@container` (ראה `globals.css`).
 * `density` נשאר prop כי הוא כוונה של המשתמש ולא מידה של המכל.
 */
export function ListingCard({ listing, density = "grid", priority = false, className }: Props) {
  const isList = density === "list";

  /*
   * שער יחיד לשורת המפרט: רק שדות שיש להם צורה עצמאית עוברים אותו.
   * מקור הנתונים כבר מסנן, וזו השכבה שמבטיחה שגם אם יפסיק — הכרטיס
   * לא יציג "אין" בלי לומר של מה.
   */
  const standalone = listing.highlights
    .filter((h) => h.standalone !== null)
    .map((h) => ({ key: h.key, text: h.standalone as string }));

  return (
    <article
      data-density={density}
      className={cn(
        "listing-card group relative overflow-hidden border border-border bg-card",
        // אין כאן צל: ההיענות היא הארה של המשטח, כמו שורה שנבחרת במכשיר
        "transition-colors duration-ui ease-ui focus-within:ring-2 focus-within:ring-ring hover:bg-secondary",
        isList && "flex flex-wrap items-stretch",
        className,
      )}
    >
      <div
        className={cn(
          "listing-card-media relative shrink-0",
          // הרוחב בשורת רשימה גדל דרך שאילתת מכל, לא לפי רוחב החלון
          isList ? "w-32" : "w-full",
        )}
      >
        <ListingImage
          src={listing.imageUrl}
          blurDataURL={listing.blurDataURL}
          categoryIcon={listing.categoryIcon}
          sizes={isList ? "176px" : "(max-width: 640px) 50vw, 300px"}
          priority={priority}
          viewTransitionName={listingImageTransition(listing.id)}
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

      {/*
       * min-w-0 חיוני: בלעדיו פריט flex לא יורד מתחת לרוחב התוכן שלו,
       * ושורת מפרט ארוכה ("יד חמישית ומעלה · 417,851 ק\"מ") דחפה את
       * גוף הכרטיס אל מחוץ לגבולותיו במקום להיחתך.
       */}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1 p-3", isList && "justify-center")}>
        {/*
         * `.num` יושב על ה-span ולא על ה-`<p>`.
         *
         * המחלקה מחילה `direction: ltr`, ועל הפסקה עצמה היא גררה גם את
         * היישור: המחיר נצמד לשמאל בעוד הכותרת שמתחתיו נצמדת לימין,
         * ובשורת קריאה רחבה הם נראו כשני טורים שונים. הבידוד נדרש למספר
         * בלבד — לא לשורה שמכילה אותו.
         */}
        {/*
         * המספר נקרא אחרת לפי מה שהוא. שכר ושווי עסק מקבלים תווית
         * מעליהם ומשקל קל יותר — הם אינם מחיר של מוצר, והצגתם באותה
         * טיפוגרפיה בדיוק היא מה שגרם ל-₪16,854 על משרה להיראות כמו
         * מחיר של אופנוע.
         */}
        <p className="listing-card-price leading-none text-foreground">
          {priceLabel(listing.priceKind) ? (
            <span className="me-1.5 align-middle text-[0.6875rem] font-medium uppercase text-muted-foreground">
              {priceLabel(listing.priceKind)}
            </span>
          ) : null}
          <span
            className={cn(
              "num align-middle",
              priceLabel(listing.priceKind) ? "text-base font-medium" : "text-lg font-medium",
            )}
          >
            {formatPrice(listing.price, { currency: listing.currency })}
          </span>
          {priceSuffix(listing.priceKind) ? (
            <span className="ms-1 align-middle text-xs font-normal text-muted-foreground">
              {priceSuffix(listing.priceKind)}
            </span>
          ) : null}
        </p>

        {/*
         * בגריד הסקאלה יושבת מתחת למחיר; בשורת קריאה היא עוברת לעמודה
         * משלה בקצה השורה (למטה). היא לא מרונדרת פעמיים — רק במקום אחד
         * מבין השניים, אחרת היו שני `role="img"` עם אותו תיאור.
         */}
        {isList ? null : <PriceMeter meter={listing.priceMeter} />}

        <h3 className="truncate text-base font-semibold leading-snug">
          {/* הקישור פרוס על כל הכרטיס כדי להגדיל את שטח הלחיצה */}
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
         * חיתוך של פריט באמצע הוא לא רק מכוער כאן: `.num` מבודד את
         * המספר ל-LTR, וחיתוך בקצה השורה ב-RTL אוכל דווקא את הספרות
         * המובילות — "417,851 ק\"מ" הופך ל-"7,851 ק\"מ", מספר שגוי
         * שנראה תקין לחלוטין. כמה שדות מוצגים נקבע ברוחב המכל
         * (`globals.css`), והפריטים עצמם לעולם לא מתכווצים.
         */}
        {/*
         * אכיפה, לא סינון נקודתי: הכרטיס מרנדר **רק** ערכים שיש להם
         * צורה עצמאית. שדה בלי תווית שמשמעותו תלויה בתווית ("יש",
         * "אין", "₪120,000") לא יגיע לכאן גם אם מישהו יוסיף אותו
         * למקור הנתונים בעתיד.
         */}
        {standalone.length ? (
          <ul className="listing-card-specs flex items-center gap-x-1.5 overflow-hidden text-xs text-muted-foreground">
            {standalone.map((h, i) => (
              <li
                key={h.key}
                className={cn(
                  "flex items-center gap-1.5",
                  // ערך עם ספרות לעולם אינו מתכווץ; טקסט מתקצר במקומו
                  /\d/.test(h.text) ? "shrink-0" : "min-w-0 truncate",
                )}
              >
                {i > 0 ? <span aria-hidden>·</span> : null}
                <span className="num">{h.text}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/*
         * בלי `/70`. שקיפות על טקסט שכבר משני מורידה את הניגודיות מתחת
         * ל-AA — Lighthouse סימן בדיוק את השורה הזו. ההיררכיה בין שורת
         * המפרט לשורת המיקום נשמרת בצבע הטוקן עצמו, בלי לרדת מהסף.
         */}
        <p className="listing-card-meta mt-auto truncate pt-0.5 text-xs text-muted-foreground">
          {listing.city}
          {listing.neighborhood ? `, ${listing.neighborhood}` : ""}
          {" · "}
          <time dateTime={listing.date}>{timeAgo(listing.date)}</time>
        </p>
      </div>

      {/*
       * עמודת הקריאה — הצד שהופך שורה ברשימה לשורה במכשיר.
       *
       * היא מרונדרת רק כשיש מה לקרוא. הרכיב עצמו כבר מחזיר null בלי
       * מדגם, אבל עמודה ריקה ברוחב 12rem הייתה משאירה חור בשורה, ולכן
       * ההחלטה נופלת כאן ולא רק בפנים.
       *
       * ברוחב מכל קטן העמודה עוברת לשורה משלה מתחת (ראה `globals.css`).
       * זו הסיבה שהמאמר הוא `flex-wrap` ולא `flex` — ולא כדי לעטוף תוכן.
       */}
      {isList ? (
        <div className="listing-card-scale flex shrink-0 flex-col justify-center border-s border-border p-3">
          <PriceMeter meter={listing.priceMeter} variant="column" />
        </div>
      ) : null}
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
      data-density={density}
      className={cn(
        "listing-card overflow-hidden rounded-lg border border-border bg-card",
        isList && "flex",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "listing-card-media aspect-[4/3] shrink-0 animate-pulse bg-muted",
          isList ? "w-32" : "w-full",
        )}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1 p-3", isList && "justify-center")}>
        <div className="h-5 w-24 animate-pulse rounded-sm bg-muted" />
        <div className="mt-1 h-4 w-full animate-pulse rounded-sm bg-muted" />
        <div className="mt-1 h-3 w-2/3 animate-pulse rounded-sm bg-muted" />
        <div className="mt-auto h-3 w-1/2 animate-pulse rounded-sm bg-muted" />
      </div>
    </div>
  );
}
