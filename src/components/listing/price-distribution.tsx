import Link from "next/link";

import { PriceHistogram } from "@/components/valuation/price-histogram";
import { formatCount, formatPrice } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { priceDistributionFor } from "@/lib/price-meter";

/**
 * ההתפלגות המלאה של המחיר בדף המודעה.
 *
 * מד המחיר בכרטיס עונה על "זול או יקר"; כאן נפתחת התשובה המלאה — כמה
 * מודעות השתתפו, איפה יושב החציון, ואיפה בתוך ההתפלגות נמצא המחיר הזה.
 *
 * **כשאין מספיק השוואות הרכיב אינו נעלם.** בכרטיס ברשימה היעדר הפס
 * הוא בסדר — יש עוד עשרים כרטיסים לידו, ואף אחד מהם לא הבטיח כלום.
 * בדף המודעה זה מסך ההחלטה, והשאלה היחידה שהביאה לכאן היא "המחיר
 * הזה הגיוני?". שתיקה שם אינה ניטרלית: היא נקראת כאילו ללוח אין את
 * הפיצ'ר, בדיוק בדף שבו הוא הבידול היחיד.
 *
 * לכן מוצגת אמירה מפורשת — מה חסר, למה, ולאן להמשיך.
 */
export async function PriceDistribution({
  listingId,
  price,
  currency = "ILS",
}: {
  listingId: string;
  price: number | null;
  currency?: string;
}) {
  const dist = await priceDistributionFor(listingId);

  // מודעה בלי מחיר (מבקש הצעה) — אין שאלה שאפשר לענות עליה
  if (price === null) return null;

  if (!dist) {
    return (
      <section
        aria-labelledby="price-distribution-heading"
        className="rounded-lg border border-border bg-card p-5"
      >
        <h2 id="price-distribution-heading" className="font-heading text-lg font-bold">
          המחיר ביחס למודעות דומות
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          עוד אין מספיק מודעות דומות פעילות כדי לתת קריאה שאפשר לסמוך עליה.
          עדיף בלי מספר מאשר מספר שיטעה.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href={pricePaths.valuation}
            className="text-info underline underline-offset-2"
          >
            להערכת שווי לפי מאפיינים
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link
            href={pricePaths.guideIndex}
            className="text-info underline underline-offset-2"
          >
            למחירון
          </Link>
        </p>
      </section>
    );
  }

  const below = dist.deltaPct < 0;
  const magnitude = Math.abs(dist.deltaPct);

  return (
    <section
      aria-labelledby="price-distribution-heading"
      className="rounded-lg border border-border bg-card p-5"
    >
      <h2 id="price-distribution-heading" className="font-heading text-lg font-bold">
        המחיר ביחס למודעות דומות
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        {magnitude < 3 ? (
          <>
            המחיר נמצא בסביבת החציון של{" "}
            <span className="num">{formatCount(dist.sample)}</span> מודעות דומות.
          </>
        ) : (
          <>
            <span className={below ? "font-medium text-primary" : "font-medium text-foreground"}>
              <span className="num">{magnitude}%</span> {below ? "מתחת" : "מעל"} החציון
            </span>{" "}
            של <span className="num">{formatCount(dist.sample)}</span> מודעות דומות, שעומד
            על <span className="num">{formatPrice(dist.median, { currency })}</span>.
          </>
        )}
      </p>

      <PriceHistogram
        buckets={dist.buckets}
        median={dist.median}
        price={price}
        currency={currency}
        scrollReveal
        className="mt-4"
      />

      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <dt className="text-xs text-muted-foreground">רבעון תחתון</dt>
          <dd className="num text-sm font-semibold">
            {formatPrice(dist.p25, { currency })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">חציון</dt>
          <dd className="num text-sm font-semibold">
            {formatPrice(dist.median, { currency })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">רבעון עליון</dt>
          <dd className="num text-sm font-semibold">
            {formatPrice(dist.p75, { currency })}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        ההשוואה היא מול מודעות פעילות באותה תת-קטגוריה ובטווח הקרוב של שנת הייצור או מספר
        החדרים.{" "}
        {/*
         * קו תחתון קבוע ולא רק בריחוף: קישור בתוך פסקה שנבדל בצבע
         * בלבד אינו נראה כקישור למי שאינו מבחין בגוון הזה, וזה בדיוק
         * מה ש-link-in-text-block בודק.
         */}
        <Link href={pricePaths.valuation} className="text-info underline underline-offset-2">
          בדיקת שווי לפריט משלך
        </Link>
      </p>
    </section>
  );
}
